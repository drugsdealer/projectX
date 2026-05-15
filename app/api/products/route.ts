import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { parseProductPathId } from "@/lib/product-url";
import {
  getSubcategoryAliases,
  mapUiCategoryToDb,
  normalizeCategorySlug,
  normalizeSubcategorySlug,
  resolveProductTaxonomy,
} from "@/lib/catalog-taxonomy";

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
  return normalizeCategorySlug(dbSlug);
}

function mapEnToDbCategorySlug(enSlug?: string | null): string | null {
  return mapUiCategoryToDb(enSlug);
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

// --- Subcategory inference: match product name/description to subcategory slug
const INFER_RULES: Array<{ slug: string; rx: RegExp }> = [
  // Обувь
  { slug: 'sneakers',    rx: /(кроссов|sneak|yeezy|dunk|air\s*force|jordan)/i },
  { slug: 'boots',       rx: /(ботинк|сапог|челси|chelsea|boot)/i },
  { slug: 'loafers',     rx: /(лофер|loafer|мокасин)/i },
  { slug: 'sandals',     rx: /(сандал|сланц|шлеп|sandal)/i },
  // Одежда
  { slug: 'tshirts',     rx: /(футболк|t[\s-]?shirt|tee\b)/i },
  { slug: 'hoodies',     rx: /(худи|hood|толстовк)/i },
  { slug: 'sweatshirts', rx: /(свитшот|sweatshirt)/i },
  { slug: 'sweaters',    rx: /(свитер|свитр|sweater|джемпер|jumper|пуловер|pullover)/i },
  { slug: 'cardigans',   rx: /(кардиган|cardigan)/i },
  { slug: 'shirts',      rx: /(рубашк|рубах|shirt(?!.*t-shirt))/i },
  { slug: 'polo',        rx: /(поло\b|polo\b)/i },
  { slug: 'jackets',     rx: /(куртк|бомбер|bomber|ветровк|jacket)/i },
  { slug: 'coats',       rx: /(пальто|coat|тренч|trench)/i },
  { slug: 'parkas',      rx: /(парка|parka|пухов|down\s*jacket)/i },
  { slug: 'vests',       rx: /(жилет|vest|безрукавк)/i },
  { slug: 'jeans',       rx: /(джинс|jeans|denim)/i },
  { slug: 'pants',       rx: /(брюк|штан|pants|trousers|чинос|chinos|джоггер|jogger|карго|cargo)/i },
  { slug: 'shorts',      rx: /(шорт|shorts)/i },
  { slug: 'tracksuits',  rx: /(спортивн.*костюм|tracksuit)/i },
  { slug: 'dresses',     rx: /(платье|dress)/i },
  { slug: 'skirts',      rx: /(юбк|skirt)/i },
  { slug: 'suits',       rx: /(костюм(?!.*спорт)|suit(?!.*track))/i },
  // Сумки
  { slug: 'bags',        rx: /(сумк|сумоч|bag(?!.*back)|тоут|tote|клатч|clutch|шопер|shopper)/i },
  { slug: 'backpacks',   rx: /(рюкзак|backpack)/i },
  { slug: 'waistbags',   rx: /(поясн.*сумк|waist\s*bag|belt\s*bag|бананк)/i },
  { slug: 'cardholders', rx: /(кардхолдер|card\s*holder|визитниц)/i },
  { slug: 'wallets',     rx: /(кошел[её]к|бумажник|wallet)/i },
  // Аксессуары
  { slug: 'belts',       rx: /(ремен|ремн|belt)/i },
  { slug: 'glasses',     rx: /(очк|glasses|sunglasses|солнцезащитн)/i },
  { slug: 'watches',     rx: /(час[ыов]|watch)/i },
  { slug: 'rings',       rx: /(кольц|ring)/i },
  { slug: 'earrings',    rx: /(серьг|серёг|earring)/i },
  { slug: 'bracelets',   rx: /(браслет|bracelet)/i },
  { slug: 'necklaces',   rx: /(колье|цеп[оч]|necklace|chain|подвеск|pendant)/i },
  { slug: 'keychains',   rx: /(брелок|брелк|keychain)/i },
  { slug: 'scarves',     rx: /(шарф|scarf|scarves|палантин)/i },
  { slug: 'gloves',      rx: /(перчатк|glove)/i },
  { slug: 'socks',       rx: /(носк|sock)/i },
  // Головные уборы
  { slug: 'caps',        rx: /(кепк|бейсболк|cap\b)/i },
  { slug: 'beanies',     rx: /(шапк|beanie)/i },
  { slug: 'hats',        rx: /(панам|шляп|hat\b|bucket)/i },
  // Парфюм
  { slug: 'fragrances',  rx: /(парфюм|духи|туалетн.*вод|eau\s*de|edp|edt|perfume|fragrance|аромат)/i },
];

function inferSubcategorySlug(p: any): string | null {
  const text = [p?.name, p?.description].filter(Boolean).join(' ');
  for (const rule of INFER_RULES) {
    if (rule.rx.test(text)) return rule.slug;
  }
  return null;
}

export const revalidate = 60; // ISR: Vercel кэширует на 60 сек, stale-while-revalidate ещё 5 мин

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
};

