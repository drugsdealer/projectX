

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type CategoryProduct = {
  id: string;
  name: string;
  price: number | null;
  imageUrl: string | null;
  images?: string[];
  brandName?: string | null;
  subcategory?: string | null;
};

type SortKey = 'new' | 'priceAsc' | 'priceDesc' | 'name';

function pickMainImage(p: CategoryProduct): string | null {
  const all = [p.imageUrl, ...(Array.isArray(p.images) ? p.images : [])].filter(
    (x): x is string => typeof x === 'string' && x.length > 0
  );
  if (!all.length) return null;
  // de-dup
  const uniq: string[] = [];
  for (const u of all) if (!uniq.includes(u)) uniq.push(u);
  return uniq[0] ?? null;
}

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return `${Number(price).toLocaleString('ru-RU')} ₽`;
}

export default function CategoryClient({
  slug,
  title,
  initialProducts,
}: {
  slug: string;
  title: string;
  initialProducts: CategoryProduct[];
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('new');
  const [activeSub, setActiveSub] = useState<string>('');
  const [pageSize, setPageSize] = useState(30);

  // derive available subcategories from data (only existing)
  const subcategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of initialProducts) {
      const s = String(p.subcategory ?? '').trim();
      if (!s) continue;
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [initialProducts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = initialProducts;

    if (activeSub) {
      const a = activeSub.toLowerCase();
      list = list.filter((p) => String(p.subcategory ?? '').toLowerCase() === a);
    }

    if (q) {
      list = list.filter((p) => {
        const n = String(p.name ?? '').toLowerCase();
        const b = String(p.brandName ?? '').toLowerCase();
        return n.includes(q) || b.includes(q);
      });
    }

    // sorting
    const sorted = [...list];
    if (sort === 'priceAsc') {
      sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (sort === 'priceDesc') {
      sorted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    } else if (sort === 'name') {
      sorted.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ru'));
    } else {
      // 'new' — keep server order
    }

    return sorted;
  }, [initialProducts, query, sort, activeSub]);

  const visible = useMemo(() => filtered.slice(0, pageSize), [filtered, pageSize]);

  // reset paging when filters change
  useEffect(() => {
    setPageSize(30);
  }, [query, sort, activeSub]);

  return (
    <div>
      {/* controls */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по товарам в категории…"
              className="h-11 w-full sm:w-[420px] rounded-full border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/25"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 rounded-full text-xs font-semibold text-black/60 hover:text-black"
              >
                Очистить
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-black/55">Сортировка:</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-11 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-black/70 outline-none focus:border-black/25"
            >
              <option value="new">Сначала новые</option>
              <option value="priceAsc">Цена: по возрастанию</option>
              <option value="priceDesc">Цена: по убыванию</option>
              <option value="name">По названию</option>
            </select>
          </div>
        </div>

        {/* subcategory chips */}
        {subcategories.length ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveSub('')}
              className={`h-9 px-4 rounded-full border text-xs font-semibold transition ${
                activeSub
                  ? 'border-black/10 bg-white text-black/60 hover:border-black/20'
                  : 'border-black bg-black text-white'
              }`}
            >
              Все
              <span className="ml-2 opacity-70">{initialProducts.length}</span>
            </button>
            {subcategories.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setActiveSub(s.name)}
                className={`h-9 px-4 rounded-full border text-xs font-semibold transition ${
                  activeSub === s.name
                    ? 'border-black bg-black text-white'
                    : 'border-black/10 bg-white text-black/60 hover:border-black/20'
                }`}
              >
                {s.name}
                <span className="ml-2 opacity-60">{s.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <div className="text-sm text-black/55">
            Показано: <span className="font-semibold text-black/70">{visible.length}</span> из{' '}
            <span className="font-semibold text-black/70">{filtered.length}</span>
          </div>

          {filtered.length > pageSize ? (
            <button
              type="button"
              onClick={() => setPageSize((x) => x + 30)}
              className="h-11 rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black/70 hover:border-black/20 hover:bg-black/[0.02] transition"
            >
              Показать ещё
            </button>
          ) : null}
        </div>
      </div>

      {/* grid */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {visible.map((p) => {
          const img = pickMainImage(p);
          const href = `/product/${p.id}`;

          return (
            <Link
              key={p.id}
              href={href}
              className="group relative overflow-hidden rounded-3xl border border-black/10 bg-white hover:border-black/20 transition"
            >
              <div className="relative aspect-[4/5]">
                <div className="absolute inset-0 bg-gradient-to-b from-white to-[#f3f3f3]" />

                {img ? (
                  <Image
                    src={img}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-contain p-6 drop-shadow-[0_25px_40px_rgba(0,0,0,0.20)] transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,0,0,0.08),transparent_60%),linear-gradient(to_bottom,#ffffff,#f3f3f3)]" />
                )}

                {/* hover overlay */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-t from-black/[0.55] via-black/[0.10] to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="pointer-events-none translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <div className="rounded-2xl bg-white/90 backdrop-blur border border-white/30 px-3 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                      <div className="text-[13px] font-semibold leading-tight line-clamp-2">{p.name}</div>
                      <div className="mt-1 text-[13px] font-bold">{formatPrice(p.price)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* empty state */}
      {filtered.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-black/10 bg-white p-6">
          <div className="text-lg font-extrabold tracking-tight">Ничего не нашли</div>
          <div className="mt-2 text-sm text-black/55">Попробуй изменить запрос или снять фильтр подкатегории.</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveSub('');
                setSort('new');
              }}
              className="h-11 rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black/70 hover:border-black/20 hover:bg-black/[0.02] transition"
            >
              Сбросить фильтры
            </button>
            <Link
              href="/search"
              className="h-11 inline-flex items-center rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black/70 hover:border-black/20 hover:bg-black/[0.02] transition"
            >
              Вернуться к поиску
            </Link>
          </div>
        </div>
      ) : null}

      {/* show more button at bottom too */}
      {filtered.length > pageSize ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setPageSize((x) => x + 30)}
            className="h-12 rounded-full border border-black/10 bg-white px-7 text-sm font-semibold text-black/70 hover:border-black/20 hover:bg-black/[0.02] transition"
          >
            Показать ещё
          </button>
        </div>
      ) : null}

      {/* small footer nav */}
      <div className="mt-10">
        <Link
          href="/search"
          className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-black/70 hover:border-black/20 hover:bg-black/[0.02] transition"
        >
          ← К поиску
        </Link>
      </div>
    </div>
  );
}