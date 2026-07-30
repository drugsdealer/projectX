import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ success: true, products: [] });
  }

  const products = await prisma.product.findMany({
    where: { deletedAt: null, name: { contains: q, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 20,
    select: {
      id: true,
      name: true,
      price: true,
      imageUrl: true,
      Brand: { select: { name: true } },
    },
  });

  const mapped = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    brandName: p.Brand?.name ?? null,
  }));

  return NextResponse.json({ success: true, products: mapped });
}
