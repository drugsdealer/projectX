import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { decryptSecret } from "@/lib/totp";

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: false, req });
  if (!guard.ok) return guard.response;
  const admin = guard.admin;
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = String(body?.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ success: false, message: "Введите 6 цифр" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
      where: { id: admin.id },
    select: { id: true, adminTotpSecretEnc: true },
  });
  if (!user?.adminTotpSecretEnc) {
    return NextResponse.json({ success: false, message: "2FA не настроен" }, { status: 400 });
  }

  const { authenticator } = await import("otplib");
  const secret = decryptSecret(user.adminTotpSecretEnc);
  const ok = authenticator.check(code, secret);
  if (!ok) {
    return NextResponse.json({ success: false, message: "Неверный код" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { adminTotpEnabled: true },
  });

  const res = NextResponse.json({ success: true });
  res.cookies.set("admin_2fa_ok", String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}
