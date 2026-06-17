import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { FUNNEL_ORDER } from "@/lib/events-server";

export const runtime = "nodejs";

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from = parseDate(fromRaw);
  const to = parseDate(toRaw);
  if ((fromRaw && !from) || (toRaw && !to)) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
  }

  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  try {
    const grouped = await prisma.shopEvent.groupBy({
      by: ["eventType"],
      where,
      _count: { _all: true },
    });

    const counts = new Map<string, number>();
    for (const g of grouped) counts.set(g.eventType, g._count._all);

    let prev: number | null = null;
    const steps = FUNNEL_ORDER.map((eventType) => {
      const events = counts.get(eventType) ?? 0;
      const conversionFromPrevious = prev != null && prev > 0 ? events / prev : null;
      prev = events;
      return { eventType, events, conversionFromPrevious };
    });

    const views = counts.get("PRODUCT_VIEW") ?? 0;
    const purchases = counts.get("PURCHASE") ?? 0;
    const overallConversion = views > 0 ? purchases / views : 0;

    return NextResponse.json(
      {
        success: true,
        funnel: {
          from: from?.toISOString() ?? null,
          to: to?.toISOString() ?? null,
          overallConversion,
          steps,
        },
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[admin.events.funnel] aggregation error");
    return NextResponse.json({ success: false, message: "Failed to build funnel" }, { status: 500 });
  }
}
