import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { encryptSecret } from "@/lib/totp";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`2fa-reset:${ip}`, 3, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false }, { status: 429 });
  }

  if (process.env.ALLOW_2FA_RESET !== "true") {
    return NextResponse.json({ success: false, message: "Запрещено" }, { status: 403 });
  }
  const guard = await requireAdminApi({ require2FA: false, req });
  if (!guard.ok) return guard.response;
  const admin = guard.admin;
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  const { authenticator } = await import("otplib");
  authenticator.options = { step: 30, digits: 6, window: 1 };
  const secret = authenticator.generateSecret();
  const issuer = "StageStore Admin";
  const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
  const { default: QRCode } = await import("qrcode");
  const qr = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });

  await prisma.user.update({
    where: { id: user.id },
    data: { adminTotpSecretEnc: encryptSecret(secret), adminTotpEnabled: false },
  });

  return NextResponse.json({ success: true, otpauthUrl, qr });
}
