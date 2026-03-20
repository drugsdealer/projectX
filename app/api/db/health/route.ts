import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { ok: true, tookMs: Date.now() - started },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, tookMs: Date.now() - started },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
