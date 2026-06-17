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
    productId: { not: null },
    eventType: { in: ["PRODUCT_VIEW", "ADD_TO_CART", "PURCHASE"] },
  };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  try {
    const grouped = await prisma.shopEvent.groupBy({
      by: ["productId", "eventType"],
      where,
      _count: { _all: true },
    });

    type Agg = { views: number; addToCart: number; purchases: number };
    const byProduct = new Map<number, Agg>();
    for (const g of grouped) {
      const pid = g.productId;
      if (pid == null) continue;
      const agg = byProduct.get(pid) ?? { views: 0, addToCart: 0, purchases: 0 };
      const c = g._count._all;
      if (g.eventType === "PRODUCT_VIEW") agg.views += c;
      else if (g.eventType === "ADD_TO_CART") agg.addToCart += c;
      else if (g.eventType === "PURCHASE") agg.purchases += c;
      byProduct.set(pid, agg);
    }

    const items = Array.from(byProduct.entries())
      .map(([productId, a]) => ({
        productId,
        views: a.views,
        addToCart: a.addToCart,
        purchases: a.purchases,
        viewToCartConversion: a.views > 0 ? a.addToCart / a.views : 0,
        cartToPurchaseConversion: a.addToCart > 0 ? a.purchases / a.addToCart : 0,
      }))
      .sort(
        (x, y) =>
          y.purchases - x.purchases ||
          y.addToCart - x.addToCart ||
          y.views - x.views
      )
      .slice(0, limit);

    return NextResponse.json(
      { success: true, items },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[admin.events.top-products] aggregation error");
    return NextResponse.json({ success: false, message: "Failed to build top products" }, { status: 500 });
  }
}
