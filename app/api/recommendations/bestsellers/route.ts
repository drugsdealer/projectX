import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildEventsServiceUrl, getEventsServiceApiKey } from "@/lib/events-upstream";

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

async function fallbackBestsellers(limit: number, categoryId: number | null) {
  const rows = await prisma.product.findMany({
    where: {
      deletedAt: null,
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
  return rows.map(mapProductRow);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || "12");
  const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 12));
  const daysRaw = Number(url.searchParams.get("days") || "90");
  const days = Math.max(7, Math.min(365, Number.isFinite(daysRaw) ? daysRaw : 90));
  const categoryIdRaw = Number(url.searchParams.get("categoryId"));
  const categoryId = Number.isFinite(categoryIdRaw) && categoryIdRaw > 0 ? categoryIdRaw : null;

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const apiKey = getEventsServiceApiKey();
  const upstreamUrl = buildEventsServiceUrl("/api/v1/analytics/top-products", {
    from: from.toISOString(),
    to: to.toISOString(),
    limit: Math.min(100, limit * 3),
  });

  if (!apiKey || !upstreamUrl) {
    const items = await fallbackBestsellers(limit, categoryId);
    return NextResponse.json({ success: true, source: "fallback", items });
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
      const items = await fallbackBestsellers(limit, categoryId);
      return NextResponse.json({ success: true, source: "fallback", items });
    }

    const rows = await upstream.json().catch(() => [] as any[]);
    const rankedIds = Array.isArray(rows)
      ? rows
          .map((item: any) => Number(item?.productId))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      : [];

    const dbRows = rankedIds.length
      ? await prisma.product.findMany({
          where: {
            deletedAt: null,
            id: { in: rankedIds },
            ...(categoryId ? { categoryId } : {}),
          },
          include: {
            Brand: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
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
    console.error("[recommendations.bestsellers] upstream error", error);
    const items = await fallbackBestsellers(limit, categoryId);
    return NextResponse.json({ success: true, source: "fallback", items });
  }
}
