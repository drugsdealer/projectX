/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Bookmark, Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type UiProduct = {
  id: number;
  name: string;
  imageUrl: string | null;
  price: number | null;
  category: string;
  brandName: string;
  color?: string;
};

const PRODUCT_SELECT = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  name: true,
  imageUrl: true,
  images: true,
  price: true,
  subcategory: true,
  Category: { select: { name: true } },
  Brand: { select: { name: true } },
  Color: { select: { name: true } },
  ProductItem: {
    select: { price: true },
    orderBy: { price: "asc" },
    take: 1,
  },
});

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

type LoadResult = {
  items: UiProduct[];
  dbError: boolean;
  brandTitle: string;
  brandSlug: string | null;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getImage(imageUrl: unknown, images: unknown): string | null {
  if (typeof imageUrl === "string" && imageUrl.trim().length > 0) {
    return imageUrl;
  }

  if (Array.isArray(images)) {
    const first = images.find((x) => typeof x === "string" && x.trim().length > 0);
    if (typeof first === "string") return first;
  }

  return null;
}

function formatRub(price: number | null): string {
  if (!price) return "Цена по запросу";
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(price))} ₽`;
}

function normalizeCategory(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "Коллекция";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

async function loadProducts(): Promise<LoadResult> {
  try {
    const margielaBrands = await prisma.brand.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            name: {
              contains: "maison margiela",
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            slug: {
              contains: "maison-margiela",
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            slug: {
              contains: "maisonmargiela",
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            name: { contains: "margiela", mode: Prisma.QueryMode.insensitive },
          },
          {
            slug: { contains: "margiela", mode: Prisma.QueryMode.insensitive },
          },
        ],
      },
      select: { id: true, name: true, slug: true },
      orderBy: { id: "asc" },
    });

    if (margielaBrands.length === 0) {
      return {
        items: [],
        dbError: false,
        brandTitle: "Maison Margiela",
        brandSlug: null,
      };
    }

    const margielaBrandIds = margielaBrands.map((b) => b.id);
    const mainBrand = margielaBrands[0];

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      brandId: { in: margielaBrandIds },
      available: true,
    };

    const rows: ProductRow[] = await prisma.product.findMany({
      where,
      select: PRODUCT_SELECT,
      orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
      take: 60,
    });

    const items: UiProduct[] = rows.map((p) => {
      const fallbackPrice = num(p.ProductItem[0]?.price);
      const price = num(p.price) ?? fallbackPrice;

      return {
        id: p.id,
        name: p.name,
        imageUrl: getImage(p.imageUrl, p.images),
        price,
        category: normalizeCategory(p.subcategory || p.Category?.name),
        brandName: p.Brand?.name || mainBrand.name || "Maison Margiela",
        color: p.Color?.name || undefined,
      };
    });

    return {
      items,
      dbError: false,
      brandTitle: mainBrand.name || "Maison Margiela",
      brandSlug: mainBrand.slug || null,
    };
  } catch (error) {
    console.error("[margiela-men-page] prisma error:", error);
    return {
      items: [],
      dbError: true,
      brandTitle: "Maison Margiela",
      brandSlug: null,
    };
  }
}

export default async function MargielaMenPage() {
  const { items, dbError, brandTitle, brandSlug } = await loadProducts();
  const showMoreHref = brandSlug ? `/brand/${brandSlug}` : "/search?q=maison+margiela";
  const grouped = items.reduce<Record<string, UiProduct[]>>((acc, item) => {
    const key = item.category || "Коллекция";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const groups = Object.entries(grouped);

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-black">
      <div className="mx-auto w-full max-w-[1700px] px-4 pb-12 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <header className="mb-8 rounded-[28px] border border-black/5 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <div className="mb-4">
                <img
                  src="/img/margiela131.png"
                  alt="Maison Martin Margiela Paris logo"
                  className="h-auto w-[100px] sm:w-120px]"
                />
              </div>
              <h1 className="font-serif text-[26px] tracking-[0.03em] sm:text-[40px]">
                {brandTitle} Men Collection
              </h1>
              <p className="mt-2 text-sm text-black/55 sm:text-base">
                Мужская линия {brandTitle}. Архитектура форм, деконструкция, силуэты.
              </p>
            </div>

            <Link
              href={showMoreHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm text-black/65 transition hover:bg-black hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Глобальный поиск
            </Link>
          </div>

          <div className="mt-4 text-xs uppercase tracking-[0.22em] text-black/45">
            {items.length} товаров
          </div>
        </header>

        {dbError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Не удалось загрузить товары сейчас. Проверь подключение к базе данных.
          </div>
        ) : null}

        {!dbError && items.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white px-5 py-7 text-black/65">
            В базе не найдено товаров бренда Maison Margiela.
          </div>
        ) : null}

        {groups.map(([categoryName, list]) => (
          <section key={categoryName} className="mb-8 rounded-[26px] border border-black/5 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-3xl font-semibold tracking-[-0.01em]">{categoryName}</h2>
              <span className="text-sm text-black/45">{list.length} шт.</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {list.map((product) => (
                <article
                  key={product.id}
                  className="group rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 hover:shadow-md hover:ring-black/10"
                >
                  <Link href={`/product/${product.id}`} className="block">
                    <div className="relative flex h-[280px] items-center justify-center bg-[#f4f4f4] px-4 py-5 sm:h-[330px]">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-black/15 bg-white font-mono text-xs uppercase tracking-[0.14em] text-black/45">
                          No Image
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="border-t border-black/10 bg-white p-4">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-wide text-black/50 leading-none">
                        {product.brandName}
                      </p>
                      <Bookmark className="h-4 w-4 text-black/50" />
                    </div>

                    <h3 className="font-semibold text-base leading-snug line-clamp-2">{product.name}</h3>

                    <p className="mt-1 text-xs text-gray-500 line-clamp-1">{categoryName}</p>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-semibold">{formatRub(product.price)}</span>
                    </div>

                    {product.color ? (
                      <p className="mt-1 text-xs text-black/45 line-clamp-1">{product.color}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
