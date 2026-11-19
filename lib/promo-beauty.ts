/**
 * Акция «Бьюти-неделя»: косметичка бренда в подарок к заказу косметики этого бренда от THRESHOLD ₽.
 *
 * Все условия акции — здесь. Страница /beauty-week, баннер на главной и пометка о подарке
 * в Telegram-уведомлении о заказе читают их отсюда.
 *
 * Бренды показываются на сайте только если в каталоге есть их косметика:
 * добавите товары Gucci в категорию «Косметика» — Gucci сам появится в баннере и на странице.
 */

export const BEAUTY_PROMO = {
  path: "/beauty-week",
  title: "Бьюти-неделя",
  /** Минимальная сумма заказа косметики одного бренда, ₽. */
  threshold: 10_000,
  /** Категории, покупки в которых идут в зачёт. */
  categorySlugs: ["cosmetics", "fragrance"] as const,
  /** Дата окончания (YYYY-MM-DD) или null — тогда сроки на сайте не пишем. */
  endsAt: null as string | null,
  brands: [
    {
      key: "dior",
      name: "Dior",
      gift: "косметичка Dior",
      cover: "/promo/beauty-week/dior-pink-scene.webp",
      giftPhoto: "/promo/beauty-week/dior-pouch-set.webp",
    },
    {
      key: "gucci",
      name: "Gucci",
      gift: "косметичка Gucci",
      cover: "/promo/beauty-week/gucci-bloom.webp",
      giftPhoto: null as string | null,
    },
  ],
} as const;

export type BeautyBrand = (typeof BEAUTY_PROMO.brands)[number];

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

/** Бренд акции по названию бренда товара (Dior, DIOR, Christian Dior → dior). */
export function beautyBrandOf(brandName: unknown): BeautyBrand | null {
  const n = norm(brandName);
  if (!n) return null;
  return BEAUTY_PROMO.brands.find((b) => n === b.key || n.includes(b.key)) ?? null;
}

export function isBeautyCategory(slug: unknown) {
  const s = norm(slug);
  return (BEAUTY_PROMO.categorySlugs as readonly string[]).includes(s) || s === "косметика" || s === "парфюмерия";
}

export type BeautyLine = { brand: unknown; category: unknown; price: number; quantity: number };

export type BeautyProgress = {
  brand: BeautyBrand;
  total: number;
  remaining: number;
  eligible: boolean;
};

/** Сколько набрано по каждому бренду акции. Пустой массив — в заказе нет косметики брендов акции. */
export function beautyProgress(lines: BeautyLine[]): BeautyProgress[] {
  const totals = new Map<string, number>();
  for (const l of lines) {
    const brand = beautyBrandOf(l.brand);
    if (!brand || !isBeautyCategory(l.category)) continue;
    const sum = Math.max(0, Number(l.price) || 0) * Math.max(0, Number(l.quantity) || 0);
    totals.set(brand.key, (totals.get(brand.key) ?? 0) + sum);
  }
  return BEAUTY_PROMO.brands
    .filter((b) => totals.has(b.key))
    .map((brand) => {
      const total = Math.round(totals.get(brand.key) ?? 0);
      return {
        brand,
        total,
        remaining: Math.max(0, BEAUTY_PROMO.threshold - total),
        eligible: total >= BEAUTY_PROMO.threshold,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Акция идёт (если дата окончания не задана — идёт). */
export function isBeautyPromoActive(now = new Date()) {
  if (!BEAUTY_PROMO.endsAt) return true;
  return now.getTime() <= new Date(`${BEAUTY_PROMO.endsAt}T23:59:59+03:00`).getTime();
}

export const formatRub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
