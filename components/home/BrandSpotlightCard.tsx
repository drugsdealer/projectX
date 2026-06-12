"use client";

/**
 * Brand Spotlight insert (ТЗ priority #1).
 *
 * An inline brand card that drops into the homepage product flow. It reads the
 * user's strongest brand affinities from the local behavioral profile, asks the
 * server for that brand's identity + top products, and renders:
 *   logo + tagline + 3-4 top products + CTA to the brand page.
 *
 * If the user has 2-3 strong brand affinities, the server returns several
 * spotlights and this component rotates between them (auto every ~8s and on the
 * "Другой бренд" control), so the homepage feels alive across visits.
 *
 * Self-contained (own data fetch) so HomeClient integration is a single line.
 * Renders nothing on cold start / no consent — never an empty shell.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { getTopBrands } from "@/lib/user-behavior";
import { canUseOptionalClientData } from "@/lib/privacy-consent";
import { productPath } from "@/lib/product-url";
import { getOptimizedImageUrl, shouldBypassNextImageOptimization } from "@/lib/media";

interface SpotlightProduct {
  id: number;
  name: string;
  price: number | null;
  oldPrice: number | null;
  imageUrl: string | null;
  premium: boolean;
  badge: string | null;
}

interface Spotlight {
  brand: {
    id: number;
    name: string;
    slug: string;
    logoUrl: string | null;
    tagline: string;
    premium: boolean;
  };
  products: SpotlightProduct[];
}

const ROTATE_INTERVAL_MS = 8000;

export default function BrandSpotlightCard() {
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);

  const load = useCallback(async () => {
    if (!canUseOptionalClientData()) return;

    const topBrandIds = getTopBrands(8).map((b) => b.brandId);

    try {
      const res = await fetch("/api/recommendations/brand-spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topBrandIds }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const list: Spotlight[] = Array.isArray(data.spotlights) ? data.spotlights : [];
        setSpotlights(list);
        setActive(0);
      }
    } catch {
      // network/recs down — stay hidden, homepage degrades gracefully
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    load();
  }, [load]);

  // Auto-rotate between the user's strong brands.
  useEffect(() => {
    if (spotlights.length < 2) return;
    const t = setInterval(() => {
      setActive((i) => (i + 1) % spotlights.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [spotlights.length]);

  if (!mounted || spotlights.length === 0) return null;

  const spot = spotlights[active] ?? spotlights[0];
  const { brand, products } = spot;
  const brandHref = `/brand/${brand.slug}`;
  const logoOptimized = brand.logoUrl
    ? getOptimizedImageUrl(brand.logoUrl, { width: 240, quality: 82 })
    : null;
  const logoBypass = brand.logoUrl ? shouldBypassNextImageOptimization(brand.logoUrl) : false;

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-black/10 bg-gradient-to-br from-[#0b0b0d] via-[#16161a] to-[#0b0b0d] text-white shadow-[0_18px_44px_rgba(0,0,0,0.22)]">
      {/* subtle texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

      <div className="relative grid gap-5 p-4 sm:p-6 lg:grid-cols-[280px_1fr]">
        {/* ── Brand identity ── */}
        <div className="flex flex-col justify-between rounded-3xl border border-white/12 bg-white/[0.04] p-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/75">
              {brand.premium ? "Premium бренд" : "Любимый бренд"}
            </div>

            <div className="mt-4 flex items-center gap-3">
              {logoOptimized ? (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/90 ring-1 ring-white/20">
                  <Image
                    src={logoOptimized}
                    alt={brand.name}
                    fill
                    sizes="48px"
                    className="object-contain p-1.5"
                    unoptimized={logoBypass}
                  />
                </div>
              ) : null}
              <h3 className="text-2xl font-black leading-none tracking-tight">{brand.name}</h3>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-white/70">{brand.tagline}</p>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Link
              href={brandHref}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-white/85"
            >
              В бренд
              <span aria-hidden>→</span>
            </Link>

            {spotlights.length > 1 && (
              <button
                type="button"
                onClick={() => setActive((i) => (i + 1) % spotlights.length)}
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50 transition hover:text-white/90"
              >
                Другой бренд
              </button>
            )}
          </div>

          {spotlights.length > 1 && (
            <div className="mt-4 flex gap-1.5">
              {spotlights.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === active ? "w-6 bg-white" : "w-2 bg-white/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Product strip ── */}
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {products.map((p) => {
            const href = productPath({ id: p.id, name: p.name, brandName: brand.name });
            const optimized = p.imageUrl
              ? getOptimizedImageUrl(p.imageUrl, { width: 420, quality: 80 })
              : null;
            const bypass = p.imageUrl ? shouldBypassNextImageOptimization(p.imageUrl) : false;

            return (
              <Link
                key={p.id}
                href={href}
                className="group relative w-[160px] shrink-0 overflow-hidden rounded-2xl bg-white text-black ring-1 ring-white/10 transition hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(0,0,0,0.3)] sm:w-[182px]"
              >
                <div className="relative aspect-[4/5] bg-white">
                  {optimized ? (
                    <Image
                      src={optimized}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 182px"
                      className="object-contain p-2.5 transition duration-300 group-hover:scale-[1.03]"
                      unoptimized={bypass}
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-100" />
                  )}
                  {(p.badge || p.premium) && (
                    <span className="absolute left-2 top-2 rounded-full bg-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      {p.badge || "Premium"}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-semibold leading-snug text-black/90">{p.name}</p>
                  {p.price != null && (
                    <div className="mt-1 flex items-baseline gap-1.5">
                      {p.oldPrice && p.oldPrice > p.price && (
                        <span className="text-[10px] text-gray-400 line-through">
                          {p.oldPrice.toLocaleString("ru-RU")} ₽
                        </span>
                      )}
                      <span className="text-xs font-extrabold text-black">
                        от {p.price.toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
