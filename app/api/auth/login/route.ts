export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { attachUiCookies, setSessionOnResponse, setSessionTokenOnResponse, setSessionClaimOnResponse } from "../../_utils/session";
import { cookies as nextCookies } from "next/headers";
import { handleApiError } from "@/lib/errors";
import { logAction } from "@/lib/logAction";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
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
  // cf-connecting-ip первым — его нельзя подделать
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim() || undefined;
  const real = h.get("x-real-ip");
  if (real) return real.trim() || undefined;
  const xf = h.get("x-forwarded-for") || h.get("x-vercel-forwarded-for");
  const raw = (xf || fallback || "").split(",")[0].trim();
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

async function createSessionTokenForUser(req: Request, userId: number, fallbackIp?: string) {
  const hdr = req.headers;
  const ipAddr = pickClientIp(req, fallbackIp);
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

  const sessionToken = randomBytes(32).toString("hex");
  const hasAny = await prisma.userSession.findFirst({
    where: { userId },
    select: { id: true },
  });
  await prisma.userSession.create({
    data: {
      userId,
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
  return sessionToken;
}

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
      select: { id: true, email: true, fullName: true, role: true, password: true, verified: true, deletedAt: true },
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

    if (!user.verified || user.verified.getTime() <= 0) {
      return NextResponse.json(
        { success: false, message: "Подтвердите email перед входом", needsVerification: true },
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

    let sessionToken = "";
    try {
      sessionToken = await createSessionTokenForUser(req, user.id, ip || undefined);
    } catch (e) {
      console.error("[LOGIN] failed to create DB session");
      return NextResponse.json(
        { success: false, message: "Не удалось создать сессию. Попробуйте войти ещё раз." },
        { status: 503 }
      );
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      verified: true,
    };

    const res = NextResponse.json(
      { success: true, user: safeUser },
      { status: 200 }
    );

    const isProd = process.env.NODE_ENV === "production";
    // Ставит основную httpOnly куку сессии (session_user_id)
    setSessionOnResponse(res, user.id);
    setSessionTokenOnResponse(res, sessionToken);
    setSessionClaimOnResponse(res, user.id);
    attachUiCookies(res, safeUser);

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
        console.warn("[LOGIN] failed to bind guest orders:");
      }
    }

    try {
      await logAction(user.id, "User", "LOGIN", {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      });
    } catch (e) {
      console.error("[LOGIN] failed to write audit log:");
    }

    return res;
  } catch (error) {
    console.error("[LOGIN] error:");
    return handleApiError(error);
}
}
