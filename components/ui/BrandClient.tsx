'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import type { ProductWithImages } from './types';
import { useUser } from '@/user/UserContext';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import { productPath } from '@/lib/product-url';
import { AnimatePresence, motion } from 'framer-motion';

// -- localStorage keys (keep both for backward compatibility) --
const LS_KEY = 'favoriteBrands';
const LS_KEY_COMPAT = 'fav_brands';

// === helpers ===================================================
function readBoth(): string[] {
  try {
    const a = localStorage.getItem(LS_KEY);
    const b = localStorage.getItem(LS_KEY_COMPAT);
    const A: unknown = a ? JSON.parse(a) : [];
    const B: unknown = b ? JSON.parse(b) : [];
    const arrA = Array.isArray(A) ? A : [];
    const arrB = Array.isArray(B) ? B : [];
    // uniq merge
    const merged = [...arrA, ...arrB].filter((x): x is string => typeof x === 'string');
    const uniq: string[] = [];
    for (const s of merged) if (!uniq.includes(s)) uniq.push(s);
    return uniq;
  } catch {
    return [];
  }
}

function writeBoth(slugs: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(slugs));
    localStorage.setItem(LS_KEY_COMPAT, JSON.stringify(slugs));
  } catch {}
}

function getUserIdFromClient(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    // cookies first
    const cookieMatch = document.cookie.match(/(?:^|; )(?:userId|userid|uid)=([^;]+)/i);
    if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
    // then localStorage fallbacks
    const ls =
      localStorage.getItem('userId') ||
      localStorage.getItem('userid') ||
      localStorage.getItem('uid') ||
      localStorage.getItem('currentUserId');
    if (ls && /^\d+$/.test(ls)) return ls;
  } catch {}
  return null;
}

async function loadFavoriteSlugsFromApi(): Promise<string[]> {
  const uid = getUserIdFromClient();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (uid) headers['x-user-id'] = String(uid);

  const res = await fetch('/api/favorites/brands', {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!res.ok) return [];
  const data = await res.json().catch(() => ({ items: [] as any[] }));
  // API returns { items: Array<{ slug: string, ... }> }
  const slugs: string[] = Array.isArray(data?.items)
    ? data.items
        .map((b: any) => (b && typeof b.slug === 'string' ? b.slug : null))
        .filter((s: string | null): s is string => !!s)
    : [];
  return slugs;
}

async function syncFavoriteToApi(slug: string, action: 'add' | 'remove') {
  const uid = getUserIdFromClient();
  try {
    await fetch('/api/favorites/brands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(uid ? { 'x-user-id': String(uid) } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ slug, action, userId: uid ? Number(uid) : undefined }),
    });
  } catch {
    // ignore network issues; localStorage is still the source of truth for UI
  }
}

// === types =====================================================
interface BrandMeta {
  id?: number;
  logo?: string;
  about?: string;
  aboutLong?: string;
  tags?: string[];
}

interface BrandClientProps {
  items: (ProductWithImages & { Category?: { name: string; slug: string } | null; category?: any })[];
  meta: BrandMeta;
  brandName: string;
  slug: string;
}

const CARD_SWIPE_VARIANTS = {
  enter: (dir: 'left' | 'right') => ({
    x: 0,
    clipPath: dir === 'left' ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)',
    opacity: 1,
    scale: 1.01,
    zIndex: 2,
  }),
  center: {
    x: 0,
    clipPath: 'inset(0 0 0 0)',
    opacity: 1,
    scale: 1,
    zIndex: 2,
  },
  exit: (_dir: 'left' | 'right') => ({
    x: 0,
    opacity: 0,
    scale: 0.995,
    zIndex: 1,
  }),
};

