import { Suspense } from "react";
import SearchClient from "./SearchClient";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Поиск",
  description:
    "Поиск брендовой одежды, обуви и аксессуаров в Stage Store. Найдите то, что ищете.",
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
