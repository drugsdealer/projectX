import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  SESSION_TOKEN_COOKIE,
  clearSessionOnResponse,
  setSessionClaimOnResponse,
} from '../../_utils/session';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function GET() {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_TOKEN_COOKIE)?.value;

    if (!token) {
      const res = NextResponse.json({ success: true, user: null }, { status: 200 });
      clearSessionOnResponse(res);
      return res;
    }

    // Single query: session validity + user data in one JOIN
    const session = await prisma.userSession.findUnique({
      where: { token },
      select: {
        revokedAt: true,
        createdAt: true,
        lastSeen: true,
        User: {
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
            deletedAt: true,
          },
        },
      },
    });

    const user = session?.User;
    const isRevoked = session?.revokedAt;
    const isExpired = session ? Date.now() - session.createdAt.getTime() > SESSION_MAX_AGE_MS : false;
    const isDeleted = user?.deletedAt;

    if (!session || isRevoked || isExpired || !user || isDeleted) {
      const res = NextResponse.json({ success: true, user: null }, { status: 200 });
      clearSessionOnResponse(res);
      return res;
    }

    // Update lastSeen at most once per 5 minutes (fire-and-forget)
    const now = Date.now();
    if (!session.lastSeen || now - session.lastSeen.getTime() > 5 * 60 * 1000) {
      prisma.userSession.update({
        where: { token },
        data: { lastSeen: new Date() },
      }).catch(() => {});
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        verified: Boolean(user.verified && user.verified.getTime() > 0),
        verifiedAt: user.verified,
        createdAt: user.createdAt,
        phone: user.phone,
        city: user.city,
        address: user.address,
        gender: user.gender,
        birthDate: user.birthDate,
        avatarEmoji: user.avatarEmoji,
        loyaltyPoints: user.loyaltyPoints,
      },
    }, { status: 200 });

    // Refresh fast-path claim so middleware skips DB for the next 10 minutes
    setSessionClaimOnResponse(res, user.id);

    return res;
  } catch (e) {
    console.error('[auth.me] error');
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}
