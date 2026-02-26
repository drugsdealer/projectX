'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { ProductWithImages } from './types';
import { useUser } from '@/user/UserContext';
import { AnimatePresence, motion } from 'framer-motion';
import { trackShopEvent } from '@/lib/events-client';

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
  logo?: string;
  about?: string;
  aboutLong?: string;
  tags?: string[];
}

interface BrandClientProps {
  items: ProductWithImages[];
  meta: BrandMeta;
  brandName: string;
  slug: string;
  brandId: number;
}

// === component =================================================
export default function BrandClient({
  items,
  meta,
  brandName,
  slug,
  brandId,
}: BrandClientProps) {
  const [limit, setLimit] = useState(12);
  const [isFav, setIsFav] = useState(false);
  const [authWarn, setAuthWarn] = useState(false);
  const { user } = useUser?.() || {};

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

  useEffect(() => {
    const eventKey = `brand-clicked:${brandId}`;
    try {
      if (sessionStorage.getItem(eventKey)) return;
      sessionStorage.setItem(eventKey, "1");
    } catch {
      // ignore storage issues and still emit best effort
    }

    void trackShopEvent({
      eventType: "BRAND_CLICK",
      pageUrl: `/brand/${encodeURIComponent(slug)}`,
      metadata: {
        brandId,
        brandSlug: slug,
        brandName,
      },
    }).catch(() => {});
  }, [brandId, brandName, slug]);

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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-6">
          {meta.logo && (
            <img src={meta.logo} alt={`${brandName} logo`} className="h-12 w-auto" />
          )}
          <div>
            <h1 className="text-3xl font-bold">{brandName}</h1>
            {meta.about && <p className="text-gray-600 mt-1">{meta.about}</p>}
            {Array.isArray(meta.tags) && meta.tags.length > 0 && (
              <div className="mt-2 flex gap-2">
                {meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 bg-gray-100 rounded-full border border-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleFavorite}
          aria-pressed={isFav}
          aria-label={isFav ? 'Убрать бренд из избранного' : 'Добавить бренд в избранное'}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
            isFav
              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 ${isFav ? 'text-red-600' : 'text-gray-500'}`}
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1.01 4.5 2.09C12.09 5.01 13.76 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span className="font-medium">
            {isFav ? 'В избранном' : 'Добавить в избранное'}
          </span>
        </button>
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

      {items.length === 0 && (
        <div className="text-sm text-gray-500 py-8">Пока нет товаров этого бренда.</div>
      )}

      {/* Сетка карточек товаров */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.slice(0, limit).map((item) => (
          <Link key={item.id} href={`/product/${item.id}`} className="border rounded-xl overflow-hidden shadow-sm block hover:-translate-y-0.5 transition">
            <div className="relative w-full h-64 bg-gray-100">
              <img
                src={
                  (Array.isArray(item.images) ? item.images[0] : undefined) ||
                  item.imageUrl ||
                  '/img/placeholder.png'
                }
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold line-clamp-2">{item.name}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {item.price != null ? `${item.price.toLocaleString('ru-RU')}₽` : '—'}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {items.length > limit && (
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
  );
}
