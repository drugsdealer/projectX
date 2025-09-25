import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthenticated = Boolean(req.cookies.get("sid")?.value);

  const protectedRoutes = ["/verify-email", "/register", "/login"];
  const restrictedRoutes = ["/profile"];

  if (protectedRoutes.includes(pathname) && isAuthenticated) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Redirecting authenticated user from ${pathname} to /profile`);
    }
    return NextResponse.redirect(new URL("/profile", req.url));
  }

  if (restrictedRoutes.includes(pathname) && !isAuthenticated) {
    if (process.env.NODE_ENV === "development") {
      console.log(`Redirecting unauthenticated user from ${pathname} to /login`);
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/verify-email", "/register", "/login", "/profile"],
};
