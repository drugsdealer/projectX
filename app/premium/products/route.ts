// app/api/premium/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeProduct } from "@/lib/normalizeProduct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
};

function inferCategorySlug(raw: any, normalized?: any): string {
  const hints: Array<string> = [];

  const pushHint = (v: any) => {
    if (!v) return;
    const s = String(v).trim();
    if (s) hints.push(s.toLowerCase());
  };

  // from relations
  pushHint(raw?.Category?.slug);
  pushHint(raw?.Category?.dbSlug);
  pushHint(raw?.subcategory?.slug);
  pushHint(raw?.subCategorySlug);

  // from normalized
  pushHint((normalized as any)?.categorySlug);
  pushHint((normalized as any)?.categoryDbSlug);
  pushHint((normalized as any)?.subcategory);
  pushHint((normalized as any)?.subCategorySlug);

  // from product metadata
  pushHint(raw?.jewelryType);
  pushHint(raw?.bagType);
  pushHint(raw?.type);

  const hay = hints.join(" ");

  // footwear
  if (/(footwear|sneaker|sneakers|shoe|shoes)/.test(hay)) return "footwear";

  // clothes
  if (
    /(clothes|apparel|outerwear|jacket|coat|hoodie|sweater|knit|tshirt|shirt|pants|jeans)/.test(
      hay
    )
  ) {
    return "clothes";
  }

  // bags
  if (/(bag|travelbag|keepall|tote|pouch|backpack|cardholder|wallet)/.test(hay))
    return "bags";

  // fragrance
  if (/(fragrance|perfume|edp|edt|parfum)/.test(hay)) return "fragrance";

  // accessories / jewelry
  if (/(jewelry|ring|pendant|chain|bracelet|belt|accessor)/.test(hay))
    return "accessories";

  return "other";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const limitParam = searchParams.get("limit");
    const cursorParam = searchParams.get("cursor");

    const take = (() => {
      const n = limitParam ? Number(limitParam) : 24;
      if (Number.isNaN(n)) return 24;
      return Math.min(Math.max(n, 1), 500);
    })();

    const where: any = {
      deletedAt: null,
      premium: true,
    };

    const query: any = {
      where,
      orderBy: { createdAt: "desc" },
      take: take + 1,
      include: {
        Brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        Category: true,
        ProductItem: {
          include: {
            Size: true,
            SizeCl: true,
            OneSize: true,
          },
        },
        PerfumeVariant: true,
      },
    };

    if (cursorParam) {
      const cursorId = Number(cursorParam);
      if (!Number.isNaN(cursorId)) {
        query.cursor = { id: cursorId };
        query.skip = 1;
      }
    }

    const rows = await prisma.product.findMany(query);

    const hasMore = rows.length > take;
    const slice = hasMore ? rows.slice(0, take) : rows;

    // Подтянем изображения из связанной таблицы, если она есть, чтобы первая картинка была главной
    const imagesByProductId: Record<number, string[]> = {};
    try {
      const maybePI = (prisma as any)?.productImage;
      if (maybePI?.findMany && slice.length) {
        const ids = slice.map((r) => r.id);
        const imgs = await maybePI.findMany({
          where: { productId: { in: ids } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { productId: true, url: true },
        });
        for (const i of imgs) {
          if (!imagesByProductId[i.productId]) imagesByProductId[i.productId] = [];
          imagesByProductId[i.productId].push(i.url);
        }
      }
    } catch (e) {
      console.warn("[premium/products] productImage relation missing", e);
    }

    const products = slice.map((p: any) => {
      const normalized: any = normalizeProduct(p);
      const relImgs = imagesByProductId[p.id] || [];

      // Жёстко фиксируем порядок: сначала imageUrl (если есть), затем связанные фото по sortOrder, затем остальные.
      const primary = normalized.imageUrl || (normalized.images?.[0] ?? null);
      const tailFromRel = (relImgs || []).filter((u) => u && u !== primary);
      const tailFromArray = (normalized.images || []).filter((u: string) => u && u !== primary);
      const mergedImages = Array.from(
        new Set([primary, ...tailFromRel, ...tailFromArray].filter(Boolean))
      );

      const brandObj = (p as any)?.Brand || null;
      const brandName =
        (brandObj?.name && String(brandObj.name).trim()) ||
        (normalized as any)?.brandName ||
        (normalized as any)?.brand ||
        null;
      const brandSlug =
        (brandObj?.slug && String(brandObj.slug).trim()) || (normalized as any)?.brandSlug || null;
      const brandId = brandObj?.id ?? (normalized as any)?.brandId ?? null;

      const normalizedWithImages = {
        ...normalized,
        images: mergedImages.length ? mergedImages : normalized.images,
        imageUrl: mergedImages[0] || normalized.imageUrl,

        // --- Brand fields (for Premium picker filtering/search) ---
        // Keep both a nested object and flat fields so the client can reliably filter/search.
        Brand: brandObj,
        brandId,
        brandName,
        brandSlug,
        // Common fallback key some UI code expects
        brand: brandName,
      };
      const inferred = inferCategorySlug(p, normalizedWithImages);

      const current = String(
        (normalizedWithImages as any)?.categorySlug ||
          (normalizedWithImages as any)?.category ||
          "other"
      ).toLowerCase();
      if (!current || current === "other") {
        return {
          ...normalizedWithImages,
          categorySlug: inferred,
          category: inferred,
        };
      }

      return normalizedWithImages;
    });

    const nextCursor = hasMore ? String(slice[slice.length - 1].id) : null;

    return NextResponse.json(
      {
        success: true,
        products,
        nextCursor,
        source: "premium/products",
      },
      {
        status: 200,
        headers: PUBLIC_CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error("[premium/products] error", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
