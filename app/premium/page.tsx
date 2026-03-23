import { Suspense } from "react";
import PremiumClient from "./PremiumClient";
import type { Metadata } from "next";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Premium коллекция",
  description:
    "Премиальная коллекция брендовой одежды и аксессуаров в Stage Store. Эксклюзивные товары от мировых брендов.",
  robots: { index: true, follow: true },
};

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
          Загрузка…
        </div>
      }
    >
      <PremiumClient />
    </Suspense>
  );
}
