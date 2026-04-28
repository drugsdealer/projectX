import { Suspense } from "react";
import PremiumClient from "./PremiumClient";
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Premium коллекция — редкие бренды и эксклюзивы",
  description:
    "Premium коллекция Stage Store: редкая брендовая одежда, обувь, сумки и аксессуары от мировых брендов с доставкой по России.",
  alternates: {
    canonical: `${SITE_URL}/premium`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/premium`,
    title: "Premium коллекция — Stage Store",
    description:
      "Редкая брендовая одежда, обувь, сумки и аксессуары премиального сегмента.",
    images: [
      {
        url: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008429/IMG_0364_xcrp0m.jpg",
        width: 1200,
        height: 630,
        alt: "Premium коллекция Stage Store",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Premium коллекция — Stage Store",
    description: "Редкие бренды, premium-позиции и эксклюзивные товары Stage Store.",
    images: ["https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008429/IMG_0364_xcrp0m.jpg"],
  },
  robots: { index: true, follow: true },
};

const premiumJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Premium коллекция", item: `${SITE_URL}/premium` },
      ],
    },
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/premium/#page`,
      name: "Premium коллекция — Stage Store",
      url: `${SITE_URL}/premium`,
      description:
        "Премиальная коллекция брендовой одежды и аксессуаров. Эксклюзивные товары от мировых брендов с гарантией подлинности.",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "ru-RU",
    },
  ],
};

export default function PremiumPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(premiumJsonLd) }}
      />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
            Загрузка…
          </div>
        }
      >
        <PremiumClient />
      </Suspense>
    </>
  );
}
