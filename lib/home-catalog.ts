// lib/home-catalog.ts — облегчённый каталог для главной.
//
// Раньше главная после загрузки качала из браузера весь каталог (/api/products, ~850 КБ:
// полные описания, все фото, цены всех размеров) и только потом показывала подборки.
// Теперь сервер кладёт облегчённый список прямо в страницу (ISR раз в минуту):
// первая фраза описания, до 3 фото, без размеров — карточкам главной больше не нужно.
// Тот же список отдаёт /api/products?lite=1 (запасной путь, если сервер не успел).

import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { resolveProductTaxonomy } from "@/lib/catalog-taxonomy";

export type HomeCatalogItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  categoryId: number | null;
  categoryDbSlug: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  createdAt: string;
  popularity: number;
  modelKey: string | null;
  images: string[];
  imageUrl: string;
  subCategorySlug: string | null;
  subcategory: string | null;
  premium: boolean;
  brandId: number | null;
  brandName: string | null;
  brandSlug: string | null;
  gender: string | null;
  badge: string | null;
  article: string | null;
};

// Первая фраза описания — её и показывает карточка на главной.
function firstSentence(text: string | null | undefined, max = 160) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const s = m ? m[1] : t;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export async function getHomeCatalog(take = 1000): Promise<HomeCatalogItem[]> {
  const rows = await withDbRetry(
    () =>
      prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          oldPrice: true,
          categoryId: true,
          createdAt: true,
          popularity: true,
          modelKey: true,
          imageUrl: true,
          images: true,
          subcategory: true,
          premium: true,
          brandId: true,
          gender: true,
          badge: true,
          article: true,
          Category: { select: { id: true, name: true, slug: true } },
          Brand: { select: { id: true, name: true, slug: true } },
        },
      }),
    { retries: 2, timeoutMs: 10000, label: "home catalog" }
  );

  return rows.map((p) => {
    const base = Array.isArray(p.images) ? p.images : [];
    const primary = p.imageUrl || base[0] || null;
    const images = Array.from(new Set([primary, ...base].filter(Boolean) as string[])).slice(0, 3);
    const dbCategorySlug = p.Category?.slug ?? null;
    const taxonomy = resolveProductTaxonomy({ ...(p as any), categorySlug: dbCategorySlug });
    const sub = taxonomy.subcategorySlug ? taxonomy.subcategorySlug.toLowerCase() : null;
    return {
      id: p.id,
      name: p.name,
      description: firstSentence(p.description),
      price: Number(p.price ?? 0),
      oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
      categoryId: p.categoryId ?? p.Category?.id ?? null,
      categoryDbSlug: dbCategorySlug,
      categorySlug: taxonomy.categorySlug ? taxonomy.categorySlug.toLowerCase() : null,
      categoryName: p.Category?.name ?? null,
      createdAt: p.createdAt.toISOString(),
      popularity: Number(p.popularity ?? 0),
      modelKey: p.modelKey ?? null,
      images: images.length ? images : ["/img/placeholder.svg"],
      imageUrl: images[0] ?? "/img/placeholder.svg",
      subCategorySlug: sub,
      subcategory: sub,
      premium: Boolean(p.premium),
      brandId: p.brandId ?? p.Brand?.id ?? null,
      brandName: p.Brand?.name ?? null,
      brandSlug: p.Brand?.slug ?? null,
      gender: p.gender ?? null,
      badge: p.badge ?? null,
      article: p.article ?? null,
    };
  });
}
