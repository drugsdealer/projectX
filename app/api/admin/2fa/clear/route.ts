import { NextResponse } from "next/server";

export const runtime = "nodejs";

function clearCookie(res: NextResponse) {
  res.cookies.set("admin_2fa_ok", "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST() {
  return clearCookie(NextResponse.json({ success: true }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") ? next : "/";
  const res = NextResponse.redirect(new URL(safeNext, url.origin));
  return clearCookie(res);
}

export async function HEAD() {
  const res = NextResponse.json({ success: true });
  return clearCookie(res);
}
