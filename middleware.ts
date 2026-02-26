import { NextResponse, NextRequest } from "next/server";

// Быстрый путь: читаем id из httpOnly куки без похода к API
const SESSION_COOKIE = 'session_user_id';
const SESSION_TOKEN_COOKIE = 'session_token';
function readUserFast(request: NextRequest) {
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
      console.log("[middleware] auth fetch error:", error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/liza");
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
    // базовые заголовки безопасности
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
    // HSTS только для https
    if (request.nextUrl.protocol === "https:") {
      res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
    // CSP (мягкая, чтобы не ломать существующие инлайн-стили/скрипты)
    res.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "img-src 'self' https: data:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' https: data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join("; ")
    );
    return res;
  };

  const needUserFor = pathname.startsWith('/user') || pathname === "/verify-email" || isAdminArea;

  // В middleware полагаемся только на httpOnly cookie, чтобы не дергать API и не ловить fetch failed
  const hasSessionToken = Boolean(request.cookies.get(SESSION_TOKEN_COOKIE)?.value);
  const fastUser = needUserFor ? readUserFast(request) : null;
  const user = needUserFor
    ? (fastUser ?? (hasSessionToken ? await fetchUser(request) : null))
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
      if (!ok || ok !== String(user.id)) {
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
    "/user/:path*",
    "/register",
    "/login",
    "/verify-phone",
  ],
};
