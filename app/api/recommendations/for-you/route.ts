/**
 * POST /api/recommendations/for-you
 * Accepts a client-side behavior profile snapshot and returns
 * personalized product recommendations from the database.
 *
 * Priority order:
 *   1. Repeat-viewed products (user keeps returning — high intent)
 *   2. Products from top brands in preferred categories
 *   3. Products from top brands in any category
 *   4. Products from preferred categories (any brand)
 *   5. Popularity fallback
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { mapUiCategoryToDb } from "@/lib/catalog-taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProfileSnapshot {
  topBrandIds?: number[];
  topCategorySlugs?: string[];
  repeatProductIds?: number[];
  excludeProductIds?: number[];
  avgPrice?: number | null;
  gender?: string | null;
}

function mapProductRow(row: any) {
  const images = Array.isArray(row?.images) ? row.images.filter(Boolean) : [];
  const imageUrl = row?.imageUrl || images[0] || null;
  return {
    id: row.id,
    name: row.name,
    price: row.price ?? null,
    oldPrice: row.oldPrice ?? null,
    imageUrl,
    images: imageUrl ? Array.from(new Set([imageUrl, ...images])) : images,
    brandId: row?.Brand?.id ?? row?.brandId ?? null,
    brandName: row?.Brand?.name ?? null,
    brandSlug: row?.Brand?.slug ?? null,
    brandLogo: row?.Brand?.logoUrl ?? null,
    categoryId: row?.categoryId ?? null,
    categorySlug: row?.Category?.slug ?? null,
    premium: Boolean(row?.premium),
    badge: row?.badge ?? null,
    gender: row?.gender ?? null,
    subcategory: row?.subcategory ?? null,
    score: row?._score ?? 0,
    reason: row?._reason ?? "for-you",
  };
}

const PRODUCT_SELECT = {
  id: true, name: true, price: true, oldPrice: true,
  imageUrl: true, images: true, premium: true, badge: true,
  gender: true, subcategory: true, categoryId: true, brandId: true,
  popularity: true, createdAt: true,
  Brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
  Category: { select: { id: true, name: true, slug: true } },
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`recs-foryou:${ip}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ items: [] }, { status: 429 });

  let body: ProfileSnapshot = {};
  try { body = await req.json(); } catch {}

  const limitRaw = Number(new URL(req.url).searchParams.get("limit") || "16");
  const limit = Math.max(1, Math.min(48, Number.isFinite(limitRaw) ? limitRaw : 16));

  const topBrandIds: number[] = Array.isArray(body.topBrandIds)
    ? body.topBrandIds.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 10)
    : [];

  const topCategorySlugs: string[] = Array.isArray(body.topCategorySlugs)
    ? body.topCategorySlugs.slice(0, 8)
    : [];

  const repeatProductIds: number[] = Array.isArray(body.repeatProductIds)
    ? body.repeatProductIds.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 12)
    : [];

  const excludeIds = new Set<number>(
    Array.isArray(body.excludeProductIds)
      ? body.excludeProductIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : []
  );

  const gender = typeof body.gender === "string" && ["men", "women", "unisex"].includes(body.gender)
    ? body.gender
    : null;

  // Convert UI category slugs → DB slugs
  const dbCategorySlugs = topCategorySlugs
    .map((s) => mapUiCategoryToDb(s))
    .filter(Boolean) as string[];

  // ── 1. Repeat-viewed products ──────────────────────────────────────────────
  const result: Map<number, any> = new Map();

  if (repeatProductIds.length > 0) {
    const repeatRows = await prisma.product.findMany({
      where: {
        id: { in: repeatProductIds },
        deletedAt: null,
        available: true,
      },
      select: PRODUCT_SELECT,
      take: 8,
    });
    for (const row of repeatRows) {
      if (!excludeIds.has(row.id)) {
        const idx = repeatProductIds.indexOf(row.id);
        result.set(row.id, { ...row, _score: 100 - idx * 5, _reason: "repeat-view" });
      }
    }
  }

  // ── 2. Products from top brands in preferred categories ───────────────────
  if (result.size < limit && topBrandIds.length > 0 && dbCategorySlugs.length > 0) {
    const catFilter = await buildCategoryFilter(dbCategorySlugs);
    const rows = await prisma.product.findMany({
      where: {
        deletedAt: null,
        available: true,
        brandId: { in: topBrandIds },
        ...(catFilter ? { Category: { slug: { in: dbCategorySlugs } } } : {}),
        ...(gender ? buildGenderFilter(gender) : {}),
        id: { notIn: Array.from(result.keys()).concat(Array.from(excludeIds)) },
      },
      select: PRODUCT_SELECT,
      orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
      take: limit * 2,
    });
    for (const row of rows) {
      if (result.size >= limit) break;
      if (!result.has(row.id)) {
        const brandRank = topBrandIds.indexOf(row.brandId ?? -1);
        result.set(row.id, { ...row, _score: 80 - brandRank * 3, _reason: "brand-category" });
      }
    }
  }

  // ── 3. Products from top brands (any category) ────────────────────────────
  if (result.size < limit && topBrandIds.length > 0) {
    const rows = await prisma.product.findMany({
      where: {
        deletedAt: null,
        available: true,
        brandId: { in: topBrandIds },
        ...(gender ? buildGenderFilter(gender) : {}),
        id: { notIn: Array.from(result.keys()).concat(Array.from(excludeIds)) },
      },
      select: PRODUCT_SELECT,
      orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
      take: limit * 2,
    });
    for (const row of rows) {
      if (result.size >= limit) break;
      if (!result.has(row.id)) {
        const brandRank = topBrandIds.indexOf(row.brandId ?? -1);
        result.set(row.id, { ...row, _score: 60 - brandRank * 2, _reason: "brand" });
      }
    }
  }

  // ── 4. Products from preferred categories (any brand) ────────────────────
  if (result.size < limit && dbCategorySlugs.length > 0) {
    const rows = await prisma.product.findMany({
      where: {
        deletedAt: null,
        available: true,
        Category: { slug: { in: dbCategorySlugs } },
        ...(gender ? buildGenderFilter(gender) : {}),
        id: { notIn: Array.from(result.keys()).concat(Array.from(excludeIds)) },
      },
      select: PRODUCT_SELECT,
      orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
      take: limit * 2,
    });
    for (const row of rows) {
      if (result.size >= limit) break;
      if (!result.has(row.id)) {
        result.set(row.id, { ...row, _score: 40, _reason: "category" });
      }
    }
  }

  // ── 5. Popularity fallback ────────────────────────────────────────────────
  if (result.size < limit) {
    const rows = await prisma.product.findMany({
      where: {
        deletedAt: null,
        available: true,
        id: { notIn: Array.from(result.keys()).concat(Array.from(excludeIds)) },
        ...(gender ? buildGenderFilter(gender) : {}),
      },
      select: PRODUCT_SELECT,
      orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
      take: limit - result.size,
    });
    for (const row of rows) {
      if (!result.has(row.id)) {
        result.set(row.id, { ...row, _score: 10, _reason: "popular" });
      }
    }
  }

  const items = Array.from(result.values())
    .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
    .slice(0, limit)
    .map(mapProductRow);

  return NextResponse.json({ success: true, items });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildCategoryFilter(slugs: string[]): Promise<boolean> {
  if (!slugs.length) return false;
  const count = await prisma.category.count({ where: { slug: { in: slugs } } });
  return count > 0;
}

function buildGenderFilter(gender: string) {
  if (gender === "unisex") return { gender: { equals: "unisex", mode: "insensitive" as const } };
  return {
    OR: [
      { gender: { equals: gender, mode: "insensitive" as const } },
      { gender: { equals: "unisex", mode: "insensitive" as const } },
      { gender: null },
    ],
  };
}
