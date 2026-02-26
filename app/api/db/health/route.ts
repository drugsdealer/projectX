import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  try {
    // Простой пинг + несложные запросы
    const [nowRow] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const productCount = await prisma.product.count().catch(() => null);
    const orderCount = await prisma.order.count().catch(() => null);

    return new NextResponse(
      JSON.stringify({
        ok: true,
        tookMs: Date.now() - started,
        now: nowRow?.now ?? null,
        productCount,
        orderCount,
        dbUrlMasked: maskDbUrl(process.env.DATABASE_URL || ''),
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    );
  } catch (e: any) {
    return new NextResponse(
      JSON.stringify({
        ok: false,
        tookMs: Date.now() - started,
        error: {
          name: e?.name,
          code: e?.code,
          message: e?.message,
        },
        dbUrlMasked: maskDbUrl(process.env.DATABASE_URL || ''),
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    );
  }
}

function maskDbUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    if (u.username) u.username = '***';
    return u.toString();
  } catch {
    return 'invalid-url';
  }
}