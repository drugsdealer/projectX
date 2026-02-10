import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { clearSessionTokenOnResponse, setSessionOnResponse, setSessionTokenOnResponse } from "../../_utils/session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isAdminEmail } from "@/lib/admin-emails";
import { randomBytes } from "crypto";

const parseUserAgentInfo = (
  uaRaw: string | null,
  chPlatform: string | null,
  chMobile: string | null
) => {
  const ua = (uaRaw || "").toLowerCase();
  const platformHint = (chPlatform || "").replace(/\"/g, "").toLowerCase();
  const mobileHint = (chMobile || "").toLowerCase().includes("?1");
  const isIOS = platformHint.includes("ios") || /iphone|ipad|ipod/.test(ua);
  const isAndroid = platformHint.includes("android") || /android/.test(ua);
  const isMac = platformHint.includes("macos") || /macintosh|mac os x/.test(ua);
  const isWindows = platformHint.includes("windows") || /windows nt/.test(ua);
  const isLinux = /linux/.test(ua) && !isAndroid;

  const os = isIOS
    ? "iOS"
    : isAndroid
      ? "Android"
      : isWindows
        ? "Windows"
        : isMac
          ? "macOS"
          : isLinux
            ? "Linux"
            : "Unknown";

  const device = isIOS || isAndroid
    ? "Mobile"
    : /tablet|ipad/.test(ua)
      ? "Tablet"
      : mobileHint
        ? "Mobile"
        : "Desktop";

  return { os, device };
};

const pickClientIp = (req: Request, fallback?: string) => {
  const h = req.headers;
  const xf = h.get("x-forwarded-for") || h.get("x-real-ip") || h.get("x-vercel-forwarded-for");
  const cf = h.get("cf-connecting-ip");
  const raw = (xf || cf || fallback || "").split(",")[0].trim();
  return raw || undefined;
};

const pickGeo = (req: Request) => {
  const h = req.headers;
  const city =
    h.get("x-vercel-ip-city") ||
    h.get("x-ip-city") ||
    h.get("x-geo-city") ||
    h.get("cf-ipcity") ||
    undefined;
  const country =
    h.get("x-vercel-ip-country") ||
    h.get("x-ip-country") ||
    h.get("x-geo-country") ||
    h.get("cf-ipcountry") ||
    undefined;
  return { city, country };
};

const isPublicIp = (ip?: string) => {
  if (!ip) return false;
  const v = ip.toLowerCase();
  if (v === "::1" || v === "127.0.0.1") return false;
  if (v.startsWith("10.") || v.startsWith("192.168.")) return false;
  if (v.startsWith("172.")) {
    const parts = v.split(".");
    const second = Number(parts[1]);
    if (second >= 16 && second <= 31) return false;
  }
  return true;
};

const geoByIp = async (ip?: string) => {
  if (!isPublicIp(ip)) return { city: undefined, country: undefined };
  const base = process.env.GEOIP_API_URL || "https://ipapi.co";
  const key = process.env.GEOIP_API_KEY || "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const url = key
      ? `${base}/${encodeURIComponent(ip || "")}/json/?key=${encodeURIComponent(key)}`
      : `${base}/${encodeURIComponent(ip || "")}/json/`;
    const res = await fetch(url, { signal: controller.signal });
    const data: any = await res.json().catch(() => ({}));
    const city = data?.city || data?.region || data?.regionName || undefined;
    const country = data?.country_name || data?.country || data?.countryCode || undefined;
    return { city, country };
  } catch {
    return { city: undefined, country: undefined };
  } finally {
    clearTimeout(timeout);
  }
};

