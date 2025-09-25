import { NextResponse, NextRequest } from "next/server";

async function fetchUser(request: NextRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const meUrl = new URL("/api/auth/me", request.url);
    const res = await fetch(meUrl.toString(), {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.user || null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.log("Auth fetch error:", error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await fetchUser(request);

  // Block guests from /user
  if (pathname.startsWith("/user")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Block authenticated users from /register and /login
  if (pathname === "/register" || pathname === "/login") {
    if (user) {
      const userUrl = new URL("/user", request.url);
      return NextResponse.redirect(userUrl);
    }
  }

  // Block direct access to /verify-email unless cookie 'vfy' is present
  if (pathname === "/verify-email") {
    const vfy = request.cookies.get("vfy");
    if (!vfy) {
      const homeUrl = new URL("/", request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // Block direct access to /verify-phone unless cookie 'vfy_phone' is present
  if (pathname === "/verify-phone") {
    const vfyPhone = request.cookies.get("vfy_phone");
    if (!vfyPhone) {
      const homeUrl = new URL("/", request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/user/:path*", "/register", "/login", "/verify-email", "/verify-phone"],
};
