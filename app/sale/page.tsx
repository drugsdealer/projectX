import { Suspense } from "react";
import type { Metadata } from "next";
import SaleClient from "./SaleClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Sale — Распродажа",
  description:
    "Скидки на брендовую одежду, обувь и аксессуары. Оригинальные товары по сниженным ценам с доставкой по России.",
  alternates: { canonical: `${SITE_URL}/sale` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/sale`,
    title: "Sale — Распродажа | Stage Store",
    description: "Скидки на брендовую одежду, обувь и аксессуары. Оригинальные товары по сниженным ценам.",
    images: [
      {
        url: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008429/IMG_0364_xcrp0m.jpg",
        width: 1200,
        height: 630,
        alt: "Sale — Stage Store",
      },
    ],
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Sale", item: `${SITE_URL}/sale` },
      ],
    },
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/sale/#page`,
      name: "Sale — Распродажа Stage Store",
      url: `${SITE_URL}/sale`,
      description: "Скидки на брендовую одежду, обувь и аксессуары с гарантией подлинности.",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "ru-RU",
    },
  ],
};

export default function SalePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-sm text-black/40">
            Загрузка…
          </div>
        }
      >
        <SaleClient />
      </Suspense>
    </>
  );
}
