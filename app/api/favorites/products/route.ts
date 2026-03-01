import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/session';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import {
  buildPrivateHeaders,
  blockIfCsrf,
  privateJson,
  requireJsonRequest,
  tooManyRequests,
} from '@/lib/api-hardening';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- GET: list favorite products for user ---
export async function GET(req: NextRequest) {
  const uid = await getUserIdFromRequest();

  if (!uid) {
    return privateJson({ items: [] }, { status: 200 });
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

  return privateJson({ items }, { status: 200 });
}

// --- POST: add/remove favorite product ---
export async function POST(req: NextRequest) {
  const csrfBlocked = blockIfCsrf(req);
  if (csrfBlocked) return csrfBlocked;

  const ip = getClientIp(req);
  const limitByIp = await rateLimit(`fav:products:ip:${ip}`, 50, 60_000);
  if (!limitByIp.ok) {
    return tooManyRequests(limitByIp.retryAfter, 'rate_limited');
  }

  const jsonBlocked = requireJsonRequest(req);
  if (jsonBlocked) return jsonBlocked;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return privateJson({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const rawProductId = body?.productId;
  const productId = Number(rawProductId);
  const action = body?.action;
  const actionAllowed = action === 'add' || action === 'remove';

  if (!Number.isInteger(productId) || productId <= 0 || productId > 2_147_483_647 || !actionAllowed) {
    return privateJson({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const uid = await getUserIdFromRequest();
  if (!uid) {
    return privateJson({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product) {
    return privateJson({ ok: false, error: 'product_not_found' }, { status: 404 });
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

  return privateJson({ ok: true }, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: buildPrivateHeaders({ Allow: 'GET, POST, OPTIONS' }),
  });
}