function BrandCardPreview({ images, alt }: { images: string[]; alt: string }) {
  const imagesArr = useMemo(() => images?.length ? images : ['/img/placeholder.svg'], [images]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right'>('left');
  const [isTouch, setIsTouch] = useState(false);
  const activeIdxRef = useRef(0);
  const swipeStateRef = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    lastStepTs: number;
    pointerId: number | null;
    intent: 'h' | 'v' | null;
  }>({ startX: 0, startY: 0, active: false, lastStepTs: 0, pointerId: null, intent: null });

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    setIsTouch(coarse || 'ontouchstart' in window);
  }, []);

  useEffect(() => {
    setActiveIdx((prev) => {
      const max = Math.max(0, imagesArr.length - 1);
      const next = Math.min(Math.max(prev, 0), max);
      activeIdxRef.current = next;
      return next;
    });
  }, [imagesArr]);

  const activeSrc = imagesArr[activeIdx] || imagesArr[0];

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: isTouch ? 'pan-y' : undefined, userSelect: 'none' }}
      onMouseMove={(e) => {
        if (isTouch) return;
        if (!imagesArr?.length || imagesArr.length === 1) return;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = rect.width > 0 ? x / rect.width : 0;
        let idx = Math.floor(ratio * imagesArr.length);
        if (idx < 0) idx = 0;
        if (idx >= imagesArr.length) idx = imagesArr.length - 1;
        if (idx === activeIdx) return;
        setSwipeDir(idx > activeIdx ? 'left' : 'right');
        setActiveIdx(idx);
      }}
      onMouseLeave={() => {
        if (isTouch) return;
        if (!imagesArr?.length || imagesArr.length === 1) return;
        if (activeIdx === 0) return;
        setSwipeDir('right');
        setActiveIdx(0);
      }}
      onPointerDown={(e) => {
        if (!isTouch) return;
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        if (!imagesArr?.length || imagesArr.length === 1) return;
        try {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        } catch {}
        swipeStateRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          active: true,
          lastStepTs: 0,
          pointerId: e.pointerId,
          intent: null,
        };
      }}
      onPointerMove={(e) => {
        if (!isTouch) return;
        const st = swipeStateRef.current;
        if (!st.active) return;
        if (st.pointerId !== null && e.pointerId !== st.pointerId) return;
        if (!imagesArr?.length || imagesArr.length === 1) return;

        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;

        if (st.intent === null) {
          const SLOP = 10;
          if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
          st.intent = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        }
        if (st.intent === 'v') return;

        e.preventDefault();
        e.stopPropagation();

        const THRESHOLD = 64;
        if (Math.abs(dx) < THRESHOLD) return;

        const now = Date.now();
        if (st.lastStepTs && now - st.lastStepTs < 160) return;

        const dir: 'left' | 'right' = dx < 0 ? 'left' : 'right';
        const delta = dir === 'left' ? 1 : -1;
        const maxIdx = imagesArr.length - 1;
        let nextIdx = activeIdxRef.current + delta;
        if (nextIdx < 0) nextIdx = 0;
        if (nextIdx > maxIdx) nextIdx = maxIdx;

        if (nextIdx !== activeIdxRef.current) {
          activeIdxRef.current = nextIdx;
          setSwipeDir(dir);
          setActiveIdx(nextIdx);
        }

        st.startX = e.clientX;
        st.startY = e.clientY;
        st.lastStepTs = now;
      }}
      onPointerUp={(e) => {
        try {
          if (swipeStateRef.current.pointerId !== null) {
            (e.currentTarget as HTMLDivElement).releasePointerCapture(swipeStateRef.current.pointerId);
          }
        } catch {}
        swipeStateRef.current.active = false;
        swipeStateRef.current.lastStepTs = 0;
        swipeStateRef.current.pointerId = null;
        swipeStateRef.current.intent = null;
      }}
      onPointerCancel={(e) => {
        try {
          if (swipeStateRef.current.pointerId !== null) {
            (e.currentTarget as HTMLDivElement).releasePointerCapture(swipeStateRef.current.pointerId);
          }
        } catch {}
        swipeStateRef.current.active = false;
        swipeStateRef.current.lastStepTs = 0;
        swipeStateRef.current.pointerId = null;
        swipeStateRef.current.intent = null;
      }}
    >
      <AnimatePresence initial={false} mode="sync" custom={swipeDir}>
        <motion.img
          key={activeSrc}
          custom={swipeDir}
          variants={CARD_SWIPE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: 0.32,
            ease: [0.22, 1, 0.36, 1],
            opacity: { duration: 0.16, ease: 'linear' },
            scale: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
          }}
          src={activeSrc}
          alt={alt}
          className="absolute inset-0 w-full h-full object-contain"
        />
      </AnimatePresence>

      {imagesArr.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none">
          {imagesArr.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ease-out ${
                i === activeIdx ? 'w-5 bg-black/50' : 'w-1.5 bg-black/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// === component =================================================
export default function BrandClient({
  items,
  meta,
  brandName,
  slug,
}: BrandClientProps) {
  const [limit, setLimit] = useState(12);
  const [isFav, setIsFav] = useState(false);
  const [authWarn, setAuthWarn] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [favBurst, setFavBurst] = useState(false);
  const burstTimerRef = useRef<number | null>(null);
  const brandTrackedRef = useRef(false);
  const { user } = useUser?.() || {};

  useEffect(() => {
    brandTrackedRef.current = false;
  }, [slug]);

  useEffect(() => {
    if (!user?.id || !meta?.id) return;
    if (brandTrackedRef.current) return;
    brandTrackedRef.current = true;
    trackAnalyticsEvent({ event: "brand_click", brandId: meta.id });
  }, [user?.id, meta?.id]);

  // Initial sync: merge server favorites with localStorage and compute UI state
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const local = readBoth();
        const server = await loadFavoriteSlugsFromApi(); // [] when not authorized
        const merged = Array.from(new Set([...local, ...server]));
        writeBoth(merged);
        if (mounted) setIsFav(merged.includes(slug));
      } catch {
        if (mounted) setIsFav(readBoth().includes(slug));
      }
    })();

    // listen cross-components updates (profile page etc.)
    const onFavs = (e: Event) => {
      const detail = (e as CustomEvent).detail as { slugs?: string[] } | undefined;
      const current = detail?.slugs ?? readBoth();
      setIsFav(current.includes(slug));
    };
    window.addEventListener('favorites:brands:update', onFavs as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('favorites:brands:update', onFavs as EventListener);
    };
  }, [slug]);

  const priceBounds = useMemo(() => {
    let min = Infinity;
    let max = 0;
    for (const it of items) {
      const price = Number((it as any)?.price ?? 0);
      if (!Number.isFinite(price) || price <= 0) continue;
      if (price < min) min = price;
      if (price > max) max = price;
    }
    if (!Number.isFinite(min)) min = 0;
    return { min: Math.floor(min || 0), max: Math.ceil(max || 0) };
  }, [items]);

  useEffect(() => {
    setMaxPrice(priceBounds.max || 0);
  }, [priceBounds.max]);

  useEffect(() => {
    if (!searchOpen) return;
    const id = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(id);
  }, [searchOpen]);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
    };
  }, []);

  const categories = useMemo(() => {
    const list: string[] = [];
    for (const it of items) {
      const name = (it as any)?.Category?.name || (it as any)?.category?.name;
      if (name && !list.includes(name)) list.push(name);
    }
    return list;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const name = String((it as any)?.name || '').toLowerCase();
      if (q && !name.includes(q)) return false;
      const cat = (it as any)?.Category?.name || (it as any)?.category?.name || null;
      if (activeCategory && cat !== activeCategory) return false;
      const price = Number((it as any)?.price ?? 0);
      if (maxPrice && price && price > maxPrice) return false;
      return true;
    });
  }, [items, query, activeCategory, maxPrice]);

  const heroProducts = useMemo(() => items.slice(0, 3), [items]);
  const premiumCount = useMemo(() => items.filter((it) => Boolean((it as any)?.premium)).length, [items]);
  const displayMinPrice = priceBounds.min > 0 ? priceBounds.min : 0;
  const displayMaxPrice = priceBounds.max > 0 ? priceBounds.max : 0;
  const collectionLabel = items.length === 1 ? 'позиция' : items.length > 1 && items.length < 5 ? 'позиции' : 'позиций';

  const openBrandSearch = () => {
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  const triggerFavBurst = () => {
    setFavBurst(false);
    requestAnimationFrame(() => setFavBurst(true));
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
    burstTimerRef.current = window.setTimeout(() => setFavBurst(false), 1000);
  };

  const toggleFavorite = async () => {
    if (!user) {
      setAuthWarn(true);
      setTimeout(() => setAuthWarn(false), 2200);
      return;
    }
    try {
      const list = readBoth();
      let next: string[];
      let action: 'add' | 'remove';

      if (list.includes(slug)) {
        next = list.filter((s) => s !== slug);
        action = 'remove';
        setIsFav(false);
      } else {
        next = [...list, slug];
        action = 'add';
        setIsFav(true);
        triggerFavBurst();
      }

      writeBoth(next);
      // notify same-tab listeners (profile favorites page)
      window.dispatchEvent(
        new CustomEvent('favorites:brands:update', { detail: { slugs: next } }),
      );
      // best effort server sync
      await syncFavoriteToApi(slug, action);
    } catch {
      // noop
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-4 text-xs font-medium text-gray-500">
        <Link href="/" className="hover:text-black transition-colors">Главная</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{brandName}</span>
      </div>

      <div className="relative overflow-hidden rounded-[34px] border border-black/10 bg-gradient-to-br from-[#f4f1ea] via-[#fbfaf6] to-[#e9e3d8] shadow-[0_30px_90px_rgba(0,0,0,0.13)]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.75]" style={{
            backgroundImage:
              "radial-gradient(900px 360px at 12% 0%, rgba(255,255,255,0.9), transparent 62%), radial-gradient(620px 380px at 92% 88%, rgba(0,0,0,0.08), transparent 64%)",
          }} />
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage:
              "linear-gradient(0deg, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
            backgroundSize: "96px 96px",
          }} />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-black/10" />
          <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full border border-black/10" />
        </div>
        {meta.logo && (
          <div className="absolute right-6 top-3 z-20 grid h-20 w-20 place-items-center rounded-3xl border border-black/10 bg-white/78 p-3 shadow-[0_16px_35px_rgba(0,0,0,0.10)] backdrop-blur sm:top-4 sm:h-24 sm:w-24 lg:right-16 lg:top-7 lg:h-28 lg:w-28 lg:p-4">
            <img src={meta.logo} alt={`${brandName} logo`} className="max-h-full max-w-full object-contain opacity-85" />
          </div>
        )}

        <div className="relative z-10 grid gap-8 px-5 py-7 sm:px-8 sm:py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-12 lg:py-12">
          <div className="flex min-h-[350px] flex-col justify-between">
            <div className="pt-20 lg:pt-8">
              <h1 className="text-[clamp(2.85rem,11vw,5rem)] font-black uppercase leading-[0.86] tracking-[-0.025em] text-black sm:text-[clamp(3rem,8vw,5.6rem)] lg:text-[clamp(3.2rem,5.35vw,5.85rem)] lg:tracking-[-0.005em]">
                {brandName}
              </h1>
              <p className="mt-5 max-w-xl text-sm font-semibold leading-6 text-black/62 sm:text-base">
                {meta.about || `Коллекция бренда ${brandName}.`}
              </p>
              {meta.aboutLong && (
                <p className="mt-3 max-w-xl text-xs leading-5 text-black/46 sm:text-sm">
                  {meta.aboutLong}
                </p>
              )}
              {!!meta.tags?.length && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {meta.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-full border border-black/10 bg-white/45 px-3 py-1.5 text-xs font-semibold text-black/55">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <div className="grid grid-cols-3 gap-2 rounded-3xl border border-black/10 bg-white/55 p-2 backdrop-blur">
                <div className="rounded-2xl bg-white/70 px-4 py-3">
                  <div className="text-xl font-black text-black">{items.length}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-black/38">{collectionLabel}</div>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3">
                  <div className="text-xl font-black text-black">{categories.length || 1}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-black/38">категорий</div>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3">
                  <div className="text-xl font-black text-black">{premiumCount}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-black/38">premium</div>
                </div>
              </div>
            <button
              type="button"
              onClick={toggleFavorite}
              aria-pressed={isFav}
              aria-label={isFav ? 'Убрать бренд из избранного' : 'Добавить бренд в избранное'}
                className="relative inline-flex items-center gap-2 overflow-visible rounded-full border border-black/15 bg-black px-5 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-white hover:text-black"
            >
              {favBurst && (
                <span className="fav-burst-layer" aria-hidden="true">
                  <span className="fav-wave" />
                  <span className="fav-star s1" />
                  <span className="fav-star s2" />
                  <span className="fav-star s3" />
                  <span className="fav-star s4" />
                  <span className="fav-star s5" />
                  <span className="fav-star s6" />
                  <span className="fav-star s7" />
                  <span className="fav-star s8" />
                  <span className="fav-bolt b1" />
                  <span className="fav-bolt b2" />
                  <span className="fav-bolt b3" />
                  <span className="fav-bolt b4" />
                </span>
              )}
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 ${isFav ? 'text-red-500' : 'text-current'}`}
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1.01 4.5 2.09C12.09 5.01 13.76 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
                <span>{isFav ? 'В избранном' : 'В избранное'}</span>
            </button>
            </div>
          </div>

          <div className="relative min-h-[330px]">
            <div className="absolute inset-x-8 top-8 h-48 rounded-full bg-black/10 blur-3xl" />
            <div className="relative grid h-full grid-cols-2 gap-3 sm:grid-cols-3">
              {heroProducts.length > 0 ? heroProducts.map((item, idx) => {
                const images =
                  (Array.isArray((item as any).images) ? (item as any).images : undefined) ||
                  ((item as any).imageUrl ? [(item as any).imageUrl] : ['/img/placeholder.svg']);
                return (
                  <Link
                    key={item.id}
                    href={productPath({ id: item.id, name: (item as any).name, brand: brandName })}
                    className={`group relative overflow-hidden rounded-[26px] border border-black/10 bg-white/75 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition hover:-translate-y-1 ${
                      idx === 1 ? 'mt-10' : idx === 2 ? 'mt-20 hidden sm:block' : ''
                    }`}
                  >
                    <div className="relative h-56 rounded-2xl bg-white">
                      <BrandCardPreview images={images} alt={(item as any).name} />
                    </div>
                    <div className="mt-3">
                      <div className="line-clamp-2 text-xs font-bold leading-4 text-black/72">{(item as any).name}</div>
                      <div className="mt-1 text-xs font-black text-black">{Number((item as any).price || 0).toLocaleString('ru-RU')}₽</div>
                    </div>
                  </Link>
                );
              }) : (
                <div className="col-span-2 grid place-items-center rounded-[28px] border border-black/10 bg-white/50 text-sm font-semibold text-black/45 sm:col-span-3">
                  Коллекция скоро появится
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 mb-7 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_16px_45px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-1 gap-0 divide-y divide-black/10 md:grid-cols-[1.35fr_1fr] md:divide-x md:divide-y-0">
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-[11px] font-bold uppercase tracking-[0.22em] text-black/38">Поиск по бренду</label>
              <span className="text-xs font-semibold text-black/35">{filtered.length} из {items.length}</span>
            </div>
            <div className="mt-2 flex h-12 items-center">
              <motion.div
                className="relative h-12 overflow-hidden rounded-full border border-black/10 bg-white shadow-sm"
                initial={false}
                animate={{
                  width: searchOpen ? '100%' : query ? 190 : 48,
                  boxShadow: searchOpen || query ? "0 12px 30px rgba(0,0,0,0.08)" : "0 0 0 rgba(0,0,0,0)",
                }}
                transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: "left center" }}
              >
                <div className="absolute inset-0 rounded-full bg-[linear-gradient(90deg,rgba(0,0,0,0.04),rgba(255,255,255,0.35),transparent)] opacity-70" />
                <button
                  type="button"
                  onClick={openBrandSearch}
                  aria-expanded={searchOpen}
                  aria-label="Открыть поиск"
                  className={`absolute left-1 top-1 grid h-10 w-10 place-items-center rounded-full border border-black/10 transition ${
                    searchOpen || query ? "bg-black text-white border-black" : "bg-white text-black/60 hover:text-black"
                  }`}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                  </svg>
                </button>

                <AnimatePresence initial={false}>
                  {searchOpen && (
                    <motion.div
                      key="brand-search-wrap"
                      className="absolute inset-y-0 left-14 right-3 flex items-center overflow-hidden"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "100%" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <input
                        ref={searchInputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onBlur={() => window.setTimeout(() => setSearchOpen(false), 80)}
                        placeholder="Найти товар внутри бренда"
                        className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-black/32"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                {!searchOpen && query && (
                  <button
                    type="button"
                    onClick={openBrandSearch}
                    className="absolute inset-y-0 left-14 right-4 overflow-hidden text-left text-xs font-bold text-black/48"
                  >
                    <span className="block truncate">{query}</span>
                  </button>
                )}
              </motion.div>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <label className="text-[11px] font-bold uppercase tracking-[0.22em] text-black/38">Цена до</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                value={Math.min(maxPrice || priceBounds.max, priceBounds.max)}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-black"
              />
              <div className="text-sm font-semibold whitespace-nowrap">
                {maxPrice ? `${maxPrice.toLocaleString('ru-RU')}₽` : '—'}
              </div>
            </div>
            <div className="mt-2 flex justify-between text-xs font-semibold text-black/35">
              <span>{displayMinPrice.toLocaleString('ru-RU')}₽</span>
              <span>{displayMaxPrice.toLocaleString('ru-RU')}₽</span>
            </div>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-black/10 bg-[#faf9f6] p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                !activeCategory ? 'bg-black text-white border-black' : 'bg-white text-black/60 border-black/10 hover:border-black/35 hover:text-black'
              }`}
            >
              Все категории
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                  activeCategory === cat ? 'bg-black text-white border-black' : 'bg-white text-black/60 border-black/10 hover:border-black/35 hover:text-black'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>
        {authWarn && (
          <motion.div
            key="auth-warn"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm"
          >
            Только зарегистрированные пользователи могут добавлять бренды в избранное.
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 && (
        <div className="text-sm text-gray-500 py-8">Пока нет товаров этого бренда.</div>
      )}

      {/* Сетка карточек товаров */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.slice(0, limit).map((item) => (
          <Link
            key={item.id}
            href={productPath({ id: item.id, name: (item as any).name, brand: brandName })}
            className="group relative rounded-2xl overflow-hidden bg-transparent border border-black/10 shadow-[0_14px_36px_rgba(0,0,0,0.08)] hover:shadow-[0_18px_48px_rgba(0,0,0,0.12)] transition-transform hover:-translate-y-1"
          >
            <div className="relative w-full h-64 bg-transparent">
              <BrandCardPreview
                images={
                  (Array.isArray(item.images) ? item.images : undefined) ||
                  (item.imageUrl ? [item.imageUrl] : ['/img/placeholder.svg'])
                }
                alt={item.name}
              />
            </div>
            <div className="p-4 transition-transform duration-300 group-hover:-translate-y-0.5 relative">
              <div className="brand-desc-sheen" aria-hidden="true" />
              <div className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-1 group-hover:text-black/60 transition-colors">
                {brandName}
              </div>
              <h3 className="text-sm font-semibold line-clamp-2 transition-colors group-hover:text-black">
                {item.name}
              </h3>
              {!!item.description && (
                <p className="mt-1 text-xs text-black/50 line-clamp-1 brand-desc-text">
                  {item.description}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold transition-colors group-hover:text-black">
                  {item.price != null ? `${Number(item.price).toLocaleString('ru-RU')}₽` : '—'}
                </span>
                <span className="text-xs text-black/40 group-hover:text-black/60 transition-colors">
                  Подробнее
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length > limit && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setLimit((l) => l + 12)}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
          >
            Показать ещё
          </button>
        </div>
      )}
      <style jsx>{`
        .fav-burst-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .fav-wave {
          position: absolute;
          left: 50%;
          top: 50%;
          width: calc(100% + 6px);
          height: calc(100% + 6px);
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.35);
          transform: translate(-50%, -50%) scale(0.98);
          animation: fav-wave 1000ms ease-out forwards;
        }
        .fav-star {
          position: absolute;
          width: 10px;
          height: 10px;
          background: radial-gradient(circle, rgba(0,0,0,0.8), rgba(0,0,0,0));
          clip-path: polygon(50% 0%, 61% 38%, 100% 38%, 68% 59%, 79% 100%, 50% 74%, 21% 100%, 32% 59%, 0% 38%, 39% 38%);
          opacity: 0;
          animation: fav-star 1000ms ease-out forwards;
        }
        .fav-star.s1 { left: 10%; top: -2px; --dx: -6px; --dy: -16px; }
        .fav-star.s2 { right: 10%; top: -2px; --dx: 6px; --dy: -16px; }
        .fav-star.s3 { left: 8%; bottom: -2px; --dx: -8px; --dy: 16px; }
        .fav-star.s4 { right: 8%; bottom: -2px; --dx: 8px; --dy: 16px; }
        .fav-star.s5 { left: -2px; top: 20%; --dx: -16px; --dy: -4px; }
        .fav-star.s6 { left: -2px; bottom: 20%; --dx: -16px; --dy: 4px; }
        .fav-star.s7 { right: -2px; top: 20%; --dx: 16px; --dy: -4px; }
        .fav-star.s8 { right: -2px; bottom: 20%; --dx: 16px; --dy: 4px; }

        .fav-bolt {
          position: absolute;
          width: 10px;
          height: 18px;
          background: linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0));
          clip-path: polygon(40% 0%, 65% 0%, 50% 40%, 75% 40%, 30% 100%, 40% 60%, 20% 60%);
          opacity: 0;
          animation: fav-bolt 900ms ease-out forwards;
        }
        .fav-bolt.b1 { left: 20%; top: -6px; --dx: -4px; --dy: -18px; }
        .fav-bolt.b2 { right: 20%; top: -6px; --dx: 4px; --dy: -18px; }
        .fav-bolt.b3 { left: 18%; bottom: -6px; --dx: -4px; --dy: 18px; transform: rotate(180deg); }
        .fav-bolt.b4 { right: 18%; bottom: -6px; --dx: 4px; --dy: 18px; transform: rotate(180deg); }

        @keyframes fav-wave {
          0% {
            transform: translate(-50%, -50%) scale(0.98);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0;
          }
        }
        @keyframes fav-star {
          0% {
            transform: translate(-50%, -50%) scale(0.2);
            opacity: 0;
          }
          35% {
            opacity: 0.9;
          }
          100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.4);
            opacity: 0;
          }
        }
        @keyframes fav-bolt {
          0% {
            transform: translate(-50%, -50%) scale(0.2);
            opacity: 0;
          }
          30% {
            opacity: 0.9;
          }
          100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.1);
            opacity: 0;
          }
        }

        .brand-desc-sheen {
          position: absolute;
          left: 0;
          right: 0;
          top: 6px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.18), transparent);
          opacity: 0;
          transform: translateX(-20%);
          transition: opacity 300ms ease;
        }
        .group:hover .brand-desc-sheen {
          opacity: 1;
          animation: brand-sheen 1.2s ease;
        }
        .brand-desc-text {
          transition: transform 300ms ease, color 300ms ease;
        }
        .group:hover .brand-desc-text {
          transform: translateY(-1px);
          color: rgba(0,0,0,0.7);
        }
        @keyframes brand-sheen {
          0% { transform: translateX(-30%); }
          100% { transform: translateX(30%); }
        }
      `}</style>
    </div>
  );
}
