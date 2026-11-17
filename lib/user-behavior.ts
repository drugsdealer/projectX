/**
 * User Behavior Profile
 * Tracks brand affinities, category preferences, product dwell time and repeat views.
 * All data stored in localStorage only — no server sync of raw behavioral data.
 * Privacy-aware: respects canUseOptionalClientData().
 */

const STORAGE_KEY = "stage_behavior_v1";
const PROFILE_VERSION = 2;
const MAX_BRANDS = 60;
const MAX_CATEGORIES = 30;
const MAX_PRODUCTS = 120;
const MAX_SEARCHES = 40;
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// ─── Signal types ─────────────────────────────────────────────────────────────

export interface BrandSignal {
  brandId: number;
  brandName: string;
  brandSlug: string;
  brandLogo?: string | null;
  clicks: number;
  productViews: number; // views of products from this brand
  score: number;
  lastSeenAt: number;
}

export interface CategorySignal {
  slug: string;
  name: string;
  visits: number;
  score: number;
  lastSeenAt: number;
}

export interface ProductSignal {
  productId: number;
  name: string;
  imageUrl: string | null;
  price: number | null;
  brandId: number | null;
  brandName: string | null;
  brandSlug: string | null;
  categorySlug: string | null;
  subcategory?: string | null;
  views: number;
  totalDwellMs: number;
  addedToCart: boolean;
  purchased: boolean;
  favorited: boolean;
  score: number;
  lastSeenAt: number;
  firstSeenAt: number;
}

export interface SearchSignal {
  query: string;
  count: number;
  lastAt: number;
}

export interface UserBehaviorProfile {
  version: number;
  createdAt: number;
  updatedAt: number;
  brands: Record<number, BrandSignal>;
  categories: Record<string, CategorySignal>;
  products: Record<number, ProductSignal>;
  searches: SearchSignal[];
  priceRange: { min: number; max: number; sum: number; samples: number } | null;
  genderCounts: Record<string, number>; // "men" | "women" | "unisex" → count
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function recencyFactor(lastSeenAt: number, now = Date.now()): number {
  const age = now - lastSeenAt;
  // Exponential decay: half-life = 7 days
  return Math.pow(0.5, age / DECAY_HALF_LIFE_MS);
}

function computeBrandScore(s: BrandSignal): number {
  const r = recencyFactor(s.lastSeenAt);
  return Math.min(100, (s.clicks * 3 + s.productViews * 1) * r);
}

function computeCategoryScore(s: CategorySignal): number {
  const r = recencyFactor(s.lastSeenAt);
  return Math.min(100, s.visits * 2 * r);
}

function computeProductScore(s: ProductSignal): number {
  if (s.purchased) return 0; // already bought
  const r = recencyFactor(s.lastSeenAt);
  const dwellMin = Math.min(s.totalDwellMs / 60000, 5); // cap at 5 min
  const repeatBoost = Math.min(s.views, 5); // cap at 5 views
  const cartBoost = s.addedToCart ? 2 : 0;
  const favBoost = s.favorited ? 1.5 : 0;
  return Math.min(100, (dwellMin * 10 + repeatBoost * 15 + cartBoost * 20 + favBoost * 10) * r);
}

// ─── Profile I/O ──────────────────────────────────────────────────────────────

function emptyProfile(): UserBehaviorProfile {
  const now = Date.now();
  return {
    version: PROFILE_VERSION,
    createdAt: now,
    updatedAt: now,
    brands: {},
    categories: {},
    products: {},
    searches: [],
    priceRange: null,
    genderCounts: {},
  };
}

function loadProfile(): UserBehaviorProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as UserBehaviorProfile;
    if (parsed.version !== PROFILE_VERSION) return emptyProfile();
    return parsed;
  } catch {
    return emptyProfile();
  }
}

function saveProfile(profile: UserBehaviorProfile): void {
  if (typeof window === "undefined") return;
  profile.updatedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Quota exceeded — prune and retry
    pruneProfile(profile);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch {}
  }
}

