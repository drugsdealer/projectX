import { NextResponse, NextRequest } from "next/server";
import { enforceSameOrigin } from "@/lib/security";

// Быстрый путь: читаем id из httpOnly куки без похода к API
const SESSION_COOKIE = 'session_user_id';
const SESSION_TOKEN_COOKIE = 'session_token';
const ADMIN_2FA_SECRET =
  process.env.ADMIN_2FA_HMAC_SECRET ||
  process.env.STAGE_VAULT_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev_2fa_hmac_key" : "");

function hexToBytes(hex: string) {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verify2FACookieInMiddleware(value: string | null, userId: string | number | null | undefined) {
  if (!value || userId == null || !ADMIN_2FA_SECRET) return false;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sigHex = value.slice(dot + 1);
  const parts = payload.split(":");
  if (parts[0] !== "2fa" || parts[1] !== String(userId)) return false;
  const ts = Number(parts[2]);
  if (!Number.isFinite(ts)) return false;
  if (Math.floor(Date.now() / 1000) - ts > 4 * 60 * 60) return false;

  const expectedBytes = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(ADMIN_2FA_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    ),
    new TextEncoder().encode(payload)
  );
  const actual = hexToBytes(sigHex);
  if (!actual) return false;
  return constantTimeEqual(actual, new Uint8Array(expectedBytes));
}

function readUserFast(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return null;
  const id = request.cookies.get(SESSION_COOKIE)?.value || request.cookies.get("uid")?.value;
  return id ? ({ id } as any) : null;
}

