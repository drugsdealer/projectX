import { Suspense } from "react";
import SearchClient from "./SearchClient";
import type { Metadata } from "next";

export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const metadata: Metadata = {
  title: "Каталог — Весь ассортимент",
  description:
    "Полный каталог брендовой одежды, обуви и аксессуаров в Stage Store. Кроссовки, куртки, сумки, парфюм от мировых брендов. Доставка по России.",
  alternates: {
    canonical: `${SITE_URL}/search`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/search`,
    title: "Каталог — Stage Store",
    description: "Полный каталог брендовой одежды, обуви и аксессуаров.",
  },
  robots: { index: true, follow: true },
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
          Загрузка…
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  );
}
