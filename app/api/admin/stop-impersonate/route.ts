import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { setSessionOnResponse } from "../../_utils/session";
import { enforceSameOrigin } from "@/lib/security";

export async function POST(req: Request) {
  const csrf = enforceSameOrigin(req);
  if (csrf) return csrf;

  const jar: any = cookies() as any;
  const c = typeof jar?.then === "function" ? await jar : jar;
  const adminIdRaw = c.get("admin_impersonator")?.value || null;
  const adminId = Number(adminIdRaw);

  if (!adminIdRaw || !Number.isFinite(adminId)) {
    return NextResponse.json({ success: false, message: "Not impersonating" }, { status: 400 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, role: true },
  });
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Invalid admin" }, { status: 403 });
  }

  const res = NextResponse.json({ success: true });
  setSessionOnResponse(res, admin.id);
  res.cookies.set("admin_impersonator", "", { path: "/", maxAge: 0 });
  return res;
}
