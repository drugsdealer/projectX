import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=15, s-maxage=60, stale-while-revalidate=120",
};

// Lightweight autocomplete — simple ILIKE prefix, no fuzzy matching.
// Returns up to 6 products + up to 2 brands in <20ms typical.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`autocomplete:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ products: [], brands: [] }, { status: 429 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ products: [], brands: [] });
  }

  const [rawProducts, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        deletedAt: null,
        name: { contains: q, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        images: true,
        Brand: { select: { name: true, slug: true } },
      },
    }),
    prisma.brand.findMany({
      where: {
        deletedAt: null,
        name: { startsWith: q, mode: "insensitive" },
      },
      take: 2,
      select: { name: true, slug: true },
    }),
  ]);

  const products = rawProducts.map((p: any) => ({
    id: String(p.id),
    name: p.name as string,
    price: (p.price as number | null) ?? null,
    brandName: (p.Brand?.name as string | null) ?? null,
    imageUrl:
      typeof p.imageUrl === "string" && p.imageUrl
        ? p.imageUrl
        : Array.isArray(p.images) && p.images.length > 0
        ? (p.images[0] as string)
        : null,
  }));

  return NextResponse.json({ products, brands }, { headers: CACHE_HEADERS });
}