const FALLBACK_PRODUCTS = [
  {
    id: 900001,
    name: "Nike Dunk Low Retro",
    description: "Базовая пара для ежедневной носки.",
    price: 18900,
    oldPrice: null,
    categoryId: null,
    categoryDbSlug: "footwear",
    categorySlug: "footwear",
    categoryName: "Обувь",
    subCategorySlug: "sneakers",
    subcategory: "sneakers",
    images: ["/img/dunk.jpg", "/img/dunk2.jpg", "/img/dunk3.jpg"],
    imageUrl: "/img/dunk.jpg",
    premium: false,
    brandId: null,
    brandName: "Nike",
    brandSlug: "nike",
    brandLogo: "/img/найк.webp",
    gender: "unisex",
    badge: null,
    article: "FALLBACK-DUNK",
    sizes: { available: [39, 40, 41, 42, 43], prices: { "39": 18900, "40": 18900, "41": 18900, "42": 18900, "43": 18900 }, inStockMoscow: { "39": true, "40": true, "41": true, "42": true, "43": true } },
  },
  {
    id: 900002,
    name: "Acne Studios Hoodie",
    description: "Плотное худи с расслабленной посадкой.",
    price: 24900,
    oldPrice: null,
    categoryId: null,
    categoryDbSlug: "clothes",
    categorySlug: "clothes",
    categoryName: "Одежда",
    subCategorySlug: "hoodies",
    subcategory: "hoodies",
    images: ["/img/acne_hoodie.webp", "/img/acne x kappa.webp"],
    imageUrl: "/img/acne_hoodie.webp",
    premium: false,
    brandId: null,
    brandName: "Acne Studios",
    brandSlug: "acne-studios",
    brandLogo: "/img/acne.png",
    gender: "unisex",
    badge: null,
    article: "FALLBACK-ACNE-HOODIE",
    sizes: { available: ["S", "M", "L"], prices: { S: 24900, M: 24900, L: 24900 }, inStockMoscow: { S: true, M: true, L: true } },
  },
  {
    id: 900003,
    name: "Goyard Saigon Mini Bag",
    description: "Компактная сумка с акцентной фактурой.",
    price: 139000,
    oldPrice: null,
    categoryId: null,
    categoryDbSlug: "bags",
    categorySlug: "bags",
    categoryName: "Сумки",
    subCategorySlug: "bags",
    subcategory: "bags",
    images: ["/img/goyard_saigon1.webp", "/img/goyard saigon2.webp", "/img/goyard saigon3.webp"],
    imageUrl: "/img/goyard_saigon1.webp",
    premium: false,
    brandId: null,
    brandName: "Goyard",
    brandSlug: "goyard",
    brandLogo: "/img/Logo_Goyard.png",
    gender: "women",
    badge: null,
    article: "FALLBACK-GOYARD-SAIGON",
    sizes: { available: ["ONE SIZE"], prices: { "ONE SIZE": 139000 }, inStockMoscow: { "ONE SIZE": true } },
  },
  {
    id: 900004,
    name: "Maison Margiela Replica Paint",
    description: "Аромат с чистым древесным профилем.",
    price: 16900,
    oldPrice: 19900,
    categoryId: null,
    categoryDbSlug: "fragrance",
    categorySlug: "fragrance",
    categoryName: "Парфюмерия",
    subCategorySlug: "fragrances",
    subcategory: "fragrances",
    images: ["/img/реплика пеинт.jpg", "/img/margiela.jpg"],
    imageUrl: "/img/реплика пеинт.jpg",
    premium: false,
    brandId: null,
    brandName: "Maison Margiela",
    brandSlug: "maison-margiela",
    brandLogo: "/img/mm-logo.svg",
    gender: "unisex",
    badge: "sale",
    article: "FALLBACK-REPLICA",
    sizes: { available: ["100 ml"], prices: { "100 ml": 16900 }, inStockMoscow: { "100 ml": true } },
  },
  {
    id: 900005,
    name: "Chrome Hearts Ring",
    description: "Серебряное кольцо с фирменной графикой.",
    price: 52900,
    oldPrice: null,
    categoryId: null,
    categoryDbSlug: "accessories",
    categorySlug: "accessories",
    categoryName: "Аксессуары",
    subCategorySlug: "rings",
    subcategory: "rings",
    images: ["/img/tiffany ring.webp", "/img/chrome-hearts.svg"],
    imageUrl: "/img/tiffany ring.webp",
    premium: false,
    brandId: null,
    brandName: "Chrome Hearts",
    brandSlug: "chrome-hearts",
    brandLogo: "/img/chrome-hearts.svg",
    gender: "unisex",
    badge: null,
    article: "FALLBACK-CH-RING",
    sizes: { available: [17, 18, 19], prices: { "17": 52900, "18": 52900, "19": 52900 }, inStockMoscow: { "17": true, "18": true, "19": true } },
  },
  {
    id: 900006,
    name: "Supreme Box Logo Cap",
    description: "Кепка для повседневной ротации.",
    price: 12900,
    oldPrice: null,
    categoryId: null,
    categoryDbSlug: "headwear",
    categorySlug: "headwear",
    categoryName: "Головные уборы",
    subCategorySlug: "caps",
    subcategory: "caps",
    images: ["/img/supreme.png", "/img/vlone.png"],
    imageUrl: "/img/supreme.png",
    premium: false,
    brandId: null,
    brandName: "Supreme",
    brandSlug: "supreme",
    brandLogo: "/img/supreme.png",
    gender: "unisex",
    badge: null,
    article: "FALLBACK-SUP-CAP",
    sizes: { available: ["ONE SIZE"], prices: { "ONE SIZE": 12900 }, inStockMoscow: { "ONE SIZE": true } },
  },
];

