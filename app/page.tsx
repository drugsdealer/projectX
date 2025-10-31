"use client";
import { Container } from "@/components/shared/container";
import { Title } from "@/components/shared/title";
import { TopBar } from "@/components/shared/top-bar";
import { Filters } from "@/components/shared/filters";
import { ProductsGroupList } from "@/components/shared/products-group-list";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Categories } from '@/components/shared/categories';
import { Stories } from "@/components/shared/stories";

// Локальные подписи основных категорий
const LABELS: Record<string, string> = {
  footwear: 'Обувь',
  clothes: 'Одежда',
  bags: 'Сумки',
  accessories: 'Аксессуары',
  fragrance: 'Парфюмерия',
  headwear: 'Головные уборы',
};

import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import { Autoplay, Pagination } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "react-feather";

import { useUser } from "@/user/UserContext";

export default function Home() {
  // --- helpers: price format + dynamic badges
  const fmtPrice = (n: number | string | undefined) => {
    const num = Number(n ?? 0);
    return num.toLocaleString('ru-RU');
  };

  const getMinPrice = (p: any): number => {
    try {
      if (!p) return 0;
      const nums: number[] = [];
      const push = (v: any) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) nums.push(n);
      };

      // explicit fields
      push(p.minPrice);
      push(p.price);
      push(p.amount);

      // sizes: common patterns
      if (Array.isArray(p.sizes)) {
        for (const s of p.sizes) {
          if (!s) continue;
          if (s.price !== undefined) push(s.price);
          if (s.amount !== undefined) push(s.amount);
          if (s.value && typeof s.value === 'object' && s.value.price !== undefined) {
            push(s.value.price);
          }
        }
      }

      // variants: fallback
      if (Array.isArray(p.variants)) {
        for (const v of p.variants) {
          if (!v) continue;
          if (v.price !== undefined) push(v.price);
          if (v.amount !== undefined) push(v.amount);
        }
      }

      if (!nums.length) return 0;
      return Math.min(...nums);
    } catch {
      return 0;
    }
  };

  const computeBadges = (it: any): string[] => {
    const res: string[] = [];
    // explicit badge from data (e.g., EXCLUSIVE/HIT)
    if (typeof it?.badge === 'string' && it.badge.trim()) res.push(it.badge.trim());
    // discount
    if (it?.oldPrice && it?.price && Number(it.oldPrice) > Number(it.price)) {
      const pct = Math.max(1, Math.round((1 - Number(it.price) / Number(it.oldPrice)) * 100));
      res.push(`-${pct}%`);
    }
    // new (by flag or recent createdAt)
    const createdDays = it?.createdAt ? (Date.now() - new Date(it.createdAt).getTime()) / 86400000 : Infinity;
    if (it?.isNew === true || createdDays <= 30) res.push('NEW');
    // low stock
    if (typeof it?.stock === 'number' && it.stock > 0 && it.stock <= 2) res.push('Последние 2 шт.');
    return res;
  };

  // Take the first sentence from a plain‑text description
  const firstSentence = (txt: any): string => {
    try {
      if (!txt) return '';
      const s = String(txt)
        .replace(/<[^>]*>/g, ' ')      // strip potential HTML
        .replace(/\s+/g, ' ')
        .trim();
      const m = s.match(/(.+?[.!?])(\s|$)/);
      const head = m ? m[1] : s;
      return head.slice(0, 160);
    } catch { 
      return ''; 
    }
  };

  // Prefer the first non-empty description-like field from the product object
  const pickDescription = (p: any): string => {
    try {
      const cands = [
        p?.description,
        p?.desc,
        p?.shortDescription,
        p?.summary,
        p?.about,
        p?.details,
        p?.text,
      ];
      for (const v of cands) {
        if (typeof v === 'string' && v.trim()) return v;
      }
      return '';
    } catch {
      return '';
    }
  };

  // Extract brand name from different shapes (string, relation, array)
  const extractBrand = useCallback((p: any): string => {
    try {
      if (!p) return '';

      const fromString = (v: any) => (typeof v === 'string' ? v.trim() : '');
      const fromObj = (o: any) => {
        if (!o || typeof o !== 'object') return '';
        return (
          fromString(o.name) ||
          fromString(o.title) ||
          fromString(o.label) ||
          fromString(o.slug) ||
          ''
        );
      };

      // 1) Direct fields / relations / arrays
      const direct =
        fromString(p.brand) ||
        fromString(p.brandName) ||
        fromObj(p.brand) ||
        fromObj(p.Brand) ||
        (Array.isArray(p.brands) && p.brands.length ? fromString(p.brands[0]) : '');

      if (direct) return direct;

      // 2) Heuristics: derive brand from name/title/description
      const hay = `${p?.name || ''} ${p?.title || ''} ${p?.description || ''}`.toLowerCase();

      // Known brands map (add here if появятся новые)
      const KNOWN: Record<string, string> = {
        'nike': 'Nike',
        'adidas': 'Adidas',
        'reebok': 'Reebok',
        'new balance': 'New Balance',
        'converse': 'Converse',
        'supreme': 'Supreme',
        'off white': 'Off-White',
        'off-white': 'Off-White',
        'yeezy': 'Yeezy',
        'puma': 'Puma',
        'chrome hearts': 'Chrome Hearts',
        'louis vuitton': 'Louis Vuitton',
        'stone island': 'Stone Island',
        'asics': 'ASICS',
        'vans': 'Vans',
        'balenciaga': 'Balenciaga',
        'salomon': 'Salomon',
        'birkenstock': 'Birkenstock',
        'dr. martens': 'Dr. Martens',
        'the north face': 'The North Face',
        'north face': 'The North Face',
        'new era': 'New Era',
        'stussy': 'Stüssy',
      };

      // Collab patterns: "Brand x Brand" or "Brand × Brand"
      const collabMatch = hay.match(/(.+?)\s*[x×]\s*(.+)/i);
      if (collabMatch) {
        const left = collabMatch[1].trim();
        const right = collabMatch[2].trim();
        for (const key of Object.keys(KNOWN)) {
          if (left.includes(key)) return KNOWN[key];
        }
        for (const key of Object.keys(KNOWN)) {
          if (right.includes(key)) return KNOWN[key];
        }
      }

      for (const key of Object.keys(KNOWN)) {
        if (hay.includes(key)) return KNOWN[key];
      }

      // 3) Fallback: first 1–2 capitalized tokens from product name
      const name = String(p?.name || '').trim();
      const m = name.match(/^[A-ZА-ЯЁ][\w.'-]*(?:\s+[A-ZА-ЯЁ][\w.'-]*)?/);
      if (m) return m[0].trim();

      return '';
    } catch {
      return '';
    }
  }, []);
  // Products from API (DB) with manual fetch + normalization
  const [products, setProducts] = useState<any[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load products: ${res.status}`);
        }
        const json = await res.json();
        const arr = Array.isArray(json?.products) ? json.products : [];

        const normalized = arr.map((p: any) => ({
          ...p,
          images: Array.isArray(p?.images) && p.images.length
            ? p.images
            : (p?.imageUrl ? [p.imageUrl] : []),
          price: p?.price ?? p?.minPrice ?? p?.amount ?? 0,
          brand: (() => {
            const str = (v: any) =>
              typeof v === "string" ? v.trim() : "";
            const fromObj = (o: any) =>
              o && typeof o === "object"
                ? (str(o.name) || str(o.title) || str(o.label) || str(o.slug))
                : "";

            const val =
              str(p?.brand) ||
              str(p?.brandName) ||
              fromObj(p?.brand) ||
              fromObj(p?.Brand) ||
              (Array.isArray(p?.brands) && p.brands.length
                ? str(p.brands[0])
                : "");

            return val || extractBrand(p) || "";
          })(),
        }));

        if (!cancelled) {
          setProducts(normalized);
        }
      } catch (err) {
        console.error("[home] failed to load products", err);
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setIsProductsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [extractBrand]);
  // --- Фильтры: бренды, категории, цены, мобильная панель ---
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // границы цен и текущий диапазон
  const priceStats = useMemo(() => {
    const all = products.map((p:any) => Number(p?.price) || 0).filter((n:number) => Number.isFinite(n));
    const min = all.length ? Math.min(...all) : 0;
    const max = all.length ? Math.max(...all) : 0;
    return { min, max };
  }, [products]);
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(0);

  // URL search params (must be hoisted for sortKey)
  const searchParams = useSearchParams();
  // --- НОРМАЛИЗАЦИЯ КАТЕГОРИЙ / ПОРЯДОК (hoisted, used below) ---
  const ORDER = ["footwear", "clothes", "bags", "accessories", "fragrance", "headwear"] as const;

  // Источник «сырой» категории из товара: сначала slug из БД/АПИ, затем поле-объект и прочие устаревшие поля
  const getRawCategory = useCallback((p: any) => {
    return (
      p?.categorySlug ??
      p?.category?.slug ??
      p?.main ??
      p?.category ??
      p?.type ??
      p?.categoryId
    );
  }, []);

  const normalizeCategory = useCallback((raw: any): string => {
    if (raw === undefined || raw === null) return "other";
    const vOrig = String(raw).trim();
    if (!vOrig) return "other";

    // приведение: нижний регистр + унификация дефисов
    const v0 = vOrig.toLowerCase().replace(/[—–−]/g, "-");
    const v = v0.replace(/\s+/g, " ");

    // numeric ids from backend (Neon/Prisma)
    const num = Number(v);
    if (!Number.isNaN(num)) {
      const byId: Record<number, string> = {
        1: "footwear",   // обувь
        2: "clothes",    // одежда
        3: "headwear",   // головные уборы
        4: "fragrance",  // парфюмерия
        5: "bags",       // сумки и рюкзаки
        6: "accessories" // аксессуары
      };
      return byId[num] ?? "other";
    }

    // canonical dictionary (включая сами слуги)
    const map: Record<string, string> = {
      // canonical slugs
      footwear: "footwear",
      clothes: "clothes",
      bags: "bags",
      accessories: "accessories",
      fragrance: "fragrance",
      headwear: "headwear",

      // EN — clothes
      clothing: "clothes",
      garments: "clothes",
      apparel: "clothes",
      // RU — clothes
      "одежда": "clothes",

      // EN — footwear
      shoes: "footwear",
      shoe: "footwear",
      sneakers: "footwear",
      sneaker: "footwear",
      boots: "footwear",
      boot: "footwear",
      sandals: "footwear",
      sandal: "footwear",
      // RU — footwear
      "обувь": "footwear",
      "кроссовки": "footwear",

      // accessories (no duplicate "accessories" key)
      accessory: "accessories",
      "аксессуары": "accessories",
      "аксессуар": "accessories",

      // bags (no duplicate "bags" key)
      bag: "bags",
      backpack: "bags",
      "рюкзак": "bags",
      "сумки": "bags",
      "сумка": "bags",
      "сумки-и-рюкзаки": "bags",

      // fragrance (no duplicate "fragrance" key)
      fragrances: "fragrance",
      perfume: "fragrance",
      perfumes: "fragrance",
      "парфюмерия": "fragrance",

      // headwear (no duplicate "headwear" key)
      hats: "headwear",
      hat: "headwear",
      caps: "headwear",
      cap: "headwear",
      beanie: "headwear",
      "шапки": "headwear",
      "головные уборы": "headwear",
      "головные-уборы": "headwear"
    };
    if (map[v]) return map[v];

    // heuristic fallbacks — ОБУВЬ проверяем раньше одежды, а у одежды убрали общий шаблон "wear"
    if (/(shoe|sneak|foot|boot|sand)/.test(v)) return "footwear";
    if (/(bag|pack|рюкзак|сумк)/.test(v)) return "bags";
    if (/(accessor|аксесс)/.test(v)) return "accessories";
    if (/(perf|fragr|парф)/.test(v)) return "fragrance";
    if (/(hat|cap|beanie|head|шапк|кепк)/.test(v)) return "headwear";
    if (/\b(cloth|apparel|garment)s?\b/.test(v)) return "clothes";

    return "other";
  }, []);

  // инициализация диапазона цен при загрузке/обновлении продуктов
  useEffect(() => {
    setPriceMin(priceStats.min);
    setPriceMax(priceStats.max);
  }, [priceStats.min, priceStats.max]);
  // Каталог: используем все товары без дополнительной фильтрации по premium
  const catalog = useMemo(() => products, [products]);
  // Доступные бренды и категории на основе полученных товаров
  const allBrands = useMemo(() => {
    const acc = new Set<string>();
    for (const p of products) {
      const b = extractBrand(p as any);
      if (b) acc.add(b);
    }
    return Array.from(acc).sort((a, b) => a.localeCompare(b, "ru"));
  }, [products, extractBrand]);

  const allCats = useMemo(() => {
    const acc = new Set<string>();
    for (const p of products) {
      const main = normalizeCategory(getRawCategory(p as any));
      if (main && main !== "other") acc.add(main);
    }
    // показываем в заданном порядке, остальные в конец
    const known = ORDER.filter((k) => acc.has(k));
    const rest = Array.from(acc).filter((k) => !ORDER.includes(k as any)).sort();
    return [...known, ...rest];
  }, [products, normalizeCategory, getRawCategory]);
  // --- Sorting helpers (hoisted) ---
  const sortKey = (searchParams.get('sort') || 'popular') as 'popular' | 'price-asc' | 'price-desc';
  const sortItems = (list: any[], key: 'popular' | 'price-asc' | 'price-desc') => {
    const copy = [...list];
    if (key === 'price-asc') {
      copy.sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0));
    } else if (key === 'price-desc') {
      copy.sort((a, b) => (Number(b?.price) || 0) - (Number(a?.price) || 0));
    } else {
      // 'popular' — если есть поле popularity, сортируем, иначе оставляем исходный порядок
      if (copy.length && typeof copy[0]?.popularity === 'number') {
        copy.sort((a, b) => (Number(b?.popularity) || 0) - (Number(a?.popularity) || 0));
      }
    }
    return copy;
  };
  // --- Подкатегории: состояние выбора + нормализация (расположено до filtered) ---
  // Активный фильтр подкатегорий
  const [subFilter, setSubFilter] = useState<Record<string, string | null>>({});

  // Синонимы подкатегорий
  const SUB_ALIASES: Record<string, string> = {
    tee: 'tshirts', tees: 'tshirts', tshirt: 'tshirts', tshirts: 'tshirts',
    sneaker: 'sneakers', sneakers: 'sneakers',
    boot: 'boots', boots: 'boots',
    sandal: 'sandals', sandals: 'sandals',
  };

  const normalizeSub = useCallback((raw: any): string | null => {
    if (raw === undefined || raw === null) return null;
    const v = String(raw).trim().toLowerCase();
    if (!v) return null;
    return SUB_ALIASES[v] ?? v;
  }, []);

  // Достаём подкатегорию из товара + нормализуем
  const getProductSubRaw = useCallback((p: any): any => {
    return (
      p?.subCategorySlug ??
      p?.subcategory ??
      p?.subCategory ??
      p?.sub ??
      null
    );
  }, []);

  const productSubNormalized = useCallback((p: any): string | null => {
    // сначала пробуем явные поля
    let s = normalizeSub(getProductSubRaw(p));
    if (s) return s;

    // эвристика из имени/описания, если явного поля нет
    try {
      const hay = `${p?.name || ''} ${p?.description || ''}`.toLowerCase();
      if (/(boot|ботинк)/.test(hay)) return 'boots';
      if (/(sneak|кроссовк|yeezy|dunk)/.test(hay)) return 'sneakers';
      if (/(tee|t-shirt|футболк)/.test(hay)) return 'tshirts';
      if (/(hood|худи|толстовк)/.test(hay)) return 'hoodies';
      if (/(bag|сумк|рюкзак)/.test(hay)) return 'bags';
    } catch {}
    return null;
  }, [normalizeSub, getProductSubRaw]);

  // Применение фильтров
  const filtered = useMemo(() => {
    const minV = Number(priceMin) || 0;
    const maxV = Number(priceMax) || Infinity;
    const selBrands = selectedBrands;
    const selCats = selectedCats;

    return (catalog as any[]).filter((p:any) => {
      const price = Number(p?.price) || 0;
      if (price < minV || price > maxV) return false;

      // категория
      const cat = normalizeCategory(getRawCategory(p));
      if (selCats.size && !selCats.has(cat)) return false;

      // подкатегория (если выбрана для текущей основной категории)
      const selectedSub = subFilter[cat] ?? null;
      if (selectedSub) {
        const pSub = productSubNormalized(p);
        if (pSub !== selectedSub) return false;
      }

      // бренд
      const brand = extractBrand(p as any);
      if (selBrands.size && (!brand || !selBrands.has(String(brand)))) return false;

      return true;
    });
  }, [catalog, priceMin, priceMax, selectedBrands, selectedCats, subFilter, normalizeCategory, normalizeSub, productSubNormalized, getRawCategory, extractBrand]);

  const filteredNoSub = useMemo(() => {
    const minV = Number(priceMin) || 0;
    const maxV = Number(priceMax) || Infinity;
    const selBrands = selectedBrands;
    const selCats = selectedCats;

    return (catalog as any[]).filter((p:any) => {
      const price = Number(p?.price) || 0;
      if (price < minV || price > maxV) return false;
      const cat = normalizeCategory(getRawCategory(p));
      if (selCats.size && !selCats.has(cat)) return false;
      const brand = extractBrand(p as any);
      if (selBrands.size && (!brand || !selBrands.has(String(brand)))) return false;
      return true;
    });
  }, [catalog, priceMin, priceMax, selectedBrands, selectedCats, normalizeCategory, getRawCategory, extractBrand]);

  // Сортировка поверх фильтра
  const visibleProducts = useMemo(() => sortItems(filtered, sortKey), [filtered, sortKey]);
  const visibleNoSub = useMemo(() => sortItems(filteredNoSub, sortKey), [filteredNoSub, sortKey]);

  // Группировка отфильтрованных товаров по основным категориям
  const groupedVisible = useMemo(() => {
    const result: Record<string, any[]> = {};
    for (const p of visibleProducts) {
      const main = normalizeCategory(getRawCategory(p as any));
      (result[main] ||= []).push(p);
    }
    return result;
  }, [visibleProducts, normalizeCategory, getRawCategory]);

  const subcatsByCat = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of visibleNoSub) {
      const cat = normalizeCategory(getRawCategory(p as any));
      const sub = productSubNormalized(p);
      if (!cat || !sub) continue;
      (map[cat] ||= []).push(sub);
    }
    Object.keys(map).forEach((k) => {
      const uniq = Array.from(new Set(map[k]));
      map[k] = uniq.slice(0, 16);
    });
    return map;
  }, [visibleNoSub, normalizeCategory, getRawCategory, productSubNormalized]);

  // Порядок секций на странице (из ORDER, затем остальные по алфавиту)
  const sectionOrder = useMemo(() => {
    const present = Object.keys(groupedVisible);
    const known = ORDER.filter((k) => present.includes(k as string)) as string[];
    const rest = present.filter((k) => !(ORDER as readonly string[]).includes(k)).sort();
    return [...known, ...rest];
  }, [groupedVisible]);

  // --- "Показать больше" per category ---
  const DEFAULT_COUNT = 20;  // initial items shown per category (was 12)
  const LOAD_STEP = 30;          // items to add on each "Показать больше"
  const [visibleByCat, setVisibleByCat] = useState<Record<string, number>>({});

  // Ensure visible counts exist and never exceed actual totals; drop stale categories
  useEffect(() => {
    setVisibleByCat((prev) => {
      const next: Record<string, number> = { ...prev };
      let changed = false;

      sectionOrder.forEach((cat) => {
        const total = (groupedVisible[cat] || []).length;
        const minDefault = Math.min(DEFAULT_COUNT, total);
        const current = next[cat]; // may be undefined
        // Clamp down to total when filters narrow results,
        // and clamp up to at least DEFAULT_COUNT when filters are cleared.
        const normalized = Math.min(Math.max((current ?? minDefault), minDefault), total);
        if (next[cat] !== normalized) { next[cat] = normalized; changed = true; }
      });

      // remove categories no longer present
      Object.keys(next).forEach((k) => {
        if (!sectionOrder.includes(k)) { delete next[k]; changed = true; }
      });

      return changed ? next : prev;
    });
  }, [sectionOrder, groupedVisible]);

  // Счетчик активных фильтров
  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (selectedBrands.size) n += 1;
    if (selectedCats.size) n += 1;
    if (priceMin > priceStats.min || priceMax < priceStats.max) n += 1;
    return n;
  }, [selectedBrands.size, selectedCats.size, priceMin, priceMax, priceStats.min, priceStats.max]);
  const toggleBrand = useCallback((b: string) => {
    setSelectedBrands(prev => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  }, []);

  const toggleCat = useCallback((c: string) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedBrands(new Set());
    setSelectedCats(new Set());
    setBrandSearch("");
    setPriceMin(priceStats.min);
    setPriceMax(priceStats.max);
  }, [priceStats.min, priceStats.max]);

  const [showAnimation, setShowAnimation] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const topBarRef = useRef<HTMLDivElement>(null);
  const swiperRef = useRef<any>(null);
  const [hoveredSide, setHoveredSide] = useState<"left" | "right" | null>(null);
  const [parallaxY, setParallaxY] = useState(0);
  const [scrolledFar, setScrolledFar] = useState(false);
  const { user } = useUser();
  const [isScrollingProgrammatically, setIsScrollingProgrammatically] = useState(false);
  const [cardImageIndex, setCardImageIndex] = useState<Record<string, number>>({});
  // Track visibility of the inline categories row (anchor under trust bar)
  const inlineCatsRef = useRef<HTMLDivElement | null>(null);
  const [inlineInView, setInlineInView] = useState(true);

  // Маркируем текущий раздел как обычный и отключаем премиум-интро при возврате по логотипу
  useEffect(() => {
    try {
      sessionStorage.setItem('lastSection', 'default');
      sessionStorage.setItem('premiumEntry', 'default');
    } catch {}
  }, []);

  // Возврат к карточке на главной: скроллим к последнему товару (или к сохранённой позиции)
  useEffect(() => {
    try {
      const lastRoute = sessionStorage.getItem('lastListRoute');
      const lastProductId = sessionStorage.getItem('lastProductId');
      const lastScrollYRaw = sessionStorage.getItem('lastScrollY');
      const lastScrollY = lastScrollYRaw ? Number(lastScrollYRaw) : NaN;

      // Проверяем что возвращаемся именно на главную
      const isHomeRoute = !lastRoute || lastRoute.split('?')[0] === '/';
      if (!isHomeRoute) return;

      const scrollToTarget = () => {
        // Пытаемся найти карточку по id
        if (lastProductId) {
          const el = document.getElementById(`product-${lastProductId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
        // иначе пробуем восстановить сохранённую позицию
        if (!Number.isNaN(lastScrollY)) {
          window.scrollTo({ top: lastScrollY, behavior: 'smooth' });
        }
      };

      // Даём странице дорендериться
      setTimeout(scrollToTarget, 0);
    } catch {}
  }, []);
  
  useEffect(() => {
    if (searchParams.get("premium") === "true") {
      setShowAnimation(true);
      setTimeout(() => {
        setShowAnimation(false);
      }, 1500);
    }
  }, [searchParams]);

  // Единый обработчик скролла
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    // Touch tracking for reliable direction on mobile
    let touchStartY = 0;

    const emitDirection = (dir: "up" | "down" | null, y: number) => {
      // update local state
      setScrollDirection(dir);
      // broadcast for listeners (TopBar/Categories)
      try {
        window.dispatchEvent(
          new CustomEvent("ui:scroll-direction", {
            detail: { direction: dir, y, scrolledFar: y > 120 },
          })
        );
      } catch {}
    };

    // Don't emit scroll direction while user interacts with sticky categories bar
    const isStickyHovered = () => {
      try {
        const el = document.getElementById('cats-sticky-overlay');
        // if element exists and is hovered, pause direction broadcasting
        return !!(el && (el as any).matches && (el as any).matches(':hover'));
      } catch {
        return false;
      }
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Верх/далеко
      setIsAtTop(currentScrollY < 10);
      setScrolledFar(currentScrollY > 120); // 120px – порог «далеко прокрутили»

      // Направление по scrollY (усилили порог и игнорируем ховер над липкой панелью)
      const movedEnough = Math.abs(currentScrollY - lastScrollY) > 6; // было 2
      if (!isScrollingProgrammatically && movedEnough && !isStickyHovered()) {
        const dir = currentScrollY > lastScrollY ? 'down' : 'up';
        emitDirection(dir, currentScrollY);
      }

      lastScrollY = currentScrollY;
    };

    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!e.touches || e.touches.length === 0) return;
      touchStartY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches || e.touches.length === 0) return;
      const y = e.touches[0].clientY;
      const dy = y - touchStartY;
      // positive dy => finger moves down => content scrolls up => direction 'up'
      if (Math.abs(dy) > 12 && !isScrollingProgrammatically && !isStickyHovered()) {
        const dir: 'up' | 'down' = dy > 0 ? 'up' : 'down';
        emitDirection(dir, window.scrollY);
        // move baseline to keep responsiveness during continuous swipe
        touchStartY = y;
      }
    };

    window.addEventListener("scroll", throttledScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });

    // initial sync
    emitDirection(null, window.scrollY);
    setIsAtTop(window.scrollY < 10);
    setScrolledFar(window.scrollY > 120);

    return () => {
      window.removeEventListener("scroll", throttledScroll);
      window.removeEventListener("touchstart", onTouchStart as any);
      window.removeEventListener("touchmove", onTouchMove as any);
    };
  }, [isScrollingProgrammatically]);

  // Products skeleton for loading state
  const ProductsSkeleton = () => {
    const items = Array.from({ length: 8 });
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-5 sm:gap-4 px-3 sm:px-0">
        {items.map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/80 border border-black/5 shadow-sm overflow-hidden animate-pulse"
          >
            <div className="w-full aspect-[4/3] bg-gray-200/80" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-16 bg-gray-200 rounded-full" />
              <div className="h-4 w-3/4 bg-gray-200 rounded-md" />
              <div className="h-3 w-1/2 bg-gray-200 rounded-md" />
              <div className="h-4 w-1/3 bg-gray-200 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Observe inline categories row; when it leaves viewport, sticky overlay can take over
  useEffect(() => {
    if (!inlineCatsRef.current) return;
    const headerOffset = (() => {
      try {
        const cs = getComputedStyle(document.documentElement);
        const h = parseFloat(cs.getPropertyValue('--header-h')) || 72;
        const safe = parseFloat(cs.getPropertyValue('--safe-top')) || 0;
        return h + safe + 4; // small cushion
      } catch { return 76; }
    })();

    const io = new IntersectionObserver(
      ([entry]) => {
        setInlineInView(!!entry.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: `-${headerOffset}px 0px 0px 0px` }
    );
    io.observe(inlineCatsRef.current);
    return () => io.disconnect();
  }, []);

  // Parallax value computed only on client
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf: number | null = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setParallaxY(window.scrollY * 0.1);
        raf = null;
      });
    };
    // initial value
    setParallaxY(window.scrollY * 0.1);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Для кнопки "Смотреть каталог"
  const [isHovered, setIsHovered] = useState(false);

  // --- Modal state for hero slides ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState<number | null>(null);
  const openModal = (i: number) => { setActiveSlide(i); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setActiveSlide(null); document.body.style.overflow = ''; };

  // Close on ESC
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isModalOpen]);

  // Lock body scroll when modal is open
  // Lock body scroll when modal is open
