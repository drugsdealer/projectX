"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { shouldBypassNextImageOptimization, getOptimizedImageUrl } from "@/lib/media";

export type BrandItem = {
  name: string;
  slug: string;
  logoUrl: string | null;
  imageUrl?: string | null;
  count: number;
};

const LETTERS = ["All", "0-9", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

function firstBucket(name: string) {
  const first = name.trim().charAt(0).toUpperCase();
  if (!first) return "#";
  if (/\d/.test(first)) return "0-9";
  if (/[A-Z]/.test(first)) return first;
  return "#";
}

function brandFallback(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function BrandsClient({ brands }: { brands: BrandItem[] }) {
  const activeBrands = useMemo(() => brands.filter((brand) => brand.count > 0), [brands]);
  const [letter, setLetter] = useState("All");
  const [activeSlug, setActiveSlug] = useState<string | null>(activeBrands[0]?.slug ?? null);

  const filtered = useMemo(() => {
    if (letter === "All") return activeBrands;
    return activeBrands.filter((brand) => firstBucket(brand.name) === letter);
  }, [activeBrands, letter]);

  const activeBrand =
    activeBrands.find((brand) => brand.slug === activeSlug) ||
    filtered[0] ||
    activeBrands[0] ||
    null;

  const previewImage = activeBrand?.imageUrl || activeBrand?.logoUrl || null;

  return (
    <div className="h-[calc(100svh-var(--header-h,80px))] overflow-hidden bg-[#f4f4f2] text-black">
      <div className="flex h-full min-h-0 flex-col px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mb-5 shrink-0 flex items-end justify-between gap-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-black/35">Stage Store</div>
            <h1 className="mt-2 text-5xl font-black uppercase tracking-[-0.04em] sm:text-7xl lg:text-8xl">
              Бренды
            </h1>
          </div>
        </div>

        <div className="z-20 -mx-4 shrink-0 border-y border-black/10 bg-[#f4f4f2]/92 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex gap-5 overflow-x-auto text-sm font-bold text-black/35 [scrollbar-width:none]">
            {LETTERS.map((item) => {
              const disabled =
                item !== "All" && !activeBrands.some((brand) => firstBucket(brand.name) === item);
              const selected = letter === item;
              return (
                <button
                  key={item}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setLetter(item);
                    const next = item === "All" ? activeBrands[0] : activeBrands.find((brand) => firstBucket(brand.name) === item);
                    setActiveSlug(next?.slug ?? null);
                  }}
                  className={`shrink-0 transition ${
                    selected ? "text-black" : disabled ? "cursor-not-allowed text-black/18" : "hover:text-black"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <div className="-mx-4 grid min-h-0 flex-1 bg-white sm:-mx-6 lg:-mx-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="min-h-0 divide-y divide-black/10 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filtered.length > 0 ? (
              filtered.map((brand, index) => (
                <motion.div
                  key={brand.slug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.025, 0.25), duration: 0.28 }}
                >
                  <Link
                    href={`/brand/${brand.slug}`}
                    onMouseEnter={() => setActiveSlug(brand.slug)}
                    onFocus={() => setActiveSlug(brand.slug)}
                    className={`group grid min-h-[92px] grid-cols-[1fr_auto] items-center gap-4 px-5 py-5 transition sm:min-h-[118px] sm:px-7 ${
                      activeBrand?.slug === brand.slug ? "bg-black text-white" : "hover:bg-black hover:text-white"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
                        {brand.name}
                      </div>
                      <div className={`mt-2 text-xs font-bold uppercase tracking-[0.16em] ${
                        activeBrand?.slug === brand.slug ? "text-white/45" : "text-black/35 group-hover:text-white/45"
                      }`}>
                        {brand.count} {brand.count === 1 ? "товар" : brand.count < 5 ? "товара" : "товаров"}
                      </div>
                    </div>
                    <div className={`grid h-14 w-14 place-items-center rounded-2xl border p-2 transition sm:h-16 sm:w-16 ${
                      activeBrand?.slug === brand.slug ? "border-white/15 bg-white/10" : "border-black/10 bg-white group-hover:border-white/15 group-hover:bg-white/10"
                    }`}>
                      {brand.logoUrl ? (
                        <Image
                          src={getOptimizedImageUrl(brand.logoUrl, { width: 200 }) || brand.logoUrl}
                          alt={brand.name}
                          width={64}
                          height={64}
                          unoptimized={shouldBypassNextImageOptimization(brand.logoUrl)}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-sm font-black">{brandFallback(brand.name)}</span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))
            ) : (
              <div className="px-7 py-12 text-sm font-semibold text-black/45">В этой букве пока нет брендов.</div>
            )}
          </div>

          <div className="relative hidden h-full min-h-0 overflow-hidden bg-[#e8e8e4] lg:block">
            {previewImage ? (
              <Image
                key={previewImage}
                src={getOptimizedImageUrl(previewImage, { width: 640 }) || previewImage}
                alt={activeBrand?.name || "Brand preview"}
                fill
                priority
                unoptimized={shouldBypassNextImageOptimization(previewImage)}
                className="object-cover"
                sizes="50vw"
              />
            ) : (
              <div className="grid h-full place-items-center text-8xl font-black text-black/10">
                {activeBrand ? brandFallback(activeBrand.name) : "ST"}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
