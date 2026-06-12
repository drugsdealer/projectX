/**
 * POST /api/recommendations/brand-spotlight
 *
 * Accepts the user's top brand IDs (from the client behavioral profile) and
 * returns one or more "brand spotlight" payloads — each with the brand's
 * identity (logo, tagline) and its 3-4 strongest products. Drives the inline
 * Brand Spotlight insert on the homepage (ТЗ priority #1).
 *
 * Priority of brands:
 *   1. The user's top-affinity brands (in the order supplied)
 *   2. If the profile is empty (cold start) — premium / popular brands as fallback
 *
 * Why a dedicated endpoint (not folded into /for-you): the spotlight needs
 * brand-level identity + a curated product strip, which is a different shape
 * from the flat product list /for-you returns. Keeping it separate also lets
 * the homepage lazy-load it independently.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SpotlightRequest {
  topBrandIds?: number[];
}

// How many brands to return (the client rotates among them).
const MAX_SPOTLIGHTS = 3;
// Products shown inside each spotlight card.
const PRODUCTS_PER_BRAND = 4;
// A brand needs at least this many live products to be worth a spotlight.
const MIN_PRODUCTS_FOR_SPOTLIGHT = 3;

const PRODUCT_SELECT = {
  id: true,
  name: true,
  price: true,
  oldPrice: true,
  imageUrl: true,
  images: true,
  premium: true,
  badge: true,
} as const;

function mapProductRow(row: any) {
  const images = Array.isArray(row?.images) ? row.images.filter(Boolean) : [];
  const imageUrl = row?.imageUrl || images[0] || null;
  return {
    id: row.id,
    name: row.name,
    price: row.price ?? null,
    oldPrice: row.oldPrice ?? null,
    imageUrl,
    premium: Boolean(row?.premium),
    badge: row?.badge ?? null,
  };
}

/** Pick the best short tagline available on the brand record. */
function brandTagline(brand: { description?: string | null; styleNotes?: string | null; name: string }): string {
  const raw = (brand.description || brand.styleNotes || "").trim();
  if (raw) {
    // Keep it to a single short line for the card.
    const firstSentence = raw.split(/(?<=[.!?])\s/)[0];
    return firstSentence.length > 120 ? `${firstSentence.slice(0, 117)}…` : firstSentence;
  }
  return `Избранное от ${brand.name}`;
}

export async function POST(req: Request) {
  const csrf = enforceSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit(`recs-spotlight:${ip}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ success: false, spotlights: [] }, { status: 429 });

  let body: SpotlightRequest = {};
  try {
    body = await req.json();
  } catch {}

  const requestedBrandIds: number[] = Array.isArray(body.topBrandIds)
    ? body.topBrandIds.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 8)
    : [];

  // ── Resolve candidate brands (preserve affinity order, fall back if needed) ──
  let candidateBrandIds = requestedBrandIds;

  if (candidateBrandIds.length === 0) {
    // Cold start: surface premium / official brands as a reasonable default.
    const fallback = await prisma.brand.findMany({
      where: { logoUrl: { not: null } },
      orderBy: [{ isPremium: "desc" }, { updatedAt: "desc" }],
      select: { id: true },
      take: MAX_SPOTLIGHTS * 2,
    });
    candidateBrandIds = fallback.map((b) => b.id);
  }

  if (candidateBrandIds.length === 0) {
    return NextResponse.json({ success: true, spotlights: [] });
  }

  const brands = await prisma.brand.findMany({
    where: { id: { in: candidateBrandIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      description: true,
      styleNotes: true,
      isPremium: true,
    },
  });
  const brandById = new Map(brands.map((b) => [b.id, b]));

  const spotlights: any[] = [];

  // Walk candidates in affinity order so the user's strongest brand is first.
  for (const brandId of candidateBrandIds) {
    if (spotlights.length >= MAX_SPOTLIGHTS) break;
    const brand = brandById.get(brandId);
    if (!brand || !brand.slug) continue;

    const rows = await prisma.product.findMany({
      where: { brandId, deletedAt: null, available: true },
      select: PRODUCT_SELECT,
      orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
      take: PRODUCTS_PER_BRAND * 2,
    });

    const products = rows
      .map(mapProductRow)
      .filter((p) => p.imageUrl) // a spotlight card needs imagery
      .slice(0, PRODUCTS_PER_BRAND);

    if (products.length < MIN_PRODUCTS_FOR_SPOTLIGHT) continue;

    spotlights.push({
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl ?? null,
        tagline: brandTagline(brand),
        premium: Boolean(brand.isPremium),
      },
      products,
    });
  }

  return NextResponse.json({ success: true, spotlights });
}
