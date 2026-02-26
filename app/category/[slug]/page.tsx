

import Link from 'next/link';
import { notFound } from 'next/navigation';

import prisma from '@/lib/prisma';
import CategoryProductGrid from './CategoryProductGrid';

export const dynamic = 'force-dynamic';

function capitalizeFirst(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function humanizeSlug(slug: string) {
  const s = decodeURIComponent(slug || '').trim();
  // support both `sneakers` and `rare-sneakers`
  return s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function prettyCategoryTitle(raw: string) {
  const base = humanizeSlug(raw);
  const key = base.toLowerCase();
  const dict: Record<string, string> = {
    обувь: 'Обувь',
    одежда: 'Одежда',
    сумки: 'Сумки',
    аксессуары: 'Аксессуары',
    парфюм: 'Парфюм',
    парфюмерия: 'Парфюмерия',
    'головные уборы': 'Головные уборы',

    sneakers: 'Кроссовки',
    sneaker: 'Кроссовки',
    boots: 'Ботинки',
    boot: 'Ботинки',
    loafers: 'Лоферы',
    sandals: 'Сандалии',
    sandal: 'Сандалии',
    hoodie: 'Худи',
    hoodies: 'Худи',
    sweatshirt: 'Свитшот',
    sweatshirts: 'Свитшоты',
    sweater: 'Свитер',
    sweaters: 'Свитеры',
    knit: 'Трикотаж',
    denim: 'Деним',
    outerwear: 'Верхняя одежда',
    jacket: 'Куртка',
    jackets: 'Куртки',
    coat: 'Пальто',
    coats: 'Пальто',
    shirt: 'Рубашка',
    shirts: 'Рубашки',
    tshirt: 'Футболка',
    tshirts: 'Футболки',
    tee: 'Футболка',
    tees: 'Футболки',
    't shirt': 'Футболка',
    pants: 'Штаны',
    trousers: 'Брюки',
    shorts: 'Шорты',
    jeans: 'Джинсы',
    dress: 'Платье',
    dresses: 'Платья',
    skirt: 'Юбка',
    skirts: 'Юбки',

    bag: 'Сумка',
    bags: 'Сумки',
    backpack: 'Рюкзак',
    backpacks: 'Рюкзаки',
    tote: 'Тоут',
    totes: 'Тоуты',
    'cross body': 'Кросс-боди',
    'cross-body': 'Кросс-боди',
    travelbag: 'Дорожная сумка',
    travelbags: 'Дорожные сумки',

    fragrance: 'Парфюм',
    fragrances: 'Парфюм',
    perfume: 'Парфюм',

    jewelry: 'Украшения',
    jewellery: 'Украшения',
    glasses: 'Очки',
    belt: 'Ремень',
    belts: 'Ремни',
    cap: 'Кепка',
    caps: 'Кепки',
    beanie: 'Шапка',
    beanies: 'Шапки',
    hat: 'Головной убор',
    hats: 'Головные уборы',
  };
  if (dict[key]) return dict[key];
  return capitalizeFirst(base);
}

function pickMainImage(p: any): string | null {
  if (typeof p?.imageUrl === 'string' && p.imageUrl.length > 0) return p.imageUrl;
  if (Array.isArray(p?.images) && p.images.length > 0 && typeof p.images[0] === 'string') return p.images[0];
  return null;
}

function getMinPrice(p: any): number | null {
  const nums: number[] = [];
  const push = (v: any) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) nums.push(n);
  };

  push(p?.minPrice);
  push(p?.price);

  if (Array.isArray(p?.ProductItem)) {
    for (const item of p.ProductItem) push(item?.price);
  }

  if (Array.isArray(p?.PerfumeVariant)) {
    for (const item of p.PerfumeVariant) push(item?.price);
  }

  if (!nums.length) return null;
  return Math.min(...nums);
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolved = await params;
  const slug = resolved?.slug ?? '';
  const label = humanizeSlug(slug);
  const displayLabel = prettyCategoryTitle(label);

  // MVP: treat [slug] as subcategory (we already have `subcategory` in DB and in /api/search)
  // Using `as any` keeps this file resilient even if your Prisma model evolves.
  const where: any = {
    deletedAt: null,
    OR: [
      { subcategory: { equals: label, mode: 'insensitive' } },
      { subcategory: { equals: slug, mode: 'insensitive' } },
      { Category: { is: { name: { equals: label, mode: 'insensitive' } } } },
      { Category: { is: { slug: { equals: label, mode: 'insensitive' } } } },
      { Category: { is: { name: { equals: slug, mode: 'insensitive' } } } },
      { Category: { is: { slug: { equals: slug, mode: 'insensitive' } } } },
    ],
  };

  // If your schema has an `isPremium` or `premium` flag, we can enforce non-premium here.
  // (kept optional to avoid TS errors when the field doesn't exist)
  // where.isPremium = false;

  const products = await (prisma as any).product.findMany({
    where,
    include: {
      ProductItem: { select: { price: true } },
      PerfumeVariant: { select: { price: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  if (!products || products.length === 0) {
    notFound();
  }

  const cards = products.map((p: any) => {
    const imageUrl = pickMainImage(p);
    const images = [imageUrl, ...(Array.isArray(p.images) ? p.images : [])].filter(
      (x): x is string => typeof x === 'string' && x.length > 0
    );
    const uniq: string[] = [];
    for (const src of images) if (!uniq.includes(src)) uniq.push(src);

    return {
      id: String(p.id),
      name: p.name ?? '',
      price: p.price ?? null,
      minPrice: getMinPrice(p),
      images: uniq,
    };
  });

  return (
    <main className="bg-white text-black">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-10">
        <section className="relative overflow-hidden rounded-[32px] border border-black/10 bg-white/80 p-6 sm:p-8 shadow-[0_30px_80px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-r from-[#ff6b2c]/10 via-transparent to-[#ffd66d]/25" />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                Категория
              </div>
              <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">{displayLabel}</h1>
              <div className="mt-2 text-sm text-black/60">{products.length} товаров</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black/70">
                  Свежие поступления
                </span>
                <span className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black/70">
                  Подборка недели
                </span>
              </div>
            </div>

            <Link
              href="/search"
              className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-sm font-semibold text-white shadow-[0_15px_35px_rgba(0,0,0,0.18)] hover:opacity-90 transition"
            >
              ← К поиску
            </Link>
          </div>
        </section>

        <CategoryProductGrid products={cards} />
      </div>
    </main>
  );
}
