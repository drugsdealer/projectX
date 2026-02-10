// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/session';
import { validatePromo } from '@/lib/promos';

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

const normalizeBrand = (v: any): string | null => {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  return s || null;
};

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
    let cartToken =
      typeof cartTokenRaw === 'string' && cartTokenRaw.trim()
        ? cartTokenRaw.trim()
        : null;
    if (!cartToken) {
      try {
        const jar = await cookies();
        cartToken = jar.get('cart_token')?.value ?? jar.get('cartToken')?.value ?? null;
      } catch {}
    }

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
    let useCartBasedFlow = !!(
      cartToken &&
      rawItems.some((it) => toNum(it?.cartItemId))
    );

    let itemsForCreate: ItemForCreate[] = [];

    const buildFromCart = async (cart: any): Promise<ItemForCreate[]> => {
      const out: ItemForCreate[] = [];
      const cartItems = Array.isArray(cart?.CartItem) ? cart.CartItem : [];
      for (const ci of cartItems) {
        if ((ci as any)?.postponed === true) continue;
        let productId = ci.productId ?? null;
        const sizeValue = normalizeSize(
          (ci as any).sizeLabel ??
            (ci as any).size ??
            (ci as any).Size?.name ??
            (ci as any).SizeCl?.name ??
            (ci as any).OneSize?.name ??
            null,
        );
        if (!productId && ci.productItemId) {
          const pi = await prisma.productItem.findUnique({
            where: { id: ci.productItemId },
            select: { productId: true },
          });
          productId = pi?.productId ?? null;
        }
        if (!productId) continue;
        out.push({
          productId,
          productItemId: ci.productItemId ?? null,
          cartItemId: ci.id,
          quantity: Number(ci.quantity || 1),
          price: Number(ci.price || 0),
          name: ci.name || 'Товар',
          image: ci.image ?? null,
          size: sizeValue,
        });
      }
      return out;
    };

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

      if (!selectedIds.length) {
        useCartBasedFlow = false;
      }

      if (!useCartBasedFlow) {
        // fallback to old flow below
      } else {
        let cartItems = cart.CartItem.filter((ci) =>
          selectedIds.includes(ci.id),
        );

        if (!cartItems.length && selectedIds.length) {
          // Fallback: try to resolve items directly by ids within user's cart or provided token
          try {
            cartItems = await prisma.cartItem.findMany({
              where: {
                id: { in: selectedIds },
                Cart: {
                  OR: [
                    ...(cartToken ? [{ token: cartToken }] : []),
                    ...(userId ? [{ userId }] : []),
                  ],
                },
              },
              include: { Size: true, SizeCl: true, OneSize: true },
            });
          } catch {}
        }

        if (!cartItems.length) {
          useCartBasedFlow = false;
        } else {
          // Если хоть один выбранный cartItem помечен как отложенный — уходим в fallback
          if ((cartItems as any[]).some((ci) => (ci as any)?.postponed === true)) {
            useCartBasedFlow = false;
          }
        }

        if (useCartBasedFlow) {
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
        }
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
          let p = await prisma.product.findFirst({
            where: { id: productId, deletedAt: null },
          });

          if (!p && (cartToken || userId)) {
            // productId мог быть cartItemId — пробуем резолв через корзину
            const cartItem = await prisma.cartItem.findFirst({
              where: {
                id: productId,
                ...(cartToken
                  ? { Cart: { token: cartToken } }
                  : userId
                  ? { Cart: { userId } }
                  : {}),
              },
            });
            if (cartItem?.productId) {
              p = await prisma.product.findFirst({
                where: { id: cartItem.productId, deletedAt: null },
              });
              if (p) {
                tmp.push({
                  productId: p.id,
                  productItemId: cartItem.productItemId ?? null,
                  cartItemId: cartItem.id,
                  quantity: qty || cartItem.quantity || 1,
                  price: priceIn ?? Number(cartItem.price ?? (p as any).price ?? 0),
                  name: givenName ?? cartItem.name ?? p.name,
                  image:
                    givenImage ??
                    cartItem.image ??
                    ((p as any).imageUrl ?? (p as any).image ?? null),
                  size: normalizeSize(cartItem.sizeLabel ?? givenSize ?? null),
                });
                continue;
              }
            }
          }

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

    if (!itemsForCreate.length && (cartToken || userId)) {
      // Последний fallback: берём все активные товары из корзины в БД
      const cart = await prisma.cart.findFirst({
        where: cartToken
          ? { token: cartToken }
          : userId
          ? { userId }
          : undefined,
        include: { CartItem: { include: { Size: true, SizeCl: true, OneSize: true } } },
      });
      if (cart) {
        itemsForCreate = await buildFromCart(cart);
      }
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

    const subtotal = calcTotal(itemsForCreate);
    const promoRaw = body?.promo?.code ? String(body.promo.code) : "";
    const promoCode = promoRaw.trim() ? promoRaw.trim().toUpperCase() : null;
    let promoMeta: { code: string; type: "PERCENT" | "AMOUNT"; value: number } | null = null;
    let discountAmount = 0;

    let promoRules: { appliesTo: "ALL" | "PREMIUM_ONLY" | "NON_PREMIUM_ONLY"; excludedBrands: string[] } | null = null;
    let eligibleSubtotal = subtotal;
    let eligibleItemIdx: number[] = [];

    if (promoCode) {
      if (!userId) {
        return NextResponse.json(
          { ok: false, success: false, message: 'Для промокода требуется вход в аккаунт' },
          { status: 401 },
        );
      }

      // правила применения (premium/brand)
      const promoRawRule = await prisma.promoCode.findUnique({
        where: { code: promoCode },
        select: { appliesTo: true, excludedBrands: true },
      });
      promoRules = {
        appliesTo:
          promoRawRule?.appliesTo === "PREMIUM_ONLY" || promoRawRule?.appliesTo === "NON_PREMIUM_ONLY"
            ? promoRawRule.appliesTo
            : "ALL",
        excludedBrands: Array.isArray(promoRawRule?.excludedBrands)
          ? promoRawRule!.excludedBrands.map((b: any) => String(b).trim().toLowerCase()).filter(Boolean)
          : [],
      };

      const productIds = Array.from(new Set(itemsForCreate.map((it) => it.productId)));
      const productMeta = await prisma.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        select: { id: true, premium: true, Brand: { select: { name: true } } },
      });
      const metaById = new Map<number, { premium: boolean; brand: string | null }>();
      productMeta.forEach((p) => {
        metaById.set(p.id, {
          premium: Boolean(p.premium),
          brand: normalizeBrand(p.Brand?.name ?? null),
        });
      });

      const isEligible = (it: ItemForCreate) => {
        if (!promoRules) return true;
        const meta = metaById.get(it.productId);
        const isPremium = meta?.premium ?? false;
        const brand = meta?.brand ?? null;
        if (promoRules.appliesTo === "PREMIUM_ONLY" && !isPremium) return false;
        if (promoRules.appliesTo === "NON_PREMIUM_ONLY" && isPremium) return false;
        if (brand && promoRules.excludedBrands.includes(brand)) return false;
        return true;
      };

      eligibleItemIdx = itemsForCreate
        .map((it, idx) => (isEligible(it) ? idx : -1))
        .filter((i) => i >= 0);
      const eligibleItems = eligibleItemIdx.map((idx) => itemsForCreate[idx]);
      eligibleSubtotal = calcTotal(eligibleItems);

      if (!eligibleSubtotal || eligibleSubtotal <= 0) {
        return NextResponse.json(
          { ok: false, success: false, message: 'Промокод не подходит к выбранным товарам' },
          { status: 400 },
        );
      }

      const validation = await validatePromo({ code: promoCode, userId, subtotal: eligibleSubtotal });
      if (!validation.ok || validation.alreadyUsed) {
        return NextResponse.json(
          { ok: false, success: false, message: validation.error || 'Промокод недоступен' },
          { status: 400 },
        );
      }
      if (validation.code?.type === "percent") {
        promoMeta = { code: promoCode, type: "PERCENT", value: validation.code.value };
        discountAmount = Math.floor((eligibleSubtotal * validation.code.value) / 100);
      } else if (validation.code?.type === "amount") {
        promoMeta = { code: promoCode, type: "AMOUNT", value: validation.code.value };
        discountAmount = validation.code.value;
      }
      discountAmount = Math.max(0, Math.min(eligibleSubtotal, Number(discountAmount || 0)));
    }

    const totalAmount = Math.max(0, subtotal - discountAmount);
    const token = crypto.randomUUID();

    // Nested create через связи + сохранение cartItemId в OrderItem
    const adjustedItems =
      discountAmount > 0
        ? (() => {
            const eligibleSet = new Set(eligibleItemIdx);
            const totalEligible = eligibleSubtotal || 0;
            let remaining = discountAmount;
            const lastEligibleIdx = eligibleItemIdx.length ? eligibleItemIdx[eligibleItemIdx.length - 1] : -1;
            return itemsForCreate.map((it, idx) => {
              if (!eligibleSet.has(idx)) return it;
              const itemTotal = Number(it.price || 0) * Number(it.quantity || 1);
              let share = 0;
              if (idx !== lastEligibleIdx) {
                share = totalEligible > 0 ? Math.round((discountAmount * itemTotal) / totalEligible) : 0;
                remaining -= share;
              } else {
                share = remaining;
              }
              const newTotal = Math.max(0, itemTotal - share);
              const newPrice = Number(it.quantity || 1) > 0 ? newTotal / Number(it.quantity || 1) : it.price;
              return { ...it, price: Math.round(Number(newPrice) || 0) };
            });
          })()
        : itemsForCreate;

    const itemsCreate = adjustedItems.map((i) => ({
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
        ...(promoMeta
          ? {
              promoCode: promoMeta.code,
              promoDiscountType: promoMeta.type,
              promoDiscountValue: promoMeta.value,
            }
          : {}),
        updatedAt: new Date(),
        OrderItem: { create: itemsCreate },
      },
      select: { id: true, token: true },
    });

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
