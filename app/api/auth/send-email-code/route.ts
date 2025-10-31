// app/api/auth/send-email-code/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    const now = new Date();
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: { updatedAt: now },
      create: {
        email: normalizedEmail,
        fullName: '',
        password: '',
        role: 'USER' as any,
        verified: new Date(0),
        updatedAt: now,
      },
    });

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
    console.log('[send-email-code] code for', normalizedEmail, ':', code);

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
