import { Suspense } from "react";
import type { Metadata } from "next";
import HomeClient from "./HomeClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Stage Store — Брендовая одежда и аксессуары",
  description:
    "Интернет-магазин оригинальной брендовой одежды, обуви и аксессуаров. Кроссовки, куртки, сумки, парфюм — с доставкой по Москве и России. Гарантия подлинности.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Stage Store — Брендовая одежда и аксессуары",
    description:
      "Оригинальная брендовая одежда, обувь и аксессуары. Кроссовки, куртки, сумки, парфюм. Доставка по России.",
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
  name: "Stage Store — Брендовая одежда и аксессуары",
  isPartOf: { "@id": `${SITE_URL}/#website` },
  about: { "@id": `${SITE_URL}/#organization` },
  description:
    "Интернет-магазин оригинальной брендовой одежды, обуви и аксессуаров. Кроссовки, куртки, сумки, парфюм — с доставкой по Москве и России.",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
    ],
  },
  potentialAction: [
    {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  ],
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