function getFallbackProducts(params: {
  desiredUiCategory: string | null;
  subParam: string | null;
  includePremium: boolean;
  dbCategoryFilter: string | null;
  saleOnly: boolean;
  genderFilter: string;
}) {
  const products = FALLBACK_PRODUCTS.filter((product) => {
    if (params.dbCategoryFilter === "premium") return product.premium;
    if (!params.includePremium && product.premium) return false;
    if (params.desiredUiCategory && product.categorySlug !== params.desiredUiCategory) return false;
    if (params.subParam && !getSubcategoryAliases(params.subParam).includes(product.subCategorySlug)) return false;
    if (params.saleOnly && product.badge !== "sale" && !product.oldPrice) return false;
    if (
      params.genderFilter &&
      product.gender &&
      product.gender !== "unisex" &&
      product.gender !== params.genderFilter
    ) {
      return false;
    }
    return true;
  });

  const brandMap = new Map<string, { id: null; name: string; slug: string | null }>();
  for (const product of products) {
    if (product.brandName && !brandMap.has(product.brandName)) {
      brandMap.set(product.brandName, {
        id: null,
        name: product.brandName,
        slug: product.brandSlug,
      });
    }
  }

  return {
    success: true,
    fallback: true,
    products,
    filters: {
      brands: Array.from(brandMap.values()),
    },
  };
}

