'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useParams } from 'next/navigation';
import { products } from '@/data/products';

// ==== helpers ====
 type SortKey = 'popular' | 'price_asc' | 'price_desc' | 'new';
 const STORAGE_KEY = 'brand_page_state';

 function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
 }
 function deslugify(s: string) {
  return s.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
 }

type BrandMeta = {
  logo?: string;
  about?: string;
  mark?: string;
  aboutLong?: string;
  tags?: string[];
};

const BRAND_META: Record<string, BrandMeta> = {
  'chanel': {
    logo: '/img/brands/chanel.png',
    about: 'Chanel — французский Дом высокой моды, основанный Габриэль “Коко” Шанель. Бренд сформировал современный язык роскоши: лаконичность, твид, маленькое чёрное платье и культовые аксессуары.',
    mark: 'Ｃ',
    aboutLong: 'Chanel продолжает влиять на моду и культуру, оставаясь символом элегантности и инноваций. От парфюмерии до одежды — бренд воплощает дух свободы и женственности.',
    tags: ['Премиум', 'Хит', 'Эксклюзив']
  },
  'maison-margiela': {
    logo: '/img/brands/maison-margiela.png',
    about: 'Maison Margiela — парижский Дом, известный деконструкцией и авангардом. Переосмысляет коды одежды через экспериментальные силуэты и материалы.',
    tags: ['Авангард', 'Эксперимент']
  },
  'rick-owens': {
    logo: '/img/Rick-Owens-Logo.png',
    about: 'Rick Owens — тёмный гламур, брутальная пластика и скульптурные формы. Архитектурные силуэты и беспощадный минимализм.',
    mark: 'Ｒ',
    aboutLong: 'Rick Owens задаёт новые стандарты в мире моды, сочетая андрогинность с драматизмом. Его работы — это исследование формы и функции в одежде.',
    tags: ['Премиум', 'Авангард', 'Хит']
  },
  'balenciaga': {
    logo: '/img/баленса лого.png',
    about: 'Balenciaga — радикальные пропорции и острые эксперименты. Бренд с богатым наследием высокой моды и дерзкими современными интерпретациями.',
    mark: 'Ｂ',
    aboutLong: 'Balenciaga известен своими инновационными подходами к дизайну, смешивая уличный стиль с высокой модой, создавая уникальные и запоминающиеся коллекции.',
    tags: ['Эксклюзив', 'Хит']
  },
  'gucci': {
    logo: '/img/brands/gucci.png',
    about: 'Gucci — итальянская эклектика и богатые декоративные коды. Сочетание классики и иронии, узнаваемые монограммы и качественные материалы.',
    mark: 'Ｇ',
    aboutLong: 'Gucci остаётся одним из самых влиятельных домов моды, объединяя традиции и современность через яркие и эклектичные коллекции.'
  },
  'prada': {
    logo: '/img/brands/prada.png',
    about: 'Prada — интеллектуальная мода из Милана. Чистые линии, техничные ткани и ироничная строгость.',
    mark: 'Ｐ',
    aboutLong: 'Prada сочетает инновации и классику, создавая одежду, которая балансирует между искусством и функциональностью, задавая тренды мировой моды.'
  },
  'saint-laurent': {
    logo: '/img/brands/saint-laurent.png',
    about: 'Saint Laurent — парижская острота и рок-н-ролльная элегантность. Смокинг для женщин и безупречные линии.',
    mark: 'Ｓ',
    aboutLong: 'Saint Laurent воплощает дух свободы и бунтарства, сочетая рок-н-ролльную эстетику с утончённым стилем, который вдохновляет поколения.'
  },
  'goyard': {
    logo: '/img/Logo_Goyard.png',
    about: 'Goyard — редкость и ремесло. Легендарный монограммный рисунок и культовые дорожные аксессуары.',
    mark: 'Ｇ',
    aboutLong: 'Goyard славится своим мастерством и эксклюзивностью, предлагая изделия, которые являются символом статуса и безупречного вкуса.'
  },
  'dior': {
    logo: '/img/dior logo.svg.png',
    about: 'Dior — наследие Haute Couture и “New Look”. Современная элегантность и культовые аксессуары.',
    mark: 'Ｄ',
    aboutLong: 'Dior продолжает переопределять женственность и роскошь, сочетая традиции высокой моды с современными тенденциями и инновациями.'
  },
  'vetements': {
    logo: '/img/brands/vetements.png',
    about: 'Vetements — постирония и большие формы. Свежий взгляд на уличную моду премиум-сегмента.',
    mark: 'Ｖ',
    aboutLong: 'Vetements бросает вызов традиционным нормам моды, создавая авангардные и провокационные коллекции, которые отражают дух времени.'
  }
};

// ==== page ====
export default function BrandPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const origin = search.get('origin') || '';
  const brandName = useMemo(() => deslugify(params.slug), [params.slug]);
  const brandSlug = useMemo(() => slugify(brandName), [brandName]);
  const meta = BRAND_META[brandSlug] || {};

  // отбираем товары бренда с учётом разных полей в источнике
  const brandItems = useMemo(() => {
    const norm = (s: string) => s?.toLowerCase().trim();
    const target = norm(brandName);
    return products.filter((p: any) => {
      const rawBrand: any = p.brand ?? (Array.isArray(p.brands) ? p.brands[0] : undefined) ?? p.brandName;
      const pb = rawBrand ? norm(String(rawBrand)) : '';
      if (pb) return pb === target;
      const name = norm(p.name || '');
      return !!name && name.includes(target);
    });
  }, [brandName]);

  // доступные подкатегории, минимум и максимум цены для фильтров
  const { subcats, minPrice, maxPrice } = useMemo(() => {
    const s = new Set<string>();
    let max = 0;
    let min = Number.POSITIVE_INFINITY;
    for (const p of brandItems as any[]) {
      if (p.subcategory) s.add(String(p.subcategory));
      if (typeof p.price === 'number') {
        max = Math.max(max, p.price);
        min = Math.min(min, p.price);
      }
    }
    if (!isFinite(min)) min = 0;
    return { subcats: Array.from(s), minPrice: min, maxPrice: max };
  }, [brandItems]);

  // ==== UI state
  const [sort, setSort] = useState<SortKey>('popular');
  const [limit, setLimit] = useState(12);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [priceCap, setPriceCap] = useState<number>(maxPrice || 0);
  const [follow, setFollow] = useState(false);
  const [favPulse, setFavPulse] = useState(false);

  // hydrate state from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[brandSlug]) {
          const st = parsed[brandSlug];
          setActiveSub(st.activeSub ?? null);
          if (typeof st.priceCap === 'number') setPriceCap(st.priceCap);
          setFollow(!!st.follow);
        }
      }
    } catch {}
    try {
      const favRaw = localStorage.getItem('favorite_brands');
      if (favRaw) {
        const favs = JSON.parse(favRaw) as string[];
        if (Array.isArray(favs) && favs.includes(brandSlug)) setFollow(true);
      }
    } catch {}
  }, [brandSlug]);

  // persist state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[brandSlug] = { activeSub, priceCap, follow };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
    try {
      const favRaw = localStorage.getItem('favorite_brands');
      let favs: string[] = favRaw ? JSON.parse(favRaw) : [];
      if (!Array.isArray(favs)) favs = [];
      const has = favs.includes(brandSlug);
      if (follow && !has) favs.push(brandSlug);
      if (!follow && has) favs = favs.filter(s => s !== brandSlug);
      localStorage.setItem('favorite_brands', JSON.stringify(favs));
    } catch {}
  }, [brandSlug, activeSub, priceCap, follow]);

  // сбросить кап, когда поменялся минимум/максимум
  useEffect(() => {
    if (!maxPrice && !minPrice) return;
    setPriceCap((prev) => {
      const base = (prev ?? maxPrice) as number;
      const lo = (minPrice ?? 0) as number;
      const hi = (maxPrice ?? 0) as number;
      const clamped = Math.min(Math.max(base, lo), hi);
      return clamped;
    });
  }, [minPrice, maxPrice]);

  // применяем фильтры
  const filtered = useMemo(() => {
    let arr = [...brandItems] as any[];
    if (activeSub) arr = arr.filter(p => (p.subcategory || '').toString() === activeSub);
    if (priceCap) arr = arr.filter(p => (p.price || 0) <= priceCap);
    return arr;
  }, [brandItems, activeSub, priceCap]);

  // сортировка
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case 'price_asc':
        arr.sort((a: any, b: any) => (a.price ?? 0) - (b.price ?? 0));
        break;
      case 'price_desc':
        arr.sort((a: any, b: any) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case 'new':
        arr.sort((a: any, b: any) => (b.id ?? 0) - (a.id ?? 0));
        break;
      default:
        arr.sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0));
    }
    return arr;
  }, [filtered, sort]);

  const visible = sorted.slice(0, limit);

  return (
    <div className="max-w-6xl mx-auto px-4 pb-16">
      {/* header + hero */}
      <div className="pt-10" />
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:underline">Главная</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{brandName}</span>
      </nav>

      <header className="relative mb-10">
        {/* мягкий фон/водяной знак */}
        <span className="pointer-events-none select-none absolute inset-0 flex items-center justify-center text-[26vw] md:text-[18vw] font-black tracking-tighter text-black/5 dark:text-white/5">
          {meta.mark || brandName[0]}
        </span>

        {/* стеклянная карточка бренда */}
        <div className="relative backdrop-blur-xl bg-white/60 dark:bg-white/10 border border-white/40 shadow-xl rounded-3xl px-6 sm:px-10 py-8 overflow-hidden">
          <div className="absolute -inset-20 bg-gradient-to-br from-black/5 to-transparent rounded-3xl" />
          <div className="relative flex flex-col items-center gap-4">
            <div className="relative w-56 h-20 md:w-72 md:h-24">
              {meta.logo && (
                <Image src={meta.logo} alt={brandName} fill className="object-contain" />
              )}
            </div>
            {meta.about && (
              <p className="max-w-3xl text-center text-gray-700 leading-relaxed">{meta.about}</p>
            )}
            {meta.aboutLong && (
              <p className="max-w-3xl text-center text-gray-600 leading-relaxed">{meta.aboutLong}</p>
            )}
            {/* tags */}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {(meta.tags || ['Премиум','Хит','Эксклюзив']).map((t) => (
                <span key={t} className="px-3 py-1 rounded-full text-xs font-semibold bg-black text-white">
                  {t}
                </span>
              ))}
            </div>

            {/* actions */}
            <div className="mt-2 flex items-center justify-center">
              <button
                onClick={() => {
                  setFollow(v => !v);
                  setFavPulse(true);
                  window.setTimeout(() => setFavPulse(false), 800);
                }}
                className={`relative overflow-visible h-11 px-5 rounded-xl border text-sm font-medium transition will-change-transform ${(
                  follow ?
                  'bg-black text-white border-black hover:bg-gray-800' :
                  'bg-white/70 hover:bg-white border-gray-300'
                )}`}
              >
                {/* animated ring */}
                {favPulse && (<span className="pulse-ring" />)}

                {/* sparkles burst */}
                {favPulse && (
                  <span className="spark-wrap" aria-hidden>
                    <span className="spark s1" />
                    <span className="spark s2" />
                    <span className="spark s3" />
                    <span className="spark s4" />
                    <span className="spark s5" />
                    <span className="spark s6" />
                  </span>
                )}

                {/* icon + label */}
                <span className="inline-flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 ${follow ? 'icon-pop' : ''}`}
                    viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                  </svg>
                  <span>{follow ? 'В избранных брендах' : 'Добавить в избранные'}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* sticky панель фильтров */}
      <div className="sticky top-16 z-30">
        <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm px-4 sm:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* chips подкатегорий */}
            {subcats.map(s => (
              <button
                key={s}
                onClick={() => setActiveSub(prev => prev === s ? null : s)}
                className={`px-3 h-9 rounded-full text-sm border transition ${activeSub===s? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50 border-gray-300'}`}
              >{s}</button>
            ))}
          </div>

          {/* price + sort */}
          <div className="flex items-center gap-4">
            {!!maxPrice && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 whitespace-nowrap">До</span>
                <input
                  type="range"
                  min={minPrice || 0}
                  max={maxPrice || 0}
                  step={1}
                  value={priceCap ?? maxPrice}
                  onChange={(e) => setPriceCap(Number(e.target.value))}
                  className="range-black w-56 sm:w-72"
                />
                <span className="text-sm font-medium">{(priceCap||maxPrice).toLocaleString('ru-RU')}₽</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Сортировка:</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 rounded-xl border border-gray-200 px-3 text-sm bg-white"
              >
                <option value="popular">Популярное</option>
                <option value="price_asc">Сначала дешёвые</option>
                <option value="price_desc">Сначала дорогие</option>
                <option value="new">Новинки</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* счётчик */}
      <div className="flex items-center justify-between mt-4 mb-3">
        <p className="text-gray-500">Показано {visible.length} из {sorted.length}</p>
        {(activeSub || (priceCap && priceCap < maxPrice)) && (
          <button
            onClick={()=>{ setActiveSub(null); setPriceCap(maxPrice); }}
            className="text-sm text-gray-500 hover:text-black underline underline-offset-2"
          >Сбросить фильтры</button>
        )}
      </div>

      {/* grid */}
      {visible.length === 0 ? (
        <div className="text-gray-500">Пока нет товаров этого бренда.</div>
      ) : (
        <div id="grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {visible.map((item: any) => (
            <Link key={item.id} href={`/product/${item.id}?origin=brand`}>
              <div className="group border rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition">
                <div className="relative w-full h-64 bg-gray-50">
                  <Image
                    src={item.images?.[0] || '/img/placeholder.png'}
                    alt={item.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {(item.isPremium || item.premium) && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black text-white">★ Premium</span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold truncate" title={item.name}>{item.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{(item.price||0).toLocaleString('ru-RU')}₽</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {limit < sorted.length && (
        <div className="flex justify-center mt-8">
          <button onClick={() => setLimit(n => n + 12)} className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition">Показать ещё</button>
        </div>
      )}

      {origin === 'product' && (
        <div className="mt-10">
          <Link href="/" className="text-sm text-gray-500 hover:text-black hover:underline underline-offset-2">← Вернуться в каталог</Link>
        </div>
      )}
      <style jsx>{`
        .range-black { -webkit-appearance:none; appearance:none; height:2px; background: #000; outline:none; border-radius:2px; }
        .range-black::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:16px; height:16px; border-radius:50%; background:#000; cursor:pointer; border:2px solid #000; }
        .range-black::-moz-range-thumb { width:16px; height:16px; border-radius:50%; background:#000; border:2px solid #000; cursor:pointer; }
        .range-black::-ms-thumb { width:16px; height:16px; border-radius:50%; background:#000; border:2px solid #000; cursor:pointer; }
        .pulse-ring{position:absolute;inset:-6px;border-radius:14px;border:2px solid rgba(0,0,0,.65);animation:pulseRing .8s ease-out forwards;pointer-events:none}
        @keyframes pulseRing{0%{opacity:.35;transform:scale(.9)}70%{opacity:.15;transform:scale(1.15)}100%{opacity:0;transform:scale(1.25)}}
        .icon-pop{animation:pop .32s cubic-bezier(.2,.7,.2,1) forwards}
        @keyframes pop{0%{transform:scale(.6) rotate(-12deg)}60%{transform:scale(1.15) rotate(6deg)}100%{transform:scale(1) rotate(0)}}
        .spark-wrap{position:absolute;inset:0;pointer-events:none}
        .spark{position:absolute;width:6px;height:6px;background:#000;border-radius:50%;opacity:0}
        .spark.s1{left:10%;top:50%;animation:spark .6s ease-out forwards}
        .spark.s2{left:25%;top:10%;animation:spark .6s ease-out .03s forwards}
        .spark.s3{left:50%;top:0;animation:spark .6s ease-out .06s forwards}
        .spark.s4{right:25%;top:15%;animation:spark .6s ease-out .09s forwards}
        .spark.s5{right:10%;bottom:20%;animation:spark .6s ease-out .12s forwards}
        .spark.s6{left:45%;bottom:0;animation:spark .6s ease-out .15s forwards}
        @keyframes spark{0%{transform:translate(0,0) scale(.7);opacity:.9}100%{transform:translate(var(--tx,0),var(--ty,0)) scale(.9);opacity:0}}
        /* motion paths */
        .spark.s1{--tx:-18px;--ty:-22px}
        .spark.s2{--tx:-8px;--ty:-28px}
        .spark.s3{--tx:0;--ty:-30px}
        .spark.s4{--tx:14px;--ty:-22px}
        .spark.s5{--tx:20px;--ty:-12px}
        .spark.s6{--tx:-12px;--ty:-10px}
      `}</style>
    </div>
  );
}