import { NextResponse } from "next/server";

export function enforceSameOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const host = req.headers.get("host");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const fetchSite = req.headers.get("sec-fetch-site");

  if (fetchSite === "same-origin" || fetchSite === "same-site") {
    return null;
  }

  if (host && origin) {
    try {
      if (new URL(origin).host === host) return null;
    } catch {}
  }

  if (host && referer) {
    try {
      if (new URL(referer).host === host) return null;
    } catch {}
  }

  return NextResponse.json(
    { success: false, message: "CSRF blocked" },
    { status: 403 }
  );
}
