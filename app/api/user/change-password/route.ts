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
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, message: "Введите текущий и новый пароль." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, message: "Новый пароль слишком короткий." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user?.password) {
      return NextResponse.json(
        { success: false, message: "Пароль не установлен для этого аккаунта." },
        { status: 400 }
      );
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return NextResponse.json({ success: false, message: "Текущий пароль неверный." }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[change-password] error", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
