import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseLimit(raw: string | null, fallback = 20): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.round(n)));
}

// Веса вовлечённости: покупка ценнее всего, дальше — добавление в корзину, клик по бренду, просмотр.
const WEIGHTS = { views: 1, addToCart: 4, brandClicks: 2, purchases: 10 };

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from = parseDate(fromRaw);
  const to = parseDate(toRaw);
  const limit = parseLimit(url.searchParams.get("limit"), 20);
  if ((fromRaw && !from) || (toRaw && !to)) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
  }

  const where: any = {
    brandId: { not: null },
    eventType: { in: ["PRODUCT_VIEW", "ADD_TO_CART", "PURCHASE", "BRAND_CLICK"] },
  };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  try {
    const grouped = await prisma.shopEvent.groupBy({
      by: ["brandId", "eventType"],
      where,
      _count: { _all: true },
    });

    type Agg = { views: number; addToCart: number; purchases: number; brandClicks: number };
    const byBrand = new Map<number, Agg>();
    for (const g of grouped) {
      const bid = g.brandId;
      if (bid == null) continue;
      const agg = byBrand.get(bid) ?? { views: 0, addToCart: 0, purchases: 0, brandClicks: 0 };
      const c = g._count._all;
      if (g.eventType === "PRODUCT_VIEW") agg.views += c;
      else if (g.eventType === "ADD_TO_CART") agg.addToCart += c;
      else if (g.eventType === "PURCHASE") agg.purchases += c;
      else if (g.eventType === "BRAND_CLICK") agg.brandClicks += c;
      byBrand.set(bid, agg);
    }

    const brandIds = Array.from(byBrand.keys());
    const brands = brandIds.length
      ? await prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(brands.map((b) => [b.id, b.name]));

    const items = brandIds
      .map((brandId) => {
        const a = byBrand.get(brandId)!;
        const weightedScore =
          a.views * WEIGHTS.views +
          a.addToCart * WEIGHTS.addToCart +
          a.brandClicks * WEIGHTS.brandClicks +
          a.purchases * WEIGHTS.purchases;
        return {
          brandId,
          brandName: nameById.get(brandId) ?? `Brand #${brandId}`,
          views: a.views,
          addToCart: a.addToCart,
          purchases: a.purchases,
          brandClicks: a.brandClicks,
          weightedScore,
        };
      })
      .sort((x, y) => y.weightedScore - x.weightedScore)
      .slice(0, limit);

    return NextResponse.json(
      { success: true, items },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[admin.events.top-brands] aggregation error");
    return NextResponse.json({ success: false, message: "Failed to build top brands" }, { status: 500 });
  }
}
