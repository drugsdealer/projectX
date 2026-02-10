import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("admin_2fa_ok", "", { path: "/", maxAge: 0 });
  return res;
}
