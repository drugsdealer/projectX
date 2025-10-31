import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies, headers } from 'next/headers';
import type { Prisma } from '@prisma/client';

// Disable any caching for this route handler
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Аккуратно достаём userId из кук/заголовков без зависимости от '@/lib/session' */
async function getUserIdSafe(): Promise<number | null> {
  try {
    const jar = await cookies();
    const hdr = await headers();

    const getCookie = (name: string): string | undefined => jar.get(name)?.value;
    const getHeader = (name: string): string | null => hdr.get(name);

    // 1) Пробуем из кук — набор распространённых имён
    for (const key of ['session_user_id','userId','user_id','userid','uid','sessionUserId','auth_user_id','next-auth.userId']) {
      const n = Number(getCookie(key));
      if (Number.isFinite(n)) return n;
    }

    // 2) Пробуем из заголовков (если фронт их выставляет)
    for (const key of ['x-user-id','x-userid','x-user','x-session-userid']) {
      const raw = getHeader(key);
      const n = Number(raw ?? undefined);
      if (Number.isFinite(n)) return n;
    }

    // 3) Иногда кладут JSON-куку сессии
    const sessionLike =
      getCookie('session') ||
      getCookie('auth') ||
      getCookie('stage_session') ||
      getCookie('stage_auth') ||
      getCookie('next-auth') ||
      getCookie('next-auth.session-token');
    if (sessionLike) {
      try {
        const obj = JSON.parse(sessionLike);
        const n = Number(
          obj?.id ??
          obj?.userId ??
          obj?.sub ??
          obj?.user?.id
        );
        if (Number.isFinite(n)) return n;
      } catch {}
    }

    // 4) Иногда id кладут прямо в Authorization: Bearer &lt;id&gt;
    const auth = getHeader('authorization');
    if (auth?.toLowerCase().startsWith('bearer ')) {
      const maybeId = auth.slice(7).trim();
      const n = Number(maybeId);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  return null;
}

export async function GET(req: Request) {
  try {
    const jar = await cookies();
    const hdr = await headers();
    const userId = await getUserIdSafe();

    const url = new URL(req.url);

    // Гостевой токен заказа (если пользователь не авторизован)
    const token =
      jar.get('order_token')?.value ??
      jar.get('orderToken')?.value ??
      jar.get('guestOrderToken')?.value ??
      jar.get('order_guest')?.value ??
      jar.get('last_order_token')?.value ??
      hdr.get('x-order-token') ??
      hdr.get('x-order') ??
      url.searchParams.get('token') ??
      undefined;

    // Явный идентификатор заказа — берём из query/заголовков/кук
    const orderIdRaw =
      url.searchParams.get('orderId') ??
      hdr.get('x-order-id') ??
      jar.get('order_id')?.value ??
      jar.get('last_order_id')?.value ??
      jar.get('orderId')?.value ??
      null;
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

    // Строим where: расширяем логику — ищем по userId И/ИЛИ по токену, И/ИЛИ по id
    const ors: Prisma.OrderWhereInput[] = [];
    if (userId != null) ors.push({ userId });
    if (token) ors.push({ token });
    if (orderId != null) ors.push({ id: orderId });

    const where: Prisma.OrderWhereInput =
      ors.length === 1 ? ors[0] : { OR: ors };

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
        paymentId: true,
        fullName: true,
        email: true,
        phone: true,
        address: true,
        comment: true,
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
