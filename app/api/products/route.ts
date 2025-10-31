import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// --- Runtime relation-name detector (handles category/brand vs Category/Brand) ---
// --- Relation names for Product model (fixed to match Prisma schema) ---
type RelNames = { categoryKey: "Category"; brandKey: "Brand" };
let REL_NAMES: RelNames | null = { categoryKey: "Category", brandKey: "Brand" };

async function ensureRelationNames(): Promise<RelNames> {
  // Schema уже использует PascalCase relations: Category / Brand
  return REL_NAMES!;
}

// ===== Category mapping helpers (RU DB slugs  -> EN app slugs) =====
const CAT_DB_TO_EN: Record<string, string> = {
  "обувь": "footwear",
  "одежда": "clothes",
  "головные-уборы": "headwear",
  "аксессуары": "accessories",
  "сумки-и-рюкзаки": "bags",
  "парфюмерия": "fragrance",
  "premium": "premium",
};

const CAT_EN_TO_DB: Record<string, string> = Object.entries(CAT_DB_TO_EN)
  .reduce((acc, [ru, en]) => {
    acc[en] = ru;
    return acc;
  }, {} as Record<string, string>);

function mapDbToEnCategorySlug(dbSlug?: string | null): string | null {
  if (!dbSlug) return null;
  return CAT_DB_TO_EN[dbSlug] ?? dbSlug;
}

function mapEnToDbCategorySlug(enSlug?: string | null): string | null {
  if (!enSlug) return null;
  // allow multiple synonyms coming from the UI
  const alias = enSlug.toLowerCase();
  const SYN: Record<string, string> = {
    shoes: "footwear",
    shoe: "footwear",
    footwear: "footwear",
    clothing: "clothes",
    apparel: "clothes",
    clothes: "clothes",
    headwear: "headwear",
    hats: "headwear",
    bags: "bags",
    bag: "bags",
    perfume: "fragrance",
    perfumery: "fragrance",
    fragrance: "fragrance",
    fragrances: "fragrance",
  };
  const canonical = CAT_EN_TO_DB[SYN[alias] ?? alias];
  // if already RU slug was passed, keep it
  return canonical ?? enSlug;
}

function inferMainCategorySlug(p: any, sub: string | null): string | null {
  // 1) Prefer DB category → EN alias (source of truth)
  const fromDb = mapDbToEnCategorySlug(p?.category?.slug ?? p?.Category?.slug ?? p?.categorySlug ?? null);
  if (fromDb) return fromDb;

  // 2) Fallback heuristics (used only if DB missing)
  if (typeof p?.sizeType === "string" && p.sizeType.toUpperCase() === "SHOE") {
    return "footwear";
  }
  if (sub && ["sneakers", "boots", "sandals"].includes(sub)) return "footwear";
  if (sub && ["hoodies", "tshirts", "outerwear", "pants"].includes(sub)) return "clothes";
  if (sub && ["caps", "beanies", "bandanas"].includes(sub)) return "headwear";

  const text = [p?.name, p?.description].filter(Boolean).join(" ").toLowerCase();
  if (/(кроссов|sneak|yeezy|dunk|air|force|jordan|adidas|nike|ботинк|сапог|челси|chelsea)/i.test(text)) return "footwear";
  if (/(hood|толстовк|худи|футболк|t-?shirt|tee|куртк|парка|пухов|ветровк|бомбер|coat|jacket|брюк|джинс|штан)/i.test(text)) return "clothes";
  if (/(кепк|cap|шапк|beanie|бандан|bandan)/i.test(text)) return "headwear";

  return null;
}

