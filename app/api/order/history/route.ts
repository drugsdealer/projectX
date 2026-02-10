import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies, headers } from 'next/headers';
import { getUserIdFromRequest, getGuestToken } from '@/lib/session';
import type { Prisma } from '@prisma/client';

// Disable any caching for this route handler
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const jar = await cookies();
    const hdr = await headers();
    const userId = await getUserIdFromRequest();

    const url = new URL(req.url);

    // Гостевой токен заказа (если пользователь не авторизован)
    const token =
      (await getGuestToken()) ??
      jar.get('order_token')?.value ??
      jar.get('orderToken')?.value ??
      jar.get('guestOrderToken')?.value ??
      jar.get('order_guest')?.value ??
      jar.get('last_order_token')?.value ??
      hdr.get('x-order-token') ??
      hdr.get('x-order') ??
      url.searchParams.get('token') ??
      undefined;

    // Явный идентификатор заказа — берём ТОЛЬКО из query (иначе можно случайно сузить выдачу)
    const orderIdRaw = url.searchParams.get('orderId') ?? null;
    const orderIdNum = orderIdRaw != null ? Number(orderIdRaw) : NaN;
    const orderId = Number.isFinite(orderIdNum) ? orderIdNum : undefined;

    // Немного безопасного логирования (без PII)
    console.log('[api.order.history] filters', {
      userId: userId ?? null,
      hasToken: Boolean(token),
      orderId: orderId ?? null,
      src: token
        ? (jar.get('order_token')
            ? 'cookie:order_token'
            : jar.get('orderToken')
            ? 'cookie:orderToken'
            : jar.get('guestOrderToken')
            ? 'cookie:guestOrderToken'
            : jar.get('order_guest')
            ? 'cookie:order_guest'
            : jar.get('last_order_token')
            ? 'cookie:last_order_token'
            : hdr.get('x-order-token')
            ? 'header:x-order-token'
            : hdr.get('x-order')
            ? 'header:x-order'
            : 'query')
        : null,
    });

    // Если не пришло ничего для фильтрации — отдаём пусто
    if (userId == null && !token && orderId == null) {
      return NextResponse.json({ success: true, orders: [] }, { status: 200 });
    }

    // Строим where строго: либо по userId, либо по гостевому токену.
    let where: Prisma.OrderWhereInput | null = null;
    if (userId != null) where = { userId };
    else if (token) where = { token };
    if (!where) {
      return NextResponse.json({ success: true, orders: [] }, { status: 200 });
    }
    if (orderId != null) {
      where = { AND: [where, { id: orderId }] };
    }

    // Не показываем мягко удалённые заказы
    const whereSafe: Prisma.OrderWhereInput = {
      AND: [
        where,
        { deletedAt: null },
      ],
    };

    const orders = await prisma.order.findMany({
      where: whereSafe,
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        token: true,
        totalAmount: true,
        status: true,
        shippingStatus: true,
        paymentId: true,
        fullName: true,
        email: true,
        phone: true,
        address: true,
        comment: true,
        deliveryRequestedAt: true,
        deliveryScheduledAt: true,
        deliveryAddress: true,
        deliveryRecipientName: true,
        deliveryPhone: true,
        handedAt: true,
        createdAt: true,
        updatedAt: true,
        paidAt: true,
        publicNumber: true,
        OrderItem: {
          select: {
            id: true,
            productId: true,
            name: true,
            price: true,
            size: true,
            quantity: true,
            image: true,
            Product: {
              select: { id: true, name: true, imageUrl: true, price: true },
            },
          },
        },
      },
    });

    // Нормализуем paidAt и publicNumber в ответе
    const normalized = (orders as any[]).map((o) => ({
      ...o,
      // paidAt, если он выставлен, иначе — для совместимости берём updatedAt при успешном статусе
      paidAt:
        o.paidAt ??
        ((o.status === 'SUCCEEDED' || o.status === 'PAID') ? o.updatedAt : null),
      publicNumber: o.publicNumber ?? null,
      items: (o.OrderItem || []).map((it: any) => ({
        id: it.id,
        productId: it.productId ?? it.Product?.id ?? null,
        name: it.name ?? it.Product?.name ?? 'Товар',
        price: it.price ?? it.Product?.price ?? 0,
        size: it.size ?? null,
        quantity: it.quantity ?? 1,
        image: it.image ?? it.Product?.imageUrl ?? null,
        product: it.Product ?? null,
      })),
    }));

    return NextResponse.json(
      { success: true, orders: normalized },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    );
  } catch (err) {
    console.error('[api.order.history] error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 },
    );
  }
}
