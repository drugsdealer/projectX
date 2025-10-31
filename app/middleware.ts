import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static files and Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|map)$/)
  ) {
    return NextResponse.next();
  }

  // Жёсткая серверная сессия — единственный источник правды об авторизации.
  const hasSession = Boolean(req.cookies.get('sid')?.value);
  const isAuthenticated = hasSession;

  if (process.env.NODE_ENV === 'development') {
    const hasUiProfile = Boolean(req.cookies.get('ui_user_data')?.value);
    console.log('[mw] Cookies:', {
      hasSid: hasSession,
      hasUiProfile,
      isAuthenticated,
      path: pathname,
    });
  }

  const isAuthPages = (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/verify-email'
  );

  const isProfileArea = (
    pathname === '/profile' || pathname.startsWith('/profile/')
  );

  // Если уже авторизован — редиректим с auth-страниц в профиль
  if (isAuthPages && isAuthenticated) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[mw] Authenticated user on ${pathname} → /profile`);
    }
    return NextResponse.redirect(new URL('/profile', req.url));
  }

  // Если не авторизован — можно пускать в профиль при наличии soft UI профиля,
  // иначе — отправляем на логин.
  if (isProfileArea && !isAuthenticated) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[mw] Unauthenticated to ${pathname} — redirect to /login`);
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Защита /admin
  if (pathname.startsWith('/admin')) {
    const sessionToken = req.cookies.get('sid')?.value;
    const rawUiUserData = req.cookies.get('ui_user_data')?.value;
    let isAdmin = false;

    if (rawUiUserData) {
      try {
        const parsed = JSON.parse(rawUiUserData);
        isAdmin = parsed.role === 'ADMIN';
      } catch (e) {
        console.warn('[mw] Failed to parse ui_user_data:', e);
      }
    }

    if (!sessionToken || !isAdmin) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[mw] Non-admin trying to access ${pathname} — redirect to /unauthorized`);
      }
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/register',
    '/verify-email',
    '/profile',
    '/profile/:path*',
    '/admin',
    '/admin/:path*',
  ],
};