// --- Subcategory inference helpers (temporary until DB gets real subcategory table)
// Keys below are top-level Category slugs from DB (ru slugs per your seed: "обувь", "одежда", "головные-уборы", ...)
const SUB_DICT: Record<string, Array<{ slug: string; label: string; rx: RegExp }>> = {
  "обувь": [
    { slug: "boots", label: "Ботинки", rx: /(ботинк|сапог|челси|chelsea|boot)/i },
    { slug: "sneakers", label: "Кроссовки", rx: /(кроссов|sneak|yeezy|dunk|air|force|jordan|adidas|nike)/i },
    { slug: "sandals", label: "Сандалии", rx: /(сандал|сланц|шлеп)/i },
  ],
  "одежда": [
    { slug: "hoodies", label: "Худи и толстовки", rx: /(hood|толстовк|худи)/i },
    { slug: "tshirts", label: "Футболки", rx: /(футболк|t-?shirt|tee)/i },
    { slug: "outerwear", label: "Верхняя одежда", rx: /(куртк|парка|пухов|ветровк|бомбер|coat|jacket)/i },
    { slug: "pants", label: "Брюки и джинсы", rx: /(брюк|штан|джинс)/i },
  ],
  "головные-уборы": [
    { slug: "caps", label: "Кепки", rx: /(кепк|cap)/i },
    { slug: "beanies", label: "Шапки", rx: /(шапк|beanie)/i },
    { slug: "bandanas", label: "Банданы", rx: /(бандан|bandan)/i },
  ],
};

function inferSubcategorySlug(p: any): string | null {
  const slug = (p?.category?.slug ?? p?.Category?.slug ?? p?.categorySlug ?? "").toString();
  const dict = SUB_DICT[slug];
  if (!dict) return null;
  const text = [p?.name, p?.description].filter(Boolean).join(" ").toLowerCase();
  for (const rule of dict) {
    if (rule.rx.test(text)) return rule.slug;
  }
  return null;
}

export const dynamic = "force-dynamic"; // отключаем кеш на всякий случай

