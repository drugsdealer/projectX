import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { sendEmail } from "@/lib/notifications";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;
    const jsonBlocked = requireJsonRequest(req);
    if (jsonBlocked) return jsonBlocked;

    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const ipLimit = await rateLimit(`pwreset:ip:${ip}`, 10, 10 * 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много запросов. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user?.email) {
      return NextResponse.json({ success: false, message: "Email не найден." }, { status: 400 });
    }

    const code = generateCode();
    await prisma.passwordResetCode.upsert({
      where: { userId: user.id },
      update: { code, createdAt: new Date() },
      create: { userId: user.id, code },
    });

    console.log(`[password-reset] code for ${user.email}: ${code}`);

    const sent = await sendEmail({
      to: user.email,
      subject: "Код для смены пароля StageStore",
      text: `Ваш код подтверждения: ${code}. Он действителен 10 минут.`,
    }).catch(() => {});

    if (!sent) {
      return NextResponse.json({
        success: false,
        message: "SMTP не настроен. Проверьте SMTP_* в .env.local.",
      }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[password-reset/request] error", e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
