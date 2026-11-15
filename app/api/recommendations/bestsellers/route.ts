import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function fallbackByPopularity(limit: number, categoryId: number | null, exclude: number[] = []) {
  const rows = await prisma.product.findMany({
    where: {
      deletedAt: null,
      available: true,
      ...(exclude.length ? { id: { notIn: exclude } } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    select: PRODUCT_SELECT,
    orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
    take: Math.min(limit * 4, 60),
  });
  return rows.map(mapProductRow);
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`recs-best:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ items: [] }, { status: 429 });
  }

  // Параметры — только целые числа. Мусор («180/2», «12.5», «abc») — 400, а не тихая подмена
  // значением по умолчанию: иначе сканеры безопасности принимают совпадение ответов за SQL-инъекцию.
  const url = new URL(req.url);
  const parseIntParam = (name: string) => {
    const raw = url.searchParams.get(name);
    if (raw == null || raw === "") return null;
    return /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
  };
  const limitParam = parseIntParam("limit");
  const daysParam = parseIntParam("days");
  const categoryParam = parseIntParam("categoryId");
  if (Number.isNaN(limitParam) || Number.isNaN(daysParam) || Number.isNaN(categoryParam)) {
    return NextResponse.json({ success: false, error: "invalid_params", items: [] }, { status: 400 });
  }
  const limit = Math.max(1, Math.min(50, limitParam ?? 12));
  const days = Math.max(7, Math.min(365, daysParam ?? 90));
  const categoryId = categoryParam && categoryParam > 0 ? categoryParam : null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Ранжируем по реальным покупкам за окно (ShopEvent.PURCHASE).
    const purchaseAgg = await prisma.shopEvent.groupBy({
      by: ["productId"],
      where: {
        eventType: "PURCHASE",
        productId: { not: null },
        createdAt: { gte: since },
      },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: Math.min(limit * 3, 100),
    });

    const rankedIds = purchaseAgg
      .map((g) => g.productId)
      .filter((id): id is number => id != null);

    if (rankedIds.length === 0) {
      // Нет данных о покупках за период — отдаём по популярности каталога.
      const items = await fallbackByPopularity(limit, categoryId);
      return NextResponse.json({ success: true, source: "fallback-popularity", items: items.slice(0, limit) });
    }

    const dbRows = await prisma.product.findMany({
      where: {
        deletedAt: null,
        available: true,
        id: { in: rankedIds },
        ...(categoryId ? { categoryId } : {}),
      },
      select: PRODUCT_SELECT,
    });
    const byId = new Map(dbRows.map((row: any) => [row.id, row]));

    const items = rankedIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(mapProductRow);

    // Добиваем популярными, если покупок было меньше лимита.
    if (items.length < limit) {
      const existing = new Set(items.map((i) => i.id));
      const fill = await fallbackByPopularity(limit, categoryId, Array.from(existing));
      for (const p of fill) {
        if (existing.has(p.id)) continue;
        items.push(p);
        existing.add(p.id);
        if (items.length >= limit) break;
      }
    }

    return NextResponse.json({ success: true, source: "db-purchases", items: items.slice(0, limit) });
  } catch (error) {
    console.error("[recommendations.bestsellers] db error");
    const items = await fallbackByPopularity(limit, categoryId);
    return NextResponse.json({ success: true, source: "fallback", items: items.slice(0, limit) });
  }
}