useEffect(() => {
  const originalStyle = window.getComputedStyle(document.body).overflow;
  
  if (isModalOpen) {
    document.body.style.overflow = 'hidden';
  }
  
  return () => {
    document.body.style.overflow = originalStyle;
  };
}, [isModalOpen]);
// Лочим скролл, пока открыт мобильный/планшетный Drawer фильтров
useEffect(() => {
  const originalStyle = window.getComputedStyle(document.body).overflow;
  if (isFilterOpen) {
    document.body.style.overflow = 'hidden';
  }
  return () => {
    document.body.style.overflow = originalStyle;
  };
}, [isFilterOpen]);
  // --- HERO SLIDES DATA ---
  const slides = [
    {
      type: "image" as const,
      src: "/img/acne x kappa.webp", // помести файл баннера сюда
      title: "ACNE STUDIOS × KAPPA",
      subtitle: "Коллаборация сезона: минимализм Acne и спортивное ДНК Kappa.",
      modal: {
        title: "Acne Studios × Kappa",
        text: "Капсульная коллекция: свитшоты, трикотаж, аксессуары. Лимитированные цвета и вышитые лого.",
        ctas: [
          { label: "Смотреть одежду", hash: "#clothes" },
          { label: "Аксессуары", hash: "#accessories" }
        ]
      }
    },
    {
      type: "image" as const,
      src: "/img/скидочки.jpeg",
      title: "STAGE SNEAKERS",
      subtitle: "Добро пожаловать в наш каталог. Открой для себя лимитированные кроссовки и эксклюзивные коллекции!",
      modal: {
        title: "О каталоге",
        text: "Мы собираем редкие релизы, лимитированные партии и классические модели. Доставка по РФ и удобная оплата.",
        ctas: [
          { label: "Перейти к кроссовкам", hash: "#footwear" },
          { label: "Открыть каталог", hash: "#clothes" }
        ]
      }
    },
    {
      type: "image" as const,
      src: "/img/промо.jpg",
      title: "НОВАЯ КОЛЛЕКЦИЯ",
      subtitle: "Встречай свежие поступления эксклюзивных моделей прямо сейчас!",
      modal: {
        title: "Новая коллекция",
        text: "Еженедельно пополняем ассортимент. Отслеживаем размерные сетки и лучшие цены.",
        ctas: [
          { label: "Смотреть новинки", hash: "#clothes" },
          { label: "Аксессуары", hash: "#accessories" }
        ]
      }
    },
    {
      type: "image" as const,
      src: "/img/гугле.webp",
      title: "SALE ДО 50%",
      subtitle: "Поймай лучшие скидки сезона в нашем магазине!",
      modal: {
        title: "Скидки",
        text: "Скидка считается от минимальной цены среди размеров. Успей забрать последние размеры!",
        ctas: [
          { label: "Все предложения", hash: "#footwear" },
          { label: "Сумки", hash: "#bags" }
        ]
      }
    },
    {
      type: "video" as const,
      src: "/img/banner.mp4",
      title: "STAGE VIDEO",
      subtitle: "Погрузись в атмосферу вместе с нами.",
      modal: {
        title: "О бренде Stage",
        text: "Мы за честные цены, проверенную подлинность и доставку без задержек.",
        ctas: [
          { label: "Контакты", hash: "#accessories" },
          { label: "Каталог", hash: "#footwear" }
        ]
      }
    }
  ];


  const parseHash = useCallback((): { main: string | null; sub: string | null } => {
    if (typeof window === 'undefined') return { main: null, sub: null };
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return { main: null, sub: null };
    const [mainRaw, subRaw] = raw.split('/');
    const main = normalizeCategory(mainRaw);
    const sub = normalizeSub(subRaw ?? null);
    return { main, sub };
  }, [normalizeCategory, normalizeSub]);


  // Плавный скролл к элементу с учётом высоты шапки
  const smoothScrollToElement = useCallback((element: HTMLElement) => {
    setIsScrollingProgrammatically(true);

    const getHeaderOffset = () => {
      try {
        const cs = getComputedStyle(document.documentElement);
        const h = parseFloat(cs.getPropertyValue('--header-h')) || 80;
        const safe = parseFloat(cs.getPropertyValue('--safe-top')) || 0;
        return h + safe + 10; // небольшой зазор
      } catch {
        return 90;
      }
    };

    const scrollNow = () => {
      const rect = element.getBoundingClientRect();
      const target = window.scrollY + rect.top - getHeaderOffset();
      window.scrollTo({ top: target, behavior: 'smooth' });

      // проверка через небольшой интервал и мягкая коррекция, если нужно
      window.setTimeout(() => {
        const rect2 = element.getBoundingClientRect();
        const target2 = window.scrollY + rect2.top - getHeaderOffset();
        if (Math.abs(target2 - window.scrollY) > 4) {
          window.scrollTo({ top: target2, behavior: 'smooth' });
        }
      }, 320);

      window.setTimeout(() => setIsScrollingProgrammatically(false), 1000);
    };

    // даём вначале примениться состояниям/оверлею
    requestAnimationFrame(scrollNow);
  }, []);

  // Обработчики событий выбора категорий
  useEffect(() => {
    const handleSubcategorySelect = (e: CustomEvent) => {
      const { anchor, sub } = e.detail || {};
      if (!anchor) return;
      setSubFilter(prev => ({ ...prev, [anchor]: sub && sub !== 'all' ? sub : null }));
      // скролл выполняется внутри компонента Categories; здесь не дублируем
    };

    const handleCategorySelect = (e: CustomEvent) => {
      const { anchor } = e.detail || {};
      if (!anchor) return;
      setSubFilter(prev => ({ ...prev, [anchor]: prev[anchor] ?? null }));
      // скролл выполняется внутри компонента Categories; здесь не дублируем
    };

    window.addEventListener('subcategory:select', handleSubcategorySelect as EventListener);
    window.addEventListener('category:select', handleCategorySelect as EventListener);

    return () => {
      window.removeEventListener('subcategory:select', handleSubcategorySelect as EventListener);
      window.removeEventListener('category:select', handleCategorySelect as EventListener);
    };
  }, []);

  // Синхронизация с hash
  useEffect(() => {
    const applyFromHash = () => {
      const { main, sub } = parseHash();
      if (!main) return;
      setSubFilter(prev => ({ ...prev, [main]: sub }));
      // скролл по hash выполняется в Categories, чтобы не было двойных прыжков
    };

    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, [parseHash]);

  // Категории, порядок, соответствия
  const idMap: Record<string, number> = {
    footwear: 1,     // Обувь
    clothes: 2,      // Одежда
    headwear: 3,     // Головные уборы
    fragrance: 4,    // Парфюмерия
    bags: 5,         // Сумки и рюкзаки
    accessories: 6   // Аксессуары
  };

  // Группировка товаров по категориям
  const byMain = useMemo(() => {
    const result: Record<string, any[]> = {};
    for (const p of catalog) {
      const main = normalizeCategory(getRawCategory(p as any));
      (result[main] ||= []).push(p);
    }
    return result;
  }, [catalog, normalizeCategory, getRawCategory]);

  return (
    <>
      {/* Анимация Premium */}
      <AnimatePresence>
        {showAnimation && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="fixed bottom-0 left-0 right-0 h-screen bg-black flex justify-center items-center text-white text-4xl font-bold z-50"
          >
            <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 1 }} className="relative">
              Premium
              <Image src="/img/звезддочкиии.png" alt="Stars" width={40} height={40} className="absolute -top-4 -right-4 animate-spin" />
              <Image src="/img/звездочкиии.png" alt="Stars" width={40} height={40} className="absolute -bottom-4 -left-4 animate-spin" />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>


      <div
        className="relative z-0 w-screen overflow-hidden h-[380px] md:h-[520px] lg:h-[600px] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1224]"
        onMouseLeave={() => setHoveredSide(null)}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-10 top-10 w-64 h-64 bg-emerald-400/20 blur-3xl rounded-full" />
          <div className="absolute right-[-40px] bottom-[-60px] w-72 h-72 bg-indigo-500/25 blur-[70px] rounded-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/55" />
        </div>
        {/*
          HERO SLIDES DATA
        */}
        <Swiper
          modules={[Autoplay, Pagination]}
          loop={true}
          autoplay={{
            delay: 4000,
            disableOnInteraction: false,
          }}
          pagination={{
            clickable: true,
            el: ".swiper-pagination",
            type: "bullets",
            renderBullet: function (index, className) {
              return `<span class="${className}"></span>`;
            },
          }}
          speed={1000}
          className="w-full h-full transition-transform duration-1000 ease-in-out"
          onSwiper={(swiper) => (swiperRef.current = swiper)}
        >
          {slides.map((slide, index) => (
            <SwiperSlide key={index}>
              <div
                className="relative w-full h-full will-change-transform"
                style={{ transform: `translateY(${parallaxY}px)` }}
              >
                {slide.type === "image" ? (
                  <Image
                    src={slide.src}
                    alt={`Slide ${index + 1}`}
                    fill
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  >
                    <source src={slide.src} type="video/mp4" />
                    Ваш браузер не поддерживает видео.
                  </video>
                )}
                <div className="absolute inset-0 flex items-center justify-center text-white text-center px-6 z-10">
                  <div>
                    <h1 className="text-4xl md:text-6xl font-extrabold mb-4">{slide.title}</h1>
                    <p className="text-lg md:text-xl mb-6 max-w-xl mx-auto text-gray-300">
                      {slide.subtitle}
                    </p>

                    {/* Кнопка: только обычная без премиум */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        className={`px-7 py-3 rounded-full font-bold transition-all duration-300 shadow-lg ${
                          isHovered
                            ? "bg-black text-white shadow-black/30 scale-[1.02]"
                            : "bg-white/90 text-black shadow-white/20 hover:shadow-white/40"
                        }`}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        onClick={() => openModal(index)}
                      >
                        Смотреть каталог
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
        <div className="swiper-pagination"></div>

        {hoveredSide === "left" && (
          <div
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-30 cursor-pointer"
            onClick={() => swiperRef.current?.slidePrev()}
            onMouseEnter={() => setHoveredSide("left")}
          >
            <div className="text-white hover:scale-125 transition-transform duration-300">
              <ChevronLeft size={36} />
            </div>
          </div>
        )}

        {hoveredSide === "right" && (
          <div
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-30 cursor-pointer"
            onClick={() => swiperRef.current?.slideNext()}
            onMouseEnter={() => setHoveredSide("right")}
          >
            <div className="text-white hover:scale-125 transition-transform duration-300">
              <ChevronRight size={36} />
            </div>
          </div>
        )}

        <div 
          className={`absolute left-0 top-0 h-full w-1/3 z-20 ${hoveredSide === "left" ? "cursor-arrow-left" : ""}`} 
          onMouseEnter={() => setHoveredSide("left")}
          onMouseLeave={() => setHoveredSide(null)}
        />
        <div 
          className={`absolute right-0 top-0 h-full w-1/3 z-20 ${hoveredSide === "right" ? "cursor-arrow-right" : ""}`} 
          onMouseEnter={() => setHoveredSide("right")}
          onMouseLeave={() => setHoveredSide(null)}
        />

      </div>

      {/* Stories bar */}
      <div className="w-full">
        <Stories />
      </div>

      {/* Sticky categories overlay (no background, only buttons). Appears when inline row is out of view and user scrolls up. */}
      <AnimatePresence>
        {(!inlineInView && (scrollDirection === 'up' || isAtTop)) && (
          <motion.div
            id="cats-sticky-overlay"
            className="fixed left-0 right-0 z-[90] pointer-events-none"
            style={{ top: 'calc(var(--header-h,72px) + 8px)' }}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <div className="max-w-[1200px] mx-auto px-6 pointer-events-auto">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
                <div id="cats-sticky-host" className="flex-1 min-w-0 pr-2 pl-3 sm:pl-0">
                  <Categories
                    mode="sticky"
                    subcatsByCat={subcatsByCat}
                    activeSub={subFilter}
                    onSelectSub={(cat, sub) => setSubFilter((p) => ({ ...p, [cat]: sub }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(true)}
                  className="lg:hidden shrink-0 w-[92px] mr-3 sm:mr-0 inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-black text-white px-3 py-2 text-xs font-semibold"
                  aria-label={`Открыть фильтры${activeFiltersCount ? ` (${activeFiltersCount})` : ""}`}
                >
                  <span>Фильтры{activeFiltersCount ? ` (${activeFiltersCount})` : ""}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Inline categories + Sort (normal flow). This is the anchor we observe. */}
      <div ref={inlineCatsRef}>
        <Container className="flex items-start gap-1 sm:gap-2 mt-4">
          <div id="cats-inline-host" className="relative z-10 flex-1 min-w-0 pr-2 pl-3 sm:pl-0">
            <Categories
              mode="inline"
              subcatsByCat={subcatsByCat}
              activeSub={subFilter}
              onSelectSub={(cat, sub) => setSubFilter((p) => ({ ...p, [cat]: sub }))}
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 relative z-10 ml-auto mt-[4px]">
            <Link
              href="/premium"
              className="inline-flex items-center gap-2 rounded-2xl bg-black text-white px-5 py-2.5 text-sm font-semibold shadow-sm hover:bg-white hover:text-black hover:shadow-md transition"
            >
              <span className="text-xs uppercase tracking-[0.16em] opacity-70">
                Premium
              </span>
              <span>Эксклюзивный раздел</span>
            </Link>
          </div>
          {/* Кнопка открытия фильтров на мобилке */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="lg:hidden relative z-10 shrink-0 w-[92px] mr-3 sm:mr-0 rounded-xl border border-black/10 bg-black text-white px-3 py-2 text-xs font-semibold"
            aria-label={`Открыть фильтры${activeFiltersCount ? ` (${activeFiltersCount})` : ""}`}
          >
            Фильтры{activeFiltersCount ? ` (${activeFiltersCount})` : ""}
          </button>
        </Container>
      </div>
      {/* Premium button for mobile (full-width under categories) */}
      <div className="sm:hidden px-4 mt-3">
        <Link
          href="/premium"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black text-white px-5 py-2.5 text-sm font-semibold shadow-sm hover:bg-white hover:text-black hover:shadow-md transition"
        >
          <span className="text-xs uppercase tracking-[0.16em] opacity-70">
            Premium
          </span>
          <span>Эксклюзивный раздел</span>
        </Link>
      </div>
      <Container className="mt-10 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
          {/* SIDEBAR (desktop) */}
          <aside className="hidden lg:block sticky top-[calc(var(--header-h,72px)+16px)] self-start rounded-2xl bg-white/80 supports-[backdrop-filter]:bg-white/60 backdrop-blur border border-black/10 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            {/* Бренды: поиск + чек-лист */}
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-black/60 mb-2">Бренды</p>
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Поиск бренда…"
                className="w-full mb-3 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 placeholder:text-black/30"
              />
              <div className="max-h-[220px] overflow-auto rounded-lg border border-black/10 divide-y divide-black/5">
                {allBrands
                  .filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()))
                  .slice(0, 50)
                  .map((b) => (
                    <label key={b} className="flex items-center gap-2 text-sm px-2 py-2 hover:bg-black/[0.02]">
                      <input
                        type="checkbox"
                        checked={selectedBrands.has(b)}
                        onChange={() => toggleBrand(b)}
                        className="accent-black"
                      />
                      <span className="line-clamp-1 text-black/80">{b}</span>
                    </label>
                  ))}
                {!allBrands.length && (
                  <div className="px-2 py-3">
                    <p className="text-xs text-gray-500">Бренды появятся после загрузки товаров</p>
                  </div>
                )}
              </div>
            </div>

            <hr className="my-4 border-black/10" />

            {/* Категории */}
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-black/60 mb-2">Категории</p>
              <div className="rounded-lg border border-black/10 divide-y divide-black/5">
                {allCats.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm px-2 py-2 hover:bg-black/[0.02]">
                    <input
                      type="checkbox"
                      checked={selectedCats.has(c)}
                      onChange={() => toggleCat(c)}
                      className="accent-black"
                    />
                    <span className="text-black/80">{LABELS[c] ?? c}</span>
                  </label>
                ))}
              </div>
            </div>

            <hr className="my-4 border-black/10" />

            {/* Цена */}
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-black/60 mb-2">Цена</p>
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min={priceStats.min}
                  max={priceMax}
                  value={priceMin}
                  onChange={(e) => setPriceMin(Math.min(Number(e.target.value) || 0, priceMax))}
                  className="w-24 rounded-md border border-black/15 px-2 py-1 focus:border-black/40 focus:outline-none"
                />
                <span className="text-gray-500">—</span>
                <input
                  type="number"
                  min={priceMin}
                  max={priceStats.max}
                  value={priceMax}
                  onChange={(e) => setPriceMax(Math.max(Number(e.target.value) || 0, priceMin))}
                  className="w-24 rounded-md border border-black/15 px-2 py-1 focus:border-black/40 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-500 text-right whitespace-nowrap">
                мин: {fmtPrice(priceStats.min)} ₽ • макс: {fmtPrice(priceStats.max)} ₽
              </p>
              {/* Двойной ползунок — два range */}
              <div className="mt-3 space-y-2">
                <input
                  type="range"
                  min={priceStats.min}
                  max={priceStats.max}
                  value={priceMin}
                  onChange={(e) => setPriceMin(Math.min(Number(e.target.value) || 0, priceMax))}
                  className="w-full ui-range"
                />
                <input
                  type="range"
                  min={priceStats.min}
                  max={priceStats.max}
                  value={priceMax}
                  onChange={(e) => setPriceMax(Math.max(Number(e.target.value) || 0, priceMin))}
                  className="w-full ui-range"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={resetFilters}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-black hover:text-white transition"
              >
                Сбросить
              </button>
            </div>
          </aside>


          {/* PRODUCTS BY CATEGORY */}
          <section className="space-y-10">
            {isProductsLoading ? (
              <ProductsSkeleton />
            ) : (
              <>
                {!sectionOrder.length && (
                  <div className="text-center text-sm text-gray-500 py-8">
                    По выбранным фильтрам ничего не найдено
                  </div>
                )}

                {sectionOrder.map((main, idx) => {
              const items = groupedVisible[main] || [];
              if (!items.length) return null;
              const anchorId = idMap[main] ? `category-${idMap[main]}` : undefined;
              return (
                <div
                  key={`sec-${main}`}
                  data-anchor={main}
                  id={anchorId}
                  className="scroll-mt-[calc(var(--header-h,72px)+16px)] px-3 sm:px-0"
                  style={{ scrollMarginTop: 'calc(var(--header-h,72px) + 16px)' }}
                >
                  <div className="mb-3 flex items-baseline justify-between">
                    <h3 className="text-lg sm:text-xl font-bold">{LABELS[main] ?? main}</h3>
                    {(visibleByCat[main] ?? DEFAULT_COUNT) > DEFAULT_COUNT && (
                      <button
                        type="button"
                        onClick={() => {
                          setVisibleByCat((p) => ({ ...p, [main]: Math.min(DEFAULT_COUNT, items.length) }));
                          const el = document.querySelector(`[data-anchor="${main}"]`) as HTMLElement | null;
                          if (el) smoothScrollToElement(el);
                        }}
                        className="text-xs sm:text-sm text-gray-500 hover:text-black transition inline-flex items-center gap-1"
                        aria-label="Скрыть дополнительные товары"
                        title="Скрыть товары"
                      >
                        <span aria-hidden>−</span>
                        <span>Скрыть товары</span>
                      </button>
                    )}
                  </div>
                  {(() => {
                    const limit = visibleByCat[main] ?? DEFAULT_COUNT;
                    const list = items.slice(0, limit);
                    return (
                      <>
                        <motion.div
                          layout
                          className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-5 sm:gap-4"
                        >
                          {list.map((product: any) => {
                            const imgSrc =
                              (Array.isArray(product?.images) && product.images[0]) ||
                              product?.imageUrl ||
                              "/img/placeholder.png";
                          const imagesArr =
                            Array.isArray(product?.images) && product.images.length
                              ? product.images
                              : [imgSrc];
                          const key = String(product.id);
                          const activeIdxRaw = cardImageIndex[key] ?? 0;
                          const activeIdx =
                            activeIdxRaw >= 0 && activeIdxRaw < imagesArr.length
                              ? activeIdxRaw
                              : 0;
                          const activeSrc = imagesArr[activeIdx] || imgSrc;
                            const sub = productSubNormalized(product);
                            const cat = normalizeCategory(getRawCategory(product as any));
                            const typeKey = sub ?? cat;
                            const TYPE_LABELS: Record<string, string> = {
                              sneakers: "Кроссовки",
                              boots: "Ботинки",
                              sandals: "Сандалии",
                              tshirts: "Футболка",
                              hoodies: "Худи",
                              bags: "Сумка",
                              headwear: "Головной убор",
                              accessories: "Аксессуар",
                              fragrance: "Парфюм",
                              clothes: "Одежда",
                              footwear: "Обувь",
                            };
                            const typeLabel = TYPE_LABELS[typeKey] ?? (LABELS[cat] ?? "");
                            const brandName = extractBrand(product);
                            // Try to take the first sentence of any description-like field
                            let descToShow = firstSentence(pickDescription(product));
                            // If there is no textual description in the DB, compose a compact technical snippet
                            if (!descToShow) {
                              const genderMap: Record<string, string> = {
                                unisex: 'унисекс',
                                male: 'мужское',
                                female: 'женское',
                                men: 'мужское',
                                women: 'женское',
                                woman: 'женское',
                                man: 'мужское',
                              };

                              const parts: string[] = [];

                              // --- Категорийные фишки ----------------------------------------
                              // 1) ДУХИ: ноты (верхние / средние / базовые)
                              if (cat === 'fragrance' && (product as any)?.fragranceNotes) {
                                const fn = (product as any).fragranceNotes;
                                if (fn && typeof fn === 'object') {
                                  const tops = Array.isArray(fn.top) ? fn.top : [];
                                  const middles = Array.isArray(fn.middle) ? fn.middle : [];
                                  const bases = Array.isArray(fn.base) ? fn.base : [];

                                  const candidates = [...tops, ...middles, ...bases].filter(
                                    (v) => typeof v === 'string' && v.trim()
                                  );

                                  const uniqueNotes: string[] = [];
                                  for (const note of candidates) {
                                    const trimmed = note.trim();
                                    if (!uniqueNotes.includes(trimmed)) uniqueNotes.push(trimmed);
                                    if (uniqueNotes.length >= 2) break;
                                  }

                                  if (uniqueNotes.length === 1) {
                                    parts.push(uniqueNotes[0]);
                                  } else if (uniqueNotes.length >= 2) {
                                    parts.push(`${uniqueNotes[0]}, ${uniqueNotes[1]}`);
                                  }
                                }
                              }

                              // 2) ЮВЕЛИРКА: материалы (металл + камни)
                              const rawCat = String(
                                (product as any)?.categorySlug ??
                                (product as any)?.category ??
                                (product as any)?.type ??
                                ''
                              ).toLowerCase();

                              const isJewelry =
                                cat === 'accessories' ||
                                rawCat.includes('jewel') ||
                                !!(product as any)?.jewelryType;

                              if (isJewelry) {
                                const materialsSrc =
                                  (product as any)?.materials ??
                                  (product as any)?.material ??
                                  (product as any)?.metal ??
                                  null;

                                const matList: string[] = [];

                                if (Array.isArray(materialsSrc)) {
                                  for (const m of materialsSrc) {
                                    if (typeof m === 'string' && m.trim()) matList.push(m.trim());
                                  }
                                } else if (typeof materialsSrc === 'string' && materialsSrc.trim()) {
                                  matList.push(materialsSrc.trim());
                                }

                                const stone =
                                  (product as any)?.stone ??
                                  (product as any)?.stones ??
                                  (product as any)?.gemstone;

                                if (typeof stone === 'string' && stone.trim()) {
                                  matList.push(stone.trim());
                                }

                                if (matList.length) {
                                  // Не засоряем строку: максимум два материала/камня
                                  parts.push(matList.slice(0, 2).join(' • '));
                                }
                              }

                              // 3) СУМКИ: внешний материал + подкладка
                              if (cat === 'bags') {
                                const outer =
                                  (product as any)?.outerMaterial ??
                                  (product as any)?.materialOuter ??
                                  (product as any)?.material ??
                                  null;
                                const lining =
                                  (product as any)?.liningMaterial ??
                                  (product as any)?.innerMaterial ??
                                  (product as any)?.insideMaterial ??
                                  null;

                                const bagParts: string[] = [];
                                if (typeof outer === 'string' && outer.trim()) {
                                  bagParts.push(`снаружи: ${outer.trim()}`);
                                }
                                if (typeof lining === 'string' && lining.trim()) {
                                  bagParts.push(`подкладка: ${lining.trim()}`);
                                }
                                if (bagParts.length) {
                                  parts.push(bagParts.join(', '));
                                }
                              }

                              // --- Общая техническая часть (для всех категорий) --------------
                              if (typeLabel) parts.push(typeLabel); // e.g., Кроссовки, Худи, Парфюм

                              const gKey = String((product as any)?.gender || '').toLowerCase();
                              if (genderMap[gKey]) parts.push(genderMap[gKey]);

                              const vol = Number((product as any)?.volume);
                              if (Number.isFinite(vol) && vol > 0) parts.push(`${vol} мл`);

                              const colorName =
                                ((product as any)?.Color &&
                                  (((product as any).Color as any).name ||
                                    ((product as any).Color as any).title)) ||
                                ((product as any)?.color &&
                                  (((product as any).color as any).name ||
                                    ((product as any).color as any).title)) ||
                                (product as any)?.colorName ||
                                '';

                              if (colorName) parts.push(String(colorName));

                              const sizeType = String((product as any)?.sizeType || '').trim();
                              if (sizeType && sizeType.toUpperCase() !== 'NONE') parts.push(sizeType);

                              descToShow = parts.join(' • ');
                            }
                            return (
                              <motion.div
                                layout
                                key={product.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                              >
                                <a
                                  id={`product-${product.id}`}
                                  href={`/product/${product.id}`}
                                  className="group rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5 hover:ring-black/10 hover:shadow-md transition-transform hover:-translate-y-0.5 will-change-transform [contain:content]"
                                  onClick={(e) => {
                                    if (typeof window === 'undefined') return;
                                    const isMobile = window.innerWidth <= 768;
                                    if (!isMobile) return;
                                    if (!imagesArr.length || imagesArr.length === 1) return;
                                    e.preventDefault();
                                    const key = String(product.id);
                                    setCardImageIndex((prev) => {
                                      const current = prev[key] ?? 0;
                                      const next = (current + 1) % imagesArr.length;
                                      return { ...prev, [key]: next };
                                    });
                                  }}
                                >
                                  <div
                                    className="relative w-full aspect-[4/3] bg-white overflow-hidden"
                                    onMouseMove={(e) => {
                                      if (!imagesArr.length || imagesArr.length === 1) return;
                                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                      const x = e.clientX - rect.left;
                                      const ratio = rect.width > 0 ? x / rect.width : 0;
                                      let idx = Math.floor(ratio * imagesArr.length);
                                      if (idx < 0) idx = 0;
                                      if (idx >= imagesArr.length) idx = imagesArr.length - 1;
                                      const key = String(product.id);
                                      setCardImageIndex((prev) => {
                                        if (prev[key] === idx) return prev;
                                        return { ...prev, [key]: idx };
                                      });
                                    }}
                                    onMouseLeave={() => {
                                      if (!imagesArr.length || imagesArr.length === 1) return;
                                      const key = String(product.id);
                                      setCardImageIndex((prev) => {
                                        if (prev[key] === 0 || prev[key] === undefined) return prev;
                                        return { ...prev, [key]: 0 };
                                      });
                                    }}
                                  >
                                    <Image
                                      src={activeSrc}
                                      alt={product.name || "Товар"}
                                      fill
                                      className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                                      priority={false}
                                    />
                                  </div>
                                  <div className="p-3">
                                    {brandName && (
                                      <div className="text-[10px] uppercase tracking-wide text-black/50 leading-none mb-1">
                                        {brandName}
                                      </div>
                                    )}
                                    <h2 className="font-semibold text-sm leading-snug line-clamp-2">
                                      {product.name}
                                    </h2>
                                    {typeLabel && (
                                      <div className="mt-1 text-[12px] font-semibold text-black">{typeLabel}</div>
                                    )}
                                    {descToShow && (
                                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{descToShow}</p>
                                    )}
                                    <div className="mt-2 flex items-baseline gap-2">
                                      {product?.oldPrice &&
                                        Number(product.oldPrice) > Number(product.price) && (
                                          <span className="text-[11px] text-gray-400 line-through">
                                            {fmtPrice(product.oldPrice)} ₽
                                          </span>
                                        )}
                                      {(() => {
                                        const minPrice = getMinPrice(product) || Number(product.price) || 0;
                                        return (
                                          <span className="text-sm font-semibold">
                                            от {fmtPrice(minPrice)} ₽
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </a>
                              </motion.div>
                            );
                          })}
                        </motion.div>

                        {/* Show more (always visible; disabled if нечего догружать) */}
                        <div className="mt-4 flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (items.length <= limit) return;
                              setVisibleByCat((p) => ({
                                ...p,
                                [main]: Math.min((p[main] ?? DEFAULT_COUNT) + LOAD_STEP, items.length),
                              }));
                            }}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-black/15 transition text-sm ${
                              items.length > limit ? "hover:bg-black hover:text-white" : "opacity-50 cursor-not-allowed"
                            }`}
                            aria-label="Показать больше товаров"
                            disabled={items.length <= limit}
                            title={items.length <= limit ? "Больше товаров нет" : "Показать больше"}
                          >
                            <span className="text-lg leading-none" aria-hidden>＋</span>
                            <span>Показать больше</span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              );
                })}
              </>
            )}
          </section>
        </div>
      </Container>
      {/* MOBILE FILTERS DRAWER */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            key="filters-drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center"
            aria-modal="true"
            role="dialog"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />
            <motion.div
              initial={{ y: 24, scale: 1, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 16, scale: 1, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.22 }}
              className="relative z-[1201] w-full sm:max-w-[520px] rounded-t-2xl sm:rounded-2xl bg-white shadow-xl p-4 sm:p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-base font-semibold">Фильтры</p>
                <button onClick={() => setIsFilterOpen(false)} aria-label="Закрыть" className="text-black/60 hover:text-black">✕</button>
              </div>

              {/* Бренды */}
              <div className="mb-4">
                <p className="text-sm font-semibold mb-2">Бренды</p>
                <input
                  type="text"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="Поиск бренда…"
                  className="w-full mb-3 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <div className="max-h-[180px] overflow-auto pr-1 grid grid-cols-2 gap-2">
                  {allBrands
                    .filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()))
                    .slice(0, 60)
                    .map((b) => (
                      <label key={`m-${b}`} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedBrands.has(b)}
                          onChange={() => toggleBrand(b)}
                          className="accent-black"
                        />
                        <span className="truncate">{b}</span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Категории */}
              <div className="mb-4">
                <p className="text-sm font-semibold mb-2">Категории</p>
                <div className="grid grid-cols-2 gap-2">
                  {allCats.map((c) => (
                    <label key={`m-${c}`} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedCats.has(c)}
                        onChange={() => toggleCat(c)}
                        className="accent-black"
                      />
                      <span className="truncate">{LABELS[c] ?? c}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Цена */}
              <div className="mb-4">
                <p className="text-sm font-semibold mb-2">Цена</p>
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="number"
                    min={priceStats.min}
                    max={priceMax}
                    value={priceMin}
                    onChange={(e) => setPriceMin(Math.min(Number(e.target.value) || 0, priceMax))}
                    className="w-28 rounded-md border border-black/10 px-2 py-2"
                  />
                  <span className="text-gray-500">—</span>
                  <input
                    type="number"
                    min={priceMin}
                    max={priceStats.max}
                    value={priceMax}
                    onChange={(e) => setPriceMax(Math.max(Number(e.target.value) || 0, priceMin))}
                    className="w-28 rounded-md border border-black/10 px-2 py-2"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <input
                    type="range"
                    min={priceStats.min}
                    max={priceStats.max}
                    value={priceMin}
                    onChange={(e) => setPriceMin(Math.min(Number(e.target.value) || 0, priceMax))}
                    className="w-full ui-range"
                  />
                  <input
                    type="range"
                    min={priceStats.min}
                    max={priceStats.max}
                    value={priceMax}
                    onChange={(e) => setPriceMax(Math.max(Number(e.target.value) || 0, priceMin))}
                    className="w-full ui-range"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  мин: {fmtPrice(priceStats.min)} ₽ • макс: {fmtPrice(priceStats.max)} ₽
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={resetFilters}
                  className="w-1/2 rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black hover:text-white transition"
                >
                  Сбросить
                </button>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="w-1/2 rounded-lg bg-black text-white px-3 py-2 text-sm font-semibold"
                >
                  Применить{activeFiltersCount ? ` (${activeFiltersCount})` : ""}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Footer */}
      <style jsx global>{`
  /* Desktop/Laptop: show categories fully (wrap) and avoid clipping */
  #cats-inline-host [role="tablist"],
  #cats-sticky-host [role="tablist"] {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    overflow: visible;
    white-space: normal;
  }
  /* Swiper pagination/bullets */
  .swiper-pagination {
    bottom: 20px !important;
    z-index: 20 !important;
    position: absolute !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    width: 100% !important;
    left: 0 !important;
    transform: none !important;
  }
  .swiper-pagination-bullet {
    position: relative;
    width: 10px;
    height: 10px;
    border-radius: 9999px;
    background-color: #000;
    opacity: 0.3;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  .swiper-pagination-bullet-active {
    width: 50px;
    height: 6px;
    border-radius: 9999px;
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
  }
  .swiper-pagination-bullet-active::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background-color: black;
    animation: progressFill 4s linear forwards;
    width: 0%;
  }
  @keyframes progressFill {
    0% { width: 0%; }
    100% { width: 100%; }
  }
  .cursor-arrow-left { cursor: url("/img/arrow-left.svg"), auto; }
  .cursor-arrow-right { cursor: url("/img/arrow-right.svg"), auto; }

  /* Filters: consistent, thin, monochrome controls */
  .ui-range {
    height: 20px;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background: transparent !important; /* kill any framework gradient */
    box-shadow: none !important;
    outline: none !important;
    --range-shdw: rgba(0,0,0,0.12) !important; /* some libs read this */
  }
  /* WebKit */
  .ui-range::-webkit-slider-runnable-track {
    height: 2px;
    background: rgba(0,0,0,0.12);
    border-radius: 9999px;
  }
  .ui-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    margin-top: -6px; /* align to 2px track */
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    background: #000;
    border: 1px solid rgba(0,0,0,0.5);
  }
  /* Firefox */
  .ui-range::-moz-range-track {
    height: 2px;
    background: rgba(0,0,0,0.12);
    border-radius: 9999px;
  }
  .ui-range::-moz-range-progress {
    height: 2px;
    background: rgba(0,0,0,0.12); /* same as track – no colored progress */
    border-radius: 9999px;
  }
  .ui-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: 1px solid rgba(0,0,0,0.5);
    border-radius: 9999px;
    background: #000;
  }
  /* IE/Edge Legacy */
  .ui-range::-ms-track {
    height: 2px;
    background: transparent;
    border-color: transparent;
    color: transparent;
  }
  .ui-range::-ms-fill-lower,
  .ui-range::-ms-fill-upper {
    background: rgba(0,0,0,0.12);
    border-radius: 9999px;
  }
  .ui-range::-ms-thumb {
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    background: #000;
    border: 1px solid rgba(0,0,0,0.5);
    margin-top: 0;
  }
  .ui-range:focus,
  .ui-range:focus-visible {
    outline: none !important;
    box-shadow: none !important;
  }

  /* Thin hr replacement (where used) */
  .filters-hr { height: 1px; background: rgba(0,0,0,0.10); }

  /* Remove number input spinners for cleaner mobile UI */
  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type=number] { -moz-appearance: textfield; }

  /* Hide horizontal scrollbar for promo rail (mobile) */
  .scrollbar-none::-webkit-scrollbar { display: none; }
  .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }

  @media (max-width: 640px) {
    /* Main categories: single-row, horizontally scrollable */
    #cats-inline-host [role="tablist"],
    #cats-sticky-host [role="tablist"] {
      display: flex;
      flex-wrap: nowrap !important;
      gap: 8px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      white-space: nowrap;
      scroll-snap-type: x proximity;
      scrollbar-width: none;
    }
    #cats-inline-host [role="tablist"]::-webkit-scrollbar,
    #cats-sticky-host [role="tablist"]::-webkit-scrollbar { display: none; }

    /* Add comfortable side padding so the first/last labels are not flush with screen edges */
    #cats-inline-host [role="tablist"],
    #cats-sticky-host [role="tablist"] {
      padding-left: 16px;
      padding-right: 14px;
    }

    #cats-inline-host [role="tablist"] > *,
    #cats-sticky-host [role="tablist"] > * {
      flex: 0 0 auto;
      scroll-snap-align: center;
    }

    /* Subcategories (chips) may wrap on mobile */
    #cats-inline-host .subcats,
    #cats-sticky-host .subcats,
    #cats-inline-host [data-subcats],
    #cats-sticky-host [data-subcats] {
      display: flex;
      flex-wrap: wrap;
      row-gap: 8px;
      overflow: visible;
      white-space: normal;
    }
  }

  /* Ensure hash/programmable scroll aligns sections below sticky header on all browsers */
  [id^="category-"] { scroll-margin-top: calc(var(--header-h,72px) + 16px); }
  [data-anchor] { scroll-margin-top: calc(var(--header-h,72px) + 16px); }
`}</style>
      <footer className="w-full bg-black text-white py-12 mt-16">
        <div className="px-6 max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 relative">
                  <Image 
                    src="/img/IMG_0363.PNG"
                    alt="StageStore Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <h3 className="text-lg font-bold">StageStore</h3>
              </div>
              <p className="text-gray-400 text-sm">
                Оригинальные кроссовки и одежда от ведущих мировых брендов.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Меню</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/" className="text-gray-400 hover:text-white transition">Главная</a></li>
                <li><a href="/products" className="text-gray-400 hover:text-white transition">Каталог</a></li>
                <li><a href="/premium" className="text-gray-400 hover:text-white transition">Premium</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Помощь</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#shipping" className="text-gray-400 hover:text-white transition">Доставка</a></li>
                <li><a href="#returns" className="text-gray-400 hover:text-white transition">Возврат</a></li>
                <li><a href="#size-guide" className="text-gray-400 hover:text-white transition">Таблица размеров</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Контакты</h3>
              <address className="not-italic text-gray-400 text-sm">
                <p className="mb-2">Москва, ул. Тверская, 12</p>
                <p className="mb-2">
                  <a href="mailto:info@stagestore.ru" className="hover:text-white transition">
                    info@stagestore.ru
                  </a>
                </p>
                <p>
                  <a href="tel:+74951234567" className="hover:text-white transition">
                    +7 (495) 123-45-67
                  </a>
                </p>
              </address>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500">
            <p>© {new Date().getFullYear()} StageStore. Все права защищены.</p>
            <p className="mt-2 md:mt-0 opacity-80">created by: <span className="font-semibold">crym0nt</span> × <span className="font-semibold">proxyess</span></p>
            <p className="mt-2 md:mt-0">Политика конфиденциальности</p>
          </div>
        </div>
      </footer>
      {/* Global HERO Modal (outside hero to avoid clipping and to blur the whole page) */}
      <AnimatePresence>
        {isModalOpen && activeSlide !== null && (
          <motion.div
            key="hero-modal-global"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[2000] flex items-start justify-center pt-10 md:pt-16 lg:pt-20 overflow-y-auto"
            aria-modal="true"
            role="dialog"
          >
            {/* compute promo items for the current slide (only Acne × Kappa) */}
            {(() => {
              const slide = slides[activeSlide];
              const isAcnePromo = /acne\s*studios.*kappa/i.test(
                (slide?.title || '') + ' ' + (slide?.modal?.title || '')
              );

              let promoItems: any[] = [];
              if (isAcnePromo) {
                promoItems = (catalog as any[])
                  .filter((p: any) => Array.isArray(p?.brands) && p.brands.includes('Acne Studios') && p.brands.includes('Kappa'))
                  .slice(0, 3);
                if (!promoItems.length) {
                  const ids = new Set([2001, 2002, 2003]);
                  promoItems = (catalog as any[]).filter((p: any) => ids.has(Number(p?.id))).slice(0, 3);
                }
              }
              // expose to outer scope via window property used right below (hacky but safe inside modal lifetime)
              (window as any).__modalHasPromo = Boolean(promoItems.length);
              (window as any).__modalPromoItems = promoItems;
              return null;
            })()}
            {/* Backdrop: full-page black + strong blur */}
            <div
              className="absolute inset-0 bg-black/55 backdrop-blur-lg supports-[backdrop-filter]:backdrop-blur-xl"
              onClick={closeModal}
            />

            {/* Panel */}
            <motion.div
              initial={{ y: 20, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.98, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="relative z-[2001] w-[92vw] max-w-[860px] rounded-2xl bg-white shadow-2xl p-0 overflow-hidden my-6 md:my-10"
            >
              <button
                aria-label="Закрыть"
                onClick={closeModal}
                className="absolute top-3 right-3 z-20 text-black/70 hover:text-black"
              >
                ✕
              </button>

              {/* Header with image */}
              <div className="relative w-full h-[200px] md:h-[260px] overflow-visible">
                {slides[activeSlide].type === 'image' ? (
                  <Image
                    src={slides[activeSlide].src}
                    alt={slides[activeSlide].title}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-black/5 flex items-center justify-center text-black/50">
                    <span className="text-sm">Видео баннер</span>
                  </div>
                )}

                {/* Centered badge with collection title */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/90 shadow-md backdrop-blur px-3 py-1 text-xs md:text-sm font-semibold text-black">
                    {slides[activeSlide].modal?.title || slides[activeSlide].title}
                  </span>
                </div>

                {/* Short description under the title, above the product cards */}
                <div className="absolute top-12 md:top-14 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-[760px] text-center px-3">
                  <p className="text-base md:text-2xl font-semibold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                    {slides[activeSlide].subtitle}
                  </p>
                </div>

                <div
                  className={`absolute inset-0 bg-gradient-to-t ${
                    (window as any).__modalHasPromo ? 'from-white via-white/60' : 'from-white/80 via-white/40'
                  } to-transparent`}
                />

                {(() => {
                  const promo: any[] = (window as any).__modalPromoItems || [];
                  if (!promo.length) return null;
                  return (
                    <div
                      className="absolute left-1/2 z-20 pointer-events-auto"
                      style={{ bottom: '-140px', transform: 'translateX(-50%)', width: 'min(860px, 92%)' }}
                    >
                      <div className="grid grid-cols-3 gap-6 md:gap-8 place-items-center">
                        {promo.map((it: any) => (
                          <div key={`promo-${it.id}`} className="w-36 md:w-48 flex flex-col items-center text-center">
                            <a
                              href={`/product/${it.id}`}
                              className="relative w-36 h-40 md:w-48 md:h-56 rounded-2xl overflow-hidden bg-white shadow-[0_14px_36px_rgba(0,0,0,0.20)] ring-1 ring-black/10 will-change-transform transform transition duration-300 hover:-translate-y-1 hover:scale-[1.03]"
                              onClick={(e) => {
                                try {
                                  sessionStorage.setItem('lastListRoute', window.location.pathname + window.location.search);
                                  sessionStorage.setItem('lastScrollY', String(window.scrollY));
                                  sessionStorage.setItem('lastProductId', String(it.id));
                                } catch {}
                              }}
                            >
                              <Image
                                src={it.images?.[0] || '/img/placeholder.png'}
                                alt={it.name}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 9rem, 12rem"
                                priority
                              />
                              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/50 to-transparent" />
                            </a>
                            <div className="mt-2 w-full px-1">
                              <p className="text-xs md:text-sm font-medium text-gray-900 line-clamp-1">{it.name}</p>
                              <div className="mt-0.5 flex items-baseline justify-center gap-2">
                                {it?.oldPrice && Number(it.oldPrice) > Number(it.price) && (
                                  <span className="text-[10px] md:text-xs text-gray-400 line-through">{fmtPrice(it.oldPrice)} ₽</span>
                                )}
                                <span className="text-xs md:text-sm font-semibold text-black">{fmtPrice(it.price)} ₽</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Body */}
              <div className={`p-6 md:p-8 ${ (window as any).__modalHasPromo ? 'pt-44 md:pt-52' : 'pt-8 md:pt-10' }`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="space-y-3">
                    <h4 className="font-bold">Почему стоит заглянуть:</h4>
                    <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
                      <li>Лимитированные релизы и эксклюзивы</li>
                      <li>Цены считаются от минимального размера</li>
                      <li>Доставка по РФ, возврат 14 дней</li>
                      <li>Поддержка 24/7</li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold">Быстрые действия:</h4>
                    <div className="flex flex-wrap gap-3">
                      {(slides[activeSlide].modal?.ctas || []).map((c, i) => (
                        <a
                          key={i}
                          href={c.hash}
                          onClick={(e) => {
                            e.preventDefault();
                            const anchor = (c.hash || '').replace('#','');
                            const numericId = (anchor && (anchor in idMap)) ? (idMap as any)[anchor] : null;
                            const el = numericId ? document.getElementById(`category-${numericId}`) : document.querySelector(`[data-anchor="${anchor}"]`);
                            if (el) {
                              closeModal();
                              setTimeout(() => smoothScrollToElement(el as HTMLElement), 50);
                            } else {
                              closeModal();
                              window.location.hash = c.hash;
                            }
                          }}
                          className="px-4 py-2 rounded-full border border-black text-black hover:bg-black hover:text-white transition"
                        >
                          {c.label}
                        </a>
                      ))}
                    </div>

                    <div className="pt-4 flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        Гарантия подлинности
                      </div>
                      <div className="hidden md:flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                        Безопасная оплата
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