async function fetchUser(request: NextRequest) {
  const controller = new AbortController();
  // короче таймаут, чтобы не зависать в middleware
  const timeoutId = setTimeout(() => controller.abort(), 800);

  try {
    const meUrl = new URL("/api/auth/me", request.url);
    const res = await fetch(meUrl.toString(), {
      headers: request.headers.get("cookie")
        ? { cookie: request.headers.get("cookie") as string }
        : {},
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) return null;

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    // поддерживаем разные форматы ответа: { user } ИЛИ { userId }
    return data?.user ?? (data?.userId ? { id: data.userId } : null);
  } catch (error: any) {
    // Игнорируем AbortError (нормален при быстрых переходах)
    if (error?.name !== 'AbortError' && process.env.NODE_ENV === 'development') {
      console.log("[middleware] auth fetch error");
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiPath = pathname.startsWith("/api/");
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/liza");
  const isPrivateApiPath =
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/user") ||
    pathname.startsWith("/api/cart") ||
    pathname.startsWith("/api/order") ||
    pathname.startsWith("/api/checkout") ||
    pathname.startsWith("/api/favorites") ||
    pathname.startsWith("/api/promocodes/save") ||
    pathname.startsWith("/api/promocodes/owned") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/register") ||
    pathname.startsWith("/api/auth/send-email-code") ||
    pathname.startsWith("/api/auth/password-reset") ||
    pathname.startsWith("/api/auth/me") ||
    pathname.startsWith("/api/auth/logout");
  const isPrefetchRequest =
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("x-middleware-prefetch") === "1";
  const accept = request.headers.get("accept") || "";
  const isHtmlNavigation =
    request.method === "GET" &&
    !isPrefetchRequest &&
    (
      request.headers.get("sec-fetch-mode") === "navigate" ||
      request.headers.get("sec-fetch-dest") === "document" ||
      accept.includes("text/html")
    );
  const applySecurityHeaders = (res: NextResponse) => {
    const reqId = request.headers.get("x-request-id") || crypto.randomUUID();
    res.headers.set("X-Request-Id", reqId);
    // базовые заголовки безопасности
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    if (isApiPath) {
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      // приватные API нельзя кэшировать в браузере/прокси
      if (isPrivateApiPath && !res.headers.has("Cache-Control")) {
        res.headers.set("Cache-Control", "private, no-store, max-age=0");
      }
    }
    // HSTS только для https
    if (request.nextUrl.protocol === "https:") {
      res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
    // CSP: unsafe-inline нужен для Next.js inline-скриптов гидрации.
    // In development Next React Refresh uses eval; production keeps it blocked.
    const scriptSrc = [
      "script-src 'self' 'unsafe-inline'",
      process.env.NODE_ENV === "development" ? "'unsafe-eval'" : "",
      "https://mc.yandex.ru",
      "https://mc.yandex.com",
    ].filter(Boolean).join(" ");
    res.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "img-src 'self' https: data: blob:",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' https: data:",
        "connect-src 'self' https://upload.imagekit.io https://ik.imagekit.io https://*.upstash.io https://mc.yandex.ru https://mc.yandex.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; ")
    );
    return res;
  };

  const needUserFor = pathname.startsWith('/user') || pathname === "/verify-email" || isAdminArea;

  // CSRF: для мутаций API с auth cookies принимаем только same-origin/same-site запросы.
  // Исключения: внешние вебхуки/интеграции, где Origin обычно отсутствует.
  if (isApiPath && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    const webhookBypass =
      pathname === "/api/yookassa";
    const cookieHeader = request.headers.get("cookie") || "";
    const hasAuthCookie =
      /(?:^|;\s*)(session_user_id|session_token|auth_session|sid|admin_2fa_ok)=/.test(cookieHeader);
    if (!webhookBypass && hasAuthCookie) {
      const blocked = enforceSameOrigin(request);
      if (blocked) return applySecurityHeaders(blocked);
    }
  }

  // В middleware полагаемся только на httpOnly cookie, чтобы не дергать API и не ловить fetch failed
  const hasSessionToken = Boolean(request.cookies.get(SESSION_TOKEN_COOKIE)?.value);
  const fastUser = needUserFor ? readUserFast(request) : null;
  const user = needUserFor
    ? (
        fastUser ??
        (hasSessionToken
          // Не дергаем БД на обычной странице профиля: короткий timeout мог случайно
          // редиректить живую сессию на главную при сетевом сбое.
          ? (pathname.startsWith("/user") ? ({ id: null } as any) : await fetchUser(request))
          : null)
      )
    : null;
  const vfyCookie = request.cookies.get("vfy")?.value ?? null;

  // Блокируем гостей от /user
  if (pathname.startsWith("/user")) {
    if (!user) {
      const homeUrl = new URL("/", request.url);
      return applySecurityHeaders(NextResponse.redirect(homeUrl));
    }
    // Если маршрут вида /user/{id}, убеждаемся, что id совпадает с сессией
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "user" && parts[1]) {
      const targetId = parts[1];
      if (user.id && String(user.id) !== targetId) {
        const selfUrl = new URL("/user", request.url);
        return applySecurityHeaders(NextResponse.redirect(selfUrl));
      }
    }
  }

  // Блокируем гостей от /admin (роль проверяется в серверных страницах/роутах)
  if (isAdminArea) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
    if (!pathname.startsWith("/admin/2fa") && !pathname.startsWith("/liza/2fa")) {
      const ok = request.cookies.get("admin_2fa_ok")?.value || null;
      const verified2fa = await verify2FACookieInMiddleware(ok, user.id);
      if (!verified2fa) {
        const twofaUrl = new URL("/admin/2fa", request.url);
        return applySecurityHeaders(NextResponse.redirect(twofaUrl));
      }
    }
  }

  // Гейтинг регистрационного флоу
  if (pathname === "/verify-email") {
    // Уже авторизован — не пускаем обратно на подтверждение
    if (user?.id) {
      const profileUrl = new URL("/user", request.url);
      return applySecurityHeaders(NextResponse.redirect(profileUrl));
    }
    // Нет активной сессии верификации — отправляем на регистрацию
    if (!vfyCookie) {
      const regUrl = new URL("/register", request.url);
      return applySecurityHeaders(NextResponse.redirect(regUrl));
    }
  }

  if (pathname === "/register" || pathname === "/login") {
    // Если уже есть активная сессия подтверждения — возвращаем на /verify-email
    if (vfyCookie) {
      const vfyUrl = new URL("/verify-email", request.url);
      vfyUrl.searchParams.set("reason", "active");
      return applySecurityHeaders(NextResponse.redirect(vfyUrl));
    }
  }

  // Блок прямого доступа к /verify-phone если нет куки 'vfy_phone'
  if (pathname === "/verify-phone") {
    const vfyPhone = request.cookies.get("vfy_phone");
    if (!vfyPhone) {
      const homeUrl = new URL("/", request.url);
      return applySecurityHeaders(NextResponse.redirect(homeUrl));
    }
  }

  const shouldClear2fa =
    !isAdminArea &&
    isHtmlNavigation &&
    Boolean(request.cookies.get("admin_2fa_ok")?.value);

  if (shouldClear2fa) {
    const res = NextResponse.next();
    res.cookies.set("admin_2fa_ok", "", { path: "/", maxAge: 0 });
    return applySecurityHeaders(res);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
    "/api/:path*",
    "/user/:path*",
    "/register",
    "/login",
    "/verify-phone",
  ],
};
