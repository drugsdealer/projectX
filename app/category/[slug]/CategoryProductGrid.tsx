'use client';

import { useCallback, useEffect, useMemo, useRef, useState, memo, type MutableRefObject } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

type CategoryProduct = {
  id: string;
  name: string;
  price: number | null;
  minPrice: number | null;
  images: string[];
};

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

const ProductCardImage = memo(function ProductCardImage({
  productId,
  imagesArr,
  alt,
  isTouchDevice,
  lastSwipeRef,
}: {
  productId: string;
  imagesArr: string[];
  alt: string;
  isTouchDevice: boolean;
  lastSwipeRef: MutableRefObject<{ id: string | null; ts: number }>;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right'>('left');
  const [touchActionMode, setTouchActionMode] = useState<'pan-y' | 'none'>('pan-y');
  const activeIdxRef = useRef(0);
  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);
  const swipeStateRef = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    lastStepTs: number;
    pointerId: number | null;
    intent: 'h' | 'v' | null;
  }>({ startX: 0, startY: 0, active: false, lastStepTs: 0, pointerId: null, intent: null });

  useEffect(() => {
    setActiveIdx((prev) => {
      const max = Math.max(0, (imagesArr?.length || 1) - 1);
      const next = Math.min(Math.max(prev, 0), max);
      activeIdxRef.current = next;
      return next;
    });
  }, [imagesArr]);

  const activeSrc = imagesArr?.[activeIdx] || imagesArr?.[0] || '/img/placeholder.png';

  const prefetchAround = useCallback(
    (idx: number) => {
      try {
        if (typeof window === 'undefined') return;
        if (!Array.isArray(imagesArr) || imagesArr.length <= 1) return;
        const nextSrc = imagesArr[Math.min(idx + 1, imagesArr.length - 1)];
        const prevSrc = imagesArr[Math.max(idx - 1, 0)];
        [nextSrc, prevSrc].forEach((src) => {
          if (!src) return;
          const img = new window.Image();
          img.src = src;
        });
      } catch {}
    },
    [imagesArr]
  );

  return (
    <div
      className="relative aspect-[4/5] bg-white overflow-hidden"
      style={{ touchAction: isTouchDevice ? touchActionMode : undefined, WebkitUserSelect: 'none', userSelect: 'none' }}
      onMouseMove={(e) => {
        if (isTouchDevice) return;
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
        if (isTouchDevice) return;
        if (!imagesArr?.length || imagesArr.length === 1) return;
        if (activeIdx === 0) return;
        setSwipeDir('right');
        setActiveIdx(0);
      }}
      onPointerDown={(e) => {
        if (!isTouchDevice) return;
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        if (!imagesArr?.length || imagesArr.length === 1) return;
        setTouchActionMode('pan-y');
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
        prefetchAround(activeIdx);
      }}
      onPointerMove={(e) => {
        if (!isTouchDevice) return;
        const st = swipeStateRef.current;
        if (!st.active) return;
        if (st.pointerId !== null && e.pointerId !== st.pointerId) return;
        if (!imagesArr?.length || imagesArr.length === 1) return;

        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;

        if (st.intent === null) {
          const slop = 10;
          if (Math.abs(dx) < slop && Math.abs(dy) < slop) return;
          st.intent = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
          if (st.intent === 'h') setTouchActionMode('none');
        }

        if (st.intent === 'v') return;

        e.preventDefault();
        e.stopPropagation();

        const threshold = 72;
        if (Math.abs(dx) < threshold) return;

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
          prefetchAround(nextIdx);
          lastSwipeRef.current = { id: productId, ts: Date.now() };
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
        setTouchActionMode('pan-y');
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
        setTouchActionMode('pan-y');
      }}
      onLostPointerCapture={() => {
        swipeStateRef.current.active = false;
        swipeStateRef.current.lastStepTs = 0;
        swipeStateRef.current.pointerId = null;
        swipeStateRef.current.intent = null;
        setTouchActionMode('pan-y');
      }}
    >
      <AnimatePresence initial={false} mode="sync" custom={swipeDir}>
        <motion.div
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
          className="absolute inset-0 transform-gpu"
          style={{ willChange: 'transform, clip-path' }}
        >
          <Image
            src={activeSrc}
            alt={alt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
            priority={false}
          />
        </motion.div>
      </AnimatePresence>

      {imagesArr.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none">
          {imagesArr.map((_: string, i: number) => (
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
});

export default function CategoryProductGrid({ products }: { products: CategoryProduct[] }) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'new' | 'price-asc' | 'price-desc'>('new');
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const lastSwipeRef = useRef<{ id: string | null; ts: number }>({ id: null, ts: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const coarse =
        (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches) ||
        (navigator as any)?.maxTouchPoints > 0 ||
        ('ontouchstart' in window);
      setIsTouchDevice(!!coarse);
    };
    compute();
    try {
      const mql = window.matchMedia('(pointer: coarse)');
      const onChange = () => compute();
      if (mql?.addEventListener) mql.addEventListener('change', onChange);
      else if ((mql as any)?.addListener) (mql as any).addListener(onChange);
      return () => {
        if (mql?.removeEventListener) mql.removeEventListener('change', onChange);
        else if ((mql as any)?.removeListener) (mql as any).removeListener(onChange);
      };
    } catch {
      return;
    }
  }, []);

  const parsedMin = Number(String(minInput).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  const parsedMax = Number(String(maxInput).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const nameOk = !q || String(p.name ?? '').toLowerCase().includes(q);
      if (!nameOk) return false;

      const priceValue = p.minPrice ?? p.price ?? 0;
      const hasPrice = Number.isFinite(priceValue) && priceValue > 0;
      const minOk = !parsedMin || (hasPrice && priceValue >= parsedMin);
      const maxOk = !parsedMax || (hasPrice && priceValue <= parsedMax);
      return minOk && maxOk;
    });
  }, [products, query, parsedMin, parsedMax]);

  const sortedProducts = useMemo(() => {
    if (sort === 'new') return filteredProducts;

    const list = [...filteredProducts];
    if (sort === 'price-asc') {
      list.sort((a, b) => {
        const av = a.minPrice ?? a.price ?? Number.POSITIVE_INFINITY;
        const bv = b.minPrice ?? b.price ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
    } else {
      list.sort((a, b) => {
        const av = a.minPrice ?? a.price ?? Number.NEGATIVE_INFINITY;
        const bv = b.minPrice ?? b.price ?? Number.NEGATIVE_INFINITY;
        return bv - av;
      });
    }
    return list;
  }, [filteredProducts, sort]);

  useEffect(() => {
    setVisibleCount(20);
  }, [query, sort, minInput, maxInput]);

  const visibleProducts = sortedProducts.slice(0, visibleCount);

  return (
    <div className="mt-10">
      <div className="sticky top-3 z-20 rounded-2xl border border-black/10 bg-white/95 p-3 sm:p-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск внутри категории"
              className="h-11 w-full rounded-full border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/30"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border border-black/10 text-xs text-black/50 hover:text-black transition"
                aria-label="Очистить поиск"
              >
                ×
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'new' | 'price-asc' | 'price-desc')}
              className="h-11 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold"
            >
              <option value="new">Сначала новые</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
            </select>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="h-11 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold hover:bg-black/[0.03] transition sm:hidden"
            >
              Фильтры
            </button>
          </div>
        </div>

        <div className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto] ${filtersOpen ? 'grid' : 'hidden sm:grid'}`}>
          <input
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            inputMode="numeric"
            placeholder="Цена от"
            className="h-10 rounded-full border border-black/10 bg-white px-3 text-sm outline-none focus:border-black/30"
          />
          <input
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            inputMode="numeric"
            placeholder="Цена до"
            className="h-10 rounded-full border border-black/10 bg-white px-3 text-sm outline-none focus:border-black/30"
          />
          <button
            type="button"
            onClick={() => {
              setMinInput('');
              setMaxInput('');
            }}
            className="h-10 rounded-full border border-black/10 px-4 text-sm font-semibold hover:bg-black/[0.03] transition"
          >
            Сбросить
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-black/50">
          <span>Показано: {visibleProducts.length} из {sortedProducts.length}</span>
          {query || minInput || maxInput ? <span>Фильтры активны</span> : <span>Без фильтров</span>}
        </div>
      </div>

      {sortedProducts.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/60">
          Ничего не найдено. Попробуй изменить запрос или фильтры.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
          {visibleProducts.map((p) => {
        const priceValue = p.minPrice ?? p.price ?? 0;
        const priceLabel =
          Number.isFinite(priceValue) && priceValue > 0
            ? `от ${Number(priceValue).toLocaleString('ru-RU')} ₽`
            : 'Цена по запросу';

        return (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="group overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(0,0,0,0.12)]"
              onClickCapture={(e) => {
                if (!isTouchDevice) return;
                const s = lastSwipeRef.current;
                if (s?.id === String(p.id) && Date.now() - s.ts < 600) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              <ProductCardImage
                productId={String(p.id)}
                imagesArr={p.images}
                alt={p.name || 'Товар'}
                isTouchDevice={isTouchDevice}
                lastSwipeRef={lastSwipeRef}
              />

              <div className="p-3 sm:p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-black/35">Подборка</div>
                <div className="mt-1 text-sm font-semibold leading-snug line-clamp-2">{p.name}</div>
                <div className="mt-2 text-sm font-bold">{priceLabel}</div>
              </div>
            </Link>
          );
        })}
        </div>
      )}

      {visibleProducts.length < sortedProducts.length ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((v) => Math.min(v + 20, sortedProducts.length))}
            className="h-12 px-6 rounded-full border border-black/10 bg-white text-sm font-semibold hover:bg-black/[0.03] transition"
          >
            Показать ещё
          </button>
        </div>
      ) : null}
    </div>
  );
}
