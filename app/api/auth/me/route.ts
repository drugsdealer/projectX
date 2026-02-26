import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/session';

// "Кто я" — возвращает текущего пользователя по сессии.
export async function GET() {
  try {
    const userId = await getUserIdFromRequest();

    // Не авторизован — возвращаем user: null (200), чтобы фронт не падал
    if (!userId) {
      return NextResponse.json({ success: true, user: null }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        verified: true,
        provider: true,
        providerId: true,
        createdAt: true,
        updatedAt: true,
        phone: true,
        city: true,
        address: true,
        gender: true,
        birthDate: true,
        avatarEmoji: true,
        loyaltyPoints: true,
      },
    });

    if (!user) {
      // Сессия указывает на несуществующего/удалённого пользователя — считаем, что он не авторизован
      return NextResponse.json({ success: true, user: null }, { status: 200 });
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (e) {
    console.error('[auth.me] error', e);
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}