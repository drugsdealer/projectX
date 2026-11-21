import { prisma } from "@/lib/prisma";
import { beautyProgress, findPouch, isBeautyPromoActive, randomPouch, sanitizeGiftChoice } from "@/lib/promo-beauty";

/**
 * Подарок по акции «Бьюти-неделя», положенный к заказу — строка для менеджера:
 * ["косметичка Dior: Miss Dior с бантом (выбор покупателя)"]. Не положен или ошибка — пустой список.
 */
export async function getOrderBeautyGifts(orderId: number): Promise<string[]> {
  if (!isBeautyPromoActive() || !Number.isFinite(orderId)) return [];
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        giftChoice: true,
        OrderItem: {
          where: { canceledAt: null },
          select: {
            price: true,
            quantity: true,
            Product: { select: { Brand: { select: { name: true } }, Category: { select: { slug: true } } } },
          },
        },
      },
    });
    if (!order) return [];
    const progress = beautyProgress(
      order.OrderItem.map((i) => ({
        brand: i.Product?.Brand?.name,
        category: i.Product?.Category?.slug,
        price: i.price,
        quantity: i.quantity,
      }))
    );
    if (!progress.eligible) return [];
    const chosen = findPouch(sanitizeGiftChoice(order.giftChoice));
    const pouch = chosen ?? randomPouch(orderId);
    return [
      `${pouch.brand.gift}: ${pouch.name} (${chosen ? "выбор покупателя" : "покупатель не выбрал — случайная"})`,
    ];
  } catch {
    return [];
  }
}
