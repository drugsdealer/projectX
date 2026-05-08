import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  try {
    const rows = await prisma.brand.findMany({
      where: { deletedAt: null },
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        features: true,
        _count: { select: { Product: { where: { deletedAt: null } } } },
      },
      orderBy: { name: "asc" },
    });

    const brands = rows
      .map((brand) => ({
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl ?? null,
        imageUrl: brand.features ?? null,
        count: brand._count.Product,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"));

    return NextResponse.json(
      { success: true, brands },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json(
      { success: true, brands: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
