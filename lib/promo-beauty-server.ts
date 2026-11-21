import { prisma } from "@/lib/prisma";
import {
  beautyProgress,
  findPouch,
  isBeautyPromoActive,
  randomPouch,
  sanitizeGiftChoice,
} from "@/lib/promo-beauty";

/**
 * Подарки по акции «Бьюти-неделя», положенные к заказу — строки для менеджера:
 * ["косметичка Dior: Miss Dior с бантом (выбор покупателя)"]. Ошибка — пустой список.
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
    const choice = sanitizeGiftChoice(order.giftChoice);
    return beautyProgress(
      order.OrderItem.map((i) => ({
        brand: i.Product?.Brand?.name,
        category: i.Product?.Category?.slug,
        price: i.price,
        quantity: i.quantity,
      }))
    )
      .filter((p) => p.eligible)
      .map(({ brand }) => {
        const chosen = findPouch(brand, choice[brand.key]);
        const pouch = chosen ?? randomPouch(brand, orderId);
        return `${brand.gift}: ${pouch.name} (${chosen ? "выбор покупателя" : "покупатель не выбрал — случайная"})`;
      });
  } catch {
    return [];
  }
}
