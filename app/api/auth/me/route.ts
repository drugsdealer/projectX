import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/session';
import { clearSessionOnResponse } from '../../_utils/session';

// "Кто я" — возвращает текущего пользователя по сессии.
export async function GET() {
  try {
    const userId = await getUserIdFromRequest();

    // Не авторизован — возвращаем user: null (200), чтобы фронт не падал
    if (!userId) {
      const res = NextResponse.json({ success: true, user: null }, { status: 200 });
      clearSessionOnResponse(res);
      return res;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        verified: true,
        createdAt: true,
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
      const res = NextResponse.json({ success: true, user: null }, { status: 200 });
      clearSessionOnResponse(res);
      return res;
    }

    const verifiedAt = user.verified;
    return NextResponse.json({
      success: true,
      user: {
        ...user,
        verified: Boolean(verifiedAt && verifiedAt.getTime() > 0),
        verifiedAt,
      },
    }, { status: 200 });
  } catch (e) {
    console.error('[auth.me] error');
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}
