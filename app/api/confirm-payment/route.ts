// app/api/confirm-payment/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '../_utils/session';
import { cookies, headers } from 'next/headers';
import { sendOrderNotificationToTelegram } from '@/lib/telegram';
import { redeemPromoForOrder } from '@/lib/promos';

// аккуратный парсер числа
function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v | 0;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n | 0;
  }
  return null;
}

// трим строки
function cleanToken(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s || null;
}

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    /* 1. Авторизация */
    const rawUid = await getSessionUserId().catch(() => null);
    const userId = toInt(rawUid);
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }

    /* 2. Достаём orderId / token из body, query, headers, cookies */
    let orderId: number | null = null;
    let token: string | null = null;

    // 2.1 body (JSON)
    try {
      const ct = req.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const body = (await req.json().catch(() => null)) as any;
        if (body) {
          orderId = toInt(body.orderId) ?? orderId;
          token =
            cleanToken(body.token) ??
            cleanToken(body.orderToken) ??
            token;
        }
      }
    } catch {
      // битое body — просто игнорируем
    }

    // 2.2 query-параметры
    if (!orderId || !token) {
      const url = new URL(req.url);
      orderId = toInt(url.searchParams.get('orderId')) ?? orderId;
      token =
        cleanToken(url.searchParams.get('token')) ??
        cleanToken(url.searchParams.get('orderToken')) ??
        token;
    }

    // 2.3 заголовки
    const hdrs = await headers(); // ← тут добавили await
    orderId = toInt(hdrs.get('x-order-id')) ?? orderId;
    token = cleanToken(hdrs.get('x-order-token')) ?? token;

    const ref = hdrs.get('referer');
    if ((!orderId || !token) && ref) {
      try {
        const rurl = new URL(ref);
        orderId = toInt(rurl.searchParams.get('orderId')) ?? orderId;
        token =
          cleanToken(rurl.searchParams.get('token')) ??
          cleanToken(rurl.searchParams.get('orderToken')) ??
          token;
      } catch {
        // странный referer — пропускаем
      }
    }

    // 2.4 cookies
    const cookieStore = await cookies();

    if (!orderId) {
      const orderIdCandidates = [
        cookieStore.get('pending_order_id')?.value,
        cookieStore.get('last_order_id')?.value,
        cookieStore.get('order_id')?.value,
        cookieStore.get('orderId')?.value,
      ];

      for (const raw of orderIdCandidates) {
        const parsed = toInt(raw ?? null);
        if (parsed !== null) {
          orderId = parsed;
          break;
        }
      }
    }

    if (!token) {
      const tokenCandidates = [
        cookieStore.get('order_token')?.value,
        cookieStore.get('orderToken')?.value,
      ];
      for (const raw of tokenCandidates) {
        const cleaned = cleanToken(raw ?? null);
        if (cleaned) {
          token = cleaned;
          break;
        }
      }
    }

    const PENDING_STATUS = 'PENDING' as const;

    /* 3. Находим целевой заказ */

    let targetOrderId: number | null = null;

    // 3.1 по токену
    if (token) {
      const byToken = await prisma.order.findFirst({
        where: { token, userId },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      if (byToken) targetOrderId = byToken.id;
    }

    // 3.2 по id
    if (!targetOrderId && orderId) {
      const byId = await prisma.order.findFirst({
        where: { id: orderId, userId },
        select: { id: true },
      });
      if (byId) targetOrderId = byId.id;
    }

    // 3.3 fallback: последний НЕуспешный заказ за час
    if (!targetOrderId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const last = await prisma.order.findFirst({
        where: {
          userId,
          createdAt: { gte: oneHourAgo },
          status: { not: 'SUCCEEDED' },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      if (last) targetOrderId = last.id;
    }

    if (!targetOrderId) {
      console.warn('[api.confirm-payment] 400 – no order to confirm', {
        userId,
        candidates: { orderId, token },
      });
      return NextResponse.json(
        { success: false, message: 'no order to confirm' },
        { status: 400 },
      );
    }

    /* 4. Подтверждаем оплату */

    const existing = await prisma.order.findUnique({
      where: { id: targetOrderId },
      select: {
        id: true,
        status: true,
        userId: true,
        publicNumber: true,
      },
    });

    if (!existing || existing.userId !== userId) {
      console.warn('[api.confirm-payment] 403 – foreign or missing order', {
        userId,
        targetOrderId,
      });
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 403 },
      );
    }

    const publicNumber =
      existing.publicNumber ||
      `STG-${String(targetOrderId).padStart(6, '0')}`;

    const shouldNotify = existing.status !== 'SUCCEEDED';
    let confirmed = existing;

    if (existing.status !== 'SUCCEEDED') {
      confirmed = await prisma.order.update({
        where: { id: targetOrderId },
        data: {
          status: 'SUCCEEDED',
          paidAt: new Date(),
          publicNumber,
          ...(userId && !existing.userId ? { userId } : {}),
        },
        select: {
          id: true,
          userId: true,
          publicNumber: true,
          status: true,
        },
      });
    }

    if (shouldNotify) {
      try {
        const orderForNotify = await prisma.order.findUnique({
          where: { id: targetOrderId },
          select: {
            id: true,
            token: true,
            totalAmount: true,
            fullName: true,
            phone: true,
            email: true,
            publicNumber: true,
          },
        });
        if (orderForNotify) {
          await sendOrderNotificationToTelegram({
            orderId: orderForNotify.publicNumber || orderForNotify.id,
            token: orderForNotify.token,
            amount: Number(orderForNotify.totalAmount || 0),
            fullName: orderForNotify.fullName || undefined,
            phone: orderForNotify.phone || undefined,
            email: orderForNotify.email || undefined,
          });
        }
      } catch (err) {
        console.error('[api.confirm-payment] failed to send telegram notification', err);
      }
    }

    // Промокод списываем только после успешной оплаты
    try {
      const promoOrder = await prisma.order.findUnique({
        where: { id: targetOrderId },
        select: { promoCode: true, userId: true, status: true },
      });
      if (
        promoOrder?.promoCode &&
        promoOrder.userId &&
        String(promoOrder.status) === 'SUCCEEDED'
      ) {
        await redeemPromoForOrder({
          code: promoOrder.promoCode,
          userId: promoOrder.userId,
          orderId: targetOrderId,
        });
      }
    } catch (err) {
      console.error('[api.confirm-payment] promo redeem failed', err);
    }

    /* 4.1 Берём позиции заказа */
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: targetOrderId },
      select: {
        id: true,
        cartItemId: true,
        productId: true,
        size: true,
        quantity: true,
      },
    });

    /* 4.2 Гасим остальные PENDING-заказы пользователя */
    if (userId) {
      await prisma.order.updateMany({
        where: {
          userId,
          status: PENDING_STATUS,
          id: { not: targetOrderId },
        },
        data: { status: 'CANCELED' },
      });
    }

    /* 4.3 Чистим купленные позиции из корзины */
    if (orderItems.length) {
      try {
        // сначала по прямым cartItemId
        const cartItemIds = orderItems
          .map((it) => it.cartItemId)
          .filter(
            (id): id is number =>
              typeof id === 'number' && Number.isFinite(id),
          );

        if (cartItemIds.length) {
          await prisma.cartItem.deleteMany({
            where: { id: { in: cartItemIds } },
          });
        } else {
          // fallback — по продукту + размеру
          let cart: { id: number } | null = null;

          if (userId) {
            cart = await prisma.cart.findFirst({
              where: { userId },
              select: { id: true },
            });
          }

          if (!cart) {
            const rawToken =
              cookieStore.get('cart_token')?.value ||
              cookieStore.get('cartToken')?.value ||
              null;

            if (rawToken) {
              cart = await prisma.cart.findFirst({
                where: { token: rawToken },
                select: { id: true },
              });
            }
          }

          if (cart) {
            for (const it of orderItems) {
              const sizeLabel = it.size ? String(it.size) : null;

              const existingItem = await prisma.cartItem.findFirst({
                where: {
                  cartId: cart.id,
                  productId: it.productId ?? undefined,
                  sizeLabel: sizeLabel ?? undefined,
                },
              });

              if (!existingItem) continue;

              const nextQty =
                (existingItem.quantity ?? 1) - (it.quantity ?? 1);

              if (nextQty > 0) {
                await prisma.cartItem.update({
                  where: { id: existingItem.id },
                  data: { quantity: nextQty, updatedAt: new Date() },
                });
              } else {
                await prisma.cartItem.delete({
                  where: { id: existingItem.id },
                });
              }
            }
          }
        }
      } catch (err) {
        // даже если корзина не почистилась — заказ остаётся SUCCEEDED
        console.error(
          '[api.confirm-payment] cart cleanup failed, order stays SUCCEEDED',
          {
            orderId: targetOrderId,
            userId,
            err,
          },
        );
      }
    }

    /* 5. Ответ и очистка временных кук */
    const res = NextResponse.json({
      success: true,
      orderId: targetOrderId,
      publicNumber,
    });

    res.headers.set('Cache-Control', 'no-store');

    res.cookies.set('pending_order_id', '', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    res.cookies.set('order_token', '', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    res.cookies.set('order_id', '', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return res;
  } catch (e) {
    console.error('[api.confirm-payment] failed', e);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 },
    );
  }
}
