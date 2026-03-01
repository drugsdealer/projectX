export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { clearSessionTokenOnResponse, setSessionOnResponse, setSessionTokenOnResponse } from "../../_utils/session";
import { cookies as nextCookies } from "next/headers";
import { handleApiError } from "@/lib/errors";
import { logAction } from "@/lib/logAction";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isAdminEmail } from "@/lib/admin-emails";
import { randomBytes } from "crypto";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";

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

  const vendor = isIOS ? "Apple" : isAndroid ? "Android" : isWindows ? "Windows" : isMac ? "Apple" : "Other";

  return { os, device, vendor };
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

// Логин по email+password. Ставит httpOnly куку `session_user_id`,
// которую читает твой getSessionUserId() / getUserIdFromRequest().
export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;
    const jsonBlocked = requireJsonRequest(req);
    if (jsonBlocked) return jsonBlocked;

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    const ip = getClientIp(req);
    const ipLimit = await rateLimit(`login:ip:${ip}`, 12, 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много попыток входа. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
      );
    }

    // Пробуем вытащить гостевой токен заказа из кук (если пользователь оформлял без авторизации)
    const cookieStore = await nextCookies();
    // NB: In Next 15 cookies()/headers() are async; we already awaited it above.
    // Read potential guest order token created during checkout-as-guest.
    const guestToken =
      cookieStore.get("orderToken")?.value ??
      cookieStore.get("order_token")?.value ??
      null;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Введите email и пароль" },
        { status: 400 }
      );
    }

    const emailLimit = await rateLimit(`login:email:${email}`, 6, 10 * 60_000);
    if (!emailLimit.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много попыток входа. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter) } }
      );
    }

    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true, role: true, password: true, deletedAt: true },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, message: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    if (user.deletedAt) {
      return NextResponse.json(
        { success: false, message: "Профиль деактивирован" },
        { status: 403 }
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { success: false, message: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    if (isAdminEmail(user.email) && user.role !== "ADMIN") {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" as any },
        select: { id: true, email: true, fullName: true, role: true, password: true, deletedAt: true },
      }).catch(() => null);
      if (updated) user = updated;
    }

    const res = NextResponse.json(
      { success: true, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } },
      { status: 200 }
    );

    const isProd = process.env.NODE_ENV === "production";
    // Ставит основную httpOnly куку сессии (session_user_id)
    setSessionOnResponse(res, user.id);

    // Доп. не-httpOnly кука для клиентского UI (по желанию)
    res.cookies.set("stage_session", JSON.stringify({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    }), {
      httpOnly: false,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    // Совместимость: часть кода читает `uid`. Дублируем id в эту куку.
    res.cookies.set("uid", String(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    // Если есть гостевой токен заказа — привяжем все такие заказы к пользователю и очистим токен
    if (guestToken) {
      try {
        await prisma.order.updateMany({
          where: { token: guestToken, userId: null },
          data: { userId: user.id },
        });
        // Чистим гостевой токен, чтобы не мешал истории
        res.cookies.set("orderToken", "", { path: "/", maxAge: 0 });
        res.cookies.set("order_token", "", { path: "/", maxAge: 0 });
      } catch (e) {
        console.warn("[LOGIN] failed to bind guest orders:", e);
      }
    }

    try {
      await logAction(user.id, "User", "LOGIN", {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      });
    } catch (e) {
      console.error("[LOGIN] failed to write audit log:", e);
    }

    let sessionMeta: {
      ipAddr?: string;
      city?: string;
      country?: string;
      device?: string;
      os?: string;
      ua?: string;
    } = {};
    try {
      const hdr = req.headers;
      const ipAddr = pickClientIp(req, ip || undefined);
      let { city, country } = pickGeo(req);
      const ua = hdr.get("user-agent") || "";
      const parsed = parseUserAgentInfo(
        ua,
        hdr.get("sec-ch-ua-platform"),
        hdr.get("sec-ch-ua-mobile")
      );
      if (!city && !country) {
        const geo = await geoByIp(ipAddr);
        city = geo.city || city;
        country = geo.country || country;
      }
      sessionMeta = { ipAddr, city, country, device: parsed.device, os: parsed.os, ua };
    } catch (e) {
      console.warn("[LOGIN] failed to parse session meta:", e);
    }

    try {
      const sessionToken = randomBytes(32).toString("hex");
      const hasAny = await prisma.userSession.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: sessionToken,
          isPrimary: !hasAny,
          ip: sessionMeta.ipAddr,
          city: sessionMeta.city,
          country: sessionMeta.country,
          device: sessionMeta.device,
          os: sessionMeta.os,
          userAgent: sessionMeta.ua?.slice(0, 500),
        },
      });
      setSessionTokenOnResponse(res, sessionToken);
    } catch (e) {
      console.warn("[LOGIN] failed to create session:", e);
      clearSessionTokenOnResponse(res);
    }

    return res;
  } catch (error) {
    console.error("[LOGIN] error:", error);
    return handleApiError(error);
}
}
