/**
 * Персональная лента главной: смешивает категории пропорционально интересу пользователя.
 *
 * Пример: косметика 70% интереса, обувь 30% → в ленте примерно 2 из 3 карточек — косметика,
 * но идут они вперемешку (К, О, К, К, О, К…), а не блоками. Небольшая доля (EXPLORE)
 * отдаётся остальным категориям, чтобы человек видел и новое.
 *
 * Чистые функции без React и браузерных API — категории и подкатегории передаются
 * уже нормализованными через колбэки.
 */
import type { InterestModel } from "@/lib/user-behavior";

export const PERSONAL_MIX_KEY = "for-you";

/** Доля ленты, которая отдаётся категориям вне интересов пользователя. */
const EXPLORE = 0.15;
/** Сколько сигналов нужно, чтобы вообще показывать персональную ленту. */
export const MIN_SIGNALS_FOR_MIX = 3;

export type FeedProduct = {
  id: number | string;
  price?: number | null;
  brandId?: number | null;
  brandName?: string | null;
  brand?: string | null;
  gender?: string | null;
  createdAt?: string | Date | null;
};

export type FeedHelpers<P> = {
  categoryOf: (p: P) => string;
  subcategoryOf: (p: P) => string | null;
};

/** Детерминированный ГПСЧ: одна и та же лента в рамках одного открытия страницы. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Доли интереса по категориям в ключах главной (footwear, cosmetics…), сумма = 1. */
export function categoryShares(model: InterestModel, normalize: (slug: string) => string) {
  const out: Record<string, number> = {};
  for (const [slug, w] of Object.entries(model.categories)) {
    const key = normalize(slug);
    if (!key || key === "other") continue;
    out[key] = (out[key] ?? 0) + w;
  }
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (total <= 0) return {};
  for (const k of Object.keys(out)) out[k] /= total;
  return out;
}

/**
 * Насколько товар подходит пользователю (без учёта категории — она решается квотами).
 * jitter — случайная добавка, чтобы лента не была одинаковой при каждом заходе.
 */
export function scoreProduct<P extends FeedProduct>(
  p: P,
  model: InterestModel,
  helpers: FeedHelpers<P>,
  jitter = 0
): number {
  let s = 0;

  const bid = Number(p.brandId);
  const bname = String(p.brandName ?? p.brand ?? "").trim().toLowerCase();
  const brandW = (Number.isFinite(bid) && model.brandIds[bid]) || (bname && model.brandNames[bname]) || 0;
  s += 3 * brandW;

  const sub = helpers.subcategoryOf(p);
  if (sub) {
    const maxSub = Math.max(0, ...Object.values(model.subcategories));
    if (maxSub > 0) s += 2 * ((model.subcategories[sub] ?? 0) / maxSub);
  }

  const views = model.productViews[Number(p.id)] ?? 0;
  if (views >= 2) s += 1.5; // возвращался — явно хочет
  else if (views === 1) s += 0.3;

  const price = Number(p.price);
  if (model.avgPrice && price > 0) {
    const d = Math.log(price / model.avgPrice);
    s += 1.2 * Math.exp(-(d * d) / 0.5); // ближе к привычному чеку — выше
  }

  if (model.gender) {
    const g = String(p.gender ?? "").toLowerCase();
    const opposite = model.gender === "men" ? ["women", "female"] : ["men", "male"];
    if (opposite.includes(g)) s -= 2.5;
  }

  if (p.createdAt) {
    const ageDays = (Date.now() - new Date(p.createdAt).getTime()) / 86_400_000;
    if (ageDays >= 0 && ageDays < 30) s += 0.5 * (1 - ageDays / 30); // свежие поступления
  }

  return s + jitter;
}

/**
 * Собирает смешанную ленту. Категории чередуются по алгоритму «плавного взвешенного
 * кругового обхода» (как балансировщики нагрузки): категория с долей 60% получает
 * примерно 6 мест из 10, и они распределены по ленте равномерно.
 */
export function buildPersonalMix<P extends FeedProduct>(
  catalog: P[],
  model: InterestModel,
  helpers: FeedHelpers<P> & { normalizeCategory: (slug: string) => string },
  opts: { limit?: number; seed?: number } = {}
): P[] {
  const limit = opts.limit ?? 60;
  if (model.signalCount < MIN_SIGNALS_FOR_MIX) return [];

  const interest = categoryShares(model, helpers.normalizeCategory);
  if (!Object.keys(interest).length) return [];

  const rand = seededRandom(opts.seed ?? 1);
  const purchased = new Set(model.purchasedIds);

  const byCat: Record<string, { p: P; s: number }[]> = {};
  for (const p of catalog) {
    if (purchased.has(Number(p.id))) continue;
    const cat = helpers.categoryOf(p);
    if (!cat || cat === "other") continue;
    (byCat[cat] ||= []).push({ p, s: scoreProduct(p, model, helpers, rand() * 0.8) });
  }
  const cats = Object.keys(byCat);
  if (!cats.length) return [];
  for (const c of cats) byCat[c].sort((a, b) => b.s - a.s);

  // Если интересная категория пуста (всё раскупили), её доля уходит остальным интересам.
  const interestTotal = cats.reduce((sum, c) => sum + (interest[c] ?? 0), 0);
  const explore = interestTotal > 0 ? EXPLORE : 1;
  const share: Record<string, number> = {};
  for (const c of cats) {
    const own = interestTotal > 0 ? (interest[c] ?? 0) / interestTotal : 0;
    share[c] = (1 - explore) * own + explore / cats.length;
  }

  const current: Record<string, number> = Object.fromEntries(cats.map((c) => [c, 0]));
  const out: P[] = [];
  const recentBrands: string[] = [];

  while (out.length < limit) {
    const active = cats.filter((c) => byCat[c].length > 0);
    if (!active.length) break;
    const total = active.reduce((sum, c) => sum + share[c], 0);
    let pick = active[0];
    for (const c of active) {
      current[c] += share[c];
      if (current[c] > current[pick]) pick = c;
    }
    current[pick] -= total;

    // Не ставим подряд три вещи одного бренда, если в категории есть близкая по рейтингу альтернатива.
    const list = byCat[pick];
    let idx = 0;
    for (let i = 0; i < Math.min(list.length, 4); i++) {
      const b = String(list[i].p.brandName ?? list[i].p.brand ?? list[i].p.brandId ?? "").toLowerCase();
      if (!b || !recentBrands.includes(b)) { idx = i; break; }
    }
    const [chosen] = list.splice(idx, 1);
    out.push(chosen.p);
    const b = String(chosen.p.brandName ?? chosen.p.brand ?? chosen.p.brandId ?? "").toLowerCase();
    recentBrands.push(b);
    if (recentBrands.length > 2) recentBrands.shift();
  }

  return out;
}

/** Порядок разделов-категорий: сначала те, к которым есть заметный интерес (по убыванию). */
export function orderSectionsByInterest(base: string[], shares: Record<string, number>, minShare = 0.08) {
  const preferred = base
    .filter((k) => (shares[k] ?? 0) >= minShare)
    .sort((a, b) => (shares[b] ?? 0) - (shares[a] ?? 0));
  return [...preferred, ...base.filter((k) => !preferred.includes(k))];
}
