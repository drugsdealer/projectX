import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { prisma } from '../../../../prisma/prisma-client';
import bcrypt from 'bcryptjs';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { isAdminEmail } from '@/lib/admin-emails';

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

    const ip = getClientIp(req);
    const ipLimit = await rateLimit(`register:ip:${ip}`, 8, 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, message: 'Слишком много запросов. Попробуйте позже.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter) } }
      );
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Некорректный email' },
        { status: 400 }
      );
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, message: 'Пароль слишком короткий' },
        { status: 400 }
      );
    }

    const emailLimit = await rateLimit(`register:email:${email}`, 3, 10 * 60_000);
    if (!emailLimit.ok) {
      return NextResponse.json(
        { success: false, message: 'Слишком много попыток регистрации. Попробуйте позже.' },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfter) } }
      );
    }

    // check existing (case-insensitive)
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, verified: true, email: true, fullName: true, role: true },
    });
    if (existing) {
      if (isAdminEmail(email) && existing.role !== 'ADMIN') {
        await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' as any } }).catch(() => {});
      }
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
        role: isAdminEmail(email) ? ('ADMIN' as any) : undefined,
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
