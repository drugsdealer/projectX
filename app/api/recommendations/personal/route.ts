import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewerIdentity } from "@/lib/session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Баланс персонализации: 70% — под интересы пользователя, 30% — глобальные тренды.
const PERSONAL_RATIO = 0.7;
// Окно, за которое считаем интересы пользователя.
const AFFINITY_WINDOW_DAYS = 60;
// Веса сигналов вовлечённости (как в админ-аналитике топ-брендов).
const W = { view: 1, addToCart: 4, brandClick: 2, purchase: 10 };

type RecommendationReason =
  | "brand_affinity"
  | "category_affinity"
  | "global_trending";

type TopBrand = {
  brandId: number;
  brandName: string;
  views: number;
  addToCart: number;
  purchases: number;
  brandClicks: number;
  weightedScore: number;
  slug?: string | null;
  logoUrl?: string | null;
};

const PRODUCT_SELECT = {
  id: true,
  name: true,
  price: true,
  oldPrice: true,
  imageUrl: true,
  images: true,
  premium: true,
  badge: true,
  gender: true,
  categoryId: true,
  brandId: true,
  popularity: true,
  createdAt: true,
  Brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
} as const;

function parseCsvIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((chunk) => Number(chunk.trim()))
    .filter((n, i, arr) => Number.isFinite(n) && n > 0 && arr.indexOf(n) === i);
}

function mapProductRow(row: any, reason: RecommendationReason, score: number) {
  const images = Array.isArray(row?.images) ? row.images.filter(Boolean) : [];
  const imageUrl = row?.imageUrl || images[0] || null;
  return {
    id: row.id,
    name: row.name,
    price: row.price ?? null,
    imageUrl,
    images: imageUrl ? Array.from(new Set([imageUrl, ...images])) : images,
    brandId: row?.Brand?.id ?? row?.brandId ?? null,
    brandName: row?.Brand?.name ?? null,
    brandSlug: row?.Brand?.slug ?? null,
    brandLogo: row?.Brand?.logoUrl ?? null,
    categoryId: row?.categoryId ?? null,
    premium: Boolean(row?.premium),
    badge: row?.badge ?? null,
    gender: row?.gender ?? null,
    recommendation: { score, reason },
  };
}

