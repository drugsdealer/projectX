'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/user/UserContext';
import { createPortal } from 'react-dom';

// ===== localStorage helpers (merge two keys for back-compat) =====
const LS_KEY = 'favoriteBrands';
const LS_KEY_COMPAT = 'fav_brands';
function readFavSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const a = localStorage.getItem(LS_KEY);
    const b = localStorage.getItem(LS_KEY_COMPAT);
    const arrA: unknown = a ? JSON.parse(a) : [];
    const arrB: unknown = b ? JSON.parse(b) : [];
    const A = Array.isArray(arrA) ? arrA : [];
    const B = Array.isArray(arrB) ? arrB : [];
    const merged = [...A, ...B].filter((x): x is string => typeof x === 'string');
    const uniq: string[] = [];
    for (const s of merged) if (!uniq.includes(s)) uniq.push(s);
    return uniq;
  } catch {
    return [];
  }
}
function writeFavSlugs(slugs: string[]) {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(slugs);
    localStorage.setItem(LS_KEY, json);
    localStorage.setItem(LS_KEY_COMPAT, json);
  } catch {}
}

// ===== types for UI =====
interface FavoriteBrand {
  slug: string;
  name: string;
  logoUrl?: string | null;
  logo?: string | null;
  description?: string | null;
  isPremium?: boolean;
  isOfficialBrand?: boolean;
  tags?: string[];
}

// Cloudinary фолбэки для основных брендов, если API не вернул logoUrl
const BRAND_LOGO_FALLBACKS: Record<string, string> = {
  adidas: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/Adidas_Logo_Alternative_2_2_l0avvn.webp',
  nike: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/nike_bkpkj3.png',
  puma: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/puma_kz0bjl.png',
  reebok: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/reebok_kfdl0e.png',
  'new-balance': 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/newbalance_v4lovh.png',
  'chrome-hearts': 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/chromehearts_iwxxvz.png',
  'stone-island': 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/stoneisland_nhhazi.png',
  converse: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/converse_ddr6ot.png',
  'louis-vuitton': 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761174359/LV_khvkyh.svg',
  supreme: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176286/idiZv-aD8G_logos_qrn7qg.png',
};

// prettify name from slug if API not available
const nameFromSlug = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');

const getDisplayName = (b: FavoriteBrand) => b.name || nameFromSlug(b.slug);
const getLogoUrl = (b: FavoriteBrand) => {
  const slug = (b.slug || '').toLowerCase();
  return b.logoUrl || b.logo || BRAND_LOGO_FALLBACKS[slug];
};

// read userId from cookies or localStorage (best-effort)
function getUserIdFromClient(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const m = document.cookie.match(/(?:^|; )(?:userId|userid|uid)=([^;]+)/i);
    if (m) return decodeURIComponent(m[1]);
    const ls =
      localStorage.getItem('userId') ||
      localStorage.getItem('userid') ||
      localStorage.getItem('uid') ||
      localStorage.getItem('currentUserId');
    if (ls && /^\d+$/.test(ls)) return ls;
  } catch {}
  return null;
}

