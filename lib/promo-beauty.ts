/**
 * Акция «Бьюти-неделя»: одна косметичка на выбор (любого бренда акции) в подарок к заказу,
 * в котором косметики и парфюма брендов акции (Dior, Gucci — вместе) на THRESHOLD ₽ и больше.
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
  /** Минимальная общая сумма косметики и парфюма брендов акции в заказе, ₽. */
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
      pouches: [
        { id: "dior-miss-bow", name: "Miss Dior с бантом", note: "Нежно-розовая, металлический CD", image: "/promo/beauty-week/pouch-dior-miss-bow.webp" },
        { id: "dior-white-cd", name: "Белая с тиснением CD", note: "Фактурная ткань, золотая молния", image: "/promo/beauty-week/pouch-dior-white-cd.webp" },
        { id: "dior-red-stripe", name: "Christian Dior Paris", note: "Белый клатч с красной лентой", image: "/promo/beauty-week/pouch-dior-red-stripe.webp" },
      ],
    },
    {
      key: "gucci",
      name: "Gucci",
      gift: "косметичка Gucci",
      cover: "/promo/beauty-week/gucci-bloom.webp",
      giftPhoto: null as string | null,
      pouches: [
        { id: "gucci-gold", name: "Золотистая Gucci beauty", note: "Мягкая, с тиснением логотипа", image: "/promo/beauty-week/pouch-gucci-gold.webp" },
        { id: "gucci-black", name: "Чёрная с карманом", note: "Плотная, с наружным карманом", image: "/promo/beauty-week/pouch-gucci-black.webp" },
        { id: "gucci-navy", name: "Тёмно-синий клатч", note: "Плоский, с петлёй на запястье", image: "/promo/beauty-week/pouch-gucci-navy.webp" },
      ],
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
  /** Сумма косметики и парфюма брендов акции (все бренды вместе). */
  total: number;
  remaining: number;
  eligible: boolean;
  /** Бренды акции, которые есть в заказе — по убыванию суммы. */
  brands: BeautyBrand[];
};

/** Сколько набрано на подарок. Бренды акции суммируются: Gucci 6 000 + Dior 4 000 = 10 000. */
export function beautyProgress(lines: BeautyLine[]): BeautyProgress {
  const byBrand = new Map<string, number>();
  for (const l of lines) {
    const brand = beautyBrandOf(l.brand);
    if (!brand || !isBeautyCategory(l.category)) continue;
    const sum = Math.max(0, Number(l.price) || 0) * Math.max(0, Number(l.quantity) || 0);
    byBrand.set(brand.key, (byBrand.get(brand.key) ?? 0) + sum);
  }
  const total = Math.round([...byBrand.values()].reduce((a, b) => a + b, 0));
  return {
    total,
    remaining: Math.max(0, BEAUTY_PROMO.threshold - total),
    eligible: total >= BEAUTY_PROMO.threshold,
    brands: BEAUTY_PROMO.brands
      .filter((b) => byBrand.has(b.key))
      .sort((a, b) => (byBrand.get(b.key) ?? 0) - (byBrand.get(a.key) ?? 0)),
  };
}

/** Акция идёт (если дата окончания не задана — идёт). */
export function isBeautyPromoActive(now = new Date()) {
  if (!BEAUTY_PROMO.endsAt) return true;
  return now.getTime() <= new Date(`${BEAUTY_PROMO.endsAt}T23:59:59+03:00`).getTime();
}

export const formatRub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

// ── Выбор косметички ──────────────────────────────────────────────────────────
// Одна косметичка на заказ, любого бренда акции (можно заказать Gucci и выбрать Dior).
// Покупатель выбирает на странице акции; id лежит в куке и при оформлении попадает в заказ
// (Order.giftChoice). Не выбрал — менеджер получает случайную, выбранную при уведомлении.

export const BEAUTY_GIFT_COOKIE = "beauty_gift";

export type BeautyPouch = BeautyBrand["pouches"][number] & { brand: BeautyBrand };

/** Все косметички акции по порядку брендов. */
export const BEAUTY_POUCHES: BeautyPouch[] = BEAUTY_PROMO.brands.flatMap((brand) =>
  brand.pouches.map((p) => ({ ...p, brand }))
);

export function findPouch(id?: string | null): BeautyPouch | null {
  return (id && BEAUTY_POUCHES.find((p) => p.id === id)) || null;
}

/**
 * id выбранной косметички или null. Кука приходит от браузера, поэтому принимаем только
 * известные id: просто строку, JSON {"pouch":"…"} или старый формат {"dior":"…"}.
 */
export function sanitizeGiftChoice(raw: unknown): string | null {
  let value: any = raw;
  if (typeof value === "string") {
    let text = value.trim();
    try {
      text = decodeURIComponent(text);
    } catch {
      /* уже раскодировано */
    }
    if (findPouch(text)) return text;
    try {
      value = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const candidates = [value.pouch, ...Object.values(value)];
  for (const c of candidates) if (typeof c === "string" && findPouch(c)) return c;
  return null;
}

/** Случайная, но стабильная для заказа косметичка (одна и та же при повторных уведомлениях). */
export function randomPouch(seed: number): BeautyPouch {
  const i = Math.abs(Math.imul(seed ^ 0x9e3779b9, 2654435761)) % BEAUTY_POUCHES.length;
  return BEAUTY_POUCHES[i];
}
