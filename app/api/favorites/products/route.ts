import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- GET: list favorite products for user ---
export async function GET(req: NextRequest) {
  const uid = await getUserIdFromRequest();

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

  const uid = await getUserIdFromRequest();
  if (!uid) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, {
      status: 401,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
