import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { prisma } from '../../../../prisma/prisma-client';
import bcrypt from 'bcryptjs';

/**
 * Email+Password registration (direct, without OTP).
 * - normalizes email to lowercase
 * - checks for existing user (case-insensitive)
 * - hashes password with bcrypt
 * - creates a user record in Prisma
 * - waits for email confirmation before session creation
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const rawEmail: string = body?.email ?? '';
    const password: string = body?.password ?? '';
    const nameInput: string = body?.name ?? body?.fullName ?? '';

    const email = rawEmail.trim().toLowerCase();
    const fullName = (nameInput || '').toString().trim() || 'Не указано';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Некорректный email' },
        { status: 400 }
      );
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Пароль слишком короткий' },
        { status: 400 }
      );
    }

    // check existing (case-insensitive)
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, verified: true, email: true, fullName: true },
    });
    if (existing) {
      const isVerified = existing.verified && existing.verified > new Date();
      // Если аккаунт уже есть, но не подтверждён — разрешаем продолжить, чтобы отправить код
      if (!isVerified) {
        return NextResponse.json(
          { success: true, user: existing, existed: true, needsVerification: true },
          { status: 200 }
        );
      }
      // Уже подтверждённый аккаунт — без 400, но с флагом, чтобы фронт ушёл на /login
      return NextResponse.json(
        { success: false, message: 'Пользователь с таким email уже существует', alreadyRegistered: true },
        { status: 200 }
      );
    }

    const hash = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        email,
        fullName,
        password: hash,
        verified: new Date(0), // требуем подтверждения
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });

    // Сессию создаём только после подтверждения email
    return NextResponse.json({ success: true, user: created }, { status: 200 });
  } catch (e) {
    console.error('[REGISTER] exception', e);
    return NextResponse.json(
      { success: false, message: 'Ошибка регистрации' },
      { status: 500 }
    );
  }
}
