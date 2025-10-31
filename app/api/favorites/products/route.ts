import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- helpers (reuse patterns from favorites/brands) ---
function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const m = cookieHeader.match(new RegExp('(?:^|;\\s*)' + escaped + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function readReqCookie(req: NextRequest, name: string): string | null {
  try {
    const v = (req as any).cookies?.get?.(name)?.value;
    return v ?? null;
  } catch {
    return null;
  }
}

function readAuthUserId(h: Headers): number | null {
  const auth = h.get('authorization');
  if (!auth) return null;
  const m = auth.match(/^(?:Bearer|User)\s+(\d+)$/i);
  return m ? parseInt(m[1], 10) : null;
}

function getUserId(req: NextRequest, body?: any): number | null {
  if (body?.userId && /^\d+$/.test(String(body.userId))) {
    return parseInt(String(body.userId), 10);
  }

  const h = req.headers;
  const authId = readAuthUserId(h);
  if (authId) return authId;

  const headerId = h.get('x-user-id') || h.get('x-userid') || h.get('x-uid');
  if (headerId && /^\d+$/.test(headerId)) return parseInt(headerId, 10);

  const directCookieId =
    readReqCookie(req, 'userId') || readReqCookie(req, 'uid') || readReqCookie(req, 'userid');
  if (directCookieId && /^\d+$/.test(directCookieId)) return parseInt(directCookieId, 10);

  const cookieHeader = h.get('cookie') || '';
  const cookieId =
    readCookie(cookieHeader, 'userId') ||
    readCookie(cookieHeader, 'uid') ||
    readCookie(cookieHeader, 'userid');
  if (cookieId && /^\d+$/.test(cookieId)) return parseInt(cookieId, 10);

  return null;
}

// --- GET: list favorite products for user ---
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qsUser = url.searchParams.get('userId');
  const uid =
    (qsUser && /^\d+$/.test(qsUser) ? parseInt(qsUser, 10) : null) ??
    getUserId(req);

  if (!uid) {
    return NextResponse.json({ items: [] }, {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const rows = await prisma.favoriteProduct.findMany({
    where: { userId: uid },
    select: {
      productId: true,
      createdAt: true,
      Product: {
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          Brand: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const items = rows
    .filter((r) => r.Product)
    .map((r) => ({
      id: r.Product!.id,
      name: r.Product!.name,
      price: r.Product!.price ?? null,
      imageUrl: r.Product!.imageUrl ?? null,
      brand: r.Product!.Brand?.name ?? null,
      addedAt: r.createdAt,
    }));

  return NextResponse.json({ items }, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

// --- POST: add/remove favorite product ---
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore parse errors
  }

  const productId = body?.productId ? Number(body.productId) : NaN;
  const action: 'add' | 'remove' = body?.action === 'remove' ? 'remove' : 'add';

  if (!Number.isInteger(productId)) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const uid = getUserId(req, body);
  if (!uid) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, {
      status: 401,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, {
      status: 404,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (action === 'add') {
    await prisma.favoriteProduct.upsert({
      where: { userId_productId: { userId: uid, productId } },
      update: {},
      create: { userId: uid, productId },
    });
  } else {
    await prisma.favoriteProduct.deleteMany({
      where: { userId: uid, productId },
    });
  }

  return NextResponse.json({ ok: true }, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Userid, X-Uid',
      'Access-Control-Max-Age': '86400',
    },
  });
}
