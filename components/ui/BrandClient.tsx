'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import type { ProductWithImages } from './types';
import { useUser } from '@/user/UserContext';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import { productPath } from '@/lib/product-url';
import { getOptimizedImageUrl } from '@/lib/media';
import { AnimatePresence, motion } from 'framer-motion';

// -- localStorage keys (keep both for backward compatibility) --
const LS_KEY = 'favoriteBrands';
const LS_KEY_COMPAT = 'fav_brands';
const MAISON_MARGIELA_LOGO_URL = 'https://ik.imagekit.io/qowmy92ny/Maison_Margiela_logo.svg.png';
const MAISON_MARGIELA_HERO_IMAGE_URL = 'https://ik.imagekit.io/qowmy92ny/MARGIELA_ARTISANAL2253_C_FINAL.jpg?updatedAt=1778774121097';

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
  heroVideo?: string;
  tags?: string[];
  heroBgImage?: string;
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

type SortMode = 'popular' | 'priceAsc' | 'priceDesc' | 'newest';

const SORT_LABELS: Record<SortMode, string> = {
  popular: 'По умолчанию',
  priceAsc: 'Сначала дешевле',
  priceDesc: 'Сначала дороже',
  newest: 'Новинки',
};

function pickBrandVideo(meta: BrandMeta) {
  if (meta.heroVideo) return meta.heroVideo;
  const tagVideo = meta.tags?.find((tag) => /^video:/i.test(tag.trim()));
  return tagVideo ? tagVideo.replace(/^video:/i, '').trim() : '';
}

function pickBrandFallbackImage(items: BrandClientProps['items']) {
  for (const item of items) {
    const images = Array.isArray((item as any).images) ? (item as any).images : [];
    const first =
      images.find((src: unknown) => typeof src === 'string' && src.trim()) ||
      ((item as any).imageUrl && String((item as any).imageUrl).trim());
    if (first) return String(first);
  }
  return '/img/IMG_0364.JPG';
}

function compactBrandDescription(meta: BrandMeta, brandName: string) {
  const full = [meta.about, meta.aboutLong].filter(Boolean).join(' ').trim();
  return full || `Коллекция бренда ${brandName} в Stage Store.`;
}

