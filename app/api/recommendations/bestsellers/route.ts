import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildEventsServiceUrl, fetchEventsServiceJson, getEventsServiceApiKey } from "@/lib/events-upstream";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapProductRow(row: any) {
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
  };
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  for (let i = result.length - 1; i > 0; i--) {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    const j = Math.abs(h) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function fallbackBestsellers(limit: number, categoryId: number | null, seed?: string) {
  const rows = await prisma.product.findMany({
    where: {
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
    },
    select: {
      id: true, name: true, price: true, oldPrice: true, imageUrl: true,
      images: true, description: true, available: true, premium: true,
      badge: true, gender: true, subcategory: true, categoryId: true,
      brandId: true, createdAt: true, popularity: true,
      Brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
    orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
    take: Math.min(limit * 4, 60),
  });
  const shuffled = seed ? seededShuffle(rows, seed) : rows;
  return shuffled.slice(0, limit).map(mapProductRow);
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`recs-best:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ items: [] }, { status: 429 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || "12");
  const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 12));
  const daysRaw = Number(url.searchParams.get("days") || "90");
  const days = Math.max(7, Math.min(365, Number.isFinite(daysRaw) ? daysRaw : 90));
  const categoryIdRaw = Number(url.searchParams.get("categoryId"));
  const categoryId = Number.isFinite(categoryIdRaw) && categoryIdRaw > 0 ? categoryIdRaw : null;
  const seed = url.searchParams.get("seed") || String(Date.now());

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const apiKey = getEventsServiceApiKey();
  const upstreamUrl = buildEventsServiceUrl("/api/v1/analytics/top-products", {
    from: from.toISOString(),
    to: to.toISOString(),
    limit: Math.min(100, limit * 3),
  });

  if (!apiKey || !upstreamUrl) {
    const items = await fallbackBestsellers(limit, categoryId, seed);
    return NextResponse.json({ success: true, source: "fallback", items });
  }

  try {
    const result = await fetchEventsServiceJson(upstreamUrl, {
      apiKey,
      timeoutMs: 5000,
      retries: 1,
    });

    if (!result.ok) {
      const items = await fallbackBestsellers(limit, categoryId, seed);
      return NextResponse.json({ success: true, source: "fallback", items });
    }

    const rows: any[] = Array.isArray(result.data) ? result.data : [];
    const rankedIds = rows
      .map((item: any) => Number(item?.productId))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    const dbRows = rankedIds.length
      ? await prisma.product.findMany({
          where: {
            deletedAt: null,
            id: { in: rankedIds },
            ...(categoryId ? { categoryId } : {}),
          },
          select: {
            id: true, name: true, price: true, oldPrice: true, imageUrl: true,
            images: true, description: true, available: true, premium: true,
            badge: true, gender: true, subcategory: true, categoryId: true,
            brandId: true, createdAt: true, popularity: true,
            Brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
          },
        })
      : [];

    const byId = new Map(dbRows.map((row: any) => [row.id, row]));
    const items = rankedIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .slice(0, limit)
      .map(mapProductRow);

    if (items.length < limit) {
      const fallback = await fallbackBestsellers(limit - items.length, categoryId);
      const existing = new Set(items.map((item) => item.id));
      for (const product of fallback) {
        if (existing.has(product.id)) continue;
        items.push(product);
        existing.add(product.id);
        if (items.length >= limit) break;
      }
    }

    return NextResponse.json({ success: true, source: "events-service", items: items.slice(0, limit) });
  } catch (error) {
    console.error("[recommendations.bestsellers] upstream error");
    const items = await fallbackBestsellers(limit, categoryId, seed);
    return NextResponse.json({ success: true, source: "fallback", items });
  }
}
