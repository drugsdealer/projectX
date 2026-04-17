import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import bcrypt from "bcryptjs";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const SESSION_TOKEN_COOKIE = "session_token";

export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;
    const jsonBlocked = requireJsonRequest(req);
    if (jsonBlocked) return jsonBlocked;

    const ip = getClientIp(req);
    const rl = await rateLimit(`pwreset-confirm:${ip}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ success: false, message: "Слишком много попыток." }, { status: 429 });
    }

    // Extract current session token BEFORE any DB changes — needed to preserve current session
    const cookieHeader = req.headers.get("cookie") || "";
    const currentTokenMatch = cookieHeader.match(new RegExp(`${SESSION_TOKEN_COOKIE}=([^;]+)`));
    const currentToken = currentTokenMatch?.[1]?.trim() || null;

    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, message: "Код должен состоять из 6 цифр." }, { status: 400 });
    }
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ success: false, message: "Новый пароль слишком короткий." }, { status: 400 });
    }

    const record = await prisma.passwordResetCode.findUnique({
      where: { userId },
    });
    if (!record || !timingSafeEqual(Buffer.from(record.code), Buffer.from(code))) {
      return NextResponse.json({ success: false, message: "Неверный код." }, { status: 400 });
    }

    const isExpired = record.createdAt.getTime() < Date.now() - 10 * 60 * 1000;
    if (isExpired) {
      await prisma.passwordResetCode.delete({ where: { userId } }).catch(() => {});
      return NextResponse.json({ success: false, message: "Срок кода истёк." }, { status: 400 });
    }

    // Change password + clean up reset code
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
    await prisma.passwordResetCode.delete({ where: { userId } }).catch(() => {});

    // Revoke all OTHER active sessions — keeps only the device that performed the reset.
    // This ensures a compromised account is fully kicked out across all other devices.
    try {
      const revokeWhere: any = {
        userId,
        revokedAt: null,
      };
      // If we know the current session token, exclude it from revocation
      if (currentToken) {
        revokeWhere.NOT = { token: currentToken };
      }
      const revoked = await prisma.userSession.updateMany({
        where: revokeWhere,
        data: { revokedAt: new Date() },
      });
      if (revoked.count > 0) {
        console.log(`[password-reset/confirm] revoked ${revoked.count} other session(s) for userId=${userId}`);
      }
    } catch (e) {
      // Non-critical: password is already changed; log but don't fail the request
      console.error("[password-reset/confirm] session revocation failed:", e);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[password-reset/confirm] error");
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