export async function GET(req: Request) {
  try {
    const rel = await ensureRelationNames();
    const url = new URL(req.url);
    const categorySlugParam = url.searchParams.get("category");
    // Allow the client to pass EN aliases; convert to DB RU slug for filtering
    const dbCategoryFilter = mapEnToDbCategorySlug(categorySlugParam);
    const subParamRaw = url.searchParams.get("sub") ?? url.searchParams.get("subcategory");
    const subParam = subParamRaw ? subParamRaw.toLowerCase().trim() : null;
    const desiredUiCategory = dbCategoryFilter === "premium"
      ? null
      : (mapDbToEnCategorySlug(dbCategoryFilter ?? null)
          ?? (categorySlugParam ? categorySlugParam.toLowerCase().trim() : null));

    const idParam = url.searchParams.get("id");

    // ----------------------------------------------------
    // DETAIL: /api/products?id=123
    // ----------------------------------------------------
    if (idParam) {
      const idNum = Number(idParam);
      if (!Number.isFinite(idNum) || idNum <= 0) {
        return NextResponse.json(
          { success: false, message: "Invalid id" },
          { status: 400 }
        );
      }

      const item = await prisma.product.findUnique({
        where: { id: idNum },
        include: {
          [rel.categoryKey]: { select: { id: true, name: true, slug: true } },
          [rel.brandKey]:    { select: { id: true, name: true, slug: true } },
          ProductItem: {
            include: {
              Size: {
                select: { id: true, name: true },
              },
              SizeCl: {
                select: { id: true, name: true },
              },
              OneSize: {
                select: { id: true, name: true },
              },
            },
          },
        } as any,
      });

      if (!item) {
        return NextResponse.json(
          { success: false, message: "Not found" },
          { status: 404 }
        );
      }

      // Пытаемся подтянуть связанные изображения, если таблица существует
      let relImages: string[] = [];
      try {
        const maybePI = (prisma as any)?.productImage;
        if (maybePI?.findMany) {
          const imgs = await maybePI.findMany({
            where: { productId: item.id },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { url: true },
          });
          relImages = Array.isArray(imgs) ? imgs.map((i: any) => i.url).filter(Boolean) : [];
        }
      } catch (e) {
        // не критично — просто fallback
        console.warn("[api.products] no productImage relation (detail)", e);
      }

      const baseImages = Array.isArray((item as any).images)
        ? ((item as any).images as string[])
        : [];
      const mergedImages = Array.from(
        new Set(
          [
            ...relImages,                 // приоритет — отсортированные связанные
            ...(baseImages || []),        // затем массив из базы (как пришёл)
            item.imageUrl,                // потом одиночное поле
          ].filter(Boolean)
        )
      );

      const imageUrl = mergedImages[0] || "/img/placeholder.png";

      const dbCategorySlug = (item as any)?.category?.slug ?? (item as any)?.Category?.slug ?? null;
      const subCategorySlug = inferSubcategorySlug({
        name: item.name,
        description: item.description,
        category: (item as any).category ?? (item as any).Category,
        categorySlug: dbCategorySlug,
      });
      const mainCategorySlug = inferMainCategorySlug(
        { ...(item as any), category: (item as any).category ?? (item as any).Category },
        subCategorySlug
      );

      const product = {
        id: item.id,
        name: item.name,
        price: Number(item.price ?? 0),
        oldPrice: null as number | null,
        description: item.description ?? "",
        categoryId:
          item.categoryId ?? (item as any).category?.id ?? (item as any).Category?.id ?? null,
        categoryDbSlug: dbCategorySlug, // raw DB slug (RU)
        categorySlug: mainCategorySlug, // normalized EN slug for UI grouping
        categoryName:
          (item as any).category?.name ?? (item as any).Category?.name ?? null,
        subCategorySlug,
        subcategory: subCategorySlug ? subCategorySlug.toLowerCase() : null,
        images: mergedImages.length ? mergedImages : [imageUrl],
        imageUrl,
        // brand fields from relation
        brandId:
          (item as any)?.brandId ??
          (item as any)?.brand?.id ??
          (item as any)?.Brand?.id ??
          null,
        brandName:
          (item as any)?.brand?.name ??
          (item as any)?.Brand?.name ??
          null,
        brandSlug:
          (item as any)?.brand?.slug ??
          (item as any)?.Brand?.slug ??
          null,
        brandLogo: (item as any)?.brandLogo ?? null, // keep scalar if present
        gender: (item as any)?.gender ?? null,
        premium: Boolean((item as any)?.premium),
        sizes: buildSizesFromProductItem((item as any).ProductItem),
      };

      return NextResponse.json({ success: true, product }, { status: 200 });
    }

    // ----------------------------------------------------
    // LIST: /api/products[?take=...]
    // ----------------------------------------------------
    const takeRaw = url.searchParams.get("take");
    let take = 120;
    if (takeRaw) {
      const t = Number(takeRaw);
      take = Number.isFinite(t) && t > 0 ? Math.min(t, 200) : 120;
    }

    const where: any = {};

    // По умолчанию из общего списка убираем премиальные товары,
    // чтобы они не попадали на главную страницу.
    // Если явно запрошена категория "premium" (через слаг в БД),
    // то наоборот отдаем только премиум.
    if (dbCategoryFilter === "premium") {
      where.premium = true;
    } else {
      // отдаем все товары, у которых premium не true (false или null)
      where.NOT = { premium: true };
    }

    if (dbCategoryFilter && dbCategoryFilter !== "premium") {
      where[rel.categoryKey] = { slug: dbCategoryFilter };
    }

    const rows = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        [rel.categoryKey]: { select: { id: true, name: true, slug: true } },
        [rel.brandKey]:    { select: { id: true, name: true, slug: true } },
        ProductItem: {
          include: {
            Size: {
              select: { id: true, name: true },
            },
            SizeCl: {
              select: { id: true, name: true },
            },
            OneSize: {
              select: { id: true, name: true },
            },
          },
        },
      } as any,
    });

    // Подтягиваем фото из связанной таблицы, если она есть
    const imagesByProductId: Record<number, string[]> = {};
    try {
      const maybePI = (prisma as any)?.productImage;
      if (maybePI?.findMany && rows.length) {
        const ids = rows.map((r) => r.id);
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
      console.warn("[api.products] no productImage relation (list)", e);
    }

    // Build brand filter options based on loaded products
    const brandIds = Array.from(new Set(rows.map((r: any) => r.brandId).filter(Boolean)));
    const brandOptions = brandIds.length
      ? await prisma.brand.findMany({
          where: { id: { in: brandIds as number[] } },
          select: { id: true, name: true, slug: true },
          orderBy: { name: "asc" },
        })
      : [];

    const products = rows.map((p: any) => {
      const baseImages = Array.isArray((p as any).images) ? ((p as any).images as string[]) : [];
      const rel = imagesByProductId[p.id] || [];
      const primary = p.imageUrl || baseImages[0] || rel[0] || null;
      const tailRel = rel.filter((u) => u && u !== primary);
      const tailBase = baseImages.filter((u) => u && u !== primary);
      const mergedImages = Array.from(new Set([primary, ...tailRel, ...tailBase].filter(Boolean)));
      const images = mergedImages.length ? mergedImages : ["/img/placeholder.png"];

      const dbCategorySlug = (p as any)?.category?.slug ?? (p as any)?.Category?.slug ?? null;
      const subCategorySlug =
        inferSubcategorySlug({
          name: p.name,
          description: p.description,
          category: (p as any).category ?? (p as any).Category,
          categorySlug: dbCategorySlug,
        }) || null;
      const mainCategorySlug = inferMainCategorySlug(
        { ...(p as any), category: (p as any).category ?? (p as any).Category },
        subCategorySlug
      );

      return {
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        price: Number(p.price ?? 0),
        oldPrice: null as number | null,
        categoryId:
          p.categoryId ?? (p as any).category?.id ?? (p as any).Category?.id ?? null,
        categoryDbSlug: dbCategorySlug, // raw from DB (RU)
        categorySlug: mainCategorySlug ? mainCategorySlug.toLowerCase() : null, // normalized EN for UI
        categoryName:
          (p as any).category?.name ?? (p as any).Category?.name ?? null,
        createdAt: p.createdAt,
        images,
        imageUrl: images[0],
        subCategorySlug: subCategorySlug ? subCategorySlug.toLowerCase() : null,
        subcategory: subCategorySlug ? subCategorySlug.toLowerCase() : null,
        premium: Boolean((p as any)?.premium),
        brandId:
          (p as any)?.brandId ?? (p as any)?.brand?.id ?? (p as any)?.Brand?.id ?? null,
        brandName:
          (p as any)?.brand?.name ?? (p as any)?.Brand?.name ?? null,
        brandSlug:
          (p as any)?.brand?.slug ?? (p as any)?.Brand?.slug ?? null,
        brandLogo: (p as any)?.brandLogo ?? null,
        gender: (p as any)?.gender ?? null,
        sizes: buildSizesFromProductItem((p as any).ProductItem),
      };
    });

    const filteredByCategory = desiredUiCategory
      ? products.filter((it) => (it.categorySlug || '').toLowerCase() === desiredUiCategory)
      : products;

    const filteredBySub = subParam
      ? filteredByCategory.filter((it) => (it.subCategorySlug || '').toLowerCase() === subParam)
      : filteredByCategory;

    return NextResponse.json(
      {
        success: true,
        products: filteredBySub,
        filters: {
          brands: brandOptions.map(b => ({ id: b.id, name: b.name, slug: b.slug })),
        },
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[api.products] GET error", e);
    // Отдаём 500 и простой ответ, чтобы фронт не падал на парсинге
    return NextResponse.json({ success: false, message: "Server error", products: [] }, { status: 500 });
  }
}

function buildSizesFromProductItem(
  items: any[] | undefined
): {
  available?: (string | number)[];
  prices?: Record<string, number>;
  inStockMoscow?: Record<string, boolean>;
} | null {
  if (!items || items.length === 0) return null;

  const available: (string | number)[] = [];
  const prices: Record<string, number> = {};
  const inStockMoscow: Record<string, boolean> = {};

  for (const it of items) {
    let key: string | number;

    if (it?.Size?.name) {
      // размер из таблицы Size
      key = it.Size.name as string;
    } else if (it?.SizeCl?.name) {
      // размер из таблицы SizeCl (одежда)
      key = it.SizeCl.name as string;
    } else if (it?.OneSize?.name) {
      // безразмерные товары с явным названием
      key = it.OneSize.name as string;
    } else {
      // общий fallback, если ничего нет
      key = "ONE SIZE";
    }

    const keyStr = String(key);

    if (!available.includes(key)) {
      available.push(key);
    }

    const price = Number(it.price ?? 0);
    prices[keyStr] = price;

    const stockField =
      typeof it.stockMoscow === "number"
        ? it.stockMoscow
        : typeof it.stock === "number"
        ? it.stock
        : null;

    inStockMoscow[keyStr] = stockField != null ? stockField > 0 : true;
  }

  if (!available.length) return null;

  return {
    available,
    prices,
    inStockMoscow,
  };
}
