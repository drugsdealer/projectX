"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useUser } from "@/user/UserContext";
import { shouldBypassNextImageOptimization } from "@/lib/media";

type SaleProduct = {
  id: string | number;
  name: string;
  price: number;
  oldPrice: number | null;
  badge: string | null;
  imageUrl: string | null;
  images: string[];
  brandName: string | null;
  category: string | null;
  gender: string | null;
  available: boolean;
};

type GenderKey = '' | 'men' | 'women';
const GENDER_OPTIONS: { value: GenderKey; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'men', label: 'Мужское' },
  { value: 'women', label: 'Женское' },
];

type SortKey = "discount" | "price_asc" | "price_desc" | "newest";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "discount", label: "Скидка ↓" },
  { key: "price_asc", label: "Дешевле" },
  { key: "price_desc", label: "Дороже" },
  { key: "newest", label: "Новинки" },
];

function discountPct(price: number, oldPrice: number | null): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

function getImage(p: SaleProduct): string | null {
  if (p.imageUrl) return p.imageUrl;
  if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
  return null;
}

// ── Card ──────────────────────────────────────────────────────────────────────
function SaleCard({ product }: { product: SaleProduct }) {
  const pct = discountPct(product.price, product.oldPrice);
  const img = getImage(product);
  const href = `/product/${product.id}`;

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/[0.04]">
        {img ? (
          <Image
            src={img}
            alt={product.name}
            fill
            unoptimized={shouldBypassNextImageOptimization(img)}
            sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-black/20 text-xs">
            нет фото
          </div>
        )}

        {/* Discount badge */}
        {pct > 0 && (
          <div className="absolute top-2.5 left-2.5 rounded-full bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 leading-tight">
            -{pct}%
          </div>
        )}

        {/* Sale badge (without oldPrice) */}
        {pct === 0 && product.badge?.toLowerCase() === "sale" && (
          <div className="absolute top-2.5 left-2.5 rounded-full bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 leading-tight">
            SALE
          </div>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        {product.brandName && (
          <div className="text-[11px] text-black/40 uppercase tracking-wider font-medium truncate">
            {product.brandName}
          </div>
        )}
        <div className="text-sm font-medium line-clamp-2 mt-0.5 leading-snug">
          {product.name}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-base font-bold">
            {product.price.toLocaleString("ru-RU")} ₽
          </span>
          {product.oldPrice != null && product.oldPrice > product.price && (
            <span className="text-sm text-black/35 line-through">
              {product.oldPrice.toLocaleString("ru-RU")} ₽
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SaleClient() {
  const router = useRouter();
  const { user } = useUser();
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeGender, setActiveGender] = useState<GenderKey>('');
  const [sort, setSort] = useState<SortKey>("discount");

  // apply profile gender as default
  useEffect(() => {
    if (activeGender) return; // user already chose manually
    if (user?.gender === 'male') setActiveGender('men');
    else if (user?.gender === 'female') setActiveGender('women');
  }, [user?.gender]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/products?sale=1&includePremium=1&take=200");
        if (!res.ok) return;
        const data = await res.json();
        const raw: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data.products)
          ? data.products
          : Array.isArray(data.items)
          ? data.items
          : [];

        const mapped: SaleProduct[] = raw.map((p) => ({
          id: p.id,
          name: p.name ?? "",
          price: Number(p.price ?? 0),
          oldPrice: p.oldPrice != null ? Number(p.oldPrice) : null,
          badge: p.badge ?? null,
          imageUrl: p.imageUrl ?? p.primaryImage ?? null,
          images: Array.isArray(p.images) ? p.images : [],
          brandName: p.brand?.name ?? p.Brand?.name ?? p.brandName ?? null,
          category: p.category?.name ?? p.Category?.name ?? p.categoryName ?? null,
          gender: p.gender ?? null,
          available: p.available !== false,
        }));

        if (!cancelled) setProducts(mapped);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Categories derived from actual products
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [products]);

  // Max discount for hero label
  const maxDiscount = useMemo(() => {
    let max = 0;
    for (const p of products) {
      const pct = discountPct(p.price, p.oldPrice);
      if (pct > max) max = pct;
    }
    return max;
  }, [products]);

  // Filtered + sorted
  const visible = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.category === activeCategory);
    if (activeGender) {
      list = list.filter((p) => {
        const g = (p.gender ?? '').toLowerCase();
        return g === activeGender || g === 'unisex';
      });
    }

    switch (sort) {
      case "discount":
        list = [...list].sort(
          (a, b) =>
            discountPct(b.price, b.oldPrice) - discountPct(a.price, a.oldPrice)
        );
        break;
      case "price_asc":
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case "newest":
        // Keep original fetch order (createdAt desc from API)
        break;
    }
    return list;
  }, [products, activeCategory, activeGender, sort]);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-[#0b0b0b] text-white">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-red-600/20 blur-3xl" />
          <div className="absolute right-[-80px] bottom-[-80px] h-72 w-72 rounded-full bg-orange-500/15 blur-[80px]" />
        </div>

        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
                ● Акция активна
              </div>
              <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none">
                SALE
              </h1>
              <p className="mt-3 text-white/60 text-base sm:text-lg max-w-md">
                Оригинальные товары{maxDiscount > 0 ? ` до -${maxDiscount}%` : ""}.
                Гарантия подлинности, доставка по России.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Link
                  href="/shipping"
                  className="text-sm text-white/50 hover:text-white transition underline underline-offset-2"
                >
                  Условия доставки
                </Link>
                <span className="text-white/20">·</span>
                <Link
                  href="/returns"
                  className="text-sm text-white/50 hover:text-white transition underline underline-offset-2"
                >
                  Возврат
                </Link>
              </div>
            </div>

            {!loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="shrink-0 text-right"
              >
                <div className="text-4xl sm:text-5xl font-black tabular-nums">
                  {products.length}
                </div>
                <div className="text-sm text-white/50 mt-1">товаров в акции</div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="sticky top-[var(--header-h,60px)] z-20 bg-white/95 backdrop-blur border-b border-black/8">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Category pills */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition border ${
                activeCategory === null
                  ? "bg-black text-white border-black"
                  : "border-black/15 text-black/70 hover:border-black/30"
              }`}
            >
              Все
            </button>
            {categories.map(({ name, count }) => (
              <button
                key={name}
                onClick={() => setActiveCategory(name === activeCategory ? null : name)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition border whitespace-nowrap ${
                  activeCategory === name
                    ? "bg-black text-white border-black"
                    : "border-black/15 text-black/70 hover:border-black/30"
                }`}
              >
                {name}
                <span className="ml-1.5 text-xs opacity-60">{count}</span>
              </button>
            ))}
          </div>

          {/* Gender + Sort */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Gender pills */}
            <LayoutGroup id="sale-gender">
              <div className="relative flex items-center bg-black/[0.05] rounded-full p-1">
                {GENDER_OPTIONS.map((opt) => {
                  const isActive = activeGender === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setActiveGender(opt.value)}
                      className="relative px-3 py-1 text-xs font-medium rounded-full z-10 transition-colors duration-200"
                      style={{ color: isActive ? '#fff' : 'rgba(0,0,0,0.55)' }}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sale-gender-pill"
                          className="absolute inset-0 bg-black rounded-full"
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      <span className="relative z-10">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    sort === opt.key
                      ? "bg-black text-white border-black"
                      : "border-black/12 text-black/60 hover:border-black/25"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-2xl bg-black/6" />
                <div className="mt-2 h-3 w-2/3 rounded bg-black/6" />
                <div className="mt-1.5 h-4 w-1/2 rounded bg-black/6" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-4xl mb-4">🏷</div>
            <div className="text-lg font-semibold">Товаров нет</div>
            <p className="mt-2 text-sm text-black/50">
              {activeCategory
                ? "В этой категории нет акционных товаров"
                : "Акционных товаров пока нет — загляните позже"}
            </p>
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="mt-4 px-5 py-2.5 rounded-full border border-black/15 text-sm hover:border-black/30 transition"
              >
                Показать все
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-5 text-sm text-black/40">
              {visible.length} {visible.length === 1 ? "товар" : visible.length < 5 ? "товара" : "товаров"}
              {activeCategory && ` · ${activeCategory}`}
            </div>
            <motion.div
              key={`${activeCategory}-${activeGender}-${sort}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5"
            >
              {visible.map((p) => (
                <SaleCard key={String(p.id)} product={p} />
              ))}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
