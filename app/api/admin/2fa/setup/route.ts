import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { encryptSecret, decryptSecret } from "@/lib/totp";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: false, req });
  if (!guard.ok) return guard.response;
  const admin = guard.admin;
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { id: true, email: true, adminTotpSecretEnc: true, adminTotpEnabled: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  const { authenticator } = await import("otplib");
  authenticator.options = { step: 30, digits: 6, window: 1 };
  const issuer = "StageStore Admin";
  const { default: QRCode } = await import("qrcode");

  if (user.adminTotpSecretEnc) {
    // Если 2FA уже включен — QR не показываем (можно сбросить отдельно)
    if (user.adminTotpEnabled) {
      return NextResponse.json({
        success: true,
        alreadySetup: true,
        adminTotpEnabled: true,
      });
    }
    // Если секрет есть, но не подтверждён — покажем QR повторно
    try {
      const secret = decryptSecret(user.adminTotpSecretEnc);
      const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
      const qr = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
      return NextResponse.json({
        success: true,
        alreadySetup: true,
        adminTotpEnabled: false,
        otpauthUrl,
        qr,
      });
    } catch {
      // Если секрет поврежден — пересоздадим
    }
  }

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
  const qr = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      adminTotpSecretEnc: encryptSecret(secret),
      adminTotpEnabled: false,
    },
  });

  return NextResponse.json({
    success: true,
    alreadySetup: false,
    otpauthUrl,
    qr,
  });
}
