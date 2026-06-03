"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  getProfileSnapshot,
  getRepeatViewedProducts,
  type ProductSignal,
} from "@/lib/user-behavior";
import { canUseOptionalClientData } from "@/lib/privacy-consent";
import { productPath } from "@/lib/product-url";
import { getOptimizedImageUrl, shouldBypassNextImageOptimization } from "@/lib/media";

// ─── Repeat-viewed ("Снова смотришь") ─────────────────────────────────────────

export function RepeatViewedSection() {
  const [items, setItems] = useState<ProductSignal[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!canUseOptionalClientData()) return;
    setItems(getRepeatViewedProducts(6));
  }, []);

  if (!mounted || items.length < 2) return null;

  return (
    <section className="space-y-4 px-3 sm:px-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-black/40 font-semibold mb-0.5">
            Ты возвращался к этому
          </p>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Снова смотришь</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {items.map((p) => {
          const href = productPath({ id: p.productId, name: p.name, brandName: p.brandName ?? undefined });
          const optimized = p.imageUrl
            ? getOptimizedImageUrl(p.imageUrl, { width: 400, quality: 78 })
            : null;
          const bypass = p.imageUrl ? shouldBypassNextImageOptimization(p.imageUrl) : false;
          const timesViewed = p.views;

          return (
            <Link
              key={p.productId}
              href={href}
              className="group relative rounded-xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-black/15 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              {/* Eye badge */}
              {timesViewed >= 2 && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/80 px-1.5 py-0.5 backdrop-blur-sm">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span className="text-[9px] font-bold text-white leading-none">{timesViewed}</span>
                </div>
              )}

              <div className="relative aspect-square bg-white overflow-hidden">
                {optimized ? (
                  <Image
                    src={optimized}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 180px"
                    className="object-contain p-2 transition duration-400 group-hover:scale-[1.04]"
                    unoptimized={bypass}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100" />
                )}
              </div>

              <div className="p-2.5">
                {p.brandName && (
                  <p className="text-[9px] uppercase tracking-wide text-black/40 font-semibold leading-none mb-1 truncate">
                    {p.brandName}
                  </p>
                )}
                <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight">
                  {p.name}
                </p>
                {p.price != null && (
                  <p className="mt-1 text-xs font-bold text-black">
                    от {p.price.toLocaleString("ru-RU")} ₽
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── For You Feed ─────────────────────────────────────────────────────────────

interface ForYouItem {
  id: number;
  name: string;
  price: number | null;
  oldPrice: number | null;
  imageUrl: string | null;
  images: string[];
  brandName: string | null;
  brandSlug: string | null;
  brandLogo: string | null;
  categorySlug: string | null;
  premium: boolean;
  badge: string | null;
  reason: string;
}

interface ForYouFeedProps {
  limit?: number;
}

export function ForYouFeed({ limit = 12 }: ForYouFeedProps) {
  const [items, setItems] = useState<ForYouItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const load = useCallback(async () => {
    if (!canUseOptionalClientData()) { setLoading(false); return; }

    const snapshot = getProfileSnapshot();
    const hasData =
      snapshot.topBrandIds.length > 0 ||
      snapshot.topCategorySlugs.length > 0 ||
      snapshot.repeatProductIds.length > 0;

    setHasProfile(hasData);
    if (!hasData) { setLoading(false); return; }

    try {
      const res = await fetch(`/api/recommendations/for-you?limit=${limit}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch {}
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    setMounted(true);
    load();
  }, [load]);

  if (!mounted || (!loading && !hasProfile)) return null;
  if (loading) return (
    <section className="space-y-4 px-3 sm:px-0">
      <div>
        <p className="text-[11px] uppercase tracking-[0.12em] text-black/40 font-semibold mb-0.5">Персонально</p>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Для тебя</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-black/[0.04] aspect-[3/4] animate-pulse" />
        ))}
      </div>
    </section>
  );
  if (!items.length) return null;

  return (
    <section className="space-y-4 px-3 sm:px-0">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-black/40 font-semibold mb-0.5">Персонально</p>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Для тебя</h2>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs text-black/40 hover:text-black transition-colors"
        >
          Обновить
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.slice(0, limit).map((item) => {
          const href = productPath({ id: item.id, name: item.name, brandName: item.brandName ?? undefined });
          const imgSrc = item.imageUrl || item.images?.[0] || null;
          const optimized = imgSrc ? getOptimizedImageUrl(imgSrc, { width: 560, quality: 80 }) : null;
          const bypass = imgSrc ? shouldBypassNextImageOptimization(imgSrc) : false;

          return (
            <Link
              key={item.id}
              href={href}
              className="group rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 hover:ring-black/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative aspect-square bg-white overflow-hidden">
                {optimized ? (
                  <Image
                    src={optimized}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-contain p-3 transition duration-400 group-hover:scale-[1.03]"
                    unoptimized={bypass}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100" />
                )}
                {item.badge && (
                  <span className="absolute top-2 left-2 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {item.badge}
                  </span>
                )}
                {item.premium && !item.badge && (
                  <span className="absolute top-2 left-2 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Premium
                  </span>
                )}
              </div>
              <div className="p-3">
                {item.brandName && (
                  <p className="text-[10px] uppercase tracking-wide text-black/40 leading-none mb-1 truncate">
                    {item.brandName}
                  </p>
                )}
                <p className="font-semibold text-sm leading-snug line-clamp-2">{item.name}</p>
                {item.price != null && (
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    {item.oldPrice && item.oldPrice > item.price && (
                      <span className="text-[11px] text-gray-400 line-through">
                        {item.oldPrice.toLocaleString("ru-RU")} ₽
                      </span>
                    )}
                    <span className="text-sm font-semibold">
                      от {item.price.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
