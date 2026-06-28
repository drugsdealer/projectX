import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function generateCode() {
  const { randomInt } = require("crypto");
  return String(randomInt(100000, 1000000)); // cryptographically secure 6-digit
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;
    const jsonBlocked = requireJsonRequest(req);
    if (jsonBlocked) return jsonBlocked;

    const ip = getClientIp(req);
    const ipLimit = await rateLimit(`forgot:ip:${ip}`, 5, 15 * 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много запросов. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    // Always answer success — не раскрываем, существует ли email (защита от перебора).
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ success: true });
    }

    // Лимит и по email (по введённому значению, не по факту существования — без утечки).
    const emailLimit = await rateLimit(`forgot:email:${email}`, 5, 15 * 60_000);
    if (!emailLimit.ok) {
      return NextResponse.json(
        { success: false, message: "Слишком много запросов для этого email. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, deletedAt: true },
    });

    // Нет пользователя / деактивирован → всё равно success (без раскрытия).
    if (!user || user.deletedAt) {
      return NextResponse.json({ success: true });
    }

    const code = generateCode();
    await prisma.passwordResetCode.upsert({
      where: { userId: user.id },
      update: { code, createdAt: new Date() },
      create: { userId: user.id, code },
    });

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    try {
      await getResend().emails.send({
        from: `Stage Store <${fromEmail}>`,
        to: user.email,
        subject: "Восстановление пароля — Stage Store",
        html: `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr><td style="background:#1a1a1a;padding:28px 40px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:1px">STAGE STORE</div>
        </td></tr>
        <tr><td style="padding:32px 40px 16px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:#1a1a1a">Восстановление пароля</div>
          <div style="margin-top:8px;font-size:14px;color:#666">Введите этот код, чтобы задать новый пароль</div>
        </td></tr>
        <tr><td style="padding:16px 40px 32px;text-align:center">
          <div style="display:inline-block;background:#f5f5f5;border-radius:12px;padding:20px 40px;letter-spacing:8px;font-size:32px;font-weight:700;color:#1a1a1a;font-family:monospace">
            ${code}
          </div>
        </td></tr>
        <tr><td style="padding:0 40px 32px;text-align:center;font-size:13px;color:#888;line-height:1.5">
          Код действителен 10 минут.<br>Если вы не запрашивали восстановление пароля, просто проигнорируйте письмо.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });
    } catch {
      // даже если письмо не ушло — не палим существование email
      console.error("[forgot-password/request] email send failed");
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[forgot-password/request] error");
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
