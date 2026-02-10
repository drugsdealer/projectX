"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

type FavItem = {
  id: number | string;
  name: string;
  price?: number | null;
  currentPrice?: number | null;
  priceDelta?: number | null;
  imageUrl?: string | null;
  brand?: string | null;
  size?: string | number | null;
  lastPrice?: number | null;
  category?: string | null;
};

const EMPTY_STATE: FavItem[] = [];
const BASE_LIMIT = 5;

export default function FavoritesPage() {
  const router = useRouter();
  const [items, setItems] = React.useState<FavItem[]>(EMPTY_STATE);
  const [loading, setLoading] = React.useState(true);
  const [brandFilter, setBrandFilter] = React.useState<string | null>(null);
  const [sizeFilter, setSizeFilter] = React.useState<string | null>(null);
  const [priceMin, setPriceMin] = React.useState<number | null>(null);
  const [priceMax, setPriceMax] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [visibleByCat, setVisibleByCat] = React.useState<Record<string, number>>({});
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [firstName, setFirstName] = React.useState<string | null>(null);

  const removeItem = React.useCallback((id: FavItem["id"]) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem("favoriteProducts", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const hydrateFavorites = React.useCallback(async () => {
    setLoading(true);
    try {
      const raw = localStorage.getItem("favoriteProducts");
      const parsed: FavItem[] = raw ? JSON.parse(raw) : [];
      const base = Array.isArray(parsed) ? parsed : [];
      if (!base.length) {
        setItems([]);
        return;
      }

      const pickPrice = (p: any, sizeLabel?: string | number | null) => {
        if (!p) return null;
        const sizeKey = sizeLabel != null ? String(sizeLabel) : null;
        const prices = (p as any)?.sizes?.prices ?? {};
        if (sizeKey && prices && prices[sizeKey] != null) {
          const v = Number(prices[sizeKey]);
          if (Number.isFinite(v)) return v;
        }
        const basePrice = Number((p as any)?.price);
        return Number.isFinite(basePrice) ? basePrice : null;
      };

      const enriched: FavItem[] = [];
      await Promise.all(
        base.map(async (it) => {
          try {
            const res = await fetch(`/api/products/${it.id}`);
            if (!res.ok) {
              enriched.push(it);
              return;
            }
            const data = await res.json();
            const p = data?.product || data;
            const currentPrice = pickPrice(p, it.size);
            const savedPrice = Number(it.price ?? null);
            let priceDelta: number | null = null;
            if (currentPrice != null && Number.isFinite(currentPrice) && Number.isFinite(savedPrice)) {
              priceDelta = currentPrice - savedPrice;
            }
            const nextItem: FavItem = {
              ...it,
              price: it.price ?? null, // сохраняем базовую цену из момента добавления
              currentPrice: Number.isFinite(currentPrice) ? currentPrice : it.currentPrice ?? it.price ?? null,
              lastPrice: Number.isFinite(currentPrice) ? currentPrice : it.lastPrice ?? it.price ?? null,
              priceDelta,
              imageUrl: p?.imageUrl ?? it.imageUrl ?? null,
              brand: p?.Brand?.name ?? p?.brand ?? it.brand ?? null,
              category: p?.Category?.slug ?? p?.category ?? p?.categorySlug ?? null,
            };
            enriched.push(nextItem);
          } catch {
            enriched.push(it);
          }
        })
      );
      setItems(enriched);
      // Обновим кеш (картинки, бренд, lastPrice), но не трогаем базовую price
      try {
        const toStore = enriched.map((i) => ({
          ...i,
          currentPrice: undefined,
          priceDelta: undefined,
        }));
        localStorage.setItem("favoriteProducts", JSON.stringify(toStore));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Греть имя пользователя из профиля, чтобы показать персональный заголовок
    const fetchName = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const raw = data?.user?.fullName || data?.fullName || "";
        if (typeof raw === "string" && raw.trim()) {
          const parts = raw.trim().split(/\s+/);
          const name = parts.length > 1 ? parts[1] : parts[0];
          if (name) setFirstName(name);
        }
      } catch {
        // ignore
      }
    };
    fetchName();
  }, []);

  React.useEffect(() => {
    hydrateFavorites();
  }, [hydrateFavorites]);

  React.useEffect(() => {
    const onFocus = () => hydrateFavorites();
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [hydrateFavorites]);

  React.useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  const derived = React.useMemo(() => {
    const CAT_LABELS: Record<string, string> = {
      footwear: "Обувь",
      clothes: "Одежда",
      bags: "Сумки",
      accessories: "Аксессуары",
      fragrance: "Парфюмерия",
      headwear: "Головные уборы",
      other: "Другое",
    };
    const ORDER = ["footwear", "clothes", "bags", "accessories", "fragrance", "headwear", "other"];
    const normalizeCat = (v: string | null | undefined) => {
      const s = (v || "").toLowerCase();
      if (!s) return "other";
      if (/shoe|sneak|foot|ботин|кросс|sandal/.test(s)) return "footwear";
      if (/hood|tee|shirt|clothes|wear|одежд|худи|футбол|брюк|джинс|denim|dress|куртк|jacket/.test(s)) return "clothes";
      if (/bag|сумк|рюкзак|tote|cross/.test(s)) return "bags";
      if (/acc|аксесс|belt|ремн|glasses|очки/.test(s)) return "accessories";
      if (/perfume|parfum|fragrance|дух|парфюм/.test(s)) return "fragrance";
      if (/cap|hat|head|кепк|панам|beanie/.test(s)) return "headwear";
      return "other";
    };

    const brands = Array.from(new Set(items.map((i) => i.brand).filter(Boolean) as string[])).sort();
    const sizes = Array.from(new Set(items.map((i) => (i.size != null ? String(i.size) : null)).filter(Boolean) as string[]));
    const prices = items.map((i) => Number(i.currentPrice ?? i.price ?? 0)).filter((n) => Number.isFinite(n) && n > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;

    const filteredItems = items.filter((it) => {
      if (brandFilter && it.brand !== brandFilter) return false;
      if (sizeFilter && String(it.size ?? "") !== sizeFilter) return false;
      const priceVal = Number(it.currentPrice ?? it.price ?? 0);
      if (priceMin != null && priceVal < priceMin) return false;
      if (priceMax != null && priceVal > priceMax) return false;
      if (search.trim()) {
        const hay = `${it.name} ${it.brand || ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });

    const grouped: Record<string, FavItem[]> = {};
    for (const it of filteredItems) {
      const cat = normalizeCat(it.category);
      (grouped[cat] ||= []).push(it);
    }
    const sectionOrder = ORDER.filter((c) => grouped[c]?.length).concat(Object.keys(grouped).filter((c) => !ORDER.includes(c)));

    return { brands, sizes, minPrice, maxPrice, grouped, sectionOrder, normalizeCat, CAT_LABELS, filteredItems };
  }, [items, brandFilter, sizeFilter, priceMin, priceMax, search]);

  React.useEffect(() => {
    setVisibleByCat((prev) => {
      const next: Record<string, number> = {};
      for (const cat of derived.sectionOrder) {
        const len = derived.grouped[cat]?.length ?? 0;
        const base = prev[cat] ?? Math.min(BASE_LIMIT, len || BASE_LIMIT);
        const clamped = len ? Math.min(base, len) : base;
        next[cat] = clamped;
      }
      const same =
        Object.keys(next).length === Object.keys(prev).length &&
        Object.keys(next).every((k) => prev[k] === next[k]);
      return same ? prev : next;
    });
  }, [derived.sectionOrder, derived.grouped]);

  const content = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-48 sm:h-56 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse"
            />
          ))}
        </div>
      );
    }

    if (!items.length) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-black/5 flex items-center justify-center text-2xl">♡</div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Избранное пусто</h2>
            <p className="text-gray-600 max-w-md">
              Добавляйте понравившиеся товары в избранное — они появятся здесь и будут доступны на всех устройствах.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:-translate-y-0.5 transition"
            >
              Перейти в каталог
            </Link>
            <button
              onClick={() => hydrateFavorites()}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:border-black transition"
            >
              Обновить
            </button>
          </div>
        </div>
      );
    }

    const CAT_LABELS: Record<string, string> = {
      footwear: "Обувь",
      clothes: "Одежда",
      bags: "Сумки",
      accessories: "Аксессуары",
      fragrance: "Парфюмерия",
      headwear: "Головные уборы",
      other: "Другое",
    };

    return (
      <>
        <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setSearchOpen((v) => !v)}
              className="w-11 h-11 rounded-full border border-black/15 flex items-center justify-center bg-white shadow-sm hover:border-black/40 transition"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="9" r="6" />
                <line x1="13.5" y1="13.5" x2="18" y2="18" />
              </svg>
            </motion.button>
            <AnimatePresence initial={false} mode="wait">
              {searchOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "clamp(12rem, 60vw, 18rem)", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 20, mass: 0.7 }}
                  className="overflow-hidden min-w-0 max-w-full"
                >
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 bg-white shadow-inner">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Поиск по названию..."
                      className="w-full text-sm focus:outline-none"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="text-gray-400 hover:text-black transition text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Бренды:</span>
            <button
              onClick={() => setBrandFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${!brandFilter ? "bg-black text-white border-black" : "bg-white border-black/10 text-black/70"}`}
            >
              Все
            </button>
            {derived.brands.map((b) => (
              <button
                key={b}
                onClick={() => setBrandFilter(b)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition whitespace-nowrap ${
                  brandFilter === b ? "bg-black text-white border-black" : "bg-white border-black/10 text-black/70 hover:border-black/30"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Размеры:</span>
            <button
              onClick={() => setSizeFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${!sizeFilter ? "bg-black text-white border-black" : "bg-white border-black/10 text-black/70"}`}
            >
              Все
            </button>
            {derived.sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSizeFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition whitespace-nowrap ${
                  sizeFilter === s ? "bg-black text-white border-black" : "bg-white border-black/10 text-black/70 hover:border-black/30"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Цена от</span>
            <input
              type="number"
              className="w-24 rounded-lg border border-black/15 px-3 py-2 text-sm"
              placeholder={derived.minPrice ? String(derived.minPrice) : "0"}
              value={priceMin ?? ""}
              onChange={(e) => setPriceMin(e.target.value ? Number(e.target.value) : null)}
            />
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">до</span>
            <input
              type="number"
              className="w-24 rounded-lg border border-black/15 px-3 py-2 text-sm"
              placeholder={derived.maxPrice ? String(derived.maxPrice) : "∞"}
              value={priceMax ?? ""}
              onChange={(e) => setPriceMax(e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setBrandFilter(null); setSizeFilter(null); setPriceMin(null); setPriceMax(null); }}
              className="px-3 py-2 rounded-xl border border-black/10 text-sm font-semibold hover:border-black/30 transition"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>

        <div className="space-y-10">
          {derived.sectionOrder.map((cat) => {
            const list = derived.grouped[cat] || [];
            if (!list.length) return null;
            const limit = visibleByCat[cat] ?? BASE_LIMIT;
            const slice = list.slice(0, limit);
            const more = list.length - slice.length;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-800">{derived.CAT_LABELS[cat] ?? cat}</h3>
                  <div className="flex items-center gap-2">
                    {limit > BASE_LIMIT && (
                      <button
                        onClick={() =>
                          setVisibleByCat((prev) => ({
                            ...prev,
                            [cat]: Math.max(BASE_LIMIT, Math.min(list.length, BASE_LIMIT)),
                          }))
                        }
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/10 text-sm font-semibold hover:border-black/30 transition"
                      >
                        Свернуть
                      </button>
                    )}
                    {more > 0 && (
                      <button
                        onClick={() =>
                          setVisibleByCat((prev) => ({
                            ...prev,
                            [cat]: Math.min((prev[cat] ?? BASE_LIMIT) + BASE_LIMIT, list.length),
                          }))
                        }
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/10 text-sm font-semibold hover:border-black/30 transition"
                      >
                        Показать ещё {more > BASE_LIMIT ? BASE_LIMIT : more}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                  <AnimatePresence initial={false}>
                    {slice.map((item, idx) => (
                      <motion.div
                        layout="position"
                        key={`${cat}-${item.id}`}
                        initial={{ opacity: 0, y: 8, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.99 }}
                        transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.8 }}
                        onClick={() => router.push(`/product/${item.id}`)}
                        className="group relative rounded-2xl border border-gray-200 bg-white/90 shadow-sm hover:shadow-xl transition overflow-hidden cursor-pointer"
                      >
                        <div className="p-3 sm:p-4 flex flex-col gap-2">
                          <div className="flex flex-col gap-1 text-[11px] sm:text-xs text-gray-500">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                              {item.brand && <span className="px-2.5 sm:px-3 py-1 rounded-full bg-black/5 text-black/70 whitespace-nowrap">{item.brand}</span>}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                {item.size != null && (
                                  <span className="px-2.5 sm:px-3 py-1 rounded-full bg-gray-900 text-white font-semibold whitespace-nowrap">
                                    <span className="hidden sm:inline">Размер:</span> {String(item.size)}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                                className="p-2 rounded-full border border-black/10 text-black/70 hover:bg-black/5 transition translate-y-[-4px]"
                                aria-label="Удалить"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                          <div className="aspect-[4/3] w-full bg-white flex items-center justify-center overflow-hidden rounded-xl">
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                width={400}
                              height={300}
                              loading="lazy"
                              className="w-full h-full object-contain group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <span className="text-sm text-gray-400">Нет фото</span>
                          )}
                        </div>
                        {(() => {
                          const basePrice = Number(item.currentPrice ?? item.price ?? 0);
                          const delta = typeof item.priceDelta === "number" ? item.priceDelta : 0;
                          const hasDelta = Number.isFinite(delta) && delta !== 0;
                          const isUp = delta > 0;
                          if (!Number.isFinite(basePrice) || basePrice === 0) return null;
                          const badgeColor = hasDelta
                            ? isUp
                              ? "bg-red-50 border-red-200 text-red-700"
                              : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-white/90 border border-black/10 text-black";
                          return (
                            <div className={`mt-2 px-3 py-2 rounded-xl flex items-center justify-between gap-2 ${badgeColor}`}>
                              <span className="font-semibold text-sm sm:text-base whitespace-nowrap">{basePrice.toLocaleString("ru-RU")} ₽</span>
                              {hasDelta && (
                                <span className="text-[12px] sm:text-xs font-semibold inline-flex items-center gap-1 leading-tight whitespace-nowrap">
                                  <span className={`${isUp ? "text-red-600" : "text-emerald-600"} translate-y-[-1px] inline-block`}>
                                    {isUp ? "↑" : "↓"}
                                  </span>
                                  <span className={`${isUp ? "text-red-600" : "text-emerald-600"}`}>
                                    {Math.abs(delta).toLocaleString("ru-RU")} ₽
                                  </span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                          <div className="text-sm sm:text-base font-semibold line-clamp-2 mt-1">{item.name}</div>
                          <div className="hidden sm:flex items-center justify-between gap-2">
                            <Link
                              href={`/product/${item.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-black text-white px-3 py-2 text-xs sm:text-sm font-semibold shadow-lg shadow-black/15 transition hover:-translate-y-0.5"
                            >
                              Открыть
                            </Link>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                              className="text-xs sm:text-sm text-gray-500 hover:text-red-500 transition px-2 py-1"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gray-400">StageStore</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold">
              {firstName ? `${firstName}, вот ваши избранные` : "Избранные товары"}
            </h1>
            <p className="text-gray-600 mt-2">
              Все, что вы отметили сердечком. Доступно на всех устройствах после входа.
            </p>
          </div>
        </div>
        {content()}
      </div>
    </main>
  );
}
