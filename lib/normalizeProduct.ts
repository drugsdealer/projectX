export type NormalizedProduct = {
  id: number;
  name: string;
  price: number;
  oldPrice?: number | null;
  images: string[];
  imageUrl?: string | null;
  category: 'clothing' | 'shoes' | 'bags' | 'jewelry' | 'perfume' | 'fragrance' | string;
  description?: string | null;
  material?: string | null;
  features?: string | null;
  styleNotes?: string | null;
  premium?: boolean;
  badge?: string | null;
  brand?: string | string[] | null;
  brandLogo?: string | null;
  brandSlug?: string | null;
  sizes?: {
    available?: Array<string | number>;
    prices?: Record<string, number>;
    inStockMoscow?: Record<string, boolean>;
  } | null;
  gender?: string | null;
  createdAt?: string | Date | null;
  stock?: number | null;
  dimensions?: { width: number; height: number; depth: number } | null;
  fragranceNotes?: {
    top: string[];
    middle: string[];
    base: string[];
  } | null;
  sillageDescription?: string | null;
  jewelryType?: 'ring' | 'bracelet' | 'necklace' | string;
  metal?: string | null;
  stones?: string | null;
  coating?: string | null;
  occasion?: string | null;

  outerMaterial?: string | null;
  innerMaterial?: string | null;
  bagType?: string | null;
  capacityDescription?: string | null;
};