function ok(data: any, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}
function bad(message = "Bad Request", init = 400) {
  return NextResponse.json({ success: false, message }, { status: init });
}

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return bad("Некорректный email");
    }
    if (!/^\d{6}$/.test(code ?? "")) {
      return bad("Код должен состоять из 6 цифр");
    }

    const ip = getClientIp(req);
    const ipLimit = await rateLimit(`verify-email:ip:${ip}`, 20, 10 * 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много попыток. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
      );
    }

    // Normalize email to match the storage key
    const normalizedEmail = email.trim().toLowerCase();
    const emailLimit = await rateLimit(`verify-email:email:${normalizedEmail}`, 10, 10 * 60_000);
    if (!emailLimit.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много попыток. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter) } }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!existingUser) {
      return bad("Пользователь не найден", 404);
    }

    // уже подтвержден — сразу создаём сессию
    if (existingUser.verified && existingUser.verified.getTime() > 0) {
      const res = NextResponse.json({
        success: true,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          verified: existingUser.verified,
          fullName: existingUser.fullName ?? "",
          role: existingUser.role,
        },
      });
      setSessionOnResponse(res, existingUser.id);
      try {
        const ipAddr = pickClientIp(req, ip || undefined);
        let { city, country } = pickGeo(req);
        const ua = req.headers.get("user-agent") || "";
        const parsed = parseUserAgentInfo(
          ua,
          req.headers.get("sec-ch-ua-platform"),
          req.headers.get("sec-ch-ua-mobile")
        );
        if (!city && !country) {
          const geo = await geoByIp(ipAddr);
          city = geo.city || city;
          country = geo.country || country;
        }
        const sessionToken = randomBytes(32).toString("hex");
        const hasAny = await prisma.userSession.findFirst({
          where: { userId: existingUser.id },
          select: { id: true },
        });
        await prisma.userSession.create({
          data: {
            userId: existingUser.id,
            token: sessionToken,
            isPrimary: !hasAny,
            ip: ipAddr,
            city,
            country,
            device: parsed.device,
            os: parsed.os,
            userAgent: ua.slice(0, 500),
          },
        });
        setSessionTokenOnResponse(res, sessionToken);
      } catch (e) {
        console.warn("[VERIFY] failed to create session:", e);
        clearSessionTokenOnResponse(res);
      }
      res.cookies.set("vfy", "", {
        path: "/",
        expires: new Date(0),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      // UI/helper cookies (non-httpOnly) for client hydration
      res.cookies.set("stage_session", JSON.stringify({
        id: existingUser.id,
        email: existingUser.email,
        fullName: existingUser.fullName ?? "",
        role: existingUser.role,
      }), {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      res.cookies.set("uid", String(existingUser.id), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    const verification = await prisma.verificationCode.findUnique({
      where: { userId: existingUser.id },
    });
    if (!verification || verification.code !== code) {
      return bad("Код не найден или неверен");
    }

    // Срок действия 10 минут
    const isExpired =
      verification.createdAt.getTime() < Date.now() - 10 * 60 * 1000;
    if (isExpired) {
      await prisma.verificationCode.delete({ where: { userId: existingUser.id } }).catch(() => {});
      return bad("Срок действия кода истёк");
    }

    // Отметить пользователя как подтверждённого и создать сессию
    const updatedUser = await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        verified: new Date(),
        updatedAt: new Date(),
        ...(isAdminEmail(normalizedEmail) ? { role: "ADMIN" as any } : {}),
      },
    }).catch(() => null);

    await prisma.verificationCode.delete({ where: { userId: existingUser.id } }).catch(() => {});

    if (!updatedUser) {
      return bad("Пользователь не найден", 404);
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        verified: updatedUser.verified,
        fullName: updatedUser.fullName ?? "",
        role: updatedUser.role,
      },
    });

    setSessionOnResponse(res, updatedUser.id);
    try {
      const ipAddr = pickClientIp(req, ip || undefined);
      let { city, country } = pickGeo(req);
      const ua = req.headers.get("user-agent") || "";
      const parsed = parseUserAgentInfo(
        ua,
        req.headers.get("sec-ch-ua-platform"),
        req.headers.get("sec-ch-ua-mobile")
      );
      if (!city && !country) {
        const geo = await geoByIp(ipAddr);
        city = geo.city || city;
        country = geo.country || country;
      }
      const sessionToken = randomBytes(32).toString("hex");
      const hasAny = await prisma.userSession.findFirst({
        where: { userId: updatedUser.id },
        select: { id: true },
      });
      await prisma.userSession.create({
        data: {
          userId: updatedUser.id,
          token: sessionToken,
          isPrimary: !hasAny,
          ip: ipAddr,
          city,
          country,
          device: parsed.device,
          os: parsed.os,
          userAgent: ua.slice(0, 500),
        },
      });
      setSessionTokenOnResponse(res, sessionToken);
    } catch (e) {
      console.warn("[VERIFY] failed to create session:", e);
      clearSessionTokenOnResponse(res);
    }
    res.cookies.set("vfy", "", { path: "/", expires: new Date(0), httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.cookies.set("stage_session", JSON.stringify({
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName ?? "",
      role: updatedUser.role,
    }), {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.set("uid", String(updatedUser.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (e) {
    console.error("[VERIFY] exception", e);
    return bad("Ошибка проверки. Попробуйте позже.", 500);
  }
}