/** Считает affinity пользователя по брендам и категориям из ShopEvent. */
async function computeAffinity(identityWhere: Record<string, unknown>) {
  const since = new Date(Date.now() - AFFINITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const base = { ...identityWhere, createdAt: { gte: since } };

  const [brandAgg, categoryAgg] = await Promise.all([
    prisma.shopEvent.groupBy({
      by: ["brandId", "eventType"],
      where: {
        ...base,
        brandId: { not: null },
        eventType: { in: ["PRODUCT_VIEW", "ADD_TO_CART", "PURCHASE", "BRAND_CLICK"] },
      },
      _count: { _all: true },
    }),
    prisma.shopEvent.groupBy({
      by: ["categoryId", "eventType"],
      where: {
        ...base,
        categoryId: { not: null },
        eventType: { in: ["PRODUCT_VIEW", "ADD_TO_CART", "PURCHASE"] },
      },
      _count: { _all: true },
    }),
  ]);

  type BrandAgg = { views: number; addToCart: number; purchases: number; brandClicks: number };
  const brands = new Map<number, BrandAgg>();
  for (const g of brandAgg) {
    const id = g.brandId;
    if (id == null) continue;
    const a = brands.get(id) ?? { views: 0, addToCart: 0, purchases: 0, brandClicks: 0 };
    const c = g._count._all;
    if (g.eventType === "PRODUCT_VIEW") a.views += c;
    else if (g.eventType === "ADD_TO_CART") a.addToCart += c;
    else if (g.eventType === "PURCHASE") a.purchases += c;
    else if (g.eventType === "BRAND_CLICK") a.brandClicks += c;
    brands.set(id, a);
  }

  const categories = new Map<number, number>();
  for (const g of categoryAgg) {
    const id = g.categoryId;
    if (id == null) continue;
    const c = g._count._all;
    const w =
      g.eventType === "PURCHASE" ? W.purchase : g.eventType === "ADD_TO_CART" ? W.addToCart : W.view;
    categories.set(id, (categories.get(id) ?? 0) + c * w);
  }

  const brandScores = Array.from(brands.entries())
    .map(([brandId, a]) => ({
      brandId,
      agg: a,
      score:
        a.views * W.view +
        a.addToCart * W.addToCart +
        a.brandClicks * W.brandClick +
        a.purchases * W.purchase,
    }))
    .sort((x, y) => y.score - x.score);

  const categoryIds = Array.from(categories.entries())
    .sort((x, y) => y[1] - x[1])
    .map(([id]) => id);

  return { brandScores, categoryIds };
}

/** Топ-бренды для всплытия (с именем/лого). Cold start → премиальные бренды. */
async function buildTopBrands(
  brandScores: { brandId: number; agg: any; score: number }[]
): Promise<TopBrand[]> {
  if (brandScores.length) {
    const ids = brandScores.slice(0, 12).map((b) => b.brandId);
    const meta = await prisma.brand.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
    const byId = new Map(meta.map((m) => [m.id, m]));
    return brandScores
      .slice(0, 12)
      .map((b) => {
        const m = byId.get(b.brandId);
        if (!m) return null;
        return {
          brandId: b.brandId,
          brandName: m.name,
          views: b.agg.views,
          addToCart: b.agg.addToCart,
          purchases: b.agg.purchases,
          brandClicks: b.agg.brandClicks,
          weightedScore: b.score,
          slug: m.slug ?? null,
          logoUrl: m.logoUrl ?? null,
        } as TopBrand;
      })
      .filter((b): b is TopBrand => b !== null);
  }

  // Cold start: показываем сильные бренды каталога.
  const fallback = await prisma.brand.findMany({
    where: { logoUrl: { not: null } },
    orderBy: [{ isPremium: "desc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, slug: true, logoUrl: true },
    take: 12,
  });
  return fallback.map((m) => ({
    brandId: m.id,
    brandName: m.name,
    views: 0,
    addToCart: 0,
    purchases: 0,
    brandClicks: 0,
    weightedScore: 0,
    slug: m.slug ?? null,
    logoUrl: m.logoUrl ?? null,
  }));
}

async function trendingProducts(limit: number, categoryId: number | null, exclude: number[]) {
  return prisma.product.findMany({
    where: {
      deletedAt: null,
      available: true,
      ...(exclude.length ? { id: { notIn: exclude } } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    select: PRODUCT_SELECT,
    orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
    take: Math.min(limit * 4, 80),
  });
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`recs-personal:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ items: [] }, { status: 429 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || "16");
  const limit = Math.max(1, Math.min(60, Number.isFinite(limitRaw) ? limitRaw : 16));
  const categoryIdRaw = Number(url.searchParams.get("categoryId"));
  const categoryId = Number.isFinite(categoryIdRaw) && categoryIdRaw > 0 ? categoryIdRaw : null;
  const exclude = parseCsvIds(url.searchParams.get("exclude"));
  const sessionOverride = url.searchParams.get("sessionId");

  const { userId, guestToken } = await getViewerIdentity();
  const sessionId = sessionOverride || guestToken || null;

  // Идентичность для выборки событий: приоритет — userId, иначе sessionId.
  const identityWhere: Record<string, unknown> | null = userId
    ? { userId }
    : sessionId
      ? { sessionId }
      : null;

  try {
    const { brandScores, categoryIds } = identityWhere
      ? await computeAffinity(identityWhere)
      : { brandScores: [], categoryIds: [] };

    const topBrandIds = brandScores.slice(0, 8).map((b) => b.brandId);
    const brandRank = new Map(topBrandIds.map((id, i) => [id, i]));
    const topCategoryIds = categoryIds.slice(0, 6);

    // ── Персональный пул (по любимым брендам/категориям) ──
    let personalItems: ReturnType<typeof mapProductRow>[] = [];
    if (topBrandIds.length || topCategoryIds.length) {
      const orClauses: any[] = [];
      if (topBrandIds.length) orClauses.push({ brandId: { in: topBrandIds } });
      if (topCategoryIds.length) orClauses.push({ categoryId: { in: topCategoryIds } });

      const pool = await prisma.product.findMany({
        where: {
          deletedAt: null,
          available: true,
          ...(exclude.length ? { id: { notIn: exclude } } : {}),
          ...(categoryId ? { categoryId } : {}),
          OR: orClauses,
        },
        select: PRODUCT_SELECT,
        orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
        take: Math.min(limit * 6, 120),
      });

      personalItems = pool
        .map((row) => {
          const bRank =
            row.brandId != null && brandRank.has(row.brandId) ? brandRank.get(row.brandId)! : null;
          const inCategory = row.categoryId != null && topCategoryIds.includes(row.categoryId);
          // Чем выше бренд в affinity и больше популярность — тем выше score.
          const brandBoost = bRank != null ? Math.max(0, 1 - bRank * 0.1) : 0;
          const catBoost = inCategory ? 0.3 : 0;
          const popBoost = Math.min(0.4, (row.popularity ?? 0) / 1000);
          const reason: RecommendationReason =
            bRank != null ? "brand_affinity" : "category_affinity";
          return { row, reason, score: 0.5 + brandBoost + catBoost + popBoost };
        })
        .sort((a, b) => b.score - a.score)
        .map((e) => mapProductRow(e.row, e.reason, e.score));
    }

    // ── Трендовый пул (глобальная популярность) ──
    const trendingRows = await trendingProducts(limit, categoryId, exclude);
    const trendingItems = trendingRows.map((row, i) =>
      mapProductRow(row, "global_trending", 0.3 - Math.min(0.25, i * 0.01))
    );

    // ── Смешиваем 70/30, дедуп по id ──
    const personalTarget = Math.round(limit * PERSONAL_RATIO);
    const seen = new Set<number>(exclude);
    const result: ReturnType<typeof mapProductRow>[] = [];

    for (const it of personalItems) {
      if (result.length >= personalTarget) break;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      result.push(it);
    }
    for (const it of trendingItems) {
      if (result.length >= limit) break;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      result.push(it);
    }
    // Добиваем остатком персонального пула, если трендов не хватило.
    if (result.length < limit) {
      for (const it of personalItems) {
        if (result.length >= limit) break;
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        result.push(it);
      }
    }

    const topBrands = await buildTopBrands(brandScores);

    return NextResponse.json({
      success: true,
      source: identityWhere ? "db-personal" : "db-trending",
      items: result.slice(0, limit),
      topBrands,
    });
  } catch (error) {
    console.error("[recommendations.personal] db error");
    // Безопасный фолбэк: тренды + сильные бренды.
    try {
      const trendingRows = await trendingProducts(limit, categoryId, exclude);
      const items = trendingRows
        .slice(0, limit)
        .map((row) => mapProductRow(row, "global_trending", 0.3));
      const topBrands = await buildTopBrands([]);
      return NextResponse.json({ success: true, source: "fallback", items, topBrands });
    } catch {
      return NextResponse.json({ success: true, source: "fallback", items: [], topBrands: [] });
    }
  }
}
