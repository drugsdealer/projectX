import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import BrandsClient, { type BrandItem } from "./BrandsClient";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const metadata: Metadata = {
  title: "Бренды — Stage Store",
  description:
    "Все бренды Stage Store: Supreme, Balenciaga, Yeezy, Louis Vuitton, A Bathing Ape и другие. Оригинальные товары с доставкой по России.",
  alternates: { canonical: `${SITE_URL}/brands` },
  openGraph: {
    title: "Бренды — Stage Store",
    description: "Полный список брендов Stage Store. Оригинальные товары с гарантией подлинности.",
    url: `${SITE_URL}/brands`,
    siteName: "Stage Store",
    type: "website",
  },
};

export default async function BrandsPage() {
  let brands: BrandItem[] = [];

  try {
    const rows = await prisma.brand.findMany({
      where: { deletedAt: null },
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        features: true,
        _count: { select: { Product: { where: { deletedAt: null } } } },
      },
      orderBy: { name: "asc" },
    });

    brands = rows
      .map((b) => ({
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl ?? null,
        imageUrl: b.features ?? null,
        count: b._count.Product,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"));
  } catch {
    // DB unavailable at build time — page will render on first request via ISR
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Бренды Stage Store",
    url: `${SITE_URL}/brands`,
    numberOfItems: brands.filter((b) => b.count > 0).length,
    itemListElement: brands
      .filter((b) => b.count > 0)
      .map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: b.name,
        url: `${SITE_URL}/brand/${b.slug}`,
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BrandsClient brands={brands} />
    </>
  );
}
