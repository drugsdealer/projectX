import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
};

// --- Category helpers (RU <-> EN) and inference for [id] route ---
const RU_TO_EN: Record<string, string> = {
  "обувь": "footwear",
  "одежда": "clothes",
  "головные-уборы": "headwear",
  "аксессуары": "accessories",
  "сумки-и-рюкзаки": "bags",
  "парфюмерия": "perfumery",
  "premium": "premium",
};

function uiCategoryFromDbSlug(dbSlug?: string | null): string | null {
  if (!dbSlug) return null;
  const key = String(dbSlug).trim().toLowerCase();
  return RU_TO_EN[key] ?? key;
}

// very light-weight subcategory inference by text
function inferSubcategorySlugByText(name?: string | null, description?: string | null): string | null {
  const text = `${name ?? ""} ${description ?? ""}`.toLowerCase();
  if (!text) return null;

  if (/(ботинк|boot)/.test(text)) return "boots";
  if (/(кроссовк|sneak|yeezy|dunk|air\s?(max|force|jordan)|vapormax|new\s?balance|ultra\s?boost|gazelle|samba|forum|superstar|stan\s?smith)/.test(text)) return "sneakers";
  if (/(сандал|сланц|шл[её]пк|sandal|slide|flip\-?flop)/.test(text)) return "sandals";

  if (/(худи|толстовк|hood)/.test(text)) return "hoodies";
  if (/(футболк|t-?shirt|tee)/.test(text)) return "tshirts";
  if (/(куртк|jacket|пухов|ветровк|бомбер|coat)/.test(text)) return "outerwear";
  if (/(брюк|штаны|джинс|pants|jean)/.test(text)) return "pants";

  if (/(сумк|рюкзак|bag|backpack|tote)/.test(text)) return "bags";
  if (/(кепк|cap)/.test(text)) return "caps";
  if (/(шапк|beanie)/.test(text)) return "beanies";
  if (/(парфюмер|духи|fragrance|perfume)/.test(text)) return "perfumery";

  return null;
}

function inferMainCategorySlug(p: any, sub: string | null): string | null {
  // 1) DB → UI alias conversion
  const fromDb = uiCategoryFromDbSlug(p?.category?.slug ?? p?.categorySlug ?? null);

  // 2) sizeType hints
  const st = String(p?.sizeType || "").toUpperCase();
  if (st === "SHOE" || st === "SHOES" || st === "FOOTWEAR") return "footwear";

  // 3) subcategory hints
  if (sub && ["sneakers", "boots", "sandals", "slides", "slippers"].includes(sub)) return "footwear";
  if (sub && ["hoodies", "tshirts", "outerwear", "pants"].includes(sub)) return "clothes";
  if (sub && ["caps", "beanies"].includes(sub)) return "headwear";
  if (sub && ["bags"].includes(sub)) return "bags";
  if (sub && ["perfumery"].includes(sub)) return "perfumery";

  // 4) text fallback
  const hay = `${p?.name ?? ""} ${p?.description ?? ""}`.toLowerCase();
  if (/(кроссов|sneak|yeezy|dunk|air|force|jordan|adidas|nike|ботинк|сапог|chelsea)/.test(hay)) return "footwear";
  if (/(hood|толстовк|худи|футболк|t-?shirt|tee|куртк|парка|пухов|ветровк|бомбер|coat|jacket|брюк|джинс|штан)/.test(hay)) return "clothes";
  if (/(кепк|cap|шапк|beanie|бандан|bandan)/.test(hay)) return "headwear";
  if (/(сумк|bag|рюкзак|backpack|tote)/.test(hay)) return "bags";
  if (/(парфюмер|духи|fragrance|perfume)/.test(hay)) return "perfumery";

  return fromDb ?? null;
}

// отключаем кэш
export const revalidate = 0;

