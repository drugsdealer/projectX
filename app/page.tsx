import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import HomeClient from "./HomeClient";
import { safeJsonLd } from "@/lib/json-ld";

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
        url: "/img/IMG_0364.JPG",
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

function HomePresentationFallback() {
  const categories = [
    { label: "Premium", href: "/premium" },
    { label: "Sale", href: "/sale" },
    { label: "Обувь", href: "/category/footwear" },
    { label: "Одежда", href: "/category/clothes" },
    { label: "Сумки", href: "/category/bags" },
    { label: "Аксессуары", href: "/category/accessories" },
  ];

  return (
    <main className="min-h-screen bg-[#f3efe7] text-[#15130f]">
      <section className="relative isolate min-h-[92svh] overflow-hidden px-5 pt-28 pb-12 sm:px-8 lg:px-14">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.9),transparent_26%),linear-gradient(135deg,#f7f1e7_0%,#d9cbb8_44%,#0f0f0e_100%)]" />
        <div className="absolute right-[-8%] top-[10%] -z-10 h-[62vh] w-[52vw] min-w-[320px] rounded-[42px] bg-black/85 shadow-2xl rotate-3" />
        <div className="absolute right-[5%] top-[18%] -z-10 h-[52vh] w-[34vw] min-w-[240px] overflow-hidden rounded-[34px] border border-white/25 bg-[url('/img/IMG_0364.JPG')] bg-cover bg-center shadow-[0_35px_90px_rgba(0,0,0,0.35)]" />

        <div className="mx-auto flex min-h-[72svh] max-w-7xl flex-col justify-end">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.34em] text-black/55">
            Original fashion concept store
          </p>
          <h1 className="max-w-4xl text-[clamp(3.5rem,11vw,9.5rem)] font-black uppercase leading-[0.82] tracking-[-0.08em]">
            Stage
            <span className="block pl-[0.08em] italic text-black/45">Store</span>
          </h1>
          <div className="mt-8 grid max-w-5xl gap-6 md:grid-cols-[1fr_0.85fr] md:items-end">
            <p className="max-w-2xl text-base leading-7 text-black/68 sm:text-lg">
              Оригинальная одежда, обувь и аксессуары: Premium-подборки, Sale,
              редкие размеры и аккуратная проверка перед отправкой.
            </p>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/premium" className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-black">
                Смотреть Premium
              </Link>
              <Link href="/search" className="rounded-full border border-black/25 bg-white/35 px-6 py-3 text-sm font-semibold text-black backdrop-blur transition hover:border-black">
                В каталог
              </Link>
            </div>
          </div>

          <nav className="mt-10 flex flex-wrap gap-2" aria-label="Главные разделы">
            {categories.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-black/15 bg-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black/70 backdrop-blur transition hover:border-black hover:text-black"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(homeJsonLd) }}
      />
      <Suspense
        fallback={<HomePresentationFallback />}
      >
        <HomeClient />
      </Suspense>
    </>
  );
}
