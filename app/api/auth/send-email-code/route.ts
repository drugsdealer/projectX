// app/api/auth/send-email-code/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { Prisma } from '@prisma/client';
import { blockIfCsrf, requireJsonRequest } from '@/lib/api-hardening';
import { Resend } from 'resend';

export const runtime = 'nodejs';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function generateCode(): string {
  const { randomInt } = require("crypto");
  return String(randomInt(100000, 1000000)); // 6 digits, cryptographically secure
}

export async function POST(req: Request) {
  try {
    const csrfBlocked = blockIfCsrf(req);
    if (csrfBlocked) return csrfBlocked;
    const jsonBlocked = requireJsonRequest(req);
    if (jsonBlocked) return jsonBlocked;

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, message: 'Email обязателен' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isEmail) {
      return NextResponse.json({ success: false, message: 'Некорректный email' }, { status: 400 });
    }

    const ip = getClientIp(req);
    const ipLimit = await rateLimit(`send-email:ip:${ip}`, 12, 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, message: 'Слишком много запросов. Попробуйте позже.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter) } }
      );
    }
    const emailLimit = await rateLimit(`send-email:email:${normalizedEmail}`, 3, 10 * 60_000);
    if (!emailLimit.ok) {
      return NextResponse.json(
        { success: false, message: 'Код уже отправлен. Попробуйте чуть позже.' },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfter) } }
      );
    }

    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (!user) {
      // Не раскрываем существование email (anti-enumeration)
      return NextResponse.json({ success: true });
    }

    // гарантируем, что у пользователя есть корзина
    await prisma.cart.upsert({
      where: { userId: user.id },
      update: { updatedAt: now },
      create: { userId: user.id, updatedAt: now },
    });

    // Сохраняем код, избегая коллизий уникального поля code
    let code: string | null = null;
    for (let i = 0; i < 5; i++) {
      const candidate = generateCode();
      try {
        await prisma.verificationCode.upsert({
          where: { userId: user.id },
          update: { code: candidate, createdAt: new Date() },
          create: { userId: user.id, code: candidate },
        });
        code = candidate;
        break;
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // коллизия кода — пробуем заново
          continue;
        }
        throw err;
      }
    }

    if (!code) {
      return NextResponse.json({ success: false, message: 'Не удалось сгенерировать код' }, { status: 500 });
    }

    // Отправляем код на email через Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    try {
      await getResend().emails.send({
        from: `Stage Store <${fromEmail}>`,
        to: normalizedEmail,
        subject: 'Код подтверждения — Stage Store',
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
          <div style="font-size:18px;font-weight:700;color:#1a1a1a">Код подтверждения</div>
          <div style="margin-top:8px;font-size:14px;color:#666">Введите этот код для завершения регистрации</div>
        </td></tr>
        <tr><td style="padding:16px 40px 32px;text-align:center">
          <div style="display:inline-block;background:#f5f5f5;border-radius:12px;padding:20px 40px;letter-spacing:8px;font-size:32px;font-weight:700;color:#1a1a1a;font-family:monospace">
            ${code}
          </div>
        </td></tr>
        <tr><td style="padding:0 40px 32px;text-align:center;font-size:13px;color:#888;line-height:1.5">
          Код действителен 10 минут.<br>Если вы не запрашивали этот код, просто проигнорируйте письмо.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });
      console.log(`[send-email-code] code sent to ${normalizedEmail}`);
    } catch (emailErr) {
      console.error('[send-email-code] failed to send email:', emailErr);
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set('vfy', '1', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 минут на ввод кода
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (e) {
    console.error('[send-email-code] error');
    return NextResponse.json({ success: false, message: 'Ошибка сервера' }, { status: 500 });
  }
}