/**
 * GET /api/products/[id]
 * Возвращает один товар по id + нормализованный список вариантов (ProductItem).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const productId = Number(id);

    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid product id" },
        { status: 400 }
      );
    }

    // Базовый товар (минимальный набор полей — без жёстких связей, чтобы не падать, если какие-то relation'ы отсутствуют)
    const product = await (prisma as any).product.findFirst({
      where: { id: productId, deletedAt: null },
      include: {
        Brand: true,
        Category: true,
        Color: true,
        Size: true,
        SizeCl: true,
        ProductItem: {
          include: {
            Size: {
              select: {
                id: true,
                name: true,
              },
            },
            SizeCl: {
              select: {
                id: true,
                name: true,
              },
            },
            OneSize: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        PerfumeVariant: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    // Соберём изображения из возможных мест (imageUrl, массив images, таблица ProductImage)
    const imgs: string[] = [];
    const pAny = product as any;

    let colorVariants: any[] = [];

    if (pAny?.imageUrl) imgs.push(pAny.imageUrl);
    if (Array.isArray(pAny?.images)) imgs.push(...pAny.images);

    try {
      const anyPrisma = prisma as any;
      if (anyPrisma?.productImage?.findMany) {
        const rows = await anyPrisma.productImage.findMany({
          where: { productId },
          select: { url: true },
        });
        if (Array.isArray(rows)) {
          imgs.push(...rows.map((r: any) => r?.url).filter(Boolean));
        }
      }
    } catch {
      // игнорируем, если модели нет/упала
    }

    try {
      if (pAny?.modelKey) {
        const variants = await (prisma as any).product.findMany({
          where: {
            modelKey: pAny.modelKey,
            id: { not: product.id },
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            imageUrl: true,
            price: true,
            oldPrice: true,
            colorId: true,
            Color: {
              select: {
                id: true,
                name: true,
                hex: true,
              },
            },
            modelKey: true,
          },
          orderBy: {
            id: "asc",
          },
        });
        colorVariants = Array.isArray(variants) ? variants : [];
      }
    } catch (err) {
      console.error("[api.products.[id]] colorVariants error:", err);
    }

    const images = Array.from(new Set(imgs.filter(Boolean)));

    // 1) Варианты (ProductItem) берём из include, чтобы не делать лишний запрос
    const rawItems: any[] = Array.isArray((pAny as any).ProductItem)
      ? (pAny as any).ProductItem
      : [];

    // Нормализуем варианты в единый формат, удобный фронту + собираем цены по размерам
    const priceMap: Record<string, number> = {};
    const oldPriceMap: Record<string, number> = {};

    const normalizedItems = (rawItems ?? [])
      .map((v: any) => {
        const label =
          v?.sizeLabel ??
          v?.Size?.name ??
          v?.SizeCl?.name ??
          v?.OneSize?.name ??
          null;

        if (label != null) {
          const key = String(label);
          if (typeof v?.price === "number") {
            priceMap[key] = v.price;
          }
          if (typeof v?.oldPrice === "number") {
            oldPriceMap[key] = v.oldPrice;
          }
        }

        return {
          id: v?.id,
          sizeLabel: label,
          price: typeof v?.price === "number" ? v.price : null,
          oldPrice: typeof v?.oldPrice === "number" ? v.oldPrice : null,
        };
      })
      .filter((x: any) => x && Number.isFinite(Number(x.id)));

    const availableSizes = (normalizedItems ?? [])
      .map((it: any) => it?.sizeLabel)
      .filter((v: any) => typeof v === "string" || typeof v === "number");

    const sizes: any = { available: availableSizes };
    if (Object.keys(priceMap).length > 0) {
      sizes.prices = priceMap;
    }
    if (Object.keys(oldPriceMap).length > 0) {
      sizes.oldPrices = oldPriceMap;
    }

    // Нормализуем габариты товара (например, для сумок)
    const dimensions =
      typeof pAny?.widthCm === "number" &&
      typeof pAny?.heightCm === "number" &&
      typeof pAny?.depthCm === "number"
        ? {
            width: pAny.widthCm,
            height: pAny.heightCm,
            depth: pAny.depthCm,
          }
        : null;

    // Ноты аромата для парфюмерии (если заданы в БД)
    const fragranceNotes =
      (Array.isArray(pAny?.fragranceTopNotes) &&
        pAny.fragranceTopNotes.length > 0) ||
      (Array.isArray(pAny?.fragranceMiddleNotes) &&
        pAny.fragranceMiddleNotes.length > 0) ||
      (Array.isArray(pAny?.fragranceBaseNotes) &&
        pAny.fragranceBaseNotes.length > 0)
        ? {
            top: Array.isArray(pAny.fragranceTopNotes)
              ? pAny.fragranceTopNotes
              : [],
            middle: Array.isArray(pAny.fragranceMiddleNotes)
              ? pAny.fragranceMiddleNotes
              : [],
            base: Array.isArray(pAny.fragranceBaseNotes)
              ? pAny.fragranceBaseNotes
              : [],
          }
        : null;

    // Материалы для ювелирки / аксессуаров / сумок
    const materials =
      pAny?.materialPrimary || pAny?.materialSecondary
        ? {
            primary: pAny.materialPrimary ?? null,
            secondary: pAny.materialSecondary ?? null,
          }
        : null;

    const liningMaterial = pAny?.liningMaterial ?? null;

    // --- category normalization for detail response ---
    const categoryDbSlug = (product as any)?.Category?.slug ?? null;
    const subCategorySlug = inferSubcategorySlugByText(pAny?.name, pAny?.description);
    const categorySlug = inferMainCategorySlug({ ...pAny, category: product.Category, categorySlug: categoryDbSlug }, subCategorySlug) ?? uiCategoryFromDbSlug(categoryDbSlug);
    const categoryId = (product as any)?.categoryId ?? (product as any)?.Category?.id ?? null;
    const categoryName = (product as any)?.Category?.name ?? null;

    // Если это парфюмерия и есть варианты объёма (PerfumeVariant), переопределяем sizes
    try {
      const isPerfumeCategory =
        categorySlug === "perfumery" ||
        categorySlug === "perfume" ||
        /(парфюмер|духи|fragrance|perfume)/.test(
          `${pAny?.name ?? ""} ${pAny?.description ?? ""}`.toLowerCase()
        );

      const variants: any[] = Array.isArray((pAny as any)?.PerfumeVariant)
        ? (pAny as any).PerfumeVariant
        : [];

      if (isPerfumeCategory && variants.length > 0) {
        const sorted = variants
          .filter((v: any) => typeof v?.volumeMl === "number")
          .sort(
            (a: any, b: any) =>
              (a.volumeMl as number) - (b.volumeMl as number)
          );

        const volumes: number[] = [];
        const volumePriceMap: Record<string, number> = {};
        const volumeOldPriceMap: Record<string, number> = {};

        for (const v of sorted) {
          const vol = v.volumeMl as number;
          if (!Number.isFinite(vol)) continue;
          volumes.push(vol);

          if (typeof v.price === "number") {
            volumePriceMap[String(vol)] = v.price;
          }
          if (typeof v.oldPrice === "number") {
            volumeOldPriceMap[String(vol)] = v.oldPrice;
          }
        }

        if (volumes.length > 0) {
          (sizes as any).available = volumes;
          if (Object.keys(volumePriceMap).length > 0) {
            (sizes as any).prices = volumePriceMap;
          }
          if (Object.keys(volumeOldPriceMap).length > 0) {
            (sizes as any).oldPrices = volumeOldPriceMap;
          }
        }
      }
    } catch {
      // если что-то пошло не так с PerfumeVariant, просто оставляем sizes как есть
    }

    // Нормализованный ответ для фронта
    const normalized = {
      id: product.id,
      name: pAny?.name ?? "",
      premium: Boolean((pAny as any)?.premium),
      price: pAny?.price ?? null,
      oldPrice: pAny?.oldPrice ?? null,
      description: pAny?.description ?? null,
      imageUrl: pAny?.imageUrl ?? null,
      brand: product.Brand?.name ?? null,
      brandLogo: product.Brand?.logoUrl ?? null,
      images,
      sizeType: pAny?.sizeType ?? null,
      brandId: pAny?.brandId ?? null,
      colorId: pAny?.colorId ?? null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      dimensions,
      fragranceNotes,
      materials,
      liningMaterial,
      // category fields for UI
      categoryId,
      categoryDbSlug,
      categorySlug,
      categoryName,
      subCategorySlug,
      // важно: всегда возвращаем items, чтобы Checkout мог сопоставить productItemId
      items: normalizedItems,
      // sizes: удобный формат для фронта (доступные размеры + цены по размерам)
      sizes,
      colorVariants,
    };

    // Для обратной совместимости вернём дубли в верхних полях
    return NextResponse.json(
      {
        success: true,
        product: normalized,
        premium: normalized.premium,
        items: normalizedItems,
        productItems: normalizedItems,
        colorVariants,
      },
      { status: 200, headers: PUBLIC_CACHE_HEADERS }
    );
  } catch (e) {
    console.error("[api.products.[id]] error:", e);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
