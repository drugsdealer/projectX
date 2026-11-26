// lib/cart-purchased.ts — после оплаты убираем купленные товары из корзины покупателя.
//
// Как находим позиции корзины:
//  1) по прямой ссылке OrderItem.cartItemId (если заказ оформлен из корзины в БД);
//  2) иначе по товару и размеру — в корзине вошедшего пользователя и/или в переданной корзине
//     (у гостя корзина определяется кукой cart_token, её передаёт /api/cart/purchased).
// Отложенные позиции («купить позже») не трогаем. Убираем только оплаченные заказы.

import { prisma } from "@/lib/prisma";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export async function removePurchasedFromCart(orderId: number, opts: { extraCartId?: number | null } = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      userId: true,
      OrderItem: { select: { cartItemId: true, productId: true, size: true, canceledAt: true } },
    },
  });
  if (!order || order.status !== "SUCCEEDED") return 0;

  const toDelete = new Set<number>();
  const items = order.OrderItem ?? [];

  // 1) прямые ссылки
  for (const it of items) if (it.cartItemId) toDelete.add(it.cartItemId);

  // 2) по товару и размеру
  const cartIds = new Set<number>();
  if (opts.extraCartId) cartIds.add(opts.extraCartId);
  if (order.userId) {
    const userCart = await prisma.cart.findFirst({ where: { userId: order.userId }, select: { id: true } });
    if (userCart) cartIds.add(userCart.id);
  }
  if (cartIds.size) {
    const cartItems = await prisma.cartItem.findMany({
      where: { cartId: { in: [...cartIds] }, postponed: false },
      select: { id: true, productId: true, ProductItem: { select: { productId: true } }, sizeLabel: true },
    });
    for (const it of items) {
      if (it.cartItemId) continue;
      const size = norm(it.size);
      const match = cartItems.find((ci) => {
        if (toDelete.has(ci.id)) return false;
        const pid = ci.productId ?? ci.ProductItem?.productId ?? null;
        if (pid !== it.productId) return false;
        const ciSize = norm(ci.sizeLabel);
        return !size || !ciSize || ciSize === size;
      });
      if (match) toDelete.add(match.id);
    }
  }

  if (!toDelete.size) return 0;
  // Ссылка из заказа на позицию корзины при удалении обнуляется (ON DELETE SET NULL) — заказ не страдает.
  const res = await prisma.cartItem.deleteMany({
    where: { id: { in: [...toDelete] }, postponed: false },
  });
  return res.count;
}
