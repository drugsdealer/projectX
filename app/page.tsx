import { Suspense } from "react";
import type { Metadata } from "next";
import HomeClient from "./HomeClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Stage Store — брендовая одежда, обувь, Premium и Sale",
  description:
    "Stage Store — интернет-магазин оригинальной брендовой одежды, обуви, сумок, аксессуаров и парфюма. Premium коллекция, Sale и доставка по России.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Stage Store — брендовая одежда, обувь, Premium и Sale",
    description:
      "Оригинальная брендовая одежда, обувь и аксессуары. Premium коллекция, Sale, категории и доставка по России.",
    images: [
      {
        url: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008429/IMG_0364_xcrp0m.jpg",
        width: 1200,
        height: 630,
        alt: "Stage Store — Брендовая одежда и аксессуары",
      },
    ],
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_URL}/#homepage`,
  url: SITE_URL,
  name: "Stage Store — брендовая одежда, обувь, Premium и Sale",
  isPartOf: { "@id": `${SITE_URL}/#website` },
  about: { "@id": `${SITE_URL}/#organization` },
  description:
    "Интернет-магазин оригинальной брендовой одежды, обуви и аксессуаров. Premium коллекция, Sale, кроссовки, куртки, сумки и парфюм с доставкой по России.",
  hasPart: [
    { "@type": "CollectionPage", name: "Premium коллекция", url: `${SITE_URL}/premium` },
    { "@type": "CollectionPage", name: "Sale", url: `${SITE_URL}/sale` },
    { "@type": "CollectionPage", name: "Обувь", url: `${SITE_URL}/category/footwear` },
    { "@type": "CollectionPage", name: "Одежда", url: `${SITE_URL}/category/clothes` },
    { "@type": "CollectionPage", name: "Сумки", url: `${SITE_URL}/category/bags` },
    { "@type": "CollectionPage", name: "Аксессуары", url: `${SITE_URL}/category/accessories` },
    { "@type": "CollectionPage", name: "Парфюмерия", url: `${SITE_URL}/category/fragrance` },
  ],
  significantLink: [
    `${SITE_URL}/premium`,
    `${SITE_URL}/sale`,
    `${SITE_URL}/category/footwear`,
    `${SITE_URL}/category/clothes`,
    `${SITE_URL}/category/bags`,
    `${SITE_URL}/category/accessories`,
    `${SITE_URL}/category/fragrance`,
  ],
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
    ],
  },
  mainEntity: {
    "@type": "ItemList",
    name: "Главные разделы Stage Store",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Premium", url: `${SITE_URL}/premium` },
      { "@type": "ListItem", position: 2, name: "Sale", url: `${SITE_URL}/sale` },
      { "@type": "ListItem", position: 3, name: "Обувь", url: `${SITE_URL}/category/footwear` },
      { "@type": "ListItem", position: 4, name: "Одежда", url: `${SITE_URL}/category/clothes` },
      { "@type": "ListItem", position: 5, name: "Сумки", url: `${SITE_URL}/category/bags` },
      { "@type": "ListItem", position: 6, name: "Аксессуары", url: `${SITE_URL}/category/accessories` },
      { "@type": "ListItem", position: 7, name: "Парфюмерия", url: `${SITE_URL}/category/fragrance` },
    ],
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
            Загрузка…
          </div>
        }
      >
        <HomeClient />
      </Suspense>
    </>
  );
}
