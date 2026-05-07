import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import bcrypt from "bcryptjs";
import { blockIfCsrf } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { SESSION_TOKEN_COOKIE } from "../../_utils/session";

export async function POST(req: Request) {
  const csrf = blockIfCsrf(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit(`chpass:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false, message: "Слишком много попыток." }, { status: 429 });
  }

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
    const jar: any = cookies() as any;
    const cookieJar = typeof jar?.then === "function" ? await jar : jar;
    const currentToken = cookieJar?.get?.(SESSION_TOKEN_COOKIE)?.value || null;

    const [, revoked] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hash },
      }),
      prisma.userSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentToken ? { token: { not: currentToken } } : {}),
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true, revokedSessions: revoked.count });
  } catch (e) {
    console.error("[change-password] error");
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