function getRelativeLuminance(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

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
  const optimizedActiveSrc = useMemo(
    () => getOptimizedImageUrl(activeSrc, { width: 720, quality: 78 }),
    [activeSrc]
  );

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
          src={optimizedActiveSrc || '/img/placeholder.svg'}
          alt={alt}
          className="absolute inset-0 w-full h-full object-contain"
          loading="lazy"
          decoding="async"
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
  const [infoOpen, setInfoOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('popular');
  const [heroTone, setHeroTone] = useState<'dark' | 'light'>('dark');
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

  // Favorites are account-scoped. Never show stale local favorites to guests.
  useEffect(() => {
    let mounted = true;

    if (!user?.id) {
      setIsFav(false);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const server = await loadFavoriteSlugsFromApi(); // [] when not authorized
        writeBoth(server);
        if (mounted) setIsFav(server.includes(slug));
      } catch {
        if (mounted) setIsFav(readBoth().includes(slug));
      }
    })();

    // listen cross-components updates (profile page etc.)
    const onFavs = (e: Event) => {
      if (!user?.id) {
        setIsFav(false);
        return;
      }
      const detail = (e as CustomEvent).detail as { slugs?: string[] } | undefined;
      const current = detail?.slugs ?? readBoth();
      setIsFav(current.includes(slug));
    };
    window.addEventListener('favorites:brands:update', onFavs as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('favorites:brands:update', onFavs as EventListener);
    };
  }, [slug, user?.id]);

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
    const rows = items.filter((it) => {
      const name = String((it as any)?.name || '').toLowerCase();
      if (q && !name.includes(q)) return false;
      const cat = (it as any)?.Category?.name || (it as any)?.category?.name || null;
      if (activeCategory && cat !== activeCategory) return false;
      const price = Number((it as any)?.price ?? 0);
      if (maxPrice && price && price > maxPrice) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sortMode === 'priceAsc') return Number((a as any)?.price ?? 0) - Number((b as any)?.price ?? 0);
      if (sortMode === 'priceDesc') return Number((b as any)?.price ?? 0) - Number((a as any)?.price ?? 0);
      if (sortMode === 'newest') {
        const aDate = new Date((a as any)?.createdAt ?? 0).getTime();
        const bDate = new Date((b as any)?.createdAt ?? 0).getTime();
        return bDate - aDate;
      }
      return 0;
    });
  }, [items, query, activeCategory, maxPrice, sortMode]);

  const heroProducts = useMemo(() => items.slice(0, 3), [items]);
  const premiumCount = useMemo(() => items.filter((it) => Boolean((it as any)?.premium)).length, [items]);
  const displayMinPrice = priceBounds.min > 0 ? priceBounds.min : 0;
  const displayMaxPrice = priceBounds.max > 0 ? priceBounds.max : 0;
  const collectionLabel = items.length === 1 ? 'позиция' : items.length > 1 && items.length < 5 ? 'позиции' : 'позиций';
  const brandDescription = useMemo(() => compactBrandDescription(meta, brandName), [meta, brandName]);
  const shortDescription = brandDescription.length > 170 ? `${brandDescription.slice(0, 170).trim()}...` : brandDescription;
  const brandVideo = useMemo(() => pickBrandVideo(meta), [meta]);
  const heroFallbackImage = useMemo(
    () => slug === 'maison-margiela' ? MAISON_MARGIELA_HERO_IMAGE_URL : (meta.heroBgImage || pickBrandFallbackImage(items)),
    [items, slug, meta.heroBgImage]
  );
  const categoryLabel = categories.length === 1 ? 'категория' : categories.length > 1 && categories.length < 5 ? 'категории' : 'категорий';
  const productsSectionId = `brand-products-${slug}`;
  const brandLogo = slug === 'maison-margiela' ? MAISON_MARGIELA_LOGO_URL : meta.logo;
  const heroTextClass = heroTone === 'light' ? 'text-black' : 'text-white';
  const heroMutedTextClass = heroTone === 'light' ? 'text-black/70' : 'text-white/78';
  const heroIconButtonClass =
    heroTone === 'light'
      ? 'border-black/12 bg-white/55 text-black shadow-[0_12px_30px_rgba(255,255,255,0.16)] hover:bg-black hover:text-white'
      : 'border-white/20 bg-white/10 text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)] hover:bg-white hover:text-black';
  const heroSearchPanelClass =
    heroTone === 'light'
      ? 'border-black/12 bg-black/88 text-white'
      : 'border-white/20 bg-white/92 text-black';
  const heroSearchPlaceholderClass = heroTone === 'light' ? 'placeholder:text-white/45' : 'placeholder:text-black/35';
  const heroSearchIconClass = heroTone === 'light' ? 'text-white/55' : 'text-black/45';

  useEffect(() => {
    if (!heroFallbackImage || brandVideo) {
      setHeroTone('dark');
      return;
    }

    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        canvas.width = 24;
        canvas.height = 24;
        ctx.drawImage(img, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data;
        let sum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += getRelativeLuminance(data[i], data[i + 1], data[i + 2]);
          count += 1;
        }
        setHeroTone(sum / Math.max(1, count) > 0.58 ? 'light' : 'dark');
      } catch {
        setHeroTone('dark');
      }
    };
    img.onerror = () => {
      if (!cancelled) setHeroTone('dark');
    };
    img.src = heroFallbackImage;

    return () => {
      cancelled = true;
    };
  }, [brandVideo, heroFallbackImage]);

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
    <div className="bg-white">
      <section id="brand-hero" className="relative min-h-[100svh] overflow-hidden bg-black text-white">
        <div className="absolute inset-0">
          {brandVideo ? (
            <video
              className="h-full w-full object-cover"
              src={brandVideo}
              autoPlay
              muted
              loop
              playsInline
              poster={heroFallbackImage}
            />
          ) : (
            <img
              src={getOptimizedImageUrl(heroFallbackImage, { width: 1600, quality: 78 }) || heroFallbackImage}
              alt=""
              className="h-full w-full object-cover opacity-70 blur-[1px] scale-[1.03]"
              loading="eager"
              decoding="async"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />
        </div>

        <div className={`relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col px-5 py-5 sm:px-8 ${heroTextClass}`}>
          <div className="relative z-[60] flex items-center justify-between pt-[calc(env(safe-area-inset-top)+0.5rem)] md:pt-5">
            <Link
              href="/brands"
              className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-xl transition ${heroIconButtonClass}`}
              aria-label="Назад к брендам"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path fill="currentColor" d="M15.7 5.3a1 1 0 0 1 0 1.4L10.42 12l5.3 5.3a1 1 0 1 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.42 0Z" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={toggleFavorite}
              aria-pressed={isFav}
              aria-label={isFav ? 'Убрать бренд из избранного' : 'Добавить бренд в избранное'}
              className={`relative inline-flex h-12 w-12 items-center justify-center overflow-visible rounded-full border text-sm font-bold backdrop-blur-xl transition sm:w-auto sm:px-4 ${heroIconButtonClass}`}
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
              <svg viewBox="0 0 24 24" className={`h-4 w-4 ${isFav ? 'text-red-400' : 'text-current'}`} fill="currentColor" aria-hidden="true">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1.01 4.5 2.09C12.09 5.01 13.76 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className="hidden sm:inline">{isFav ? 'В избранном' : 'В избранное'}</span>
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center pb-16 pt-24 text-center sm:pb-20 sm:pt-28">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={`${brandName} logo`}
                className="max-h-28 w-[min(74vw,460px)] max-w-full object-contain sm:max-h-36"
              />
            ) : (
              <h1 className="max-w-4xl text-[clamp(2.8rem,12vw,7.2rem)] font-black uppercase leading-[0.86] tracking-[-0.07em]">
                {brandName}
              </h1>
            )}
            <div className={`mt-4 text-sm font-semibold sm:text-base ${heroMutedTextClass}`}>
              {brandName} · {items.length} {collectionLabel} · {categories.length || 1} {categoryLabel}
            </div>

            <div className="relative mt-7 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={openBrandSearch}
                className={`grid h-16 w-16 place-items-center rounded-full backdrop-blur-xl transition ${heroIconButtonClass}`}
                aria-label="Поиск по бренду"
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                  <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => document.getElementById(productsSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex h-16 min-w-[180px] items-center justify-center rounded-full bg-white px-8 text-lg font-black text-black shadow-[0_18px_45px_rgba(0,0,0,0.24)] transition hover:scale-[1.02]"
              >
                {items.length} товаров
              </button>
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                className={`grid h-16 w-16 place-items-center rounded-full backdrop-blur-xl transition ${heroIconButtonClass}`}
                aria-expanded={sortOpen}
                aria-label="Сортировка"
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                  <path fill="currentColor" d="M7 3a1 1 0 0 1 1 1v11.59l2.3-2.29a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L6 15.59V4a1 1 0 0 1 1-1Zm10.7 2.3 4 4a1 1 0 0 1-1.4 1.4L18 8.41V20a1 1 0 1 1-2 0V8.41l-2.3 2.29a1 1 0 1 1-1.4-1.4l4-4a1 1 0 0 1 1.4 0Z" />
                </svg>
              </button>

              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute bottom-[76px] right-0 z-30 max-h-[42svh] w-56 overflow-y-auto rounded-3xl border border-white/15 bg-black/78 p-2 text-left shadow-2xl backdrop-blur-xl md:bottom-auto md:top-[76px]"
                  >
                    {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setSortMode(mode);
                          setSortOpen(false);
                        }}
                        className={`block w-full rounded-2xl px-4 py-3 text-sm font-bold transition ${
                          sortMode === mode ? 'bg-white text-black' : 'text-white/78 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {SORT_LABELS[mode]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence initial={false}>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, width: 64 }}
                  animate={{ opacity: 1, y: 0, width: 'min(92vw,520px)' }}
                  exit={{ opacity: 0, y: -6, width: 64 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className={`mt-5 flex h-14 items-center gap-3 overflow-hidden rounded-full border px-5 shadow-2xl ${heroSearchPanelClass}`}
                >
                  <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${heroSearchIconClass}`} aria-hidden="true">
                    <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onBlur={() => window.setTimeout(() => setSearchOpen(false), 100)}
                    placeholder="Найти товар внутри бренда"
                    className={`w-full bg-transparent text-sm font-bold outline-none ${heroSearchPlaceholderClass}`}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <p className={`mx-auto mt-7 max-w-2xl text-center text-base font-semibold leading-6 line-clamp-2 sm:text-lg sm:leading-7 ${heroTone === 'light' ? 'text-black drop-shadow-[0_2px_10px_rgba(255,255,255,0.8)]' : 'text-white/92 drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]'}`}>
              {shortDescription}
              {brandDescription.length > shortDescription.length && (
                <button type="button" onClick={() => setInfoOpen(true)} className={`ml-2 text-sm font-black uppercase tracking-wide underline underline-offset-4 ${heroTone === 'light' ? 'text-black decoration-black/35' : 'text-white decoration-white/35'}`}>
                  Еще
                </button>
              )}
            </p>
          </div>
        </div>
      </section>

      <div className="relative z-20 -mt-36 h-40 bg-gradient-to-b from-transparent via-white/82 to-white pointer-events-none" />

      <div id={productsSectionId} className="relative z-30 -mt-24 mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_16px_45px_rgba(0,0,0,0.06)]">
          <div className="grid grid-cols-1 gap-0 divide-y divide-black/10 md:grid-cols-[1.1fr_0.9fr] md:divide-x md:divide-y-0">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-black/38">Коллекция</div>
                  <div className="mt-1 text-sm font-black text-black">{filtered.length} из {items.length} · {SORT_LABELS[sortMode]}</div>
                </div>
                {!!query && (
                  <button type="button" onClick={() => setQuery('')} className="rounded-full border border-black/10 px-3 py-2 text-xs font-bold text-black/55 hover:border-black/30 hover:text-black">
                    Сбросить поиск
                  </button>
                )}
              </div>
              {categories.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
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
        </div>

        <AnimatePresence>
          {infoOpen && (
            <motion.div
              className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInfoOpen(false)}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={`Описание бренда ${brandName}`}
                className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl rounded-t-[34px] bg-white px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5 text-black shadow-[0_-28px_90px_rgba(0,0,0,0.35)] sm:bottom-8 sm:rounded-[34px] sm:px-8 sm:pb-8"
                initial={{ y: '100%', opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0.6 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-black/15" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.26em] text-black/35">О бренде</div>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-5xl">{brandName}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInfoOpen(false)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/10 bg-black text-white transition hover:bg-white hover:text-black"
                    aria-label="Закрыть описание"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path fill="currentColor" d="M6.3 5.3a1 1 0 0 1 1.4 0l4.3 4.29 4.3-4.3a1 1 0 1 1 1.4 1.42L13.41 11l4.3 4.3a1 1 0 0 1-1.42 1.4L12 12.41l-4.3 4.3a1 1 0 0 1-1.4-1.42l4.29-4.3-4.3-4.29a1 1 0 0 1 0-1.4Z" />
                    </svg>
                  </button>
                </div>
                <p className="mt-5 text-base font-medium leading-8 text-black/72">{brandDescription}</p>
                {!!meta.tags?.length && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {meta.tags.filter((tag) => !/^video:/i.test(tag)).slice(0, 8).map((tag) => (
                      <span key={tag} className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-bold text-black/55">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  {String(item.description).trim().replace(/^(?:0|o|о)(?=[\s.,;:—\-\n])/i, "").replace(/^[\s.,;:—\-]+/, "").trim()}
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
      </div>
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
