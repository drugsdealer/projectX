import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildEventsServiceUrl, getEventsServiceApiKey } from "@/lib/events-upstream";
import { getViewerIdentity } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecommendationMeta = {
  productId: number;
  score: number;
  reason: string;
};

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

function parseCsvIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((chunk) => Number(chunk.trim()))
    .filter((n, i, arr) => Number.isFinite(n) && n > 0 && arr.indexOf(n) === i);
}

function mapProductRow(row: any, recommendation: RecommendationMeta | null) {
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
    recommendation: recommendation
      ? {
          score: recommendation.score,
          reason: recommendation.reason,
        }
      : null,
  };
}

async function fallbackProducts(limit: number, categoryId: number | null, exclude: number[]) {
  const rows = await prisma.product.findMany({
    where: {
      deletedAt: null,
      id: { notIn: exclude.length ? exclude : undefined },
      ...(categoryId ? { categoryId } : {}),
    },
    include: {
      Brand: {
        select: { id: true, name: true, slug: true, logoUrl: true },
      },
    },
    orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return rows.map((row) => mapProductRow(row, null));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || "16");
  const limit = Math.max(1, Math.min(60, Number.isFinite(limitRaw) ? limitRaw : 16));
  const categoryIdRaw = Number(url.searchParams.get("categoryId"));
  const categoryId = Number.isFinite(categoryIdRaw) && categoryIdRaw > 0 ? categoryIdRaw : null;
  const exclude = parseCsvIds(url.searchParams.get("exclude"));
  const seed = url.searchParams.get("seed") || String(Date.now());
  const sessionOverride = url.searchParams.get("sessionId");

  const { userId, guestToken } = await getViewerIdentity();
  const sessionId = sessionOverride || guestToken || null;

  const apiKey = getEventsServiceApiKey();
  const upstreamUrl = buildEventsServiceUrl("/api/v1/analytics/recommendations", {
    userId: userId ?? undefined,
    sessionId: sessionId ?? undefined,
    categoryId: categoryId ?? undefined,
    excludeProductIds: exclude.length ? exclude.join(",") : undefined,
    limit,
    seed,
  });

  if (!apiKey || !upstreamUrl) {
    const items = await fallbackProducts(limit, categoryId, exclude);
    return NextResponse.json({
      success: true,
      source: "fallback",
      items,
      topBrands: [],
    });
  }

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Events-Api-Key": apiKey,
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const items = await fallbackProducts(limit, categoryId, exclude);
      return NextResponse.json({
        success: true,
        source: "fallback",
        message: "recommendations upstream unavailable",
        items,
        topBrands: [],
      });
    }

    const data = await upstream.json().catch(() => ({} as any));
    const recItemsRaw = Array.isArray(data?.items) ? data.items : [];
    const recommendationMeta: RecommendationMeta[] = recItemsRaw
      .map((item: any) => ({
        productId: Number(item?.productId),
        score: Number(item?.score ?? 0),
        reason: String(item?.reason ?? "global_trending"),
      }))
      .filter((item) => Number.isFinite(item.productId) && item.productId > 0);

    const ids = recommendationMeta.map((item) => item.productId);
    const metaById = new Map(recommendationMeta.map((item) => [item.productId, item]));

    const fromRecommendations = ids.length
      ? await prisma.product.findMany({
          where: {
            deletedAt: null,
            id: { in: ids },
            ...(categoryId ? { categoryId } : {}),
          },
          include: {
            Brand: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
          },
        })
      : [];

    const rowById = new Map(fromRecommendations.map((row: any) => [row.id, row]));
    const ordered = ids
      .map((id) => rowById.get(id))
      .filter(Boolean)
      .slice(0, limit)
      .map((row: any) => mapProductRow(row, metaById.get(row.id) || null));

    if (ordered.length < limit) {
      const missing = limit - ordered.length;
      const existingIds = [
        ...exclude,
        ...ordered.map((x) => x.id),
      ];
      const topup = await fallbackProducts(missing, categoryId, existingIds);
      ordered.push(...topup);
    }

    const topBrandsRaw: TopBrand[] = Array.isArray(data?.topBrands)
      ? data.topBrands
          .map((row: any) => ({
            brandId: Number(row?.brandId),
            brandName: String(row?.brandName ?? ""),
            views: Number(row?.views ?? 0),
            addToCart: Number(row?.addToCart ?? 0),
            purchases: Number(row?.purchases ?? 0),
            brandClicks: Number(row?.brandClicks ?? 0),
            weightedScore: Number(row?.weightedScore ?? 0),
          }))
          .filter((row) => Number.isFinite(row.brandId) && row.brandId > 0 && row.brandName)
      : [];

    let topBrands = topBrandsRaw;
    if (topBrandsRaw.length) {
      const brandMetaRows = await prisma.brand.findMany({
        where: {
          id: { in: topBrandsRaw.map((row) => row.brandId) },
        },
        select: {
          id: true,
          slug: true,
          logoUrl: true,
        },
      });
      const metaById = new Map(brandMetaRows.map((row) => [row.id, row]));
      topBrands = topBrandsRaw.map((row) => {
        const meta = metaById.get(row.brandId);
        return {
          ...row,
          slug: meta?.slug ?? null,
          logoUrl: meta?.logoUrl ?? null,
        };
      });
    }

    return NextResponse.json({
      success: true,
      source: "events-service",
      items: ordered.slice(0, limit),
      topBrands,
    });
  } catch (error) {
    console.error("[recommendations.personal] upstream error", error);
    const items = await fallbackProducts(limit, categoryId, exclude);
    return NextResponse.json({
      success: true,
      source: "fallback",
      items,
      topBrands: [],
    });
  }
}