export default function FavoritesBrands() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [brands, setBrands] = useState<FavoriteBrand[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<FavoriteBrand | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // current user (for showing first name in the header)
  const { user } = useUser();
  const firstName = useMemo(() => {
    try {
      const raw = (user?.name || (user as any)?.fullName || '').toString().trim();
      return raw ? raw.split(/\s+/)[0] : '';
    } catch {
      return '';
    }
  }, [user]);

  // read from localStorage on mount
  useEffect(() => {
    setSlugs(readFavSlugs());
  }, []);

  // react on cross-tab updates
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setSlugs(readFavSlugs());
    };
    window.addEventListener('storage', onStorage);
    const onFavUpdate = () => setSlugs(readFavSlugs());
    window.addEventListener('favorites:brands:update', onFavUpdate as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('favorites:brands:update', onFavUpdate as EventListener);
    };
  }, []);

  // try server-backed favorites first; fallback to localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const _uid = getUserIdFromClient();

      try {
        const res = await fetch(`/api/favorites/brands${_uid ? `?userId=${encodeURIComponent(_uid)}` : ''}`, {
          credentials: 'include',
          headers: {
            ...(_uid ? { 'x-user-id': String(_uid) } : {}),
          },
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { items?: FavoriteBrand[] };
          if (Array.isArray(data?.items) && data.items.length > 0) {
            setBrands(data.items);
            setLoading(false);
            return;
          }
        }
      } catch {}

      // fallback to minimal cards from local slugs
      const current = slugs.length ? slugs : readFavSlugs();
      const minimal = current.map<FavoriteBrand>((slug) => ({ slug, name: nameFromSlug(slug) }));
      if (!cancelled) {
        setBrands(minimal);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slugs]);

  // close confirm modal by Escape
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmOpen]);

  useEffect(() => {
    if (!removeTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRemoveTarget(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [removeTarget]);

  const removeSlug = async (slug: string) => {
    const next = slugs.filter((s) => s !== slug);
    setSlugs(next);
    writeFavSlugs(next);
    // best-effort server sync
    const _uid = getUserIdFromClient();
    fetch('/api/favorites/brands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(_uid ? { 'x-user-id': String(_uid) } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ slug, action: 'remove', userId: _uid ? Number(_uid) : undefined }),
    }).catch(() => {});
  };

  const clearAll = async () => {
    const current = [...slugs];
    setIsClearing(true);
    setSlugs([]);
    writeFavSlugs([]);
    const _uid = getUserIdFromClient();
    try {
      await Promise.all(
        current.map((s) =>
          fetch('/api/favorites/brands', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(_uid ? { 'x-user-id': String(_uid) } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({ slug: s, action: 'remove', userId: _uid ? Number(_uid) : undefined }),
          }).catch(() => undefined)
        )
      );
    } finally {
      setIsClearing(false);
    }
  };

  const total = brands?.length ?? 0;
  const filtered = useMemo(() => {
    if (!brands) return [] as FavoriteBrand[];
    const q = query.trim().toLowerCase();
    const list = q
      ? brands.filter((b) => getDisplayName(b).toLowerCase().includes(q))
      : brands;
    const sorted = [...list].sort((a, b) =>
      sortAsc
        ? getDisplayName(a).localeCompare(getDisplayName(b))
        : getDisplayName(b).localeCompare(getDisplayName(a))
    );
    return sorted;
  }, [brands, query, sortAsc]);
  const count = filtered.length;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mr-auto">
            Избранные бренды{firstName ? <span className="text-gray-400 font-normal"> — {firstName}</span> : null}
          </h1>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-full md:w-80">
              <label htmlFor="brand-search" className="sr-only">Поиск бренда</label>
              <div className="h-12 rounded-2xl border border-gray-200 bg-white px-4 flex items-center gap-2 focus-within:border-gray-300">
                <svg
                  className="shrink-0 h-5 w-5 text-gray-400"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input
                  id="brand-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск бренда..."
                  className="w-full bg-transparent outline-none text-base leading-none placeholder:text-gray-400"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="text-gray-400 hover:text-gray-600 text-sm"
                    aria-label="Сбросить поиск"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setSortAsc((v) => !v)}
              className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-sm border border-gray-200 bg-white hover:border-gray-300"
              aria-pressed={sortAsc}
              aria-label="Сменить сортировку"
              title={sortAsc ? 'Сейчас: A→Z' : 'Сейчас: Z→A'}
            >
              {sortAsc ? 'A → Z' : 'Z → A'}
            </button>

            {total > 0 && (
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={isClearing}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-gray-200 hover:border-gray-300 bg-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                aria-haspopup="dialog"
                aria-expanded={confirmOpen}
              >
                Очистить все
              </button>
            )}
          </div>
        </div>

        <p className="text-gray-500 mt-2">
          {total === 0
            ? 'Пока пусто — добавляйте бренды в избранное на странице бренда.'
            : query
            ? `Найдено ${count} из ${total}`
            : `${total} бренда(ов)`}
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 mb-4 flex items-center justify-center">
            <span className="text-2xl">☆</span>
          </div>
          <p className="text-gray-600 max-w-md">
            У вас пока нет избранных брендов. Откройте страницу бренда и нажмите кнопку
            <span className="mx-1 font-semibold">«Добавить в избранное»</span>.
          </p>
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-600">
          <p>Ничего не найдено по запросу «{query}».</p>
          <button onClick={() => setQuery('')} className="mt-3 text-sm underline">
            Сбросить поиск
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((b) => (
            <div key={b.slug} className="group relative rounded-xl p-6 hover:bg-gray-50 transition">
              <button
                onClick={() => setRemoveTarget(b)}
                className="absolute top-2 right-2 text-xs text-gray-400 hover:text-red-500"
                aria-label={`Удалить ${b.name} из избранного`}
                title="Убрать из избранного"
              >
                Удалить
              </button>

              <Link href={`/brand/${encodeURIComponent(b.slug)}`} className="flex flex-col items-center text-center select-none">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32">
                  {getLogoUrl(b) ? (
                    <img
                      src={getLogoUrl(b) || ''}
                      alt={getDisplayName(b)}
                      className="absolute inset-0 w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-3xl font-semibold">
                      {getDisplayName(b).split(' ').slice(0, 2).map((p) => p[0]).join('')}
                    </span>
                  )}
                </div>

                <div className="mt-4 relative min-h-[1.5rem]">
                  <span className="block font-medium tracking-tight group-hover:opacity-0 transition-opacity duration-150">
                    {getDisplayName(b)}
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 font-semibold">
                    Перейти к бренду <span aria-hidden className="ml-1">→</span>
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
      {mounted && confirmOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              aria-labelledby="confirm-title"
              role="dialog"
              aria-modal="true"
              onClick={() => setConfirmOpen(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

              {/* Dialog */}
              <div
                className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6">
                  <h3 id="confirm-title" className="text-lg font-semibold tracking-tight">
                    Удалить все избранные бренды?
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Вы уверены, что хотите удалить все бренды из избранного? Это действие нельзя отменить.
                  </p>
                </div>
                <div className="px-6 pb-6 pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 hover:border-gray-300"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await clearAll();
                      setConfirmOpen(false);
                    }}
                    disabled={isClearing}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isClearing ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        Удаляю…
                      </span>
                    ) : (
                      'Удалить'
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && removeTarget
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              aria-labelledby="remove-brand-title"
              role="dialog"
              aria-modal="true"
              onClick={() => !isRemoving && setRemoveTarget(null)}
            >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div
                className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6">
                  <h3 id="remove-brand-title" className="text-lg font-semibold tracking-tight">
                    Удалить бренд из избранного?
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {removeTarget.name || getDisplayName(removeTarget)} будет убран из ваших избранных брендов.
                  </p>
                </div>
                <div className="px-6 pb-6 pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => !isRemoving && setRemoveTarget(null)}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-200 hover:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isRemoving}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!removeTarget) return;
                      setIsRemoving(true);
                      await removeSlug(removeTarget.slug);
                      setIsRemoving(false);
                      setRemoveTarget(null);
                    }}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isRemoving}
                  >
                    {isRemoving ? 'Удаляю…' : 'Удалить'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