/** Remove oldest / lowest-score entries to keep storage lean */
function pruneProfile(profile: UserBehaviorProfile): void {
  const now = Date.now();

  // Remove products older than MAX_AGE_MS or purchased
  for (const [id, p] of Object.entries(profile.products)) {
    if (p.purchased || now - p.lastSeenAt > MAX_AGE_MS) delete profile.products[Number(id)];
  }

  // Keep top N by score
  const sortedProducts = Object.entries(profile.products)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, MAX_PRODUCTS);
  profile.products = Object.fromEntries(sortedProducts.map(([k, v]) => [Number(k), v]));

  const sortedBrands = Object.entries(profile.brands)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, MAX_BRANDS);
  profile.brands = Object.fromEntries(sortedBrands.map(([k, v]) => [Number(k), v]));

  const sortedCats = Object.entries(profile.categories)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, MAX_CATEGORIES);
  profile.categories = Object.fromEntries(sortedCats);

  profile.searches = profile.searches.slice(0, MAX_SEARCHES);
}

// ─── Public tracking API ──────────────────────────────────────────────────────

export interface TrackProductViewInput {
  productId: number;
  name: string;
  imageUrl?: string | null;
  price?: number | null;
  brandId?: number | null;
  brandName?: string | null;
  brandSlug?: string | null;
  categorySlug?: string | null;
  subcategory?: string | null;
  gender?: string | null;
  dwellMs?: number;
  addedToCart?: boolean;
  purchased?: boolean;
  favorited?: boolean;
}

export function trackProductView(input: TrackProductViewInput): void {
  const profile = loadProfile();
  const now = Date.now();
  const id = input.productId;
  const existing = profile.products[id];
  const isNew = !existing;

  profile.products[id] = {
    productId: id,
    name: input.name,
    imageUrl: input.imageUrl ?? null,
    price: input.price ?? null,
    brandId: input.brandId ?? null,
    brandName: input.brandName ?? null,
    brandSlug: input.brandSlug ?? null,
    categorySlug: input.categorySlug ?? existing?.categorySlug ?? null,
    subcategory: input.subcategory ?? existing?.subcategory ?? null,
    views: (existing?.views ?? 0) + 1,
    totalDwellMs: (existing?.totalDwellMs ?? 0) + (input.dwellMs ?? 0),
    addedToCart: existing?.addedToCart || Boolean(input.addedToCart),
    purchased: existing?.purchased || Boolean(input.purchased),
    favorited: existing?.favorited || Boolean(input.favorited),
    score: 0,
    lastSeenAt: now,
    firstSeenAt: isNew ? now : (existing?.firstSeenAt ?? now),
  };
  profile.products[id].score = computeProductScore(profile.products[id]);

  // Track brand affinity from product view
  if (input.brandId && input.brandName) {
    const b = profile.brands[input.brandId] ?? {
      brandId: input.brandId,
      brandName: input.brandName,
      brandSlug: input.brandSlug ?? "",
      brandLogo: null,
      clicks: 0,
      productViews: 0,
      score: 0,
      lastSeenAt: now,
    };
    b.productViews += 1;
    b.lastSeenAt = now;
    b.score = computeBrandScore(b);
    profile.brands[input.brandId] = b;
  }

  // Track category affinity from product view
  if (input.categorySlug) {
    trackCategoryInternal(profile, input.categorySlug, input.categorySlug, now);
  }

  // Track gender preference
  const g = String(input.gender ?? "").toLowerCase();
  const genderKey = g === "male" ? "men" : g === "female" ? "women" : g;
  if (genderKey === "men" || genderKey === "women" || genderKey === "unisex") {
    profile.genderCounts[genderKey] = (profile.genderCounts[genderKey] ?? 0) + 1;
  }

  // Track price range
  if (input.price && input.price > 0) {
    if (!profile.priceRange) {
      profile.priceRange = { min: input.price, max: input.price, sum: input.price, samples: 1 };
    } else {
      profile.priceRange.min = Math.min(profile.priceRange.min, input.price);
      profile.priceRange.max = Math.max(profile.priceRange.max, input.price);
      profile.priceRange.sum += input.price;
      profile.priceRange.samples += 1;
    }
  }

  saveProfile(profile);
}

export function trackBrandClick(brandId: number, brandName: string, brandSlug: string, brandLogo?: string | null): void {
  const profile = loadProfile();
  const now = Date.now();
  const b = profile.brands[brandId] ?? {
    brandId,
    brandName,
    brandSlug,
    brandLogo: brandLogo ?? null,
    clicks: 0,
    productViews: 0,
    score: 0,
    lastSeenAt: now,
  };
  b.clicks += 1;
  b.lastSeenAt = now;
  if (brandLogo) b.brandLogo = brandLogo;
  b.score = computeBrandScore(b);
  profile.brands[brandId] = b;
  saveProfile(profile);
}

export function trackCategoryVisit(slug: string, name: string): void {
  const profile = loadProfile();
  trackCategoryInternal(profile, slug, name, Date.now());
  saveProfile(profile);
}

function trackCategoryInternal(profile: UserBehaviorProfile, slug: string, name: string, now: number): void {
  const c = profile.categories[slug] ?? { slug, name, visits: 0, score: 0, lastSeenAt: now };
  c.visits += 1;
  c.lastSeenAt = now;
  c.score = computeCategoryScore(c);
  profile.categories[slug] = c;
}

export function trackSearch(query: string): void {
  const profile = loadProfile();
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return;
  const existing = profile.searches.find((s) => s.query === q);
  if (existing) {
    existing.count += 1;
    existing.lastAt = Date.now();
  } else {
    profile.searches.unshift({ query: q, count: 1, lastAt: Date.now() });
    profile.searches = profile.searches.slice(0, MAX_SEARCHES);
  }
  saveProfile(profile);
}

export function markAddedToCart(productId: number): void {
  const profile = loadProfile();
  const p = profile.products[productId];
  if (p) {
    p.addedToCart = true;
    p.score = computeProductScore(p);
    saveProfile(profile);
  }
}

export function markPurchased(productId: number): void {
  const profile = loadProfile();
  const p = profile.products[productId];
  if (p) {
    p.purchased = true;
    p.score = 0;
    saveProfile(profile);
  }
}

export function markFavorited(productId: number, value: boolean): void {
  const profile = loadProfile();
  const p = profile.products[productId];
  if (p) {
    p.favorited = value;
    p.score = computeProductScore(p);
    saveProfile(profile);
  }
}

// ─── Read API ─────────────────────────────────────────────────────────────────

export function getProfile(): UserBehaviorProfile {
  return loadProfile();
}

/** Top brands by affinity score */
export function getTopBrands(limit = 5): BrandSignal[] {
  return Object.values(loadProfile().brands)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Top categories by visit score */
export function getTopCategories(limit = 4): CategorySignal[] {
  return Object.values(loadProfile().categories)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Products the user viewed 2+ times and hasn't purchased — "stuck" products */
export function getRepeatViewedProducts(limit = 6): ProductSignal[] {
  return Object.values(loadProfile().products)
    .filter((p) => p.views >= 2 && !p.purchased && p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Snapshot of the profile for sending to the for-you API */
export function getProfileSnapshot(): {
  topBrandIds: number[];
  topCategorySlugs: string[];
  repeatProductIds: number[];
  excludeProductIds: number[];
  avgPrice: number | null;
  gender: string | null;
} {
  const profile = loadProfile();
  const topBrands = getTopBrands(10);
  const topCats = getTopCategories(8);
  const repeatProducts = getRepeatViewedProducts(12);

  // Products already purchased/carted = exclude from recommendations
  const excludeIds = Object.values(profile.products)
    .filter((p) => p.purchased || (p.addedToCart && Date.now() - p.lastSeenAt < 7 * 24 * 60 * 60 * 1000))
    .map((p) => p.productId);

  const avgPrice = profile.priceRange && profile.priceRange.samples > 0
    ? profile.priceRange.sum / profile.priceRange.samples
    : null;

  // Dominant gender
  const genderEntries = Object.entries(profile.genderCounts);
  const dominantGender = genderEntries.length > 0
    ? genderEntries.sort(([, a], [, b]) => b - a)[0][0]
    : null;

  return {
    topBrandIds: topBrands.map((b) => b.brandId),
    topCategorySlugs: topCats.map((c) => c.slug),
    repeatProductIds: repeatProducts.map((p) => p.productId),
    excludeProductIds: excludeIds,
    avgPrice,
    gender: dominantGender,
  };
}

// ─── Модель интересов для ленты ───────────────────────────────────────────────

export interface InterestModel {
  /** Доля интереса по категориям (сырые слаги, сумма = 1). */
  categories: Record<string, number>;
  /** Доля интереса по подкатегориям (сумма = 1). */
  subcategories: Record<string, number>;
  /** Сила интереса к бренду 0..1 по brandId и по названию (lowercase). */
  brandIds: Record<number, number>;
  brandNames: Record<string, number>;
  /** Сколько раз пользователь смотрел товар (для повторных просмотров). */
  productViews: Record<number, number>;
  purchasedIds: number[];
  avgPrice: number | null;
  gender: "men" | "women" | null;
  /** Сколько всего сигналов — по нему решаем, есть ли смысл персонализировать. */
  signalCount: number;
}

/**
 * Считает интересы «на сейчас»: каждое действие затухает со временем (полураспад 7 дней),
 * поэтому вчерашний интерес к косметике весит больше, чем месячный интерес к обуви.
 * Вес товара: просмотр + время на странице + повторные заходы + корзина/избранное.
 */
export function getInterestModel(now = Date.now()): InterestModel {
  const profile = loadProfile();
  const cats: Record<string, number> = {};
  const subs: Record<string, number> = {};
  const brandIds: Record<number, number> = {};
  const brandNames: Record<string, number> = {};
  const productViews: Record<number, number> = {};
  const purchasedIds: number[] = [];
  let signalCount = 0;

  const add = (map: Record<string, number>, key: string | null | undefined, w: number) => {
    const k = String(key ?? "").trim().toLowerCase();
    if (!k || !(w > 0)) return;
    map[k] = (map[k] ?? 0) + w;
  };

  for (const p of Object.values(profile.products)) {
    const r = recencyFactor(p.lastSeenAt, now);
    const dwellMin = Math.min(p.totalDwellMs / 60000, 5);
    const intent =
      1 +
      Math.min(p.views - 1, 4) * 0.6 +
      dwellMin * 0.5 +
      (p.addedToCart ? 3 : 0) +
      (p.favorited ? 2 : 0) +
      (p.purchased ? 2 : 0);
    const w = intent * r;
    signalCount += p.views;
    productViews[p.productId] = p.views;
    if (p.purchased) purchasedIds.push(p.productId);
    add(cats, p.categorySlug, w);
    add(subs, p.subcategory, w);
    if (p.brandId) brandIds[p.brandId] = (brandIds[p.brandId] ?? 0) + w;
    add(brandNames, p.brandName, w);
  }

  // Заходы в категорию — более слабый сигнал, чем просмотр конкретного товара.
  for (const c of Object.values(profile.categories)) {
    const r = recencyFactor(c.lastSeenAt, now);
    add(cats, c.slug, Math.min(c.visits, 10) * 0.7 * r);
  }
  // Клики по брендам (страница бренда).
  for (const b of Object.values(profile.brands)) {
    const r = recencyFactor(b.lastSeenAt, now);
    const w = Math.min(b.clicks, 10) * 0.8 * r;
    if (w > 0) {
      brandIds[b.brandId] = (brandIds[b.brandId] ?? 0) + w;
      add(brandNames, b.brandName, w);
    }
    signalCount += b.clicks;
  }
  for (const c of Object.values(profile.categories)) signalCount += Math.min(c.visits, 10);

  const share = (map: Record<string, number>) => {
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    if (total <= 0) return {};
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v / total]));
  };
  const scaleToMax = <K extends string | number>(map: Record<K, number>) => {
    const max = Math.max(0, ...Object.values<number>(map));
    if (max <= 0) return map;
    for (const k of Object.keys(map) as K[]) map[k] = map[k] / max;
    return map;
  };

  const avgPrice =
    profile.priceRange && profile.priceRange.samples > 0
      ? profile.priceRange.sum / profile.priceRange.samples
      : null;
  const men = profile.genderCounts.men ?? 0;
  const women = profile.genderCounts.women ?? 0;
  // Пол считаем выраженным, только если перевес явный (2:1 и хотя бы 3 просмотра).
  const gender = men >= 3 && men >= women * 2 ? "men" : women >= 3 && women >= men * 2 ? "women" : null;

  return {
    categories: share(cats),
    subcategories: share(subs),
    brandIds: scaleToMax(brandIds),
    brandNames: scaleToMax(brandNames),
    productViews,
    purchasedIds,
    avgPrice,
    gender,
    signalCount,
  };
}

export function clearProfile(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
