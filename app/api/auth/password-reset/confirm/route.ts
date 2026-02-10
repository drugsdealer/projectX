import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
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
    if (!record || record.code !== code) {
      return NextResponse.json({ success: false, message: "Неверный код." }, { status: 400 });
    }

    const isExpired = record.createdAt.getTime() < Date.now() - 10 * 60 * 1000;
    if (isExpired) {
      await prisma.passwordResetCode.delete({ where: { userId } }).catch(() => {});
      return NextResponse.json({ success: false, message: "Срок кода истёк." }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
    await prisma.passwordResetCode.delete({ where: { userId } }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[password-reset/confirm] error", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
