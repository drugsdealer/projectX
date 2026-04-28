"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export type BrandItem = {
  name: string;
  slug: string;
  logoUrl: string | null;
  count: number;
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: (i % 6) * 0.05, duration: 0.35, ease: "easeOut" as const },
  }),
};

function BrandCard({ brand, index }: { brand: BrandItem; index: number }) {
  const hasProducts = brand.count > 0;

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
    >
      <Link
        href={`/brand/${brand.slug}`}
        className={`group block ${!hasProducts ? "pointer-events-none" : ""}`}
        tabIndex={hasProducts ? undefined : -1}
        aria-disabled={!hasProducts}
      >
        <div
          className={`relative aspect-square rounded-2xl border flex items-center justify-center p-5 transition-all duration-300 ${
            hasProducts
              ? "border-black/8 bg-white group-hover:border-black/20 group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
              : "border-black/6 bg-black/[0.02]"
          }`}
        >
          {brand.logoUrl ? (
            <Image
              src={brand.logoUrl}
              alt={brand.name}
              width={96}
              height={96}
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                hasProducts ? "opacity-90 group-hover:opacity-100" : "opacity-30"
              }`}
            />
          ) : (
            <span className="text-2xl font-black text-black/20">
              {brand.name.charAt(0)}
            </span>
          )}

          {!hasProducts && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/6 text-[10px] text-black/35 font-medium whitespace-nowrap">
              Скоро
            </div>
          )}
        </div>

        <div className="mt-2 px-0.5">
          <div
            className={`text-xs sm:text-sm font-semibold truncate transition-colors duration-200 ${
              hasProducts ? "text-black group-hover:text-black" : "text-black/35"
            }`}
          >
            {brand.name}
          </div>
          {hasProducts && (
            <div className="text-[11px] text-black/40 mt-0.5">
              {brand.count} {brand.count === 1 ? "товар" : brand.count < 5 ? "товара" : "товаров"}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export default function BrandsClient({ brands }: { brands: BrandItem[] }) {
  const active = brands.filter((b) => b.count > 0);
  const upcoming = brands.filter((b) => b.count === 0);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-6 sm:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-xs uppercase tracking-[0.2em] text-black/40 mb-2">Stage Store</div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">
            Бренды
          </h1>
          <p className="mt-3 text-sm sm:text-base text-black/50 max-w-md">
            {active.length} брендов в наличии · {upcoming.length} готовятся к запуску
          </p>
        </motion.div>
      </div>

      {/* Active brands */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {active.map((brand, i) => (
            <BrandCard key={brand.slug} brand={brand} index={i} />
          ))}
        </div>
      </div>

      {/* Upcoming brands */}
      {upcoming.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-16">
          <div className="mt-8 mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/6" />
            <span className="text-xs text-black/35 font-medium uppercase tracking-[0.15em]">Скоро</span>
            <div className="h-px flex-1 bg-black/6" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {upcoming.map((brand, i) => (
              <BrandCard key={brand.slug} brand={brand} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