export function normalizeProduct(raw: any): NormalizedProduct {
  const safeNumber = (v: any, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const safeString = (v: any, fallback = ""): string => {
    if (typeof v === "string") return v.trim();
    if (v == null) return fallback;
    return String(v).trim();
  };

  const normalizeCategory = (v: any): string => {
    const raw = safeString(v).toLowerCase();
    if (!raw) return "other";

    if (["clothing", "clothes", "одежда", "apparel"].includes(raw)) {
      return "clothing";
    }
    if (["shoes", "footwear", "обувь", "sneakers", "кроссовки"].includes(raw)) {
      return "shoes";
    }
    if (["bag", "bags", "сумка", "сумки"].includes(raw)) {
      return "bags";
    }
    // Парфюмерия / ароматы
    if (
      [
        "perfume",
        "perfumes",
        "parfum",
        "parfums",
        "fragrance",
        "fragrances",
        "perfumery",
        "парфюмерия",
        "духи",
      ].includes(raw)
    ) {
      return "perfume";
    }
    if (["jewelry", "jewellery", "украшения", "кольца", "браслеты"].includes(raw)) {
      return "jewelry";
    }
    return raw;
  };

  const pickBrand = (rawBrand: any, brandName: any, brands: any): string | string[] | null => {
    const s = (v: any) => (typeof v === "string" ? v.trim() : "");
    const fromObj = (o: any) =>
      o && typeof o === "object"
        ? s(o.name) || s(o.title) || s(o.label) || s(o.slug)
        : "";

    if (Array.isArray(brands) && brands.length) {
      const arr = brands.map((b) => (typeof b === "string" ? b.trim() : fromObj(b))).filter(Boolean);
      if (arr.length === 1) return arr[0];
      if (arr.length > 1) return arr;
    }

    const direct =
      s(rawBrand) ||
      s(brandName) ||
      fromObj(rawBrand) ||
      fromObj((brands && brands[0]) || null);
    return direct || null;
  };

  const pickImages = (raw: any): string[] => {
    const result: string[] = [];

    if (Array.isArray(raw?.images)) {
      for (const img of raw.images) {
        const s = typeof img === "string" ? img.trim() : "";
        if (s) result.push(s);
      }
    }

    const one =
      (typeof raw?.imageUrl === "string" && raw.imageUrl.trim()) ||
      (typeof raw?.image === "string" && raw.image.trim()) ||
      (typeof raw?.thumbnail === "string" && raw.thumbnail.trim()) ||
      "";

    if (one && !result.includes(one)) {
      result.push(one);
    }

    return result.length ? result : ["/img/placeholder.png"];
  };

  const normalizeSizes = (rawSizes: any): NormalizedProduct["sizes"] => {
    if (!rawSizes) return null;

    const result: NormalizedProduct["sizes"] = {
      available: undefined,
      prices: undefined,
      inStockMoscow: undefined,
    };

    // Уже нормализованный объект
    if (typeof rawSizes === "object" && !Array.isArray(rawSizes)) {
      if (Array.isArray(rawSizes.available)) {
        result.available = rawSizes.available;
      }
      if (rawSizes.prices && typeof rawSizes.prices === "object") {
        result.prices = rawSizes.prices;
      }
      if (rawSizes.inStockMoscow && typeof rawSizes.inStockMoscow === "object") {
        result.inStockMoscow = rawSizes.inStockMoscow;
      }
      return result;
    }

    // Просто массив размеров
    if (Array.isArray(rawSizes)) {
      result.available = rawSizes;
      return result;
    }

    return null;
  };

  const buildPerfumeSizes = (
    raw: any,
    baseSizes: NormalizedProduct["sizes"]
  ): NormalizedProduct["sizes"] => {
    const variants = raw?.PerfumeVariant ?? raw?.perfumeVariants ?? raw?.perfumeVariant;
    if (!Array.isArray(variants) || !variants.length) return baseSizes ?? null;

    const result: NormalizedProduct["sizes"] = baseSizes
      ? { ...baseSizes }
      : { available: [], prices: {}, inStockMoscow: undefined };

    const avail = (result.available ?? []) as Array<string | number>;
    const prices = (result.prices ?? {}) as Record<string, number>;

    for (const v of variants) {
      const volRaw = (v as any)?.volumeMl ?? (v as any)?.volume;
      const vol = safeNumber(volRaw, NaN);
      if (!Number.isFinite(vol)) continue;
      if (!avail.includes(vol)) {
        avail.push(vol);
      }

      const priceRaw = (v as any)?.price;
      const priceN = safeNumber(priceRaw, NaN);
      if (Number.isFinite(priceN)) {
        prices[String(vol)] = priceN;
      }
    }

    result.available = avail;
    result.prices = prices;

    return result;
  };

  const normalizeDimensions = (rawDim: any): NormalizedProduct["dimensions"] => {
    if (!rawDim || typeof rawDim !== "object") return null;
    const w = safeNumber(rawDim.width ?? rawDim.w);
    const h = safeNumber(rawDim.height ?? rawDim.h);
    const d = safeNumber(rawDim.depth ?? rawDim.d ?? rawDim.length);
    if (!w && !h && !d) return null;
    return { width: w, height: h, depth: d };
  };

  const normalizeFragrance = (rawFrag: any): NormalizedProduct["fragranceNotes"] => {
    if (!rawFrag || typeof rawFrag !== "object") return null;
    const arr = (v: any) =>
      Array.isArray(v)
        ? v.map((x) => safeString(x)).filter(Boolean)
        : typeof v === "string"
        ? v.split(/[;,]/).map((x) => x.trim()).filter(Boolean)
        : [];
    const top = arr(rawFrag.top);
    const middle = arr(rawFrag.middle ?? rawFrag.heart);
    const base = arr(rawFrag.base);
    if (!top.length && !middle.length && !base.length) return null;
    return { top, middle, base };
  };

  const normalizeJewelryType = (raw: any): NormalizedProduct["jewelryType"] => {
    const v =
      safeString(raw?.jewelryType) ||
      safeString(raw?.subCategory) ||
      safeString(raw?.subcategory);
    if (!v) return undefined;
    const low = v.toLowerCase();
    if (low.includes("ring") || low.includes("кольц")) return "ring";
    if (low.includes("bracelet") || low.includes("брасл")) return "bracelet";
    if (low.includes("necklace") || low.includes("ожерель") || low.includes("цеп")) return "necklace";
    return v;
  };

  const id = safeNumber(raw?.id ?? raw?.productId ?? raw?.sku ?? 0);
  const name =
    safeString(raw?.name) ||
    safeString(raw?.title) ||
    safeString(raw?.label) ||
    `Товар #${id || "без названия"}`;

  const price = safeNumber(raw?.price ?? raw?.minPrice ?? raw?.amount ?? raw?.currentPrice ?? 0);
  const oldPrice =
    raw?.oldPrice != null
      ? safeNumber(raw.oldPrice)
      : raw?.originalPrice != null
      ? safeNumber(raw.originalPrice)
      : undefined;

  const category = normalizeCategory(
    raw?.categoryDbSlug ??
      raw?.category ??
      raw?.categorySlug ??
      raw?.subCategorySlug ??
      raw?.type ??
      raw?.mainCategory
  );

  const brand = pickBrand(raw?.brand, raw?.brandName, raw?.brands);
  const brandLogo =
    (typeof raw?.brandLogo === "string" && raw.brandLogo.trim()) ||
    (typeof raw?.brandLogoUrl === "string" && raw.brandLogoUrl.trim()) ||
    null;
  const brandSlug =
    (typeof raw?.brandSlug === "string" && raw.brandSlug.trim()) ||
    (typeof raw?.BrandSlug === "string" && raw.BrandSlug.trim()) ||
    null;

  const baseSizes = normalizeSizes(raw?.sizes ?? raw?.sizeOptions ?? raw?.variants);
  const sizes = buildPerfumeSizes(raw, baseSizes);

  const gender =
    safeString(raw?.gender) ||
    safeString(raw?.sex) ||
    safeString(raw?.targetGender) ||
    null;

  let createdAt: string | Date | null = null;
  if (raw?.createdAt instanceof Date) {
    createdAt = raw.createdAt;
  } else if (typeof raw?.createdAt === "string") {
    const t = Date.parse(raw.createdAt);
    createdAt = Number.isFinite(t) ? new Date(t) : raw.createdAt;
  }

  const stock =
    raw?.stock != null
      ? safeNumber(raw.stock)
      : raw?.quantity != null
      ? safeNumber(raw.quantity)
      : null;

  const dimensions = normalizeDimensions(raw?.dimensions ?? raw);
  const fragranceNotes = normalizeFragrance(raw?.fragranceNotes ?? raw?.notes);
  const jewelryType = normalizeJewelryType(raw);

  // Дополнительные описательные поля
  const material =
    safeString(raw?.material || raw?.materials) || null;

  let features: string | null = null;
  if (Array.isArray(raw?.features)) {
    const arr = raw.features.map((x: any) => safeString(x)).filter(Boolean);
    features = arr.length ? arr.join(", ") : null;
  } else {
    features = safeString(raw?.features || raw?.featureList) || null;
  }

  const styleNotes =
    safeString(raw?.styleNotes || raw?.style || raw?.designNotes) || null;

  const sillageDescription =
    safeString(raw?.sillageDescription || raw?.sillage || raw?.projection) || null;

  const metal =
    safeString(raw?.metal || raw?.metalType) || null;

  const stones =
    safeString(raw?.stones || raw?.gems || raw?.inserts) || null;

  const coating =
    safeString(raw?.coating || raw?.plating || raw?.finish) || null;

  const occasion =
    safeString(raw?.occasion || raw?.useCase || raw?.occasionType) || null;

  const outerMaterial =
    safeString(raw?.outerMaterial || raw?.outer_material || raw?.bagMaterial) || null;

  const innerMaterial =
    safeString(raw?.innerMaterial || raw?.inner_material || raw?.liningMaterial) || null;

  const bagType =
    safeString(raw?.bagType || raw?.bag_type || raw?.formFactor) || null;

  const capacityDescription =
    safeString(raw?.capacityDescription || raw?.capacity || raw?.fits) || null;

  const images = pickImages(raw);
  const imageUrl =
    (typeof raw?.imageUrl === "string" && raw.imageUrl.trim()) ||
    images[0] ||
    null;

  const description =
    safeString(raw?.description) ||
    safeString(raw?.shortDescription) ||
    safeString(raw?.subtitle) ||
    null;

  const premium = Boolean(raw?.premium ?? raw?.isPremium);
  const badge = safeString(raw?.badge) || null;

  return {
    id,
    name,
    price,
    oldPrice,
    images,
    imageUrl,
    category,
    description,
    material,
    features,
    styleNotes,
    premium,
    badge,
    brand,
    brandLogo,
    brandSlug,
    sizes,
    gender,
    createdAt,
    stock,
    dimensions,
    fragranceNotes,
    sillageDescription,
    jewelryType,
    metal,
    stones,
    coating,
    occasion,
    outerMaterial,
    innerMaterial,
    bagType,
    capacityDescription,
  };
}
