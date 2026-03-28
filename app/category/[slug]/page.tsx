import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import prisma from '@/lib/prisma';
import CategoryProductGrid from './CategoryProductGrid';

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    select: { slug: true },
    take: 100,
  });
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug).trim();
  const category = await prisma.category.findFirst({
    where: { slug: { equals: decoded, mode: 'insensitive' } },
    select: { name: true },
  });
  const name = category?.name || decoded.replace(/[-_]+/g, ' ');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stagestore.app';
  return {
    title: name,
    description: `${name} — купить в Stage Store. Оригинальная брендовая одежда и аксессуары с доставкой по России.`,
    openGraph: {
      title: `${name} — Stage Store`,
      description: `Каталог ${name.toLowerCase()} в интернет-магазине Stage Store.`,
      url: `${siteUrl}/category/${slug}`,
    },
    alternates: {
      canonical: `${siteUrl}/category/${slug}`,
    },
  };
}

export const revalidate = 120; // revalidate every 2 minutes

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

  // Build all possible synonyms for the slug so we match both singular/plural
  // e.g. "tshirts" also matches "tshirt", "tee", "tees", "t-shirt"
  const SUBCATEGORY_SYNONYMS: Record<string, string[]> = {
    sneakers: ['sneaker', 'sneakers'],
    boots: ['boot', 'boots'],
    loafers: ['loafer', 'loafers'],
    sandals: ['sandal', 'sandals'],
    hoodies: ['hoodie', 'hoodies'],
    sweaters: ['sweater', 'sweaters'],
    sweatshirts: ['sweatshirt', 'sweatshirts'],
    jackets: ['jacket', 'jackets'],
    coats: ['coat', 'coats'],
    shirts: ['shirt', 'shirts'],
    suits: ['suit', 'suits'],
    vests: ['vest', 'vests'],
    dresses: ['dress', 'dresses'],
    skirts: ['skirt', 'skirts'],
    shorts: ['short', 'shorts'],
    jeans: ['jean', 'jeans'],
    cardigans: ['cardigan', 'cardigans'],
    tshirts: ['tshirt', 'tshirts', 'tee', 'tees', 't-shirt'],
    tops: ['top', 'tops'],
    pants: ['pant', 'pants', 'sweatpants', 'trackpants'],
    trousers: ['trouser', 'trousers'],
    bags: ['bag', 'bags'],
    backpacks: ['backpack', 'backpacks'],
    totes: ['tote', 'totes'],
    waistbags: ['waistbag', 'waistbags'],
    travelbags: ['travelbag', 'travelbags'],
    cardholders: ['cardholder', 'cardholders'],
    wallets: ['wallet', 'wallets'],
    belts: ['belt', 'belts'],
    caps: ['cap', 'caps'],
    beanies: ['beanie', 'beanies'],
    hats: ['hat', 'hats'],
    gloves: ['glove', 'gloves'],
    socks: ['sock', 'socks'],
    scarves: ['scarf', 'scarves'],
    rings: ['ring', 'rings'],
    earrings: ['earring', 'earrings'],
    bracelets: ['bracelet', 'bracelets'],
    keychains: ['keychain', 'keychains'],
    watches: ['watch', 'watches'],
    fragrances: ['fragrance', 'fragrances', 'perfume'],
    glasses: ['glass', 'glasses'],
    tracksuits: ['tracksuit', 'tracksuits'],
    polo: ['polo'],
  };

  const slugLow = slug.toLowerCase();
  const labelLow = label.toLowerCase();
  const synonyms = SUBCATEGORY_SYNONYMS[slugLow] || SUBCATEGORY_SYNONYMS[labelLow] || [];
  const subcatVariants = Array.from(new Set([label, slug, ...synonyms]));

  // Same INFER_RULES as in search and products routes — single source of truth
  const INFER_RULES: Array<{ slug: string; rx: RegExp }> = [
    { slug: 'sneakers',    rx: /(кроссов|sneak|yeezy|dunk|air\s*force|jordan)/i },
    { slug: 'boots',       rx: /(ботинк|сапог|челси|chelsea|boot)/i },
    { slug: 'loafers',     rx: /(лофер|loafer|мокасин)/i },
    { slug: 'sandals',     rx: /(сандал|сланц|шлеп|sandal)/i },
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
    { slug: 'bags',        rx: /(сумк|сумоч|bag(?!.*back)|тоут|tote|клатч|clutch|шопер|shopper)/i },
    { slug: 'backpacks',   rx: /(рюкзак|backpack)/i },
    { slug: 'waistbags',   rx: /(поясн.*сумк|waist\s*bag|belt\s*bag|бананк)/i },
    { slug: 'cardholders', rx: /(кардхолдер|card\s*holder|визитниц)/i },
    { slug: 'wallets',     rx: /(кошел[её]к|бумажник|wallet)/i },
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
    { slug: 'caps',        rx: /(кепк|бейсболк|cap\b)/i },
    { slug: 'beanies',     rx: /(шапк|beanie)/i },
    { slug: 'hats',        rx: /(панам|шляп|hat\b|bucket)/i },
    { slug: 'fragrances',  rx: /(парфюм|духи|туалетн.*вод|eau\s*de|edp|edt|perfume|fragrance|аромат)/i },
  ];

  const inferSub = (name: string, description: string | null): string | null => {
    const text = [name, description].filter(Boolean).join(' ');
    for (const rule of INFER_RULES) {
      if (rule.rx.test(text)) return rule.slug;
    }
    return null;
  };

  // Load all products, then filter using the same regex inference as search facets
  const allProducts = await (prisma as any).product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      price: true,
      oldPrice: true,
      imageUrl: true,
      images: true,
      description: true,
      available: true,
      premium: true,
      badge: true,
      categoryId: true,
      brandId: true,
      createdAt: true,
      subcategory: true,
      ProductItem: { select: { price: true } },
      PerfumeVariant: { select: { price: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter: product belongs to this category if its inferred/DB subcategory matches the slug
  const products = (allProducts as any[]).filter((p) => {
    const dbSub = (p.subcategory ?? '').trim().toLowerCase();
    const inferred = inferSub(p.name ?? '', p.description ?? null);
    const effectiveSub = dbSub || inferred;
    return effectiveSub === slugLow;
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stagestore.app';

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
          { "@type": "ListItem", position: 2, name: displayLabel, item: `${siteUrl}/category/${slug}` },
        ],
      },
      {
        "@type": "CollectionPage",
        name: displayLabel,
        url: `${siteUrl}/category/${slug}`,
        description: `${displayLabel} — купить в Stage Store. Оригинальная брендовая одежда и аксессуары.`,
        isPartOf: { "@id": `${siteUrl}/#website` },
        numberOfItems: products.length,
      },
    ],
  };

  return (
    <main className="bg-white text-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
