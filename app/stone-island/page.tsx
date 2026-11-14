import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { safeJsonLd } from "@/lib/json-ld";
import { productPath } from "@/lib/product-url";
import StoneIslandClient, { type SiItem } from "./StoneIslandClient";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";
const HERO = "https://ik.imagekit.io/qowmy92ny/53faf8c56abbe89ac97550a20101dc00%20(2).jpg";
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "3XL", "4XL"];

export const metadata: Metadata = {
  title: "Stone Island — купить оригинал в Москве",
  description:
    "Оригинальные куртки, овершоты, худи и трикотаж Stone Island: Nylon Metal, окрашивание готового изделия, органический хлопок. Проверка подлинности, доставка по России, самовывоз в Москве.",
  alternates: { canonical: `${SITE_URL}/stone-island` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/stone-island`,
    title: "Stone Island — Stage Store",
    description: "Лаборатория материалов с 1982 года. Stone Island под заказ с доставкой в Москву и проверкой подлинности.",
    images: [{ url: `${SITE_URL}/ik/qowmy92ny/53faf8c56abbe89ac97550a20101dc00%20(2).jpg`, width: 1200, height: 595, alt: "Stone Island" }],
  },
  robots: { index: true, follow: true },
};

function sortSizes(sizes: string[]) {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s.toUpperCase());
    if (i >= 0) return i;
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? 100 + n : 1000;
  };
  return [...new Set(sizes)].sort((a, b) => rank(a) - rank(b));
}

async function loadItems(): Promise<SiItem[]> {
  const brand = await withDbRetry(
    () => prisma.brand.findFirst({ where: { slug: "stone-island" }, select: { id: true } }),
    { retries: 2, timeoutMs: 8000, label: "stone-island brand" }
  ).catch(() => null);
  if (!brand) return [];

  const rows = await withDbRetry(
    () =>
      prisma.product.findMany({
        where: {
          deletedAt: null,
          available: true,
          OR: [{ brandId: brand.id }, { collabBrandIds: { has: brand.id } }],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          name: true,
          price: true,
          oldPrice: true,
          imageUrl: true,
          images: true,
          material: true,
          subcategory: true,
          createdAt: true,
          ProductItem: {
            select: {
              price: true,
              sizeLabel: true,
              Size: { select: { name: true } },
              SizeCl: { select: { name: true } },
              OneSize: { select: { name: true } },
            },
          },
        },
      }),
    { retries: 2, timeoutMs: 10000, label: "stone-island products" }
  ).catch(() => []);

  return rows.map((p) => {
    const images: string[] = [];
    for (const src of [p.imageUrl, ...(p.images ?? [])]) {
      const s = typeof src === "string" ? src.trim() : "";
      if (s && !images.includes(s)) images.push(s);
    }
    const itemPrices = p.ProductItem.map((i) => i.price).filter((n) => n > 0);
    const sizes = p.ProductItem.map((i) => i.Size?.name || i.SizeCl?.name || i.OneSize?.name || i.sizeLabel || "")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      id: p.id,
      name: p.name,
      href: productPath({ id: p.id, name: p.name, brand: "Stone Island" }),
      price: itemPrices.length ? Math.min(...itemPrices) : Math.round(p.price ?? 0),
      oldPrice: p.oldPrice ? Math.round(p.oldPrice) : null,
      images: images.slice(0, 2),
      material: p.material ?? "",
      subcategory: p.subcategory ?? "",
      sizes: sortSizes(sizes),
      createdAt: p.createdAt.getTime(),
    };
  });
}

export default async function StoneIslandPage() {
  const items = await loadItems();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Stone Island — Stage Store",
    url: `${SITE_URL}/stone-island`,
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
      <StoneIslandClient items={items} hero={HERO} />
    </>
  );
}
