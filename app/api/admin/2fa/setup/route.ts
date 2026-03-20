import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { encryptSecret, decryptSecret } from "@/lib/totp";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`2fa-setup:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false }, { status: 429 });
  }

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
    // Всегда пробуем расшифровать секрет.
    // Если ключ на сервере поменялся/секрет битый — пересоздадим ниже.
    try {
      const secret = decryptSecret(user.adminTotpSecretEnc);
      // Если 2FA уже включен и секрет валиден — QR не показываем.
      if (user.adminTotpEnabled) {
        return NextResponse.json({
          success: true,
          alreadySetup: true,
          adminTotpEnabled: true,
        });
      }
      // Если секрет есть, но не подтверждён — показываем QR повторно.
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
      // Если секрет поврежден — пересоздаём и просим подтвердить заново.
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
