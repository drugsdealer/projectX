import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";

export const runtime = "nodejs";

function clearCookie(res: NextResponse) {
  res.cookies.set("admin_2fa_ok", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: Request) {
  // GET is used by the "На сайт" link in admin layout: /api/admin/2fa/clear?next=/
  const guard = await requireAdminApi({ require2FA: false, req });
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/";
  // Only allow relative redirects to prevent open-redirect
  const safeDest = next.startsWith("/") ? next : "/";
  const res = NextResponse.redirect(new URL(safeDest, req.url));
  return clearCookie(res);
}

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: false, req });
  if (!guard.ok) return guard.response;

  return clearCookie(NextResponse.json({ success: true }));
}
