import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFARI_IDS = [356, 350, 354, 355, 351, 359];

export async function GET() {
  const rows = await prisma.product.findMany({
    where: { id: { in: SAFARI_IDS }, deletedAt: null },
    select: {
      id: true,
      name: true,
      price: true,
      oldPrice: true,
      imageUrl: true,
      images: true,
      Brand: { select: { id: true, name: true, slug: true } },
    },
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = SAFARI_IDS.map((id) => byId.get(id)).filter(Boolean);

  return NextResponse.json({ items: ordered });
}
