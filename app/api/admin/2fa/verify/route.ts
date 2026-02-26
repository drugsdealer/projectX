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
  const code = String(body?.code || "")
    .normalize("NFKC")
    .replace(/[^\d]/g, "")
    .slice(0, 6);
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
  authenticator.options = { step: 30, digits: 6, window: 1 };

  let secret = "";
  try {
    secret = decryptSecret(user.adminTotpSecretEnc);
  } catch (e) {
    console.error("[admin.2fa.verify] decrypt failed", e);
    return NextResponse.json(
      { success: false, message: "Секрет 2FA поврежден. Выполните сброс 2FA." },
      { status: 400 }
    );
  }

  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Неверный код. Проверьте, что время на телефоне выставлено автоматически и попробуйте ещё раз.",
      },
      { status: 400 }
    );
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