export async function GET(req: Request) {
  try {
    const rel = await ensureRelationNames();
    const url = new URL(req.url);
    const categorySlugParam = url.searchParams.get("category");
    const includePremiumRaw = (url.searchParams.get("includePremium") || "").toLowerCase();
    const includePremium = includePremiumRaw === "1" || includePremiumRaw === "true";
    // Allow the client to pass EN aliases; convert to DB RU slug for filtering
    const dbCategoryFilter = mapEnToDbCategorySlug(categorySlugParam);
    const subParamRaw = url.searchParams.get("sub") ?? url.searchParams.get("subcategory");
    const subParam = subParamRaw ? normalizeSubcategorySlug(subParamRaw) : null;
    const desiredUiCategory = dbCategoryFilter === "premium"
      ? null
      : (mapDbToEnCategorySlug(dbCategoryFilter ?? null)
          ?? (categorySlugParam ? categorySlugParam.toLowerCase().trim() : null));

    const idParam = url.searchParams.get("id");

    // ----------------------------------------------------
    // DETAIL: /api/products?id=123
    // ----------------------------------------------------
    if (idParam) {
      const idNum = parseProductPathId(idParam);
      if (!idNum) {
        return NextResponse.json(
          { success: false, message: "Invalid id" },
          { status: 400 }
        );
      }

      const item = await withDbRetry(
        () => prisma.product.findFirst({
          where: { id: idNum, deletedAt: null },
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
        }),
        { retries: 2, timeoutMs: 8000, label: `api product ${idNum}` }
      );

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
        console.warn("[api.products] no productImage relation (detail)");
      }

      const baseImages = Array.isArray((item as any).images)
        ? ((item as any).images as string[])
        : [];
      // imageUrl (главная фотка) всегда первая
      const primary = item.imageUrl || baseImages[0] || relImages[0] || null;
      const tail = [...relImages, ...baseImages].filter((u) => u && u !== primary);
      const mergedImages = Array.from(new Set([primary, ...tail].filter(Boolean)));

      const imageUrl = mergedImages[0] || "/img/placeholder.svg";

      const dbCategorySlug = (item as any)?.category?.slug ?? (item as any)?.Category?.slug ?? null;
      const taxonomy = resolveProductTaxonomy({
        ...(item as any),
        Category: (item as any).Category,
        category: (item as any).category,
        categorySlug: dbCategorySlug,
      });
      const subCategorySlug = taxonomy.subcategorySlug;
      const mainCategorySlug = taxonomy.categorySlug;

      const product = {
        id: item.id,
        name: item.name,
        price: Number(item.price ?? 0),
        oldPrice: (item as any).oldPrice ? Number((item as any).oldPrice) : null,
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
        badge: (item as any)?.badge ?? null,
        article: (item as any)?.article ?? null,
        sizes: buildSizesFromProductItem((item as any).ProductItem),
      };

      return NextResponse.json({ success: true, product }, { status: 200, headers: PUBLIC_CACHE_HEADERS });
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

    const saleOnly = (url.searchParams.get("sale") ?? "") === "1";

    const where: any = { deletedAt: null };

    // По умолчанию из общего списка убираем премиальные товары.
    // Можно явно включить их через includePremium=1|true (для внутренних витрин/промо).
    if (dbCategoryFilter === "premium") {
      where.premium = true;
    } else if (!includePremium) {
      where.NOT = { premium: true };
    }

    if (dbCategoryFilter && dbCategoryFilter !== "premium") {
      where[rel.categoryKey] = { slug: dbCategoryFilter };
    }

    if (saleOnly) {
      where.OR = [
        { badge: { equals: "sale", mode: "insensitive" } },
        { oldPrice: { not: null } },
      ];
    }

    const genderFilter = (url.searchParams.get("gender") ?? "").trim().toLowerCase();
    if (genderFilter) {
      const existingOr = where.OR ?? [];
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { gender: { equals: genderFilter, mode: "insensitive" } },
            { gender: { equals: "unisex", mode: "insensitive" } },
          ],
        },
      ];
    }

    const rows = await withDbRetry(
      () => prisma.product.findMany({
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
      }),
      { retries: 2, timeoutMs: 10000, label: "api products list" }
    );

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
      console.warn("[api.products] no productImage relation (list)");
    }

    // Build brand filter options from already-loaded rows (no extra DB query)
    const brandMap = new Map<number, { id: number; name: string; slug: string }>();
    for (const r of rows as any[]) {
      const b = r.Brand ?? r.brand;
      if (b?.id && !brandMap.has(b.id)) brandMap.set(b.id, { id: b.id, name: b.name, slug: b.slug });
    }
    const brandOptions = Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const products = rows.map((p: any) => {
      const baseImages = Array.isArray((p as any).images) ? ((p as any).images as string[]) : [];
      const rel = imagesByProductId[p.id] || [];
      const primary = p.imageUrl || baseImages[0] || rel[0] || null;
      const tailRel = rel.filter((u) => u && u !== primary);
      const tailBase = baseImages.filter((u) => u && u !== primary);
      const mergedImages = Array.from(new Set([primary, ...tailRel, ...tailBase].filter(Boolean)));
      const images = mergedImages.length ? mergedImages : ["/img/placeholder.svg"];

      const dbCategorySlug = (p as any)?.category?.slug ?? (p as any)?.Category?.slug ?? null;
      const taxonomy = resolveProductTaxonomy({
        ...(p as any),
        Category: (p as any).Category,
        category: (p as any).category,
        categorySlug: dbCategorySlug,
      });
      const subCategorySlug = taxonomy.subcategorySlug;
      const mainCategorySlug = taxonomy.categorySlug;

      return {
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        price: Number(p.price ?? 0),
        oldPrice: (p as any).oldPrice ? Number((p as any).oldPrice) : null,
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
        badge: (p as any)?.badge ?? null,
        article: (p as any)?.article ?? null,
        sizes: buildSizesFromProductItem((p as any).ProductItem),
      };
    });

    const filteredByCategory = desiredUiCategory
      ? products.filter((it) => (it.categorySlug || '').toLowerCase() === desiredUiCategory)
      : products;

    const filteredBySub = subParam
      ? filteredByCategory.filter((it) => getSubcategoryAliases(subParam).includes((it.subCategorySlug || '').toLowerCase()))
      : filteredByCategory;

    return NextResponse.json(
      {
        success: true,
        products: filteredBySub,
        filters: {
          brands: brandOptions.map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
        },
      },
      { status: 200, headers: PUBLIC_CACHE_HEADERS }
    );
  } catch (e) {
    console.error("[api.products] GET error");
    const url = new URL(req.url);
    const categorySlugParam = url.searchParams.get("category");
    const dbCategoryFilter = mapEnToDbCategorySlug(categorySlugParam);
    const desiredUiCategory = dbCategoryFilter === "premium"
      ? null
      : (mapDbToEnCategorySlug(dbCategoryFilter ?? null)
          ?? (categorySlugParam ? categorySlugParam.toLowerCase().trim() : null));
    const subParamRaw = url.searchParams.get("sub") ?? url.searchParams.get("subcategory");
    const includePremiumRaw = (url.searchParams.get("includePremium") || "").toLowerCase();

    return NextResponse.json(
      getFallbackProducts({
        desiredUiCategory,
        subParam: subParamRaw ? normalizeSubcategorySlug(subParamRaw) : null,
        includePremium: includePremiumRaw === "1" || includePremiumRaw === "true",
        dbCategoryFilter,
        saleOnly: (url.searchParams.get("sale") ?? "") === "1",
        genderFilter: (url.searchParams.get("gender") ?? "").trim().toLowerCase(),
      }),
      { status: 200, headers: PUBLIC_CACHE_HEADERS }
    );
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

    if (it?.sizeLabel) {
      key = String(it.sizeLabel);
    } else if (it?.Size?.name) {
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
