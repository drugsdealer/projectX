// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/session';
import { sendOrderNotificationToTelegram } from '@/lib/telegram';

const toNum = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const sanitizeString = (v: any, maxLen = 255): string => {
  if (typeof v !== 'string') v = v == null ? '' : String(v);
  v = v.trim();
  if (v.length > maxLen) return v.slice(0, maxLen);
  return v;
};

const calcTotal = (items: { price: number; quantity: number }[]) =>
  items.reduce(
    (s, i) => s + Number(i.price || 0) * Number(i.quantity || 0),
    0,
  );

const normalizeSize = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  return null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const rawItems: any[] = Array.isArray(body?.items) ? body.items : [];
    const cartTokenRaw = body?.cartToken;
    const cartToken =
      typeof cartTokenRaw === 'string' && cartTokenRaw.trim()
        ? cartTokenRaw.trim()
        : null;

    // Жёстко нормализуем пользовательский ввод
    const fullName: string = sanitizeString(body?.fullName, 160);
    const email: string = sanitizeString(body?.email, 190);
    const phone: string = sanitizeString(body?.phone, 64);
    const address: string = sanitizeString(body?.address, 255);
    const comment: string = sanitizeString(body?.comment, 1000);

    if (!rawItems.length) {
      return NextResponse.json(
        { ok: false, success: false, message: 'Корзина пуста' },
        { status: 400 },
      );
    }

    // Определяем пользователя через защищённый helper
    let userId: number | null = null;
    try {
      const uid = await getUserIdFromRequest();
      if (uid && Number.isFinite(uid) && uid > 0) {
        userId = uid;
      }
    } catch {
      // гостевой заказ
    }

    type ItemForCreate = {
      productId: number;
      productItemId: number | null;
      cartItemId: number | null;
      quantity: number;
      price: number;
      name: string;
      image: string | null;
      size: string | null;
    };

    // Если есть cartToken и cartItemId — работаем ТОЛЬКО от корзины в БД (без доверия к фронту)
    const useCartBasedFlow = !!(
      cartToken &&
      rawItems.some((it) => toNum(it?.cartItemId))
    );

    let itemsForCreate: ItemForCreate[] = [];

    if (useCartBasedFlow) {
      // --- Новый безопасный режим: всё берём только из Cart в БД
      const cart = await prisma.cart.findFirst({
        where: { token: cartToken! },
        include: {
          CartItem: {
            include: {
              Size: true,
              SizeCl: true,
              OneSize: true,
            },
          },
        },
      });

      if (!cart) {
        return NextResponse.json(
          { ok: false, success: false, message: 'Корзина не найдена' },
          { status: 400 },
        );
      }

      const selectedIds = rawItems
        .map((it) => toNum(it?.cartItemId))
        .filter((id): id is number => id !== null);

      const cartItems = cart.CartItem.filter((ci) =>
        selectedIds.includes(ci.id),
      );

      if (!cartItems.length) {
        return NextResponse.json(
          {
            ok: false,
            success: false,
            message: 'Не выбраны товары для оформления заказа',
          },
          { status: 400 },
        );
      }

      for (const ci of cartItems) {
        const productId = ci.productId ?? null;

        // Собираем размер из всех возможных полей/связей
        const sizeValue = normalizeSize(
          (ci as any).sizeLabel ??
            (ci as any).size ??
            (ci as any).Size?.name ??
            (ci as any).SizeCl?.name ??
            (ci as any).OneSize?.name ??
            null,
        );

        if (!productId) {
          // На всякий случай пытаемся достать productId через ProductItem
          if (ci.productItemId) {
            const pi = await prisma.productItem.findUnique({
              where: { id: ci.productItemId },
              select: { productId: true },
            });
            if (!pi?.productId) {
              continue;
            }
            itemsForCreate.push({
              productId: pi.productId,
              productItemId: ci.productItemId ?? null,
              cartItemId: ci.id,
              quantity: ci.quantity,
              price: Number(ci.price || 0),
              name: ci.name || 'Товар',
              image: ci.image ?? null,
              size: sizeValue,
            });
          }
          continue;
        }

        itemsForCreate.push({
          productId,
          productItemId: ci.productItemId ?? null,
          cartItemId: ci.id,
          quantity: ci.quantity,
          price: Number(ci.price || 0),
          name: ci.name || 'Товар',
          image: ci.image ?? null,
          size: sizeValue,
        });
      }
    } else {
      // --- Старый режим (fallback): берём данные из body, как раньше
      const tmp: ItemForCreate[] = [];

      for (const it of rawItems) {
        const qtyRaw = toNum(it?.quantity);
        const qty = qtyRaw && qtyRaw > 0 ? qtyRaw : 1;
        const priceIn = toNum(it?.price) ?? null;
        const givenName: string | null = it?.name ?? null;
        const givenImage: string | null = it?.image ?? null;
        const givenSize: string | null =
          typeof it?.size === 'number' || typeof it?.size === 'string'
            ? String(it.size)
            : typeof it?.sizeLabel === 'string'
            ? it.sizeLabel
            : null;

        const productItemId = toNum(it?.productItemId);
        const productId = toNum(it?.productId);

        if (productItemId) {
          const pi = await prisma.productItem.findUnique({
            where: { id: productItemId },
            include: { Product: true, Size: true, SizeCl: true, OneSize: true },
          });
          if (!pi) continue;

          tmp.push({
            productId: pi.productId ?? pi.Product?.id!,
            productItemId: pi.id,
            cartItemId: null,
            quantity: qty,
            price: priceIn ?? Number(pi.price ?? pi.Product?.price ?? 0),
            name: givenName ?? pi.Product?.name ?? 'Товар',
            image: givenImage ?? (pi.Product as any)?.imageUrl ?? null,
            size: normalizeSize(
              givenSize ??
                (pi as any)?.sizeLabel ??
                (pi as any)?.size ??
                (pi as any)?.Size?.name ??
                (pi as any)?.SizeCl?.name ??
                (pi as any)?.OneSize?.name ??
                null,
            ),
          });
          continue;
        }

        if (productId) {
          const p = await prisma.product.findUnique({
            where: { id: productId },
          });
          if (!p) continue;

          tmp.push({
            productId: p.id,
            productItemId: null,
            cartItemId: null,
            quantity: qty,
            price: priceIn ?? Number((p as any).price ?? 0),
            name: givenName ?? p.name,
            image:
              givenImage ??
              ((p as any).imageUrl ?? (p as any).image ?? null),
            size: normalizeSize(givenSize ?? null),
          });
        }
      }

      itemsForCreate = tmp;
    }

    if (!itemsForCreate.length) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          message: 'Некорректные товары в корзине',
        },
        { status: 400 },
      );
    }

    const totalAmount = calcTotal(itemsForCreate);
    const token = crypto.randomUUID();

    // Nested create через связи + сохранение cartItemId в OrderItem
    const itemsCreate = itemsForCreate.map((i) => ({
      quantity: i.quantity,
      price: i.price,
      name: i.name,
      image: i.image,
      size: i.size,
      Product: { connect: { id: i.productId } },
      // если к позиции заказа привязан элемент корзины — подключаем relation
      ...(i.cartItemId
        ? {
            CartItem: {
              connect: { id: i.cartItemId },
            },
          }
        : {}),
    }));

    const order = await prisma.order.create({
      data: {
        ...(userId ? { User: { connect: { id: userId } } } : {}),
        token,
        totalAmount,
        status: 'PENDING',
        fullName,
        email,
        phone,
        address,
        comment,
        updatedAt: new Date(),
        OrderItem: { create: itemsCreate },
      },
      select: { id: true, token: true },
    });

    // Попытка отправить уведомление о новом заказе в Telegram
    try {
      await sendOrderNotificationToTelegram({
        orderId: order.id ?? order.token ?? 'unknown',
        token: order.token ?? null,
        amount: totalAmount,
        fullName,
        phone,
        email,
      });
    } catch (err) {
      console.error('[api.checkout] failed to send telegram notification', err);
    }

    const res = NextResponse.json({
      ok: true,
      success: true,
      orderId: order.id,
      token: order.token,
    });

    // Проставляем несколько куков с id заказа и токеном
    try {
      res.cookies.set('order_id', String(order.id), {
        path: '/',
        maxAge: 1800,
        sameSite: 'lax',
      });
      res.cookies.set('orderId', String(order.id), {
        path: '/',
        maxAge: 1800,
        sameSite: 'lax',
      });
      res.cookies.set('pending_order_id', String(order.id), {
        path: '/',
        maxAge: 1800,
        sameSite: 'lax',
      });
      res.cookies.set('last_order_id', String(order.id), {
        path: '/',
        maxAge: 1800,
        sameSite: 'lax',
      });
      res.cookies.set('order_token', token, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
    } catch {}

    return res;
  } catch (e: any) {
    console.error('[api.checkout] error', e?.message || e, e);
    return NextResponse.json(
      { ok: false, success: false, message: 'Server error' },
      { status: 500 },
    );
  }
}
