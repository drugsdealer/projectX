import { prisma } from "@/lib/prisma";
import { beautyProgress, isBeautyPromoActive } from "@/lib/promo-beauty";

/** Подарки по акции «Бьюти-неделя», положенные к заказу: ["косметичка Dior"]. Ошибка — пустой список. */
export async function getOrderBeautyGifts(orderId: number): Promise<string[]> {
  if (!isBeautyPromoActive() || !Number.isFinite(orderId)) return [];
  try {
    const items = await prisma.orderItem.findMany({
      where: { orderId, canceledAt: null },
      select: {
        price: true,
        quantity: true,
        Product: { select: { Brand: { select: { name: true } }, Category: { select: { slug: true } } } },
      },
    });
    return beautyProgress(
      items.map((i) => ({
        brand: i.Product?.Brand?.name,
        category: i.Product?.Category?.slug,
        price: i.price,
        quantity: i.quantity,
      }))
    )
      .filter((p) => p.eligible)
      .map((p) => p.brand.gift);
  } catch {
    return [];
  }
}
