import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";

export const runtime = "nodejs";

function clearCookie(res: NextResponse) {
  res.cookies.set("admin_2fa_ok", "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: false, req });
  if (!guard.ok) return guard.response;

  return clearCookie(NextResponse.json({ success: true }));
}
