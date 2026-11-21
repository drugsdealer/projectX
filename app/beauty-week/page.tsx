import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { safeJsonLd } from "@/lib/json-ld";
import { productPath } from "@/lib/product-url";
import { BEAUTY_PROMO, beautyBrandOf, formatRub } from "@/lib/promo-beauty";
import BeautyWeekClient, { type BeautyItem } from "./BeautyWeekClient";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";
const URL_PATH = BEAUTY_PROMO.path;

// Картинка превью — JPG 1200×630: Telegram, VK и WhatsApp не показывают WebP в превью ссылок
// и подставляют общую картинку сайта.
const OG_IMAGE = `${SITE_URL}/promo/beauty-week/og.jpg`;
const OG_TITLE = `${BEAUTY_PROMO.title} Dior & Gucci — косметичка в подарок`;
const OG_DESCRIPTION = `Косметика и парфюм Dior и Gucci. Заказ от ${formatRub(
  BEAUTY_PROMO.threshold
)} — фирменная косметичка на выбор в подарок. Оригинал, доставка по России.`;

export const metadata: Metadata = {
  title: `${BEAUTY_PROMO.title} Dior & Gucci: косметичка в подарок к заказу от ${formatRub(BEAUTY_PROMO.threshold)}`,
  description: OG_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${URL_PATH}` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}${URL_PATH}`,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Бьюти-неделя Dior & Gucci — косметичка в подарок", type: "image/jpeg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

function prettySub(slug?: string | null) {
  const s = String(slug ?? "").replace(/[-_]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

async function loadItems(): Promise<BeautyItem[]> {
  const rows = await withDbRetry(
    () =>
      prisma.product.findMany({
        where: {
          deletedAt: null,
          available: true,
          Category: { slug: { in: [...BEAUTY_PROMO.categorySlugs] } },
          Brand: { OR: BEAUTY_PROMO.brands.map((b) => ({ name: { contains: b.name, mode: "insensitive" as const } })) },
        },
        orderBy: [{ popularity: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          name: true,
          price: true,
          oldPrice: true,
          imageUrl: true,
          images: true,
          subcategory: true,
          Brand: { select: { name: true } },
          Category: { select: { slug: true } },
          ProductItem: { select: { price: true } },
        },
      }),
    { retries: 2, timeoutMs: 10000, label: "beauty-week products" }
  ).catch(() => []);

  const out: BeautyItem[] = [];
  for (const p of rows) {
    const brand = beautyBrandOf(p.Brand?.name);
    if (!brand) continue;
    const itemPrices = p.ProductItem.map((i) => i.price).filter((n) => n > 0);
    const price = itemPrices.length ? Math.min(...itemPrices) : Math.round(p.price ?? 0);
    const image = p.imageUrl || p.images?.find(Boolean) || null;
    out.push({
      id: p.id,
      name: p.name,
      brandKey: brand.key,
      brandName: p.Brand?.name ?? brand.name,
      category: p.Category?.slug ?? "",
      sub: prettySub(p.subcategory),
      price,
      oldPrice: p.oldPrice && p.oldPrice > price ? Math.round(p.oldPrice) : null,
      image,
      href: productPath({ id: p.id, name: p.name, brand: p.Brand?.name ?? brand.name }),
    });
  }
  return out;
}

export default async function BeautyWeekPage() {
  const items = await loadItems();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${BEAUTY_PROMO.title} — Stage Store`,
    url: `${SITE_URL}${URL_PATH}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}${it.href}`,
        name: it.name,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <BeautyWeekClient items={items} />
    </>
  );
}
