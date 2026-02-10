import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { setSessionOnResponse } from "../../_utils/session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;
  const admin = guard.admin;
  if (!admin) {
    return NextResponse.json({ success: false, message: "Admin not found" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const ipLimit = await rateLimit(`admin:impersonate:${ip}`, 10, 60_000);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { success: false, message: "Слишком много запросов. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.userId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, message: "Invalid userId" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  const res = NextResponse.json({ success: true });
  setSessionOnResponse(res, target.id);
  res.cookies.set("admin_impersonator", String(admin.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
