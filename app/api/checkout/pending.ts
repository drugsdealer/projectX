// app/api/checkout/pending/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '../_utils/session';

export const revalidate = 0;

export async function GET() {
  try {
    // getSessionUserId не принимает аргументов
    const userIdRaw = await getSessionUserId();
    const userId = userIdRaw ? Number(userIdRaw) : NaN;

    // Если не получили валидный числовой id — возвращаем пусто
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ order: null }, { status: 200 });
    }

    const order = await prisma.order.findFirst({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, totalAmount: true, createdAt: true },
    });

    return NextResponse.json({ order }, { status: 200 });
  } catch (e) {
    console.error('[api.checkout.pending]', e);
    return NextResponse.json({ order: null }, { status: 200 });
  }
}