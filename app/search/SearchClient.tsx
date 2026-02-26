
'use client';

// ✅ UPDATED: categories-premium-v2

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreateEventsSessionId, trackShopEvent } from '@/lib/events-client';

// -------------------- Data models --------------------

type ResultItem = {
  id: string;
  name: string;
  price: number | null;
  brandName: string | null;
  brandSlug?: string | null;
  brandLogo?: string | null;
  imageUrl: string | null;
  images?: string[];
};

type BrandHit = {
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  count?: number;
};


type HistoryItem = { q: string; ts: number };

type FacetSubcategory = { name: string; count: number };
type FacetCategory = { name: string; slug?: string; count: number };

// -------------------- Constants --------------------

type Category = { title: string; subtitle: string; href: string; key?: string };
const CATEGORIES: Category[] = [
  { title: 'Обувь', subtitle: 'Sneakers · Boots · Loafers', href: `/category/${encodeURIComponent('обувь')}` },
  { title: 'Одежда', subtitle: 'Outerwear · Knit · Denim', href: `/category/${encodeURIComponent('одежда')}` },
  { title: 'Сумки', subtitle: 'Totes · Crossbody · Clutches', href: `/category/${encodeURIComponent('сумки')}` },
  { title: 'Аксессуары', subtitle: 'Jewelry · Belts · Glasses', href: `/category/${encodeURIComponent('аксессуары')}` },
  { title: 'Парфюм', subtitle: 'EDP · EDT · Niche', href: `/category/${encodeURIComponent('парфюм')}` },
  { title: 'Головные уборы', subtitle: 'Caps · Beanies · Hats', href: `/category/${encodeURIComponent('головные уборы')}` },
];

const GHOST_QUERIES = [
  'Nike Air Force 1',
  'Jordan 4 Retro',
  'Кроссовки New Balance 530',
  'Лоферы Gucci',
  'Сумка Jacquemus',
  'Пальто Max Mara',
  "Джинсы Levi's 501",
  'Очки Ray-Ban',
  'Парфюм Byredo',
  'Худи Fear of God',
  'Кепка Supreme',
  'Ботинки Dr. Martens',
  'Рюкзак Nike ACG',
  'Браслет Cartier',
  'Кардхолдер Bottega',
  'Кроссовки Salomon XT-6',
  'Свитер Acne Studios',
];

type Promo = { title: string; desc: string; href: string; tag: string };
const PROMOS: Promo[] = [
  { title: 'Sale до -30%', desc: 'Подборка недели — успей забрать размер.', href: '/search?tag=sale', tag: 'SALE' },
  { title: 'Premium selection', desc: 'Капсульные вещи и редкие позиции.', href: '/premium', tag: 'PREMIUM' },
  { title: 'Новинки', desc: 'Только что добавили — свежие релизы.', href: '/search?tag=new', tag: 'NEW' },
  { title: 'Топ недели', desc: 'Самое популярное — по просмотрам и покупкам.', href: '/search?tag=top', tag: 'TOP' },
  { title: 'Редкие размеры', desc: 'Собрали позиции, которые редко появляются.', href: '/search?tag=rare', tag: 'RARE' },
  { title: 'Подарки', desc: 'Аксессуары и идеи для подарка — быстро и красиво.', href: '/search?tag=gifts', tag: 'GIFT' },
  { title: 'Дропы', desc: 'Подборка по свежим релизам и лимиткам.', href: '/search?tag=drops', tag: 'DROP' },
];

const HISTORY_KEY = 'stage.searchHistory.v2';
const HISTORY_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
const HISTORY_MAX = 12;

function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, ' ');
}

function capitalizeFirst(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettySubcategory(raw: string) {
  const key = String(raw ?? '').trim();
  const low = key.toLowerCase();

  // manual mapping for common subcategories
  const dict: Record<string, string> = {
    sneakers: 'Кроссовки',
    sneaker: 'Кроссовки',
    boots: 'Ботинки',
    boot: 'Ботинки',
    loafers: 'Лоферы',

    hoodie: 'Худи',
    hoodies: 'Худи',
    sweater: 'Свитер',
    sweaters: 'Свитеры',
    knit: 'Трикотаж',
    denim: 'Деним',
    outerwear: 'Верхняя одежда',
    jacket: 'Куртка',
    jackets: 'Куртки',
    coat: 'Пальто',
    coats: 'Пальто',
    parka: 'Парка',
    anorak: 'Анорак',
    cardigan: 'Кардиган',
    cardigans: 'Кардиганы',
    sweatshirt: 'Свитшот',
    sweatshirts: 'Свитшоты',
    shirt: 'Рубашка',
    shirts: 'Рубашки',
    polo: 'Поло',
    suit: 'Костюм',
    suits: 'Костюмы',
    vest: 'Жилет',
    vests: 'Жилеты',
    dress: 'Платье',
    dresses: 'Платья',
    skirt: 'Юбка',
    skirts: 'Юбки',
    shorts: 'Шорты',
    jeans: 'Джинсы',
    jean: 'Джинсы',

    fragrance: 'Парфюм',
    fragrances: 'Парфюм',
    perfume: 'Парфюм',

    jewelry: 'Украшения',
    jewellery: 'Украшения',

    belt: 'Ремень',
    belts: 'Ремни',

    cardholder: 'Кардхолдер',
    cardholders: 'Кардхолдеры',

    waistbag: 'Поясная сумка',
    waistbags: 'Поясные сумки',

    bag: 'Сумка',
    bags: 'Сумки',

    backpack: 'Рюкзак',
    backpacks: 'Рюкзаки',

    travelbag: 'Дорожная сумка',
    travelbags: 'Дорожные сумки',

    pants: 'Штаны',
    trouser: 'Брюки',
    trousers: 'Брюки',
    sweatpants: 'Штаны',
    trackpants: 'Штаны',
    tracksuit: 'Спортивный костюм',

    tshirt: 'Футболка',
    tshirts: 'Футболки',
    tee: 'Футболка',
    tees: 'Футболки',
    't-shirt': 'Футболка',
    top: 'Топ',
    tops: 'Топы',

    cap: 'Кепка',
    caps: 'Кепки',
    beanie: 'Шапка',
    beanies: 'Шапки',
    hat: 'Головной убор',
    hats: 'Головные уборы',
    sandal: 'Сандалии',
    sandals: 'Сандалии',
    socks: 'Носки',
    scarf: 'Шарф',
    scarves: 'Шарфы',
    glove: 'Перчатки',
    gloves: 'Перчатки',

    accessories: 'Аксессуары',
    glasses: 'Очки',
    wallet: 'Кошелек',
    wallets: 'Кошельки',
    keychain: 'Брелок',
    keychains: 'Брелоки',
    ring: 'Кольцо',
    rings: 'Кольца',
    earring: 'Серьги',
    earrings: 'Серьги',
    necklace: 'Колье',
    bracelet: 'Браслет',
    watch: 'Часы',
    watches: 'Часы',
  };

  if (dict[low]) return dict[low];

  // fallback: decode, replace separators, and capitalize
  const cleaned = key
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return capitalizeFirst(cleaned);
}

function normalizeBrandKey(s: string) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-я]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const cleaned = parsed
      .filter((x) => x && typeof x.q === 'string' && typeof x.ts === 'number')
      .map((x) => ({ q: normalizeQuery(x.q), ts: x.ts }))
      .filter((x) => x.q.length > 0)
      .filter((x) => now - x.ts <= HISTORY_TTL_MS)
      .sort((a, b) => b.ts - a.ts);

    const seen = new Set<string>();
    const out: HistoryItem[] = [];
    for (const item of cleaned) {
      const key = item.q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= HISTORY_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch {}
}

// -------------------- Promo tiles (stable components) --------------------

const PickCell = memo(function PickCell({ p, className = '' }: { p: ResultItem; className?: string }) {
  return (
    <Link
      href={`/product/${p.id}`}
      className={`group relative block h-full w-full overflow-hidden rounded-2xl border border-black/10 bg-transparent transition-colors duration-200 hover:border-black/20 ${className}`}
      aria-label={p.name}
    >
      {(() => {
        const all = [p.imageUrl, ...(Array.isArray(p.images) ? p.images : [])]
          .filter((x): x is string => typeof x === 'string' && x.length > 0);
        const uniq: string[] = [];
        for (const u of all) {
          if (!uniq.includes(u)) uniq.push(u);
        }
        const main = uniq[0] ?? null;
        const thumbs = uniq.slice(1, 3);

        return (
          <>
              {main ? (
                <>

                {/*
                  NOTE: avoid `filter: drop-shadow(...)` on the <Image/> itself.
                  It can cause repaint/flicker on frequent re-renders.
                  We wrap the image and use a normal box-shadow instead.
                */}
                  <div className="absolute inset-0">
                    <div className="relative h-full w-full bg-transparent">
                      <Image
                        src={main}
                        alt={p.name}
                        fill
                        sizes="(max-width: 1024px) 50vw, 560px"
                        className="object-contain select-none"
                        draggable={false}
                      />
                    </div>
                  </div>
              </>
              ) : null}

            {thumbs.length > 0 ? (
              <div className="absolute top-2 right-2 flex -space-x-2">
                {thumbs.map((src) => (
                  <div
                    key={src}
                    className="relative h-7 w-7 sm:h-8 sm:w-8 overflow-hidden rounded-xl border border-white/60 bg-white shadow-sm"
                  >
                    <Image src={src} alt="" fill sizes="32px" className="object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </>
        );
      })()}

      <div className="absolute inset-0 pointer-events-none opacity-0 md:opacity-0 transition-opacity duration-150 md:group-hover:opacity-100 bg-gradient-to-t from-black/[0.45] via-black/[0.08] to-transparent transform-gpu will-change-opacity" />

      <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3">
        <div className="pointer-events-none opacity-100 md:opacity-0 transition-opacity duration-150 md:group-hover:opacity-100">
          <div className="md:hidden rounded-xl bg-white/95 border border-white/40 px-2 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 text-[11px] font-semibold truncate">{p.name}</div>
              <div className="shrink-0 text-[11px] font-bold">{Number(p.price ?? 0).toLocaleString('ru-RU')} ₽</div>
            </div>
          </div>
          <div className="hidden md:block rounded-2xl bg-white border border-white/50 px-2.5 py-2.5 sm:px-3 sm:py-3 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <div className="text-[12px] sm:text-[13px] font-semibold leading-tight line-clamp-2">{p.name}</div>
            <div className="mt-1 text-[12px] sm:text-[13px] font-bold">{Number(p.price ?? 0).toLocaleString('ru-RU')} ₽</div>
          </div>
        </div>
      </div>
    </Link>
  );
});

const PromoTile = ({ promo, className = '' }: { promo: Promo; className?: string }) => (
  <Link
    href={promo.href}
    className={`group rounded-2xl border border-black/10 bg-black/[0.02] hover:bg-black/[0.04] transition p-3 sm:p-4 flex flex-col justify-between ${className}`}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-black/60">{promo.tag}</div>
      <div className="text-black/50 group-hover:text-black transition">→</div>
    </div>
    <div>
      <div className="mt-2 text-[13px] sm:text-sm font-extrabold tracking-tight">{promo.title}</div>
      <div className="mt-1 text-[11px] sm:text-xs text-black/55 leading-relaxed line-clamp-2">{promo.desc}</div>
    </div>
  </Link>
);

const DiscountTile = ({ className = '' }: { className?: string }) => (
  <Link
    href="/search?tag=sale"
    className={`group rounded-2xl border border-black/10 bg-gradient-to-br from-black/[0.06] to-black/[0.02] hover:from-black/[0.08] hover:to-black/[0.03] transition p-3 sm:p-4 flex flex-col justify-between ${className}`}
  >
    <div className="flex items-center justify-between">
      <div className="text-[10px] uppercase tracking-[0.18em] text-black/60">DISCOUNT</div>
      <div className="text-black/50 group-hover:text-black transition">→</div>
    </div>
    <div>
      <div className="mt-2 text-base sm:text-lg font-extrabold tracking-tight">Скидки сегодня</div>
      <div className="mt-1 text-[11px] sm:text-xs text-black/55 leading-relaxed">Подборка со снижением цены и редкими размерами.</div>
      <div className="mt-3 inline-flex items-center gap-2 text-[13px] sm:text-sm font-semibold">
        Открыть <span className="opacity-70">•</span> -15%
      </div>
    </div>
  </Link>
);

const SidebarPromos = memo(function SidebarPromos({
  picks,
  picksLoading,
  onRefresh,
}: {
  picks: ResultItem[];
  picksLoading: boolean;
  onRefresh: () => void;
}) {
  const promoA = PROMOS[0];
  const promoB = PROMOS[1];
  const promoC = PROMOS[2];
  const promoD = PROMOS[3];
  const promoE = PROMOS[4];
  const promoF = PROMOS[5];
  const promoG = PROMOS[6];

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-black/10 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Промо и подборки</div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs font-semibold text-black/60 hover:text-black transition"
        >
          Обновить
        </button>
      </div>

      {/* bricks */}
      <div className="mt-4 grid grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3 auto-rows-[72px] sm:auto-rows-[88px] md:auto-rows-[92px]">
        {picksLoading ? (
          Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-2xl border border-black/10 bg-black/[0.04] animate-pulse ${i % 3 === 0 ? 'row-span-3' : i % 4 === 0 ? 'row-span-2' : 'row-span-2'}`}
            />
          ))
        ) : (
          <>
            {/* row 1 */}
            {picks[0] ? <PickCell p={picks[0]} className="row-span-3" /> : null}
            {promoA ? <PromoTile promo={promoA} className="row-span-2" /> : null}
            {picks[1] ? <PickCell p={picks[1]} className="row-span-2" /> : null}

            {/* row 2 */}
            <DiscountTile className="row-span-3" />
            {picks[2] ? <PickCell p={picks[2]} className="row-span-3" /> : null}
            {promoB ? <PromoTile promo={promoB} className="row-span-2" /> : null}

            {/* row 3 */}
            {picks[3] ? <PickCell p={picks[3]} className="row-span-2" /> : null}
            {promoC ? <PromoTile promo={promoC} className="col-span-2 xl:col-span-3 row-span-2" /> : null}

            {/* more */}
            {picks[4] ? <PickCell p={picks[4]} className="row-span-2" /> : null}
            {promoD ? <PromoTile promo={promoD} className="row-span-2" /> : null}
            {picks[5] ? <PickCell p={picks[5]} className="row-span-3" /> : null}

            {promoE ? <PromoTile promo={promoE} className="row-span-2" /> : null}
            {picks[6] ? <PickCell p={picks[6]} className="row-span-2" /> : null}
            {promoF ? <PromoTile promo={promoF} className="row-span-2" /> : null}

            {picks[7] ? <PickCell p={picks[7]} className="row-span-3" /> : null}
            {promoG ? <PromoTile promo={promoG} className="row-span-2" /> : null}
            {picks[8] ? <PickCell p={picks[8]} className="row-span-2" /> : null}

            {picks[9] ? <PickCell p={picks[9]} className="col-span-2 xl:col-span-3 row-span-2" /> : null}

            {!picks?.length ? (
              <div className="col-span-2 xl:col-span-3 rounded-2xl border border-black/10 p-4 text-xs text-black/55">
                Не удалось загрузить подборку. Нажми «Обновить».
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 text-[11px] text-black/45">Товары, промо и скидки — в одном блоке, как кирпичики.</div>
    </div>
  );
});

// -------------------- Page --------------------

export default function SearchPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const qFromUrl = sp.get('q') || '';
  const activeQuery = normalizeQuery(qFromUrl);
  const activeTag = sp.get('tag');
  const categoryFromUrl = sp.get('category') || '';
  const activeCategory = normalizeQuery(categoryFromUrl);
  const activeCategoryParam = categoryFromUrl || '';

  const buildSearchUrl = (params: { q?: string; category?: string; tag?: string }) => {
    const next = new URLSearchParams();
    if (params.q) next.set('q', params.q);
    if (params.category) next.set('category', params.category);
    if (params.tag) next.set('tag', params.tag);
    const qs = next.toString();
    return qs ? `/search?${qs}` : '/search';
  };

  const inputRef = useRef<HTMLInputElement | null>(null);

  // input state (what user is typing)
  const [q, setQ] = useState(activeQuery);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [ghostPlaceholder, setGhostPlaceholder] = useState('');
  const [subsOpen, setSubsOpen] = useState(false);

  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [brandHit, setBrandHit] = useState<BrandHit | null>(null);

  // DB-driven facets (active subcategories)
  const [facetSubs, setFacetSubs] = useState<FacetSubcategory[]>([]);
  const [facetCats, setFacetCats] = useState<FacetCategory[]>([]);
  const [facetLoading, setFacetLoading] = useState(false);

  // random promo picks
  const [picks, setPicks] = useState<ResultItem[]>([]);
  const [picksLoading, setPicksLoading] = useState(false);
  const seenPickIdsRef = useRef<Set<string>>(new Set());

  // load history
  useEffect(() => {
    const h = loadHistory();
    setHistory(h);
    saveHistory(h);
  }, []);

  // keep input in sync when user navigates by back/forward or lands on /search?q=...
  useEffect(() => {
    setQ(activeQuery);
  }, [activeQuery]);

  useEffect(() => {
    if (activeCategory && !activeQuery) setQ('');
  }, [activeCategory, activeQuery]);

  // close history panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const root = document.getElementById('menu-search-root');
      if (root && !root.contains(el)) setPanelOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [panelOpen]);

  const filteredHistory = useMemo(() => {
    const nq = normalizeQuery(q).toLowerCase();
    if (!nq) return history;
    return history.filter((x) => x.q.toLowerCase().includes(nq));
  }, [q, history]);

  // Add to history ONLY on explicit action (Enter / button / click)
  const pushSearch = (raw: string) => {
    const next = normalizeQuery(raw);
    if (!next) return;

    const now = Date.now();
    const merged: HistoryItem[] = [
      { q: next, ts: now },
      ...history.filter((x) => x.q.toLowerCase() !== next.toLowerCase()),
    ].slice(0, HISTORY_MAX);

    setHistory(merged);
    saveHistory(merged);
    setPanelOpen(false);

    void trackShopEvent({
      eventType: "SEARCH",
      metadata: {
        query: next,
        category: activeCategoryParam || null,
      },
    }).catch(() => {});

    router.push(
      buildSearchUrl({
        q: next,
        category: activeCategoryParam || undefined,
        tag: activeTag || undefined,
      })
    );
  };

  const removeHistoryItem = (query: string) => {
    const next = history.filter((x) => x.q.toLowerCase() !== query.toLowerCase());
    setHistory(next);
    saveHistory(next);
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  };

  // -------------------- FACETS (active categories/subcategories from DB) --------------------
  const fetchFacets = async () => {
    setFacetLoading(true);
    try {
      const res = await fetch('/api/search?facets=1', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('facets');
      const data = (await res.json()) as { subcategories?: FacetSubcategory[]; categories?: FacetCategory[] };
      const subs = Array.isArray(data.subcategories) ? data.subcategories : [];
      const cats = Array.isArray(data.categories) ? data.categories : [];
      setFacetSubs(
        subs
          .map((x) => ({ name: String(x.name ?? '').trim(), count: Number(x.count ?? 0) }))
          .filter((x) => x.name.length > 0)
          .sort((a, b) => b.count - a.count)
      );
      setFacetCats(
        cats
          .map((x) => ({
            name: String(x.name ?? '').trim(),
            slug: String(x.slug ?? '').trim(),
            count: Number(x.count ?? 0),
          }))
          .filter((x) => x.name.length > 0 && x.count > 0)
          .sort((a, b) => b.count - a.count)
      );
    } catch {
      setFacetSubs([]);
      setFacetCats([]);
    } finally {
      setFacetLoading(false);
    }
  };

  useEffect(() => {
    fetchFacets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------- RANDOM PICKS (кирпичики) --------------------
  const fetchPicks = useCallback(async () => {
    setPicksLoading(true);
    try {
      const seed = String(Date.now());
      const sessionId = getOrCreateEventsSessionId();
      const excludeCsv = Array.from(seenPickIdsRef.current).join(",");
      const qs = new URLSearchParams({
        limit: "12",
        seed,
        sessionId,
      });
      if (excludeCsv) qs.set("exclude", excludeCsv);

      const res = await fetch(`/api/recommendations/personal?${qs.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('picks');
      const data = (await res.json()) as { items?: ResultItem[] };
      let items = Array.isArray(data.items) ? data.items.slice(0, 12) : [];

      // Если закончились "новые" товары, сбрасываем seen-пул и берём ротацию заново.
      if (!items.length && seenPickIdsRef.current.size) {
        seenPickIdsRef.current = new Set();
        const retry = await fetch(`/api/recommendations/personal?limit=12&seed=${encodeURIComponent(seed)}&sessionId=${encodeURIComponent(sessionId)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const retryData = await retry.json().catch(() => ({} as any));
        items = Array.isArray(retryData?.items) ? retryData.items.slice(0, 12) : [];
      }

      setPicks(items);
      if (items.length) {
        for (const item of items) {
          seenPickIdsRef.current.add(String(item.id));
        }
      }
    } catch {
      setPicks([]);
    } finally {
      setPicksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  const showGhost = normalizeQuery(q).length === 0 && !inputFocused;

  useEffect(() => {
    if (!showGhost) {
      setGhostPlaceholder('');
      return;
    }

    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: number | undefined;
    let canceled = false;

    const tick = () => {
      if (canceled) return;
      const word = GHOST_QUERIES[wordIndex % GHOST_QUERIES.length];

      if (!deleting) {
        charIndex += 1;
        setGhostPlaceholder(word.slice(0, charIndex));
        if (charIndex >= word.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1100);
          return;
        }
        timer = window.setTimeout(tick, 70 + Math.random() * 40);
        return;
      }

      charIndex -= 1;
      setGhostPlaceholder(word.slice(0, Math.max(charIndex, 0)));
      if (charIndex <= 0) {
        deleting = false;
        wordIndex += 1;
        timer = window.setTimeout(tick, 60);
        return;
      }
      timer = window.setTimeout(tick, 35 + Math.random() * 30);
    };

    timer = window.setTimeout(tick, 500);

    return () => {
      canceled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [showGhost]);

  const CategoryCard = ({ c, meta }: { c: Category; meta?: string }) => {
    const chips = c.subtitle.includes('·')
      ? c.subtitle
          .split('·')
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    return (
      <Link
        href={c.href}
        className="group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-black/10 bg-white p-4 sm:p-5 transition-colors duration-200 md:hover:border-black/20 md:hover:bg-black/[0.02]"
      >
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white to-black/[0.02]" />
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] [background-image:radial-gradient(rgba(0,0,0,1)_1px,transparent_1px)] [background-size:14px_14px]" />

        <div className="relative flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="text-base sm:text-[18px] font-extrabold tracking-tight">{c.title}</div>
            {meta ? (
              <>
                <div className="mt-1 text-[11px] text-black/55 sm:hidden">{meta}</div>
                <div className="mt-1 hidden sm:block text-[11px] sm:text-xs text-black/55">{meta}</div>
              </>
            ) : (
              <div className="mt-1 hidden sm:block text-[11px] sm:text-xs text-black/55">{c.subtitle}</div>
            )}

            {chips.length ? (
              <div className="mt-3 hidden sm:flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center h-6 sm:h-7 px-2.5 sm:px-3 rounded-full border border-black/10 bg-white/70 text-[10px] sm:text-[11px] font-semibold text-black/70"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="shrink-0">
            <div className="h-10 sm:h-11 px-3 sm:px-4 rounded-full border border-black/10 bg-white flex items-center gap-2 text-xs sm:text-sm font-semibold text-black/70 transition-colors duration-200">
              <span className="hidden md:inline">Открыть</span>
              <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/5 text-black/70 transition-colors duration-200">
                →
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  const SubcategoryTile = ({ name, count }: { name: string; count?: number }) => (
    <Link
      href={`/category/${encodeURIComponent(name)}`}
      className="rounded-2xl border border-black/10 bg-white px-3 py-3 transition hover:border-black/20"
      title={name}
    >
      <div className="text-sm font-semibold leading-snug">{prettySubcategory(name)}</div>
      {typeof count === 'number' ? <div className="mt-1 text-[11px] text-black/50">{count} товаров</div> : null}
    </Link>
  );

  // -------------------- Computed categories/cards (DB facets first, fallback to hardcoded) --------------------

  const facetSubsTop = useMemo(() => facetSubs.slice(0, 24), [facetSubs]);

  const categoryCards: Category[] = useMemo(() => {
    if (facetSubsTop.length) {
      return facetSubsTop.map((s) => ({
        key: s.name, // raw DB value
        title: prettySubcategory(s.name), // pretty display
        subtitle: '',
        href: `/category/${encodeURIComponent(s.name)}`,
      }));
    }
    return CATEGORIES;
  }, [facetSubsTop]);

  const categoryMetaByTitle = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of facetSubsTop) m.set(s.name, `${s.count} товаров`);
    return m;
  }, [facetSubsTop]);

  const mainCategoryMeta = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of facetCats) {
      const nameKey = normalizeQuery(c.name).toLowerCase();
      const slugKey = normalizeQuery(c.slug ?? '').toLowerCase();
      if (nameKey) m.set(nameKey, `${c.count} товаров`);
      if (slugKey) m.set(slugKey, `${c.count} товаров`);
    }
    return m;
  }, [facetCats]);

  // -------------------- LIVE SEARCH --------------------
  const liveQuery = normalizeQuery(q);
  const hasQuery = liveQuery.length > 0;
  const hasCategory = activeCategory.length > 0;
  const showResults = hasQuery || hasCategory;

  const brandSuggestion = useMemo(() => {
    if (brandHit?.name && brandHit?.slug) {
      return {
        name: brandHit.name,
        slug: brandHit.slug,
        logo: brandHit.logoUrl ?? null,
        count: brandHit.count ?? 0,
        key: normalizeBrandKey(brandHit.name),
      };
    }
    const qKey = normalizeBrandKey(liveQuery);
    if (!qKey) return null;
    const map = new Map<string, { name: string; slug?: string | null; logo?: string | null; count: number; key: string }>();
    for (const p of results) {
      if (!p.brandName) continue;
      const key = normalizeBrandKey(p.brandName);
      if (!key) continue;
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
        if (!prev.logo && p.brandLogo) prev.logo = p.brandLogo;
        if (!prev.slug && p.brandSlug) prev.slug = p.brandSlug;
      } else {
        map.set(key, {
          name: p.brandName,
          slug: p.brandSlug ?? null,
          logo: p.brandLogo ?? null,
          count: 1,
          key,
        });
      }
    }
    if (!map.size) return null;
    let best: { name: string; slug?: string | null; logo?: string | null; count: number; key: string } | null = null;
    const mapValues = Array.from(map.values());
    for (const item of mapValues) {
      const match =
        item.key === qKey || item.key.includes(qKey) || qKey.includes(item.key);
      if (!match) continue;
      if (!best || item.key.length > best.key.length) best = item;
    }
    return best;
  }, [results, liveQuery, brandHit]);

  useEffect(() => {
    if (!hasQuery && !hasCategory) {
      setResults([]);
      setBrandHit(null);
      setErrorMsg(null);
      setLoading(false);
      if (qFromUrl) router.replace('/search');
      return;
    }

    if (hasQuery && liveQuery !== activeQuery) {
      router.replace(
        buildSearchUrl({
          q: liveQuery,
          category: activeCategoryParam || undefined,
          tag: activeTag || undefined,
        })
      );
    }

    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const url = hasQuery
          ? `/api/search?q=${encodeURIComponent(liveQuery)}`
          : `/api/search?category=${encodeURIComponent(activeCategory)}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items?: ResultItem[]; brand?: BrandHit | null };
        setResults(Array.isArray(data.items) ? data.items : []);
        setBrandHit(data?.brand ?? null);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setResults([]);
        setBrandHit(null);
        setErrorMsg('Не удалось загрузить результаты.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveQuery, activeCategory, hasQuery, hasCategory]);

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-black/10">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4">
            <div className="flex items-center justify-between gap-3 sm:gap-3">
              <button
                onClick={() => router.back()}
                className="h-10 px-3 sm:px-4 rounded-full border border-black/10 hover:bg-black/[0.03] transition text-xs sm:text-sm font-medium"
                aria-label="Назад"
              >
                <span className="sm:hidden">←</span>
                <span className="hidden sm:inline">← Назад</span>
              </button>
              <Link
                href="/"
                className="sm:hidden h-10 px-4 rounded-full bg-black text-white inline-flex items-center justify-center text-xs font-semibold hover:opacity-90 transition"
              >
                На главную
              </Link>
            </div>

            <div className="flex-1 w-full" id="menu-search-root">
              <div className="relative">
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPanelOpen(true);
                  }}
                  onFocus={() => {
                    setPanelOpen(true);
                    setInputFocused(true);
                  }}
                  onBlur={() => setInputFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      pushSearch(q);
                    }
                    if (e.key === 'Escape') {
                      setPanelOpen(false);
                      inputRef.current?.blur();
                    }
                  }}
                  placeholder={showGhost ? ghostPlaceholder : 'Поиск товаров, брендов…'}
                  className="w-full h-11 sm:h-12 rounded-2xl sm:rounded-full px-4 sm:px-5 pr-4 sm:pr-[120px] bg-black/[0.04] outline-none border border-transparent focus:border-black/15 focus:bg-white transition"
                />

                <button
                  type="button"
                  onClick={() => pushSearch(q)}
                  className="hidden sm:inline-flex absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 rounded-full bg-black text-white text-sm font-semibold leading-none items-center justify-center hover:opacity-90 transition"
                >
                  Искать
                </button>

                {panelOpen && (
                  <div
                    className="absolute left-0 right-0 mt-2 rounded-2xl border border-black/10 bg-white shadow-[0_20px_70px_rgba(0,0,0,0.12)] overflow-hidden"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center justify-between px-4 py-3 bg-black/[0.02]">
                      <div className="text-xs font-semibold text-black/60">История поиска</div>
                      <button
                        type="button"
                        onClick={clearHistory}
                        className="text-xs font-semibold text-black/60 hover:text-black transition"
                      >
                        Очистить
                      </button>
                    </div>

                    <div className="max-h-[42vh] sm:max-h-[340px] overflow-auto">
                      {normalizeQuery(q).length > 0 && (
                        <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-black/[0.03] transition">
                          <button
                            type="button"
                            className="flex-1 text-left text-sm font-semibold"
                            onClick={() => pushSearch(q)}
                          >
                            Искать «{normalizeQuery(q)}»
                          </button>
                          <div className="text-xs text-black/45">Enter</div>
                        </div>
                      )}

                      {filteredHistory.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-black/50">История пока пустая.</div>
                      ) : (
                        filteredHistory.map((item) => (
                          <div
                            key={item.q}
                            className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-black/[0.03] transition"
                          >
                            <button
                              type="button"
                              className="flex-1 text-left text-sm font-medium"
                              onClick={() => pushSearch(item.q)}
                            >
                              {item.q}
                            </button>
                            <button
                              type="button"
                              aria-label="Удалить"
                              className="h-8 w-8 rounded-full hover:bg-black/[0.06] transition flex items-center justify-center text-black/60"
                              onClick={() => removeHistoryItem(item.q)}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => pushSearch(q)}
                className="mt-2 w-full sm:hidden h-10 rounded-full bg-black text-white text-sm font-semibold hover:opacity-90 transition"
              >
                Искать
              </button>
              {/* Quick actions (primary) */}
              <div className="mt-3">
                <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 sm:pb-2 -mx-1 px-1 [-webkit-overflow-scrolling:touch]">
                  <Link
                    href="/search?tag=sale"
                    className={
                      "shrink-0 h-10 sm:h-11 px-4 sm:px-6 inline-flex items-center justify-center rounded-full text-xs sm:text-sm font-semibold border transition " +
                      (activeTag === 'sale'
                        ? 'bg-black text-white border-black'
                        : 'border-black/15 bg-black/5 text-black hover:bg-black hover:text-white hover:border-black')
                    }
                  >
                    Sale
                  </Link>

                  <Link
                    href="/search?tag=new"
                    className={
                      "shrink-0 h-10 sm:h-11 px-4 sm:px-6 inline-flex items-center justify-center rounded-full text-xs sm:text-sm font-semibold border transition " +
                      (activeTag === 'new'
                        ? 'bg-black text-white border-black'
                        : 'border-black/15 bg-black/5 text-black hover:bg-black hover:text-white hover:border-black')
                    }
                  >
                    Новинки
                  </Link>

                  <Link
                    href="/search?tag=top"
                    className={
                      "shrink-0 h-10 sm:h-11 px-4 sm:px-6 inline-flex items-center justify-center rounded-full text-xs sm:text-sm font-semibold border transition " +
                      (activeTag === 'top'
                        ? 'bg-black text-white border-black'
                        : 'border-black/15 bg-black/5 text-black hover:bg-black hover:text-white hover:border-black')
                    }
                  >
                    Топ бренды
                  </Link>

                  <Link
                    href="/search?tag=gifts"
                    className={
                      "shrink-0 h-10 sm:h-11 px-4 sm:px-6 inline-flex items-center justify-center rounded-full text-xs sm:text-sm font-semibold border transition " +
                      (activeTag === 'gifts'
                        ? 'bg-black text-white border-black'
                        : 'border-black/15 bg-black/5 text-black hover:bg-black hover:text-white hover:border-black')
                    }
                  >
                    Подарки
                  </Link>

                  {activeTag ? (
                    <Link
                      href="/search"
                      className="shrink-0 h-10 sm:h-11 px-4 sm:px-6 inline-flex items-center justify-center rounded-full text-xs sm:text-sm font-semibold border border-black/15 bg-white text-black hover:bg-black hover:text-white hover:border-black transition"
                    >
                      Сбросить
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="hidden sm:inline-flex h-10 px-4 rounded-full bg-black text-white items-center justify-center text-sm font-semibold hover:opacity-90 transition"
            >
              На главную
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 sm:py-8">
        {showResults ? (
          <section>
            <div className="mb-4 sm:mb-6 rounded-3xl border border-black/10 bg-black/[0.02] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-black/50">Результаты</div>
                  <div className="mt-1 text-lg sm:text-xl font-extrabold tracking-tight">
                    {hasQuery ? `Поиск: «${liveQuery}»` : `Категория: «${prettySubcategory(activeCategory)}»`}
                  </div>
                  <div className="mt-1 text-sm text-black/55">{loading ? 'Загрузка…' : `Найдено: ${results.length}`}</div>
                </div>
                <button
                  onClick={() => {
                    setPanelOpen(true);
                    inputRef.current?.focus();
                  }}
                  className="hidden md:inline-flex h-10 px-4 rounded-full border border-black/10 hover:bg-black/[0.03] transition text-sm font-semibold"
                >
                  Уточнить
                </button>
              </div>
            </div>

            {errorMsg ? (
              <div className="rounded-3xl border border-black/10 p-4 sm:p-6 text-sm text-black/60">{errorMsg}</div>
            ) : loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-black/10 overflow-hidden">
                    <div className="aspect-[4/5] bg-black/[0.04] animate-pulse" />
                    <div className="p-3">
                      <div className="h-3 w-20 bg-black/[0.06] rounded animate-pulse" />
                      <div className="mt-2 h-4 w-40 bg-black/[0.06] rounded animate-pulse" />
                      <div className="mt-3 h-4 w-24 bg-black/[0.06] rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-3xl border border-black/10 p-4 sm:p-6">
                <div className="text-base sm:text-lg font-bold">Ничего не найдено</div>
                <div className="mt-2 text-xs sm:text-sm text-black/55">Попробуй другой запрос или открой категорию ниже.</div>
                <div className="mt-4 flex gap-2 flex-wrap">
                  <Link href="/search?tag=new" className="px-3 py-2 rounded-full border border-black/10 hover:bg-black/[0.03] transition text-xs sm:text-sm">Новинки</Link>
                  <Link href="/search?tag=sale" className="px-3 py-2 rounded-full border border-black/10 hover:bg-black/[0.03] transition text-xs sm:text-sm">Sale</Link>
                  <Link href="/premium" className="px-3 py-2 rounded-full border border-black/10 hover:bg-black/[0.03] transition text-xs sm:text-sm">Premium</Link>
                </div>
              </div>
            ) : (
              <>
                {brandSuggestion?.slug && (
                  <Link
                    href={`/brand/${brandSuggestion.slug}`}
                    className="mb-4 sm:mb-5 flex items-center gap-3 rounded-3xl border border-black/10 bg-white px-4 sm:px-5 py-3 sm:py-4 hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition"
                  >
                    {brandSuggestion.logo ? (
                      <Image src={brandSuggestion.logo} alt={brandSuggestion.name} width={56} height={56} className="h-12 w-12 sm:h-14 sm:w-14 object-contain" />
                    ) : null}
                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-black/45">Бренд</div>
                      <div className="text-base sm:text-lg font-extrabold">{brandSuggestion.name}</div>
                      <div className="text-xs text-black/55">Все товары бренда · {brandSuggestion.count}</div>
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-black/70">Смотреть →</div>
                  </Link>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {results.map((p) => (
                    <Link
                      key={p.id}
                      href={`/product/${p.id}`}
                      className="group rounded-2xl border border-black/10 bg-white hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition overflow-hidden"
                    >
                      <div className="aspect-[4/5] bg-black/[0.03] relative">
                        {p.imageUrl ? (
                          <Image src={p.imageUrl} alt={p.name} fill className="object-cover group-hover:scale-[1.03] transition" />
                        ) : null}
                      </div>
                      <div className="p-3">
                        {p.brandName ? <div className="text-[11px] text-black/55">{p.brandName}</div> : null}
                        <div className="mt-1 text-sm font-semibold leading-snug line-clamp-2">{p.name}</div>
                        {typeof p.price === 'number' && p.price > 0 ? (
                          <div className="mt-2 text-sm font-bold">от {p.price.toLocaleString('ru-RU')} ₽</div>
                        ) : (
                          <div className="mt-2 text-xs text-black/50">Цена по запросу</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}

            <div className="mt-8 sm:mt-10 grid grid-cols-1 lg:grid-cols-[1fr_560px] gap-6 sm:gap-8">
              <section>
                <div className="text-sm font-semibold">Категории</div>
                <div className="mt-2 sm:mt-3">
                  <div className="grid grid-cols-1 gap-3 sm:hidden">
                    {CATEGORIES.map((c) => (
                      <CategoryCard key={c.href} c={c} meta={mainCategoryMeta.get(normalizeQuery(c.title).toLowerCase())} />
                    ))}
                  </div>

                  {facetLoading || facetSubs.length ? (
                    <div className="mt-3 sm:hidden">
                      <button
                        type="button"
                        onClick={() => setSubsOpen((v) => !v)}
                        className="w-full h-11 rounded-full border border-black/10 text-sm font-semibold hover:bg-black/[0.03] transition"
                      >
                        {subsOpen ? 'Скрыть подкатегории' : `Показать подкатегории${facetSubs.length ? ` (${facetSubs.length})` : ''}`}
                      </button>

                      {subsOpen ? (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {facetLoading
                            ? Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-black/10 bg-black/[0.03] h-[74px] animate-pulse" />
                              ))
                            : facetSubs.map((s) => <SubcategoryTile key={s.name} name={s.name} count={s.count} />)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {facetLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-3xl border border-black/10 bg-black/[0.03] h-[132px] animate-pulse" />
                      ))
                    ) : (
                      categoryCards.map((c) => (
                        <CategoryCard key={c.href} c={c} meta={categoryMetaByTitle.get(c.key ?? c.title)} />
                      ))
                    )}
                  </div>
                </div>
              </section>
              <aside className="lg:sticky lg:top-[92px] self-start">
                <SidebarPromos picks={picks} picksLoading={picksLoading} onRefresh={fetchPicks} />
              </aside>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_560px] gap-6 sm:gap-8">
            <section>
              <div className="flex items-end justify-between">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Категории</h2>
                <span className="text-xs sm:text-sm text-black/50">Быстрая навигация</span>
              </div>

              <div className="mt-4 sm:mt-6">
                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  {CATEGORIES.map((c) => (
                    <CategoryCard key={c.href} c={c} meta={mainCategoryMeta.get(normalizeQuery(c.title).toLowerCase())} />
                  ))}
                </div>

                {facetLoading || facetSubs.length ? (
                  <div className="mt-3 sm:hidden">
                    <button
                      type="button"
                      onClick={() => setSubsOpen((v) => !v)}
                      className="w-full h-11 rounded-full border border-black/10 text-sm font-semibold hover:bg-black/[0.03] transition"
                    >
                      {subsOpen ? 'Скрыть подкатегории' : `Показать подкатегории${facetSubs.length ? ` (${facetSubs.length})` : ''}`}
                    </button>

                    {subsOpen ? (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {facetLoading
                          ? Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className="rounded-2xl border border-black/10 bg-black/[0.03] h-[74px] animate-pulse" />
                            ))
                          : facetSubs.map((s) => <SubcategoryTile key={s.name} name={s.name} count={s.count} />)}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {facetLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="rounded-3xl border border-black/10 bg-black/[0.03] h-[132px] animate-pulse" />
                    ))
                  ) : (
                    categoryCards.map((c) => (
                      <CategoryCard key={c.href} c={c} meta={categoryMetaByTitle.get(c.key ?? c.title)} />
                    ))
                  )}
                </div>
              </div>

            </section>

            <aside className="lg:sticky lg:top-[92px] self-start">
              <SidebarPromos picks={picks} picksLoading={picksLoading} onRefresh={fetchPicks} />

              <div className="mt-5 sm:mt-6 rounded-3xl border border-black/10 bg-white p-4 sm:p-5">
                <div className="text-sm font-semibold">Скидки прямо сейчас</div>
                <div className="mt-3 rounded-2xl border border-black/10 bg-gradient-to-br from-black/[0.03] to-black/[0.01] p-3 sm:p-4">
                  <div className="text-sm sm:text-base font-bold">-15% на аксессуары</div>
                  <div className="mt-1 text-[11px] sm:text-xs text-black/55">По промо-подборке. Ограничено по времени.</div>
                  <Link
                    href="/search?category=%D0%B0%D0%BA%D1%81%D0%B5%D1%81%D1%81%D1%83%D0%B0%D1%80%D1%8B&tag=sale"
                    className="mt-3 inline-flex h-10 px-4 rounded-full bg-black text-white items-center justify-center text-xs sm:text-sm font-semibold hover:opacity-90 transition"
                  >
                    Открыть скидки
                  </Link>
                </div>
              </div>

              <div className="mt-4 text-[11px] sm:text-xs text-black/50 lg:hidden">
                Подсказка: открой категорию — там будут товары и фильтры (страница /category/[slug]).
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
