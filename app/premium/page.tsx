/* eslint-disable */
"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion, Variants } from "framer-motion";
import { useTitle } from "@/context/TitleContext"; // Импортируем контекст
import Link from "next/link";
import { products } from "@/data/products";
import { Categories } from "@/components/shared/categories";
import { usePathname, useSearchParams, useRouter } from "next/navigation";


// Локальные подписи основных и некоторых подкатегорий, чтобы не зависеть от внешнего taxonomy
const LABELS: Record<string, string> = {
  footwear: 'Обувь',
  clothes: 'Одежда',
  bags: 'Сумки',
  accessories: 'Аксессуары',
  fragrance: 'Парфюмерия',
  headwear: 'Головные уборы',
  // подкатегории
  sneakers: 'Кроссовки',
  boots: 'Ботинки',
  sandals: 'Сандалии',
  tshirts: 'Футболки',
  hoodies: 'Худи',
  sweatshirts: 'Свитшоты',
  pants: 'Брюки',
  shorts: 'Шорты',
  bracelets: 'Браслеты',
  necklaces: 'Подвески',
  rings: 'Кольца',
  chains: 'Цепи',
  watches: 'Часы',
  tote: 'Шопперы',
  backpack: 'Рюкзаки',
  crossbody: 'На плечо',
  edt: 'Туалетная вода',
  edp: 'Парфюмированная вода',
  extrait: 'Экстракт',
};

const ORDERED_SUBS: Record<string, string[]> = {
  footwear: ['sneakers','boots','sandals'],
  clothes: ['tshirts','hoodies','sweatshirts','pants','shorts'],
  accessories: ['bracelets','necklaces','rings','chains','watches'],
  bags: ['tote','backpack','crossbody'],
  fragrance: ['edt','edp','extrait'],
  headwear: ['caps','beanies','bandanas'],
};

const getOrderedSubcategories = (key: string): string[] => ORDERED_SUBS[key] ?? [];

// Канонические якоря категорий и алиасы, чтобы совпадало с Categories.tsx
const CANONICAL_ORDER: string[] = ['footwear','clothes','accessories','bags','fragrance','headwear'];
const CATEGORY_ALIASES: Record<string, string> = {
  shoes: 'footwear',
  shoe: 'footwear',
  sneakers: 'footwear', // как главная категория (хотя это сабкатегория)
  apparel: 'clothes',
  clothing: 'clothes',
  wear: 'clothes',
  bag: 'bags',
  handbag: 'bags',
  backpacks: 'bags',
  perfume: 'fragrance',
  parfum: 'fragrance',
  perfumes: 'fragrance',
  hats: 'headwear',
  caps: 'headwear',
  beanies: 'headwear',
  jewellery: 'accessories',
  jewelry: 'accessories',
  jewelery: 'accessories',
  accs: 'accessories',
};

const normalizeCategory = (raw: any): string | null => {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (CANONICAL_ORDER.includes(s)) return s;
  return CATEGORY_ALIASES[s] ?? null;
};

// Минимальный локальный компонент чипсов подкатегорий
const SubcategoryChips: React.FC<{ subcategories: string[]; active: string | null; onChange: (sub: string | null) => void; }> = ({ subcategories, active, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {subcategories.map((sub) => (
      <button
        key={sub}
        type="button"
        onClick={() => onChange(sub)}
        className={`px-4 py-2 rounded-full border text-sm font-semibold ${active === sub ? 'bg-black text-white' : 'bg-white text-black hover:bg-black hover:text-white transition'}`}
      >
        {LABELS[sub] || sub}
      </button>
    ))}
  </div>
);

const BrandCloud: React.FC = () => {
  const brandLogos = [
    "/img/dior logo.svg.png",
    "/img/gucci.png",
    "/img/prada-logo.png",
    "/img/баленса лого.png",
    "/img/Rick-Owens-Logo.png",
    "/img/ysl logo 2.png",
    "/img/Logo_Goyard.png",
    "/img/chanel logo.png",
    "/img/марджелка.png",
    "/img/vetmo.png"
  ];
  const allBrands = Array.from(new Set(brandLogos));

  // Helper: map logo src to brand slug
  const srcToSlug = (src: string): string | null => {
    const file = (src.split('/').pop() || '').toLowerCase();
    const map: Record<string, string> = {
      'dior logo.svg.png': 'dior',
      'gucci.png': 'gucci',
      'prada-logo.png': 'prada',
      'баленса лого.png': 'balenciaga',
      'rick-owens-logo.png': 'rick-owens',
      'ysl logo 2.png': 'saint-laurent',
      'logo_goyard.png': 'goyard',
      'chanel logo.png': 'chanel',
      'марджелка.png': 'maison-margiela',
      'vetmo.png': 'vetements',
    };
    if (map[file]) return map[file];
    // fallback: slugify filename (latin only)
    const base = file.replace(/\.[a-z0-9]+$/i, '')
                     .replace(/[_\s]+/g, '-')
                     .replace(/[^a-z0-9\-]/g, '')
                     .replace(/-+/g, '-');
    return base || null;
  };

  const shuffle = (arr: string[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const poolRef = useRef<string[]>(shuffle(allBrands));
  const idxRef = useRef<number>(0);
  const nextBrand = (exclude?: Set<string>) => {
    const pool = poolRef.current;
    if (!pool.length) return "";
    let tries = 0;
    let pick = pool[idxRef.current % pool.length];
    while (exclude && exclude.has(pick) && tries < pool.length) {
      idxRef.current = (idxRef.current + 1) % pool.length;
      pick = pool[idxRef.current % pool.length];
      tries++;
    }
    idxRef.current = (idxRef.current + 1) % pool.length;
    if (idxRef.current === 0) poolRef.current = shuffle(poolRef.current);
    return pick;
  };

  type Slot = { src: string; key: string };
  const floating = [
    { left: '4%',  top: '6%',  dx: 90, dy: 40, size: 140 },
    { left: '26%', top: '22%', dx: 70, dy: 55, size: 140 },
    { left: '50%', top: '8%',  dx: 60, dy: 35, size: 140 },
    { left: '10%', top: '64%', dx: 80, dy: 60, size: 140 },
    { left: '40%', top: '60%', dx: 65, dy: 45, size: 140 },
    { left: '72%', top: '36%', dx: 75, dy: 50, size: 140 },
  ];

  const [slots, setSlots] = useState<Slot[]>([]);

  // initial fill (appear only)
  useEffect(() => {
    if (!allBrands.length) return;
    const seed = setInterval(() => {
      setSlots((prev) => {
        if (prev.length >= 6) { clearInterval(seed); return prev; }
        const exclude = new Set(prev.map(p => p.src));
        const src = nextBrand(exclude);
        return [...prev, { src, key: `${Date.now()}-${prev.length}-${Math.random().toString(36).slice(2,6)}` }];
      });
    }, 400);
    return () => clearInterval(seed);
  }, [allBrands.length]);

  // rotate one logo every ~3s INSIDE this component only
  useEffect(() => {
    if (!allBrands.length) return;
    const id = setInterval(() => {
      setSlots((prev) => {
        if (prev.length === 0) return prev;
        const victim = Math.floor(Math.random() * prev.length);
        const next = [...prev];
        const currentVictimSrc = prev[victim]?.src;
        const exclude = new Set(prev.map(s => s.src));
        if (currentVictimSrc) exclude.add(currentVictimSrc);
        const picked = nextBrand(exclude);
        next[victim] = { src: picked, key: `${Date.now()}-${victim}-${Math.random().toString(36).slice(2,6)}` };
        return next;
      });
    }, 2800);
    return () => clearInterval(id);
  }, [allBrands.length]);

  return (
    <div className="brand-cloud relative overflow-hidden rounded-2xl w-full h-[320px] lg:h-[420px]">
      <AnimatePresence initial={false}>
        {slots.map((slot, i) => {
          const slug = srcToSlug(slot.src);
          const styles = { left: floating[i].left, top: floating[i].top, width: floating[i].size, height: 'auto' } as const;
          const imgEl = (
            <img
              src={slot.src}
              alt={slot.src.split('/').pop()?.replace(/\.[a-z]+$/i, '') || 'brand'}
              className="brand-logo w-full h-auto"
              loading="lazy"
            />
          );
          return (
            <motion.div
              key={slot.key}
              className="absolute"
              style={styles}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              {slug ? (
                <Link
                  href={`/brand/${slug}?origin=premium`}
                  aria-label={`Больше от бренда ${slug.replace(/-/g, ' ')}`}
                  className="block"
                >
                  {imgEl}
                </Link>
              ) : (
                imgEl
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default function PremiumPage() {
  const [whyOpen, setWhyOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  // Показать интро только если пришли с флагом ?intro=1
  const [showAnimation, setShowAnimation] = useState(false);
  const { setTitle } = useTitle(); // Деструктурируем метод смены заголовка
  const prefersReduced = useReducedMotion();

  // Sticky categories overlay logic (like Home): track direction & inline anchor visibility
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const [isAtTop, setIsAtTop] = useState(true);
  const lastYRef = useRef(0);

  const inlineCatsRef = useRef<HTMLDivElement | null>(null);
  const [inlineInView, setInlineInView] = useState(true);



  // A/B выключатель тяжёлых FX: если низкий FPS или пользователь просит меньше анимаций
  const [lowFps, setLowFps] = useState(false);
  const allowFX = !prefersReduced && !lowFps;


  // Управление приветственной анимацией: только при явном флаге intro=1
  useEffect(() => {
    const introFlag = searchParams.get('intro') === '1';
    if (introFlag) {
      setShowAnimation(true);
    } else {
      setShowAnimation(false);
      document.body.style.overflow = 'auto';
    }
  }, [searchParams]);

  // Замер FPS ~1 сек и обновление каждые 3 сек
  useEffect(() => {
    let raf = 0, frames = 0; let start = performance.now();
    let cancelled = false;
    const sample = () => {
      frames++;
      const now = performance.now();
      if (now - start >= 1000) {
        const fps = frames * 1000 / (now - start);
        setLowFps(fps < 30);
        frames = 0; start = now;
      }
      if (!cancelled) raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
    const interval = setInterval(() => { /* просто продлеваем сэмплинг */ }, 3000);
    return () => { cancelled = true; cancelAnimationFrame(raf); clearInterval(interval); };
  }, []);

  // Track scroll direction and whether we're at the very top
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        setScrollDirection(y < lastYRef.current ? 'up' : 'down');
        setIsAtTop(y <= 2);
        lastYRef.current = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // init
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Directly measure inline categories row position on scroll/resize to determine sticky overlay
  useEffect(() => {
    const getHeaderOffset = () => {
      try {
        const cs = getComputedStyle(document.documentElement);
        const h = parseFloat(cs.getPropertyValue('--header-h')) || 72;
        const safe = parseFloat(cs.getPropertyValue('--safe-top')) || 0;
        return h + safe + 4;
      } catch { return 76; }
    };
    let ticking = false;
    const checkInlineInView = () => {
      if (!inlineCatsRef.current) return;
      const rect = inlineCatsRef.current.getBoundingClientRect();
      const headerOffset = getHeaderOffset();
      // If the top of the inline categories is at or below the header offset, it's in view
      setInlineInView(rect.top >= headerOffset);
    };
    const handleScrollResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        checkInlineInView();
        ticking = false;
      });
    };
    // Initial check
    checkInlineInView();
    window.addEventListener('scroll', handleScrollResize, { passive: true });
    window.addEventListener('resize', handleScrollResize);
    return () => {
      window.removeEventListener('scroll', handleScrollResize);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, []);



  // Состояние 3D tilt для заголовка
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, s: 1 });
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const onTiltMove = (e: React.MouseEvent) => {
    if (!allowFX) return;
    const el = tiltRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const max = 6; // градусов
    setTilt({ rx: -(dy * max), ry: dx * max, s: 1.01 });
  };
  const onTiltLeave = () => setTilt({ rx: 0, ry: 0, s: 1 });

  const starDuration = prefersReduced ? 0.01 : 4;
  const starVariants: Variants = {
    rotate: (i: number) => ({
      rotate: 360,
      transition: {
        repeat: Infinity,
        duration: starDuration + i * 0.25,
        ease: [0, 0, 1, 1], // linear cubic-bezier
      },
    }),
    pulse: {
      scale: [1, 1.08, 1],
      transition: {
        repeat: Infinity,
        duration: prefersReduced ? 0.01 : 2.4,
        ease: [0.42, 0, 0.58, 1], // easeInOut cubic-bezier
      },
    },
  };

  useEffect(() => {
    setTitle("Stage Premium");

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAnimation(false); };
    window.addEventListener("keydown", onKey);

    // Если анимация активна (только при ?intro=1) — временно блокируем скролл и скрываем её по таймеру
    let timer: any;
    if (showAnimation) {
      const timeout = prefersReduced ? 300 : 1500;
      document.body.style.overflow = "hidden";
      timer = setTimeout(() => {
        setShowAnimation(false);
        document.body.style.overflow = "auto";
        // Удаляем флаг intro из URL, чтобы анимация не повторялась при возврате/обновлении
        const url = new URL(window.location.href);
        url.searchParams.delete('intro');
        window.history.replaceState({}, '', url.toString());
      }, timeout);
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "auto";
      setTitle("Stage Shoes");
    };
  }, [setTitle, prefersReduced, showAnimation]);


  // Helper to render per-letter spans with sparkle effect and staggered animation delay
  const renderSparkleText = (text: string, isTitle: boolean) => {
    const perCharDelay = isTitle ? 120 : 90; // ms between letters
    // Make duration long enough to cover all letters in один цикл, so "волна" проходит целиком
    const durationSec = Math.max(3.2, (text.length * perCharDelay) / 1000 + 1.2);
    return text.split("").map((char, i) => (
      <span
        key={i}
        className="spark" // base effect
        style={{
          // negative delay создаёт непрерывную бегущую волну от начала к концу
          animationDelay: `-${i * perCharDelay}ms`,
          animationName: isTitle ? "shine" : "shine-soft",
          animationDuration: `${durationSec}s`,
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
          display: "inline-block",
          color: "white",
          userSelect: "none",
        }}
      >
        {char === " " ? "\u00A0" : char}
      </span>
    ));
  };


  // --- Gender picker (inline, no navigation) ---
  type Gender = 'men' | 'women' | 'unisex' | null;
  const [gender, setGender] = useState<Gender>(null);
  // Инициализация пола из URL (?gender=men|women|unisex) или из sessionStorage
  useEffect(() => {
    const fromUrl = searchParams.get('gender');
    const fromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('premium_gender') : null;
    const initial = (fromUrl === 'men' || fromUrl === 'women' || fromUrl === 'unisex')
      ? (fromUrl as Gender)
      : (fromStorage === 'men' || fromStorage === 'women' || fromStorage === 'unisex' ? (fromStorage as Gender) : null);
    if (initial !== null) {
      setGender(initial);
      // Если URL без gender — допишем его без перезагрузки
      if (!fromUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set('gender', initial);
        url.searchParams.delete('intro');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  // Сохраняем выбор и обновляем URL при смене пола
  useEffect(() => {
    if (gender === null) return;
    try { sessionStorage.setItem('premium_gender', gender); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set('gender', gender);
    url.searchParams.delete('intro');
    window.history.replaceState({}, '', url.toString());
  }, [gender]);

  // --- remember & restore scroll for Premium page when navigating to product and back ---
  const rememberPremiumScroll = React.useCallback(() => {
    try {
      sessionStorage.setItem('premium_scroll', String(window.scrollY || 0));
      sessionStorage.setItem('premium_restore', '1');
      if (gender) sessionStorage.setItem('premium_gender', gender);
          try {
      sessionStorage.setItem('premium_filters_snapshot', JSON.stringify({ subByMain, maxPrice, pickedBrands }));
    } catch {}
    } catch {}
  }, [gender]);

  // Restore once after returning from product page — with smooth animation
  useEffect(() => {
    try {
      const should = sessionStorage.getItem('premium_restore');
      if (should === '1') {
        const y = parseFloat(sessionStorage.getItem('premium_scroll') || '0');
                // restore filters snapshot as well
        try {
          const raw = sessionStorage.getItem('premium_filters_snapshot');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              if (parsed.subByMain && typeof parsed.subByMain === 'object') setSubByMain(parsed.subByMain);
              if (typeof parsed.maxPrice === 'number' && Number.isFinite(parsed.maxPrice)) setMaxPrice(parsed.maxPrice);
              if (Array.isArray(parsed.pickedBrands)) setPickedBrands(parsed.pickedBrands.filter(Boolean));
            }
          }
        } catch {}
        // clear the flag early to avoid loops
        sessionStorage.removeItem('premium_restore');

        const doSmoothScroll = () => {
          const target = Number.isFinite(y) ? y : 0;
          const start = window.scrollY || 0;
          const dist = target - start;
          if (Math.abs(dist) < 2) return; // already there

          const duration = 650; // ms
          const t0 = performance.now();
          const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

          const step = (now: number) => {
            const p = Math.min(1, (now - t0) / duration);
            const eased = easeOutCubic(p);
            window.scrollTo(0, start + dist * eased);
            if (p < 1) requestAnimationFrame(step);
          };

          requestAnimationFrame(step);
        };

        // If the intro overlay is shown, wait until it closes, then scroll
        if (showAnimation) {
          const id = setInterval(() => {
            if (!showAnimation) {
              clearInterval(id);
              // next frame to ensure layout settled
              requestAnimationFrame(doSmoothScroll);
            }
          }, 50);
          return () => clearInterval(id);
        }

        // Otherwise scroll immediately after paint
        requestAnimationFrame(doSmoothScroll);
      }
    } catch {}
  }, [showAnimation]);
  // Выбранная подкатегория по каждому разделу (null = Все)
  const [subByMain, setSubByMain] = useState<Record<string, (string | null)>>({});
  // UI state for showing swap hint badge on hover (desktop)
  const [showSwapHint, setShowSwapHint] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [hoverTabs, setHoverTabs] = useState(false);
  useEffect(() => {
    const mm = window.matchMedia('(pointer:fine) and (min-width: 768px)');
    const update = () => setIsDesktop(mm.matches);
    update();
    mm.addEventListener?.('change', update);
    return () => mm.removeEventListener?.('change', update);
  }, []);

  // Только премиум-товары из общего каталога
  const premiumOnly = useMemo(
    () => products.filter((p: any) => !!p.premium),
    []
  );

  // Итоговый список для грида по выбранному полу
  const currentPremium = useMemo(() => {
    if (gender === 'men')   return premiumOnly.filter((p: any) => p.gender === 'men'   || p.gender === 'unisex');
    if (gender === 'women') return premiumOnly.filter((p: any) => p.gender === 'women' || p.gender === 'unisex');
    if (gender === 'unisex') return premiumOnly; // показать все
    return premiumOnly; // по умолчанию — всё
  }, [gender, premiumOnly]);

  // --- Interactive curator (brand + price) ---
  // --- Brand helpers (parse brands from products.ts) ---
    const normalizeBrands = (p: any): string[] => {
      const raw =
        (p as any).brands ??
        (p as any).brand ??
        (p as any).brandName ??
        (p as any).brand_logo_name ??
        "";
      if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
      if (typeof raw === "string")
        return raw.split(/[|,/\\]+/).map((s) => s.trim()).filter(Boolean);
      return [];
    };

  const [curatorOpen, setCuratorOpen] = useState(false);
  const [pickedBrands, setPickedBrands] = useState<string[]>([]);
  const [brandQuery, setBrandQuery] = useState("");

  // Brand search & list expansion (must be declared at top level to keep hooks order stable)
  const [brandSearchOpen, setBrandSearchOpen] = useState(false);
  const brandSearchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (brandSearchOpen && brandSearchInputRef.current) {
      brandSearchInputRef.current.focus();
    }
  }, [brandSearchOpen]);

  const [showAllBrands, setShowAllBrands] = useState(false);

  const allBrandsInPremium = useMemo(
    () =>
      Array.from(
        new Set(currentPremium.flatMap((p: any) => normalizeBrands(p)))
      ).sort(),
    [currentPremium]
  );

  const filteredBrands = useMemo(
    () =>
      allBrandsInPremium.filter((b) =>
        brandQuery.trim()
          ? b.toLowerCase().includes(brandQuery.trim().toLowerCase())
          : true
      ),
    [allBrandsInPremium, brandQuery]
  );

  const visibleBrands = useMemo(
    () => (showAllBrands ? filteredBrands : filteredBrands.slice(0, 6)),
    [filteredBrands, showAllBrands]
  );

  const hiddenCount = useMemo(() => Math.max(0, filteredBrands.length - 6), [filteredBrands]);

  const priceBounds = useMemo(() => {
    const prices = currentPremium.map((p: any) => Number(p.price) || 0);
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    return { min, max };
  }, [currentPremium]);

  const [maxPrice, setMaxPrice] = useState<number>(0);
  useEffect(() => {
    setMaxPrice(priceBounds.max);
  }, [priceBounds.max]);

  // Persist/restore premium filters
  useEffect(() => {
    // restore once on mount
    try {
      const raw = localStorage.getItem('premium_filters');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.subByMain && typeof parsed.subByMain === 'object') setSubByMain(parsed.subByMain);
          if (typeof parsed.maxPrice === 'number' && Number.isFinite(parsed.maxPrice)) setMaxPrice(parsed.maxPrice);
          if (Array.isArray(parsed.pickedBrands)) setPickedBrands(parsed.pickedBrands.filter(Boolean));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    // persist on change
    try {
      localStorage.setItem('premium_filters', JSON.stringify({ subByMain, maxPrice, pickedBrands }));
    } catch {}
  }, [subByMain, maxPrice, pickedBrands]);

      const filteredPremium = useMemo(
      () =>
        currentPremium.filter((p: any) => {
          const itemBrands = normalizeBrands(p);
          const brandOk = pickedBrands.length
            ? itemBrands.some((b) => pickedBrands.includes(b))
            : true;
          const priceOk = (Number(p.price) || 0) <= (maxPrice || priceBounds.max);
          return brandOk && priceOk;
        }),
      [currentPremium, pickedBrands, maxPrice, priceBounds.max]
    );

  // Динамически соберём список категорий премиум-товаров (footwear, bags, accessories, ...)
  const premiumCategories = useMemo(() => {
    const canon = filteredPremium
      .map((p: any) => normalizeCategory(p.category))
      .filter((v): v is string => !!v);
    const uniq = Array.from(new Set(canon));
    // упорядочим как в CANONICAL_ORDER
    return CANONICAL_ORDER.filter((k) => uniq.includes(k));
  }, [filteredPremium]);
  // Разложим товары по категориям (после всех фильтров бренда/цены)
const productsByCategory = useMemo(() => {
  const map: Record<string, any[]> = {};
  for (const p of filteredPremium) {
    const key = normalizeCategory((p as any).category);
    if (!key) continue;
    (map[key] ||= []).push(p);
  }
  return map;
}, [filteredPremium]);

      // Сколько карточек показывать на секцию (пакетами по 12)
      const [visibleByMain, setVisibleByMain] = useState<Record<string, number>>({});
      useEffect(() => {
        // инициализируем для новых категорий
        setVisibleByMain(prev => {
          const next = { ...prev } as Record<string, number>;
          for (const k of premiumCategories) if (!next[k]) next[k] = 12;
          // удалить лишние ключи
          Object.keys(next).forEach(k => { if (!premiumCategories.includes(k)) delete next[k]; });
          return next;
        });
      }, [premiumCategories]);

      const showMore = (k: string) => setVisibleByMain(prev => ({ ...prev, [k]: (prev[k] || 12) + 12 }));


  const showMenTab = gender === null || gender === 'men' || (isDesktop && hoverTabs);
  const showWomenTab = gender === null || gender === 'women' || (isDesktop && hoverTabs);

  // Помечаем переход с премиум-страницы + текущий пол в ссылке на товар
  const buildProductHref = (id: string | number) => {
    const params = new URLSearchParams();
    params.set('origin', 'premium');
    const g = gender || searchParams.get('gender');
    if (g === 'men' || g === 'women') params.set('gender', g);
    return `/premium/product/${id}?${params.toString()}`;
  };

  const GridCard = ({ item }: { item: any }) => (
    <Link
      href={buildProductHref(item.id)}
      onClick={rememberPremiumScroll}
      className="relative group block rounded-2xl overflow-hidden bg-white border border-black/10 shadow-sm hover:shadow-lg hover:-translate-y-[3px] transition-all duration-300 w-full"
    >
      {(item as any).premium && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="w-4 h-4 drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)] transition-colors duration-200 fill-transparent stroke-black stroke-[2] group-hover:fill-black"
          >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)] bg-gradient-to-br from-black to-neutral-900 select-none">
            premium
          </span>
        </div>
      )}
      {(item as any).badge && (
        <span
          className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
          style={{
            background:
              (item as any).badge === "NEW"
                ? "linear-gradient(135deg,#60a5fa,#2563eb)"
                : (item as any).badge === "HIT"
                ? "linear-gradient(135deg,#34d399,#059669)"
                : "linear-gradient(135deg,#000000,#111111)",
          }}
        >
          {(item as any).badge}
        </span>
      )}

      {/* image area with hover preview (second image) */}
      <div className="w-full h-[220px] bg-white flex items-center justify-center overflow-hidden relative p-3">
        {/* primary */}
        <img
          src={item.images?.[0] || '/img/placeholder.png'}
          alt={item.name}
          className="absolute inset-0 m-auto max-h-[90%] max-w-[90%] object-contain transition-opacity duration-300 group-hover:opacity-0"
        />
        {/* secondary preview */}
        {item.images?.[1] && (
          <img
            src={item.images?.[1]}
            alt={`${item.name} — preview`}
            className="absolute inset-0 m-auto max-h-[90%] max-w-[90%] object-contain opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        {/* subtle zoom on hover for the whole area */}
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.02]" />
        {/* gradient fog top/bottom for premium look */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white to-transparent opacity-70" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent opacity-80" />
      </div>

      {/* info */}
      <div className="p-3">
        <p className="text-sm font-semibold line-clamp-2">{item.name}</p>
        <p className="text-xs text-gray-500 mt-1">от {item.price}₽</p>
      </div>

      {/* quick preview CTA on hover */}
      <div className="pointer-events-none absolute inset-x-2 bottom-3 flex justify-end opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
        <button
          type="button"
          className="pointer-events-auto select-none px-3 py-1.5 rounded-full text-[11px] font-semibold bg-black text-white shadow/50"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickItem(item); }}
          aria-label="Быстрый просмотр"
        >
          Смотреть
        </button>
      </div>
    </Link>
  );

  // --- Concierge widget ---
  type ConciergeProps = { open: boolean; setOpen: (v: boolean) => void };

  const Concierge: React.FC<ConciergeProps> = ({ open, setOpen }) => {
    const [loading, setLoading] = useState(false);
    const [ok, setOk] = useState<null | string>(null);
    const [err, setErr] = useState<null | string>(null);

    useEffect(() => {
      // lock body scroll while modal opened
      if (open) {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onEsc);
        return () => {
          document.body.style.overflow = prev;
          window.removeEventListener("keydown", onEsc);
        };
      }
    }, [open, setOpen]);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setLoading(true); setOk(null); setErr(null);
      const fd = new FormData(e.currentTarget);
      const payload = Object.fromEntries(fd.entries());
      const files = (fd.getAll("photos") as File[]).filter(Boolean);
      let attachments: { name: string; type: string; data: string }[] = [];
      if (files.length) {
        attachments = await Promise.all(files.map(
          (f) => new Promise<{ name: string; type: string; data: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(",")[1] || "";
              resolve({ name: f.name, type: f.type, data: base64 });
            };
            reader.readAsDataURL(f);
          })
        ));
      }
      try {
        const resp = await fetch("/api/concierge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, attachments }),
        });
        if (!resp.ok) throw new Error("Failed");
        setOk("Заявка отправлена! Мы свяжемся с вами.");
        (e.currentTarget as HTMLFormElement).reset();
      } catch {
        const mail = new URL(`mailto:info@stagestore.ru`);
        mail.searchParams.set("subject", "Консьерж — подбор размера/силуэта");
        mail.searchParams.set("body", `Имя: ${payload.name}\nEmail/Телеграм: ${payload.contact}\nКатегория: ${payload.category}\nРазмеры: ${payload.size}\nПожелания: ${payload.notes}`);
        window.location.href = mail.toString();
        setOk("Открыто почтовое приложение. Вложения через mailto не поддерживаются — если нужны фото, отправьте их ответным письмом.");
      } finally {
        setLoading(false);
      }
    }

    return (
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[9998] pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* backdrop blur (no click-to-close to avoid случайного закрытия) */}
            <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />

            {/* modal */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="relative mx-auto mt-24 w-[94%] max-w-[560px] rounded-2xl bg-white p-6 shadow-xl border border-black/10 z-[9999]"
            >
              <div className="absolute top-3 right-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className="rounded-full w-8 h-8 grid place-items-center border border-black/10 hover:bg-black/5"
                >
                  ✕
                </button>
              </div>

              <h3 className="text-xl font-extrabold mb-4">Консьерж Stage Premium</h3>
              <p className="text-sm text-gray-600 mb-4">
                Оставьте пожелания — подберём вещи по вашему росту, стилю и случаю. Можно прикрепить фото.
              </p>

              <form onSubmit={onSubmit} className="space-y-3">
                <div>
                  <label className="text-sm font-semibold">Имя</label>
                  <input name="name" required className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm font-semibold">Почта или @телеграм</label>
                  <input name="contact" required className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold">Категория</label>
                    <select name="category" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2">
                      <option value="footwear">Обувь</option>
                      <option value="clothes">Одежда</option>
                      <option value="bags">Сумки</option>
                      <option value="accessories">Аксессуары</option>
                      <option value="fragrance">Парфюмерия</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Ваши размеры</label>
                    <input name="size" placeholder="Напр. 42 EU, рост 182, плечо 48" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Фото/скриншоты (необязательно)</label>
                    <input name="photos" type="file" multiple accept="image/*" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold">Пожелания</label>
                  <textarea name="notes" rows={3} placeholder="Силуэт, цвета, бренд, бюджет…" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2" />
                </div>

                {ok && <div className="text-sm text-green-600">{ok}</div>}
                {err && <div className="text-sm text-red-600">{err}</div>}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-full border border-black/10">Отмена</button>
                  <button disabled={loading} className="px-4 py-2 rounded-full bg-black text-white font-semibold disabled:opacity-60">{loading ? "Отправка…" : "Отправить"}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // Concierge modal open state
  const [conciergeOpen, setConciergeOpen] = useState(false);
  // Quick View
  const [quickItem, setQuickItem] = useState<any | null>(null);

  return (
    <>
      {/* Premium-aware sticky header */}
      { !showAnimation ? (
        <>
          <div className="relative w-full z-10">
          <div className="w-full px-6 md:px-10 py-6">
            <div className="flex items-start justify-between gap-6">
              {/* Left: title text with inline star above the last letter of 'Premium' */}
              <div
                ref={tiltRef}
                onMouseMove={onTiltMove}
                onMouseLeave={onTiltLeave}
                style={{
                  transformStyle: 'preserve-3d',
                  transform: allowFX ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.s})` : undefined,
                  transition: 'transform .25s ease',
                }}
                className="pr-6 max-w-[740px] md:max-w-[820px] lg:max-w-[900px] shrink-0"
              >
                <p className="font-extrabold tracking-tight leading-tight text-4xl md:text-6xl text-black text-left">
                  Добро пожаловать в Stage
                  {" "}
                  <span className="relative inline-block">
                    Premium
                    {/* star positioned above the last letter 'm' */}
                    <img
                      src="/img/звездочка.png"
                      alt="Premium"
                      className="absolute -top-1 right-[-6px] md:-top-2 md:-right-3 w-5 h-5 md:w-6 md:h-6 drop-shadow-[0_0_6px_rgba(0,0,0,0.15)]"
                    />
                  </span>
                  {" "}— здесь находятся эксклюзивы и уникальные предложения
                </p>
              </div>

              {/* Right: brand cloud (chaotic fly-in logos) */}
              <div className="hidden md:block flex-1 pl-4">
                <BrandCloud />
              </div>
            </div>
          </div>
        </div>
        {/* Быстрые бренды с количеством позиций (по текущему полу и цене) */}
        {/* Sticky categories overlay (Premium): appears on scroll up, no background, no sort */}
        <AnimatePresence>
          {(!inlineInView && scrollDirection === 'up') && (
            <motion.div
              id="premium-cats-sticky"
              className="fixed left-0 right-0 z-[90] pointer-events-none"
              style={{ top: 'calc(var(--header-h,72px) + 8px)' }}
              initial={{ y: -80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -80, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
            >
              <div className="max-w-[1200px] mx-auto px-6 pointer-events-auto">
                <Categories />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Категории для Premium (такой же слайдер, как на главной) */}
        <div id="premium-cats" ref={inlineCatsRef} className="max-w-[1200px] mx-auto mt-10">
          <h2 className="text-2xl md:text-4xl font-extrabold text-black mb-6 text-center">Выберите категорию</h2>
          <div className="flex justify-center">
            <Categories />
          </div>
        </div>


        </>
      ) : null }

      {/* Анимация Premium (отключаем на слабых устройствах) */}
      {allowFX && (
        <AnimatePresence>
          {showAnimation && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ duration: prefersReduced ? 0.2 : 1.5, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[9999]"
            >
              <motion.h1
                className="text-6xl font-extrabold mb-4 premium-title"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReduced ? 0.2 : 0.6, ease: "easeOut" }}
              >
                {renderSparkleText("Добро пожаловать в Premium", true)}
              </motion.h1>

              {/* Вращающиеся звезды */}
              <div className="relative w-64 h-64">
                {Array.from({ length: 8 }).map((_, i) => (
                  <motion.img
                    key={i}
                    src="/img/звездочка.png"
                    alt="Star"
                    className="absolute w-12 h-12 drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]"
                    style={{
                      top: `${50 + 40 * Math.sin((i / 8) * 2 * Math.PI)}%`,
                      left: `${50 + 40 * Math.cos((i / 8) * 2 * Math.PI)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    animate={["pulse", "rotate"]}
                    variants={starVariants}
                    custom={i}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Контент Premium страницы */}
      <section className="px-6 md:px-10 pb-16">
        {/* Выбор категории: Мужчины / Женщины */}
        <div className="max-w-[1200px] mx-auto mt-6">
          <h2 className="text-2xl md:text-4xl font-extrabold text-black mb-6 md:mb-8 text-center">
            Выберите пол для отображения коллекций
          </h2>

          <div className="relative w-full flex items-center justify-center"
            onMouseEnter={() => isDesktop && setHoverTabs(true)}
            onMouseLeave={() => setHoverTabs(false)}
          >
            <div className="relative inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 backdrop-blur px-1 py-1 shadow-sm">
              <AnimatePresence initial={false}>
                {showMenTab && (
                  <motion.div
                    layout
                    key="men-tab"
                    role="button"
                    tabIndex={0}
                    onMouseEnter={() => setShowSwapHint(true)}
                    onMouseLeave={() => setShowSwapHint(false)}
                    onClick={() => { setGender('men'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setGender('men'); } }}
                    className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-colors cursor-pointer ${gender==='men' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={gender === 'men' ? { opacity: 0, x: 140, scale: 0.9, filter: 'blur(2px)' } : { opacity: 0, x: -40, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    aria-label="Мужская коллекция"
                  >
                    Мужская коллекция
                  </motion.div>
                )}
                {showWomenTab && (
                  <motion.div
                    layout
                    key="women-tab"
                    role="button"
                    tabIndex={0}
                    onMouseEnter={() => setShowSwapHint(true)}
                    onMouseLeave={() => setShowSwapHint(false)}
                    onClick={() => { setGender('women'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setGender('women'); } }}
                    className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-colors cursor-pointer ${gender==='women' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={gender === 'women' ? { opacity: 0, x: 140, scale: 0.9, filter: 'blur(2px)' } : { opacity: 0, x: 40, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    aria-label="Женская коллекция"
                  >
                    Женская коллекция
                  </motion.div>
                )}
                {/* Унисекс кнопка */}
                <motion.div
                  layout
                  key="unisex-tab"
                  role="button"
                  tabIndex={0}
                  onClick={() => { setGender('unisex'); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setGender('unisex'); } }}
                  className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-colors cursor-pointer ${gender==='unisex' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={gender === 'unisex' ? { opacity: 0, x: 140, scale: 0.9, filter: 'blur(2px)' } : { opacity: 0, x: 40, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  aria-label="Унисекс"
                >
                  Унисекс
                </motion.div>
              </AnimatePresence>
            </div>
            {/* Mobile switch (no hover) */}
            {gender && (
              <div className="mt-4 w-full flex items-center justify-center md:hidden">
                <button
                  onClick={() => {
                    if (gender === 'men') { setGender('women'); }
                    else if (gender === 'women') { setGender('unisex'); }
                    else if (gender === 'unisex') { setGender('men'); }
                  }}
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-black text-white active:scale-[.98]"
                  aria-label="Сменить категорию"
                >
                  Сменить категорию
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Floating Concierge Button (bottom-right) */}
        <motion.button
          type="button"
          onClick={() => setConciergeOpen(true)}
          className="group fixed bottom-6 right-6 z-[60] inline-flex items-center justify-center rounded-full bg-black text-white px-7 py-3 font-semibold shadow-lg hover:shadow-xl"
          aria-label="Открыть консьерж"
          whileHover={{ y: -4, scale: 1.03, boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 360, damping: 20 }}
        >
          <span className="relative grid place-items-center">
            {/* Invisible measurer preserves natural width using the LONGEST label */}
            <span className="invisible flex items-center justify-center gap-2 whitespace-nowrap">
              <span>✨</span>
              <span>Готов к заявке</span>
            </span>

            {/* Sliding viewport */}
            <span className="absolute inset-0 h-[1.4em] overflow-hidden leading-none grid place-items-center">
              {/* Top layer (default) */}
              <span className="absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap transition-transform duration-300 ease-out group-hover:-translate-y-full">
                <span>💬</span>
                <span>Консьерж</span>
              </span>
              {/* Bottom layer (slides in) */}
              <span className="absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0">
                <span>✨</span>
                <span>Готов к заявке</span>
              </span>
            </span>
          </span>
        </motion.button>

        {/* Interactive curator panel */}
        <div className="max-w-[1200px] mx-auto mt-8">
          <button
            type="button"
            onClick={() => setCuratorOpen((v) => !v)}
            className="mx-auto flex items-center gap-2 px-5 py-3 rounded-full bg-black text-white font-semibold shadow hover:shadow-md active:scale-[.98] transition"
          >
            <span>🧭 Премиум-подборщик</span>
            <span className="text-xs opacity-80">({(curatorOpen ? filteredPremium.length : currentPremium.length) || 0} товаров)</span>
          </button>

          <AnimatePresence initial={false}>
            {curatorOpen && (
              <motion.div
                key="curator"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="mt-5 rounded-2xl border border-black/10 bg-white/70 backdrop-blur p-4 md:p-6 shadow-sm"
              >
                <div className="mb-4">
                  <p className="text-sm font-semibold mb-2">Бренды</p>

                  {/* --- Search + Clear + Brand cloud with show more --- */}
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      {/* Animated search button/input */}
                      <motion.div
                        className="relative"
                        initial={false}
                        animate={brandSearchOpen ? "open" : "closed"}
                        variants={{ open: { width: 180 }, closed: { width: 40 } }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        style={{ overflow: "hidden", display: "flex" }}
                      >
                        <motion.button
                          type="button"
                          aria-label={brandSearchOpen ? "Скрыть поиск" : "Поиск бренда"}
                          className={`w-10 h-10 rounded-full flex items-center justify-center border border-black/10 bg-white transition-colors ${brandSearchOpen ? "mr-2" : ""}`}
                          style={{ minWidth: 40, minHeight: 40 }}
                          onClick={() => setBrandSearchOpen((v) => !v)}
                          tabIndex={0}
                        >
                          <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <circle cx={11} cy={11} r={7} />
                            <line x1={16.5} y1={16.5} x2={21} y2={21} />
                          </svg>
                        </motion.button>
                        <AnimatePresence initial={false}>
                          {brandSearchOpen && (
                            <motion.input
                              ref={brandSearchInputRef}
                              key="brand-search"
                              type="text"
                              placeholder="Поиск бренда…"
                              value={brandQuery}
                              onChange={(e) => setBrandQuery(e.target.value)}
                              className="w-full max-w-xs rounded-full border border-black/10 px-3 py-2 text-sm"
                              style={{ minWidth: 120 }}
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: "100%" }}
                              exit={{ opacity: 0, width: 0, transition: { duration: 0.15 } }}
                              transition={{ duration: 0.22 }}
                            />
                          )}
                        </AnimatePresence>
                      </motion.div>

                      {/* Снять выбор — всегда рядом */}
                      {pickedBrands.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPickedBrands([])}
                          className="px-3 py-2 rounded-full text-sm border border-black/10 hover:bg-black/5"
                        >
                          Снять выбор ({pickedBrands.length})
                        </button>
                      )}
                    </div>

                    {/* Brand cloud (max 6, +N button) */}
                    <div className="max-h-40 overflow-auto pr-1 flex flex-wrap gap-2">
                      {filteredBrands.length === 0 ? (
                        <span className="text-sm text-gray-500">Ничего не найдено</span>
                      ) : (
                        <>
                          {visibleBrands.map((b) => {
                            const active = pickedBrands.includes(b);
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() =>
                                  setPickedBrands((prev) =>
                                    prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
                                  )
                                }
                                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                  active ? "bg-black text-white border-black" : "bg-white text-black hover:bg-black/5"
                                }`}
                                title={b}
                              >
                                {b}
                              </button>
                            );
                          })}
                          {hiddenCount > 0 && (
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-full text-sm border border-black/10 bg-white text-black hover:bg-black/5 font-semibold"
                              onClick={() => setShowAllBrands((v) => !v)}
                            >
                              {showAllBrands ? "Свернуть" : `+${hiddenCount}`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                </div>

                {/* Price slider */}
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">
                    Потяните ползунок, чтобы скрыть товары дороже выбранного значения.
                  </p>
                  <p className="text-sm font-semibold mb-2">
                    Цена до: <span className="font-bold">{maxPrice}₽</span>
                  </p>
                  <input
                    type="range"
                    min={Math.floor(priceBounds.min)}
                    max={Math.ceil(priceBounds.max)}
                    step={1}
                    value={Math.min(maxPrice, Math.ceil(priceBounds.max))}
                    onChange={(e) =>
                      setMaxPrice(Math.min(Number(e.target.value), Math.ceil(priceBounds.max)))
                    }
                    onMouseUp={() =>
                      setMaxPrice((v) =>
                        Math.abs(v - Math.ceil(priceBounds.max)) <= 1
                          ? Math.ceil(priceBounds.max)
                          : v
                      )
                    }
                    onTouchEnd={() =>
                      setMaxPrice((v) =>
                        Math.abs(v - Math.ceil(priceBounds.max)) <= 1
                          ? Math.ceil(priceBounds.max)
                          : v
                      )
                    }
                    className="w-full accent-black"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Диапазон: {priceBounds.min}₽ — {priceBounds.max}₽
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-gray-700">Подходит товаров: <span className="font-semibold">{filteredPremium.length}</span></div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPickedBrands([])}
                        className="px-3 py-2 rounded-full text-sm border border-black/10 hover:bg-black/5"
                      >
                        Сбросить бренды
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaxPrice(priceBounds.max)}
                        className="px-3 py-2 rounded-full text-sm border border-black/10 hover:bg-black/5"
                      >
                        Сбросить цену
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPickedBrands([]); setMaxPrice(priceBounds.max); }}
                        className="px-4 py-2 rounded-full text-sm bg-black text-white font-semibold"
                      >
                        Сбросить всё
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stage Store Top */}
        <div className="max-w-[1200px] mx-auto mt-16">
          <h3 className="text-3xl md:text-5xl font-extrabold mb-6">Stage Store Top</h3>

          {/* helper to pick some top items */}
          {(() => {
            // возьмём до 10 премиум-товаров (категории в Top сейчас не фильтруем)
            const base = filteredPremium.length ? filteredPremium : (gender ? currentPremium : premiumOnly);
            const top = base.slice(0, 10);
            const rowA = top.slice(0, Math.ceil(top.length / 2));
            const rowB = top.slice(Math.ceil(top.length / 2));

            const Card = ({ item }: { item: any }) => (
              <div className="relative group rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <Link
                  href={buildProductHref(item.id)}
                  onClick={rememberPremiumScroll}
                  className="relative block rounded-2xl overflow-hidden bg-white border border-black/10 shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-300 min-w-[240px] max-w-[240px]"
                >
                  {/* badge */}
                  {/* premium star + optional chip */}
                  {(item as any).premium && (
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="w-4 h-4 drop-shadow transition-colors duration-200 fill-transparent stroke-black stroke-[2] group-hover:fill-black"
                      >
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide text-white bg-gradient-to-br from-black to-neutral-900">
                        premium
                      </span>
                    </div>
                  )}
                  {(item as any).badge && (
                    <span
                      className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
                      style={{
                        background:
                          (item as any).badge === "NEW"
                            ? "linear-gradient(135deg,#60a5fa,#2563eb)"
                            : (item as any).badge === "HIT"
                            ? "linear-gradient(135deg,#34d399,#059669)"
                            : "linear-gradient(135deg,#000000,#111111)",
                      }}
                    >
                      {(item as any).badge}
                    </span>
                  )}
                  {/* image */}
                  <div className="w-full h-[180px] bg-white flex items-center justify-center overflow-hidden relative p-3">
                    <img
                      src={item.images?.[0] || '/img/placeholder.png'}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-b from-transparent via-transparent to-black/[0.03]"/>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold line-clamp-2">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-1">от {item.price}₽</p>
                  </div>
                </Link>
              </div>
            );

            return (
              <>
                {/* row A – движется вправо */}
                <div className="marquee marquee-right mb-6">
                  <div className="track">
                    {[...rowA, ...rowA].map((it, i) => (
                      <div key={`a-${it.id}-${i}`} className="mr-5 last:mr-0">
                        <Card item={it} />
                      </div>
                    ))}
                  </div>
                </div>
                {/* row B – движется влево */}
                <div className="marquee marquee-left">
                  <div className="track">
                    {[...rowB, ...rowB].map((it, i) => (
                      <div key={`b-${it.id}-${i}`} className="mr-5 last:mr-0">
                        <Card item={it} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {premiumCategories.map((key: any) => {
          const listAll = productsByCategory[key] || [];
          if (!listAll.length) return null;

          const orderedSubs = getOrderedSubcategories(key as any).filter((sub) =>
            listAll.some((p: any) => p.subcategory === sub)
          );
          const activeSub = subByMain[key] ?? null;
          const list = activeSub ? listAll.filter((p: any) => p.subcategory === activeSub) : listAll;
          const total = list.length;
          const visible = Math.min(visibleByMain[key] || 12, total);
          const sliced = list.slice(0, visible);

          return (
            <section
              key={`sec-${String(key)}`}
              id={String(key)}
              data-anchor={String(key)}
              className="max-w-[1200px] mx-auto mt-12"
            >
              <h3 className="text-3xl md:text-4xl font-extrabold mb-4">{LABELS[key] || String(key)}</h3>

              {/* Чипы подкатегорий (Все + доступные подкатегории) */}
              <SubcategoryChips
                subcategories={orderedSubs as any}
                active={activeSub}
                onChange={(sub) => setSubByMain((prev) => ({ ...prev, [key]: sub }))}
              />
              {/* Показано N из M + кнопка показать ещё */}
              <div className="mt-5 mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">Показано <b>{visible}</b> из <b>{total}</b></span>
                {visible < total && (
                  <button
                    type="button"
                    onClick={() => showMore(key)}
                    className="px-4 py-2 rounded-full text-sm bg-black text-white font-semibold hover:shadow-md active:scale-[.98] transition"
                  >
                    Показать ещё
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 mt-6">
                {sliced.map((it: any) => (
                  <div key={`grid-${it.id}`} className="w-full">
                    <GridCard item={it} />
                  </div>
                ))}
              </div>
              {/* JSON-LD для SEO (часть премиум-товаров) */}
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'ItemList',
                    itemListElement: (filteredPremium.length ? filteredPremium : currentPremium).slice(0, 20).map((p: any, i: number) => ({
                      '@type': 'ListItem',
                      position: i + 1,
                      item: {
                        '@type': 'Product',
                        name: p.name,
                        image: Array.isArray(p.images) ? p.images : [p.images].filter(Boolean),
                        brand: (p.brands && Array.isArray(p.brands) ? { '@type': 'Brand', name: p.brands[0] } : (p.brand ? { '@type': 'Brand', name: p.brand } : undefined)),
                        offers: {
                          '@type': 'Offer',
                          priceCurrency: 'RUB',
                          price: String(p.price ?? ''),
                          availability: 'https://schema.org/InStock',
                        }
                      }
                    }))
                  })
                }}
              />
            </section>
          );
        })}
      </section>
        {/* Storytelling / Манифест */}
        <section className="relative w-full h-[360px] md:h-[480px] mt-20 overflow-hidden">
          <img src="/img/гугле.webp" alt="Premium background" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center text-white px-6 max-w-3xl">
              <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Почему Stage Premium?</h2>
              <p className="text-lg md:text-xl leading-relaxed mb-6">Только эксклюзивные коллекции, прямые поставки от брендов и лимитированные дропы.</p>
              <button
                type="button"
                onClick={() => router.push('/premium/why')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-md shadow hover:shadow-lg active:scale-[.98] transition"
              >
                Почему?
              </button>
            </div>
          </div>
        </section>

        <AnimatePresence>
          {whyOpen && (
            <motion.div
              className="fixed inset-0 z-[10000]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setWhyOpen(false)} />
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 240, damping: 22 }}
                className="relative mx-auto mt-24 w-[94%] max-w-[720px] bg-white rounded-xl shadow-xl border border-black/10 p-6"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-xl font-extrabold">Почему именно мы</h3>
                  <button className="w-8 h-8 grid place-items-center rounded-full border border-black/10" onClick={() => setWhyOpen(false)} aria-label="Закрыть">✕</button>
                </div>
                <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
                  <li>Прямые поставки и проверенные партнёры</li>
                  <li>Подлинность и ручной отбор каждой позиции</li>
                  <li>Консьерж-сопровождение и помощь с подбором</li>
                  <li>Быстрая доставка по РФ и удобный возврат</li>
                </ul>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Newsletter */}
        <section className="mt-16 max-w-[700px] mx-auto text-center px-6">
          <h3 className="text-2xl md:text-4xl font-extrabold mb-4">Будьте первыми в курсе новых дропов</h3>
          <p className="text-gray-600 mb-6">Подпишитесь на рассылку и получайте уведомления о свежих релизах и акциях.</p>
          <form className="flex flex-col items-center gap-3 justify-center max-w-[560px] mx-auto">
            <div className="w-full flex items-center gap-3 justify-center">
              <input
                type="email"
                placeholder="Ваш email"
                className="flex-1 max-w-[320px] rounded-full border border-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-full bg-black text-white font-semibold shadow hover:shadow-lg transition relative overflow-hidden"
              >
                <span className="relative z-10">Подписаться</span>
                <span className="absolute inset-0 bg-gradient-to-r from-black via-gray-800 to-black animate-pulse opacity-40" />
              </button>
            </div>
            <label className="text-xs text-gray-600 flex items-start gap-2 leading-snug">
              <input type="checkbox" required className="mt-[2px]" />
              <span>
                Я соглашаюсь с
                {" "}
                <Link href="/privacy" className="underline">политикой конфиденциальности</Link>
                {" "}и
                {" "}
                <Link href="/personal-data" className="underline">обработкой персональных данных</Link>.
              </span>
            </label>
          </form>
        </section>

        {/* Footer */}
        <footer className="mt-20 bg-black text-white pt-12">
          <div className="max-w-[1200px] mx-auto px-6 md:px-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-10">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <img src="/img/IMG_0363.PNG" alt="StageStore" className="w-12 h-8" onError={(e:any)=>{e.currentTarget.style.display='none'}} />
                  <span className="text-xl font-bold">StageStore</span>
                </div>
                <p className="text-sm text-gray-400">Оригинальные кроссовки и одежда от ведущих мировых брендов.</p>
              </div>
              <div>
                <h4 className="text-base font-semibold mb-3">Меню</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/">Главная</Link></li>
                  <li><Link href="/#catalog">Каталог</Link></li>
                  <li><Link href="/premium">Premium</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-semibold mb-3">Помощь</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/#delivery">Доставка</Link></li>
                  <li><Link href="/#returns">Возврат</Link></li>
                  <li><Link href="/#size-guide">Таблица размеров</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-semibold mb-3">Контакты</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>Москва, ул. Тверская, 12</li>
                  <li><a href="mailto:info@stagestore.ru" className="hover:underline">info@stagestore.ru</a></li>
                  <li><a href="tel:+74951234567" className="hover:underline">+7 (495) 123-45-67</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-white/10 py-4 flex flex-col md:flex-row items-center justify-between gap-3 text-[13px] text-gray-400">
              <span>© 2025 StageStore. Все права защищены.</span>
              <Link href="/privacy" className="hover:underline">Политика конфиденциальности</Link>
            </div>
          </div>
        </footer>
        {/* Quick View Modal */}
        <AnimatePresence>
          {quickItem && (
            <motion.div
              className="fixed inset-0 z-[9990]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setQuickItem(null)} />
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                className="relative mx-auto mt-16 w-[94%] max-w-[820px] rounded-2xl bg-white p-5 shadow-xl border border-black/10"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-lg md:text-xl font-extrabold line-clamp-2 pr-6">{quickItem.name}</h3>
                  <button className="w-8 h-8 grid place-items-center rounded-full border border-black/10" onClick={() => setQuickItem(null)} aria-label="Закрыть">✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative w-full aspect-[4/3] bg-white rounded-xl border border-black/10 overflow-hidden">
                    <img src={quickItem.images?.[0] || '/img/placeholder.png'} alt={quickItem.name} className="absolute inset-0 w-full h-full object-contain" />
                    {quickItem.images?.[1] && (
                      <img src={quickItem.images?.[1]} alt={`${quickItem.name} preview`} className="absolute inset-0 w-full h-full object-contain opacity-0 hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Цена</p>
                    <p className="text-2xl font-extrabold mb-4">{quickItem.price}₽</p>
                    <div className="flex items-center gap-3">
                      <Link href={buildProductHref(quickItem.id)} onClick={rememberPremiumScroll} className="px-5 py-2.5 rounded-full bg-black text-white font-semibold hover:shadow-md active:scale-[.98] transition">Открыть страницу товара</Link>
                      <button type="button" className="px-5 py-2.5 rounded-full border border-black/10" onClick={() => setQuickItem(null)}>Закрыть</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      {/* Concierge modal (mounted once at end) */}
      <Concierge open={conciergeOpen} setOpen={setConciergeOpen} />

      <style jsx>{`
        .premium-title {
          color: white;
          position: relative;
        }
        .premium-subtitle {
          font-size: 2rem;
          font-weight: 700;
          color: white;
          position: relative;
          display: inline-block;
        }
        .spark {
          text-shadow:
            0 0 8px rgba(255, 255, 255, 0.6),
            0 0 12px rgba(255, 255, 255, 0.4),
            0 0 20px rgba(255, 255, 255, 0.3);
          will-change: text-shadow;
        }
        @keyframes shine {
          0%, 100% {
            text-shadow:
              0 0 8px rgba(255, 255, 255, 0.6),
              0 0 12px rgba(255, 255, 255, 0.4),
              0 0 20px rgba(255, 255, 255, 0.3);
          }
          50% {
            text-shadow:
              0 0 16px rgba(255, 255, 255, 1),
              0 0 24px rgba(255, 255, 255, 0.8),
              0 0 40px rgba(255, 255, 255, 0.6);
          }
        }
        @keyframes shine-soft {
          0%, 100% {
            text-shadow:
              0 0 6px rgba(255, 255, 255, 0.4),
              0 0 10px rgba(255, 255, 255, 0.3),
              0 0 16px rgba(255, 255, 255, 0.2);
          }
          50% {
            text-shadow:
              0 0 10px rgba(255, 255, 255, 0.7),
              0 0 16px rgba(255, 255, 255, 0.5),
              0 0 28px rgba(255, 255, 255, 0.4);
          }
        }
        .brand-logo {
          height: auto;
          filter: grayscale(1) contrast(1.15);
          opacity: 0.85;
          transition: filter .3s ease, opacity .3s ease, transform .3s ease;
        }
        .brand-logo:hover {
          filter: grayscale(0) contrast(1);
          opacity: 1;
          transform: translateY(-2px);
        }
        .marquee { position: relative; overflow: hidden; }
        .marquee .track { display: inline-flex; align-items: stretch; white-space: nowrap; will-change: transform; }
        .marquee-right .track { animation: scrollRight 24s linear infinite; }
        .marquee-left  .track { animation: scrollLeft  24s linear infinite; }
        .marquee:hover .track { animation-play-state: paused; }
        .marquee::before, .marquee::after {
          content: "";
          position: absolute; top: 0; width: 72px; height: 100%; pointer-events: none; z-index: 5;
        }
        .marquee::before { left: 0; background: linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0)); }
        .marquee::after  { right: 0; background: linear-gradient(to left,  rgba(255,255,255,1), rgba(255,255,255,0)); }

        @keyframes scrollRight { from { transform: translateX(-50%); } to { transform: translateX(0%); } }
        @keyframes scrollLeft  { from { transform: translateX(0%); }  to { transform: translateX(-50%); } }
      `}</style>
    </>
  );
}
