import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";
import { verifyResetCode } from "@/lib/password-reset";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;
    const jsonBlocked = requireJsonRequest(req);
    if (jsonBlocked) return jsonBlocked;

    const ip = getClientIp(req);
    const rl = await rateLimit(`forgot-confirm:ip:${ip}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много попыток. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, message: "Неверный код." }, { status: 400 });
    }
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ success: false, message: "Пароль должен быть не короче 8 символов." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
    if (!user || user.deletedAt) {
      return NextResponse.json({ success: false, message: "Неверный код." }, { status: 400 });
    }

    const check = await verifyResetCode(user.id, code);
    if (!check.ok) {
      return NextResponse.json({ success: false, message: check.message }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
    await prisma.passwordResetCode.delete({ where: { userId: user.id } }).catch(() => {});

    // Сброс пароля «забыл» = пользователь не авторизован → гасим ВСЕ активные сессии.
    try {
      await prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (e) {
      console.error("[forgot-password/confirm] session revoke failed");
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[forgot-password/confirm] error");
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
