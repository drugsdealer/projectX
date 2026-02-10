// app/api/auth/send-email-code/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

export async function POST(req: Request) {
  try {
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
      return NextResponse.json(
        { success: false, message: 'Пользователь не найден' },
        { status: 404 }
      );
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

    // Здесь можно интегрировать реальную отправку письма.
    if (process.env.NODE_ENV !== 'production') {
      console.log('[send-email-code] code for', normalizedEmail, ':', code);
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set('vfy', '1', {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 минут на ввод кода
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (e) {
    console.error('[send-email-code] error', e);
    return NextResponse.json({ success: false, message: 'Ошибка сервера' }, { status: 500 });
  }
}
