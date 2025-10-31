/* eslint-disable */
"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion, Variants } from "framer-motion";
import { useTitle } from "@/context/TitleContext"; // Импортируем контекст
import Link from "next/link";
import { Categories } from "@/components/shared/categories";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ChevronDown, Search, Filter, X, Menu, Crown } from "lucide-react";

const wrapIndex = (min: number, max: number, v: number) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

const swipeConfidenceThreshold = 1200; // было 9000 — на мобилках часто не срабатывало
const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;

const getPreviewImages = (item: any): string[] => {
  const imgs = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
  if (imgs.length) return imgs;
  if (item?.imageUrl) return [item.imageUrl];
  if (item?.image) return [item.image];
  return [];
};

function SwipeablePreview({
  images,
  alt,
  className = "",
}: {
  images: string[];
  alt: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [isTouch, setIsTouch] = React.useState(false);
  const draggingRef = React.useRef(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const detect = () => {
      try {
        const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
        const small = window.matchMedia?.("(max-width: 767px)")?.matches ?? false;
        const touch =
          ("ontouchstart" in window) ||
          ((navigator as any)?.maxTouchPoints ?? 0) > 0 ||
          ((navigator as any)?.msMaxTouchPoints ?? 0) > 0;
        setIsTouch(Boolean(coarse || touch || small));
      } catch {
        setIsTouch(true);
      }
    };

    detect();
    window.addEventListener("resize", detect);
    window.addEventListener("orientationchange", detect);
    return () => {
      window.removeEventListener("resize", detect);
      window.removeEventListener("orientationchange", detect);
    };
  }, []);

  const [[page, direction], setPage] = React.useState<[number, number]>([0, 0]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState(0);
  const imagesKey = images?.join("|") || "";

  const count = images?.length ?? 0;
  const index = count > 0 ? wrapIndex(0, count, page) : 0;

  const paginate = (newDirection: number) => {
    if (count <= 1) return;
    setPage(([p]) => [p + newDirection, newDirection]);
  };

  // Smooth spring animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: reduceMotion ? 0 : direction > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: reduceMotion ? 0 : direction > 0 ? -100 : 100,
      opacity: 0,
      scale: 0.95,
    }),
  };

  // Handle drag for swipe
  const handleDragStart = () => {
    draggingRef.current = true;
    setIsDragging(true);
  };

  const handleDrag = (_event: any, info: any) => {
    if (count <= 1) return;
    setDragOffset(info.offset.x);
  };

  const handleDragEnd = (_event: any, info: any) => {
    setIsDragging(false);
    setDragOffset(0);

    const swipe = swipePower(info.offset.x, info.velocity.x);
    if (swipe < -swipeConfidenceThreshold) paginate(1);
    else if (swipe > swipeConfidenceThreshold) paginate(-1);
  };

  // Если список картинок сменился — возвращаемся к первой с плавной анимацией
  React.useEffect(() => {
    setDragOffset(0);
    setPage((prev) => {
      if (prev[0] === 0) return prev;
      return [0, prev[0] > 0 ? -1 : 1];
    });
  }, [imagesKey]);

  if (!images?.length) {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="text-gray-400">Нет изображения</div>
      </div>
    );
  }

  // Desktop: прежняя логика — на ховер плавно появляется следующее фото (без свайпа)
  if (!isTouch) {
    const primary = images[0];
    const secondary = images[1];
    return (
      <div
        className={`relative overflow-hidden rounded-xl bg-white group ${className}`}
        style={{ touchAction: "pan-y pinch-zoom" }}
      >
        <img
          src={primary}
          alt={alt}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 group-hover:opacity-0"
        />
        {secondary && (
          <img
            src={secondary}
            alt={`${alt} preview`}
            className="absolute inset-0 w-full h-full object-contain opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white to-transparent opacity-70" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent opacity-80" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        touchAction: "pan-y pinch-zoom",
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onClickCapture={(e) => {
        if (draggingRef.current) {
          e.preventDefault();
          e.stopPropagation();
          draggingRef.current = false;
        }
      }}
    >
      {/* Main image with drag animation */}
      <motion.div
        className="relative w-full h-full"
        drag={isTouch && count > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{
          x: dragOffset,
        }}
      >
        <AnimatePresence initial custom={direction} mode="popLayout">
          <motion.img
            key={`${index}-${images[index]}`}
            src={images[index]}
            alt={alt}
            className="absolute inset-0 w-full h-full object-contain"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 0.5,
            }}
          />
        </AnimatePresence>
      </motion.div>

      {/* Progress dots */}
      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1">
          {images.map((_, i) => (
            <motion.span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === index ? "bg-black/80" : "bg-black/25"
              }`}
              initial={{ width: i === index ? 12 : 5 }}
              animate={{ width: i === index ? 12 : 5 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
            />
          ))}
        </div>
      )}

      {/* Current image counter */}
      {/* intentionally removed badge/hint to keep mobile чище */}
    </div>
  );
}


// Локальные подписи основных и некоторых подкатегорий, чтобы не зависеть от внешнего taxonomy
const LABELS: Record<string, string> = {
  footwear: 'Обувь',
  clothes: 'Одежда',
  bags: 'Сумки',
  accessories: 'Аксессуары',
  fragrance: 'Парфюмерия',
  headwear: 'Головные уборы',
  other: 'Другое',
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
const CANONICAL_ORDER: string[] = ['footwear','clothes','accessories','bags','fragrance','headwear','other'];
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

// Поддержка числовых id категорий (например, из БД: 1..6)
const NUMERIC_CATEGORY_MAP: Record<number, string> = {
  1: 'footwear',
  2: 'clothes',
  3: 'headwear',
  4: 'fragrance',
  5: 'accessories',
  6: 'bags',
};

const normalizeCategory = (raw: any): string | null => {
  if (raw === undefined || raw === null) return null;

  // Если пришло число (categoryId)
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return NUMERIC_CATEGORY_MAP[raw] ?? null;
  }

  const s = String(raw).trim().toLowerCase();
  if (!s) return null;

  // Число в строке
  const asNum = Number(s);
  if (!Number.isNaN(asNum)) {
    return NUMERIC_CATEGORY_MAP[asNum] ?? null;
  }

  if (CANONICAL_ORDER.includes(s)) return s;
  if (s === 'other') return 'other';
  return CATEGORY_ALIASES[s] ?? null;
};

const getProductCategoryKey = (p: any): string => {
  // Try the most likely sources first (API field, Prisma relation, ids)
  const candidates: any[] = [
    p?.category,
    p?.Category?.slug,
    p?.Category?.name,
    p?.categoryId,
    p?.Category?.id,
  ];

  for (const c of candidates) {
    const norm = normalizeCategory(c);
    if (norm) return norm;
  }

  // If we still can’t classify — keep it visible, don’t drop it
  return "other";
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
    <div className="brand-cloud relative overflow-hidden rounded-2xl w-full h-[220px] sm:h-[280px] lg:h-[420px]">
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

// --- Diagonal PNG belts (for the first intro slide only) ---
const DiagonalBelts: React.FC<{ images1: string[]; images2: string[] }> = ({ images1, images2 }) => {
  // Deterministic, no randomization
  const track1 = React.useMemo(() => [...images1, ...images1], [images1]);
  const track2 = React.useMemo(() => [...images2, ...images2], [images2]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[1]">
      {/* Top belt (left-to-right, slight counter-clockwise) */}
      <div className="absolute left-[-20%] right-[-20%] top-[22%] -rotate-[14deg]">
        <div className="premium-belt-track premium-belt-track--ltr">
          {track1.map((src, i) => (
            <img key={`b1-${i}`} src={src} alt="" className="premium-belt-img" />
          ))}
        </div>
      </div>

      {/* Bottom belt (right-to-left, slight clockwise) */}
      <div className="absolute left-[-20%] right-[-20%] bottom-[18%] rotate-[14deg]">
        <div className="premium-belt-track premium-belt-track--rtl">
          {track2.map((src, i) => (
            <img key={`b2-${i}`} src={src} alt="" className="premium-belt-img" />
          ))}
        </div>
      </div>

      {/* styles for belts */}
      <style jsx global>{`
        @keyframes premium-belt-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .premium-belt-track {
          display: inline-flex;
          width: max-content;
          will-change: transform;
          filter: saturate(1.05);
          animation: premium-belt-scroll 38s linear infinite;
        }
        .premium-belt-track--rtl { animation-direction: reverse; }
        .premium-belt-img {
          width: 120px;
          height: 120px;
          object-fit: contain;
          margin-right: 22px;
          opacity: .9;
          filter: drop-shadow(0 8px 24px rgba(0,0,0,.35));
        }
        @media (min-width: 768px) {
          .premium-belt-img {
            width: 160px;
            height: 160px;
            margin-right: 28px;
          }
        }
        @media (min-width: 1280px) {
          .premium-belt-img {
            width: 190px;
            height: 190px;
            margin-right: 32px;
          }
        }
      `}</style>
    </div>
  );
};

// --- Stats row for slide 2 ---
// --- Stats row for slide 2 ---
const StatsRow: React.FC = () => (
  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-[520px] mx-auto md:mx-0">
    <div className="min-h-[72px] px-4 py-3 rounded-xl bg-white/10 border border-white/15 flex flex-col justify-center">
      <div className="text-xl md:text-2xl font-extrabold text-white leading-none">100+</div>
      <div className="text-xs text-white/70 mt-1 leading-snug">премиум-брендов</div>
    </div>
    <div className="min-h-[72px] px-4 py-3 rounded-xl bg-white/10 border border-white/15 flex flex-col justify-center">
      <div className="text-xl md:text-2xl font-extrabold text-white leading-none">2 000+</div>
      <div className="text-xs text-white/70 mt-1 leading-snug">редких лотов</div>
    </div>
    <div className="min-h-[72px] px-4 py-3 rounded-xl bg-white/10 border border-white/15 flex flex-col justify-center">
      <div className="text-xl md:text-2xl font-extrabold text-white leading-none">24/7</div>
      <div className="text-xs text-white/70 mt-1 leading-snug">консьерж-сервис</div>
    </div>
  </div>
);

type Collab = {
  title: string;
  images?: string[]; // optional — will render gradient tile if empty
  where?: string;
};

const FEATURED_COLLABS: Collab[] = [
  {
    title: "Louis Vuitton × Timberland",
    images: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761426648/e42b6044_e48e_11ef_8461_3cecef222b53_c991bbc8_e495_11ef_8461_3cecef222b53_g8unrc.png",
    ],
    where: "LV Boots by Pharrell",
  },
  {
    title: "Jacquemus × Nike",
    images: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761426834/18818944_40783580_600_q4gbdy.png",
    ],
    where: "J Force / Swoosh bag",
  },
  {
    title: "Tiffany & Co. × Nike",
    images: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761426985/19839241_44497355_1000_a3qcwu.png",
    ],
    where: "AF1 1837",
  },
  {
    title: "Louis Vuitton x Tyler, The Creator",
    images: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761427128/66a76570c4559139544632_g3lkbk.png",
    ],
    where: "Keepal 45",
  },
  {
    title: "Miu Miu × New Balance",
    images: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761427052/NB_530_Miu_L_brown_1_dy7wpq.png",
    ],
    where: "NB 530/574",
  },
  {
    title: "Moncler x 1017 Alyx 9SM",
    images: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761427367/e62875a8-c1dd-350b-9c8b-5842eecd779f_1_gctml7.png",
    ],
    where: "Moncler Genius",
  },
  {
    title: "Stone Island × New Balance",
    images: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761427007/collab_stoneisland_nb.png",
    ],
    where: "Made in UK",
  },
  {
    title: "MM6 Maison Margiela × Dr. Martens",
    images: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761427008/collab_mm6_docs.png",
    ],
    where: "1461 Bex",
  },
];

// --- Authenticity slide artwork (certificate + checklist) ---
const AuthSlideArt: React.FC = () => {
  // simple looping highlight for checklist (SSR-safe – deterministic)
  const [active, setActive] = React.useState(0);
  const items = [
    "Серийные номера и QR‑метки",
    "Материалы, кромки, прошивка",
    "Фурнитура и гравировки",
    "Комплектация и упаковка",
    "Сопоставление с эталонами",
    "Финальный контроль качества",
  ];
  React.useEffect(() => {
    const id = setInterval(() => setActive((v) => (v + 1) % items.length), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full h-full p-6 md:p-8">
      {/* glass panel */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0b0b0b] to-[#171717] border border-white/10" />

      <div className="relative z-10 flex items-start justify-center h-full pt-4 md:pt-8">
        <div className="w-full md:max-w-[620px] rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6 shadow-[0_8px_40px_rgba(0,0,0,.25)]">
          <div className="text-white font-bold text-lg mb-3">Дорожная карта проверки</div>

          {(() => {
            const steps = [
              {
                title: "Выкуп — проверка экспертами",
                details: [
                  "Серийные номера и QR‑метки",
                  "Материалы, кромки, прошивка",
                  "Фурнитура и гравировки",
                ],
              },
              {
                title: "Россия — повторная экспертиза",
                details: [
                  "Сопоставление с эталонами",
                  "Фото/видео‑отчёт",
                  "Финальный контроль качества",
                ],
              },
              {
                title: "Доставка — товар у вас",
                details: [
                  "Упаковка и пломбирование",
                  "Трек‑номер и страхование",
                  "Вручение под подпись",
                ],
              },
            ] as const;

            const stepActive = Math.floor(active / 2) % steps.length;

            return (
              <ol className="relative ml-3">
                {steps.map((s, idx) => (
                  <li
                    key={s.title}
                    className={`relative pl-6 py-3 rounded-xl transition-colors ${
                      idx === stepActive ? "bg-white/10 border border-white/15" : ""
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-4 w-3 h-3 rounded-full border ${
                        idx === stepActive
                          ? "bg-white border-white shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                          : "bg-white/20 border-white/40"
                      }`}
                    />
                    {idx < steps.length - 1 && (
                      <span className="absolute left-[5px] top-7 bottom-[-7px] w-px bg-gradient-to-b from-white/30 to-white/10" />
                    )}

                    <div className="text-sm font-semibold text-white">{s.title}</div>
                    <ul className="mt-1 text-xs text-white/70 list-disc pl-4 space-y-0.5">
                      {s.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            );
          })()}

          {/* Бейджи доверия как итоговый блок */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-white/80">
            <div className="h-8 rounded-xl border border-white/15 bg-white/10 grid place-items-center">Фото/видео‑отчёт</div>
            <div className="h-8 rounded-xl border border-white/15 bg-white/10 grid place-items-center">База эталонов</div>
            <div className="h-8 rounded-xl border border-white/15 bg-white/10 grid place-items-center">Подпись эксперта</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Packaging & Delivery slide artwork (interactive 3D box + delivery timeline) ---
const LogisticsSlideArt: React.FC = () => {
  // animate highlight along the timeline, deterministic loop
  const [active, setActive] = React.useState(0);
  const steps = [
    { title: "Сборка — подготовка", details: ["Пыльник, бумага", "Thank‑you карта"] },
    { title: "Пломба и документы", details: ["Сертификат Stage", "Индивидуальная пломба"] },
    { title: "Упаковка и защита", details: ["Транспортная коробка", "Амортизационные вставки"] },
    { title: "Доставка", details: ["Трек‑номер и страхование", "Сроки 1–5 дней"] },
    { title: "Вручение", details: ["Выдача под подпись", "Проверка содержимого"] },
  ] as const;

  React.useEffect(() => {
    const id = setInterval(() => setActive((v) => (v + 1) % steps.length), 1100);
    return () => clearInterval(id);
  }, []);

  // --- Box interactivity (hover/tap to open) ---
  const [opened, setOpened] = React.useState(false);
  const [tilt, setTilt] = React.useState({ rx: 0, ry: 0 });
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    const max = 6;
    setTilt({ rx: -(dy * max), ry: dx * max });
  };
  const onLeave = () => setTilt({ rx: 0, ry: 0 });

  const lidV: Variants = {
    closed: {
      rotateX: 0,
      y: 0,
      transition: { type: "spring", stiffness: 240, damping: 22 } as const,
    },
    open: {
      rotateX: -62,
      y: -6,
      transition: { type: "spring", stiffness: 200, damping: 18 } as const,
    },
  };

  const cardV: Variants = {
    closed: { y: 18, opacity: 0, scale: 0.96, transition: { duration: 0.35 } },
    open: {
      y: -36,
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 260, damping: 18, delay: 0.05 } as const,
    },
  };

  const sealV: Variants = {
    closed: { scaleX: 1, opacity: 1, transition: { duration: 0.3 } },
    open: { scaleX: 0, opacity: 0, transition: { duration: 0.35 } },
  };

  return (
    <div className="relative w-full h-full p-6 md:p-8">
      {/* Подложка */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0b0b0b] to-[#151515] border border-white/10" />

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-center h-full">
        {/* LEFT: interactive 3D box */}
        <div className="relative w-full md:h-full grid place-items-center">
          <div
            ref={boxRef}
            className="relative w-[88%] md:w-[92%] aspect-[4/3] rounded-2xl"
            style={{ perspective: 1000 }}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            onClick={() => setOpened((v) => !v)}
            role="button"
            aria-label={opened ? "Закрыть коробку" : "Открыть коробку"}
          >
            {/* body */}
            <motion.div
              className="absolute inset-x-0 bottom-0 h-[58%] rounded-b-2xl border border-white/15 bg-white/7 backdrop-blur"
              style={{
                transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div className="absolute inset-0 rounded-b-2xl bg-[radial-gradient(60%_40%_at_20%_20%,rgba(255,255,255,.08),transparent),radial-gradient(45%_35%_at_80%_80%,rgba(255,255,255,.08),transparent)]" />
              <div className="absolute left-4 bottom-3 text-white/80 text-sm font-semibold">Коробка</div>
              {/* inner shine */}
              <div className="pointer-events-none absolute inset-x-2 top-0 h-10 rounded-t-xl bg-gradient-to-b from-white/15 to-transparent" />
            </motion.div>

            {/* lid */}
            <motion.div
              className="absolute inset-x-0 top-[12%] h-[22%] rounded-t-2xl border border-white/15 bg-white/10 backdrop-blur origin-top"
              variants={lidV}
              animate={opened ? "open" : "closed"}
              style={{
                transform: `rotateX(${opened ? -62 : 0}deg) rotateY(${tilt.ry}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* subtle stripes */}
              <div className="absolute inset-0 rounded-t-2xl opacity-20 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.2)_0,rgba(255,255,255,.2)_2px,transparent_2px,transparent_8px)]" />
              {/* seal (breaks on open) */}
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 h-6 w-40 rounded-full bg-white/20 border border-white/25"
                variants={sealV}
                animate={opened ? "open" : "closed"}
              >
                <div className="absolute inset-0 grid place-items-center text-[11px] text-white/80 font-semibold">Пломба Stage</div>
              </motion.div>
            </motion.div>

            {/* thank-you card pops up when open */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 bottom-[34%] w-[56%] md:w-[60%] h-20 md:h-24 rounded-xl bg-white text-black grid place-items-center shadow"
              variants={cardV}
              animate={opened ? "open" : "closed"}
              style={{ transform: `translateX(-50%) ${opened ? "" : ""}` }}
            >
              <div className="text-sm font-bold">Thank‑you / сертификат</div>
            </motion.div>

            {/* dust bag layer */}
            <motion.div
              className="absolute left-[8%] right-[8%] bottom-[46%] h-[18%] rounded-xl border border-white/15 bg-white/5 backdrop-blur"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
            >
              <div className="absolute left-4 top-2 text-white/80 text-sm font-semibold">Пыльник</div>
            </motion.div>

            {/* sparkles when opened */}
            <div className={`pointer-events-none absolute inset-0 ${opened ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}>
              <span className="sparkle s1" />
              <span className="sparkle s2" />
              <span className="sparkle s3" />
              <span className="sparkle s4" />
              <span className="sparkle s5" />
            </div>

            {/* hint */}
            {!opened && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-center text-[11px] text-white/70">
                Наведите/тапните, чтобы открыть
              </div>
            )}
          </div>

          <style jsx>{`
            .sparkle{
              position:absolute;
              width:10px;height:10px;
              border-radius:50%;
              background: radial-gradient(circle, rgba(255,255,255,.9), rgba(255,255,255,0));
              animation: twinkle 1.8s ease-in-out infinite;
            }
            .s1{ top:14%; left:22%; animation-delay:-0.2s; }
            .s2{ top:10%; right:18%; animation-delay:-0.6s; }
            .s3{ bottom:28%; left:12%; animation-delay:-1.0s; }
            .s4{ bottom:18%; right:20%; animation-delay:-1.3s; }
            .s5{ top:40%; left:48%; animation-delay:-1.6s; }
            @keyframes twinkle{
              0%,100%{ transform:scale(0.6); opacity:.4; }
              50%{ transform:scale(1.1); opacity:1; }
            }
          `}</style>
        </div>

        {/* RIGHT: delivery roadmap */}
        <div className="w-full">
          <div className="text-white font-bold text-lg mb-3">Маршрут «от склада до вас»</div>
          <ol className="relative ml-3">
            {steps.map((s, idx) => (
              <li
                key={s.title}
                className={`relative pl-6 py-3 rounded-xl transition-colors ${idx === active ? "bg-white/10 border border-white/15" : ""}`}
              >
                <span
                  className={`absolute left-0 top-4 w-3 h-3 rounded-full border ${idx === active ? "bg-white border-white shadow-[0_0_0_2px_rgba(255,255,255,0.25)]" : "bg-white/20 border-white/40"}`}
                />
                {idx < steps.length - 1 && (
                  <span className="absolute left-[5px] top-7 bottom-[-7px] w-px bg-gradient-to-b from-white/30 to-white/10" />
                )}

                <div className="text-sm font-semibold text-white">{s.title}</div>
                <ul className="mt-1 text-xs text-white/70 list-disc pl-4 space-y-0.5">
                  {s.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          {/* bottom badges */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-white/80">
            {["До двери", "Страхование", "Контроль содержимого", "Экологичная тара"].map((t) => (
              <div
                key={t}
                className="h-8 rounded-xl border border-white/15 bg-white/10 grid place-items-center"
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


// --- Concierge chat slide artwork (compact chat + optional mini-form) ---
const ConciergeSlideArt: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const openConcierge = () => {
    // открыть полноразмерный модал (для вложений и расширенной анкеты)
    try {
      window.dispatchEvent(new CustomEvent("open-concierge"));
    } catch {}
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setDone(null);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const resp = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, source: "premium-intro" }),
      });
      if (!resp.ok) throw new Error("Fail");
      setDone("Заявка отправлена! Мы свяжемся с вами.");
      (e.currentTarget as HTMLFormElement).reset();
    } catch {
      setError("Не удалось отправить. Попробуйте снова или откройте полную форму.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full h-full p-6 md:p-8">
      {/* Подложка */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0b0b0b] to-[#1a1a1a] border border-white/10" />

      <div className="relative z-10 grid grid-cols-1 gap-6 h-full">
        {/* Левая колонка — «сценка» чата */}
        <div className="flex flex-col gap-3 justify-center">
          <div className="self-start max-w-[88%] rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-sm backdrop-blur">
            Ищу <b>Birkin 30</b> в тёмно‑сером. Б/у тоже рассматриваю.
          </div>
          <div className="self-start max-w-[88%] rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-sm backdrop-blur">
            Нужны <b>New Balance 2002R</b>, EU&nbsp;42, до 20&nbsp;000₽.
          </div>
          <div className="self-end max-w-[88%] rounded-2xl bg-white text-black px-4 py-3 text-sm shadow">
            Привет! Подберу 3–5 вариантов в течение 1–3 часов. ✨
          </div>
          <div className="self-end max-w-[88%] rounded-2xl bg-white px-4 py-3 text-sm text-black/70 shadow flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-black/50 animate-bounce [animation-delay:-120ms]" />
            <span className="inline-block w-2 h-2 rounded-full bg-black/50 animate-bounce [animation-delay:-40ms]" />
            <span className="inline-block w-2 h-2 rounded-full bg-black/50 animate-bounce" />
          </div>

          {/* Бейджи доверия */}
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-white/80 items-stretch">
            {["Ответ 1–3 ч", "Предлагаем лучшую цену", "Проверка 100%"].map((t) => (
              <div
                key={t}
                className="h-9 md:h-8 rounded-xl border border-white/15 bg-white/10 px-3 flex items-center justify-center text-center whitespace-nowrap"
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Правая колонка — компактная стеклянная форма (скрыта на десктопе по требованию) */}
        <div className="hidden">
          <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-4 md:p-5 shadow-[0_8px_40px_rgba(0,0,0,.25)]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-bold text-lg">Заявка Консьерж</h4>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  name="name"
                  required
                  placeholder="Имя"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/50"
                />
            <input
              name="contact"
              required
              placeholder="Телефон или @Telegram / WhatsApp"
              className="w-full rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm"
            />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  name="category"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                  defaultValue="footwear"
                >
                  <option value="footwear">Обувь</option>
                  <option value="clothes">Одежда</option>
                  <option value="bags">Сумки</option>
                  <option value="accessories">Аксессуары</option>
                  <option value="fragrance">Парфюмерия</option>
                </select>
                <input
                  name="size"
                  placeholder="Размеры (напр. 42 EU, рост 182)"
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/50"
                />
              </div>
            <textarea
            name="notes"
            rows={4}
            placeholder="Комментарий к запросу: что ищете, цвет, бюджет, ссылки…"
            className="w-full rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm"
            />

              {done && <div className="text-green-400 text-sm">{done}</div>}
              {error && <div className="text-red-400 text-sm">{error}</div>}

              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">
                  Нужны вложения?{" "}
                  <button
                    type="button"
                    onClick={openConcierge}
                    className="underline underline-offset-2 hover:text-white"
                  >
                    Откройте полную форму
                  </button>
                </span>
                <button
                  disabled={loading}
                  className="px-5 py-2 rounded-full bg-white text-black font-semibold disabled:opacity-60"
                >
                  {loading ? "Отправка…" : "Отправить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Декоративные логотипы, опционально */}
      <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-4 opacity-30">
        <img src="/img/prada-logo.png" alt="Prada" className="h-6" />
        <img src="/img/Logo_Goyard.png" alt="Goyard" className="h-5" />
        <img src="/img/ysl logo 2.png" alt="Saint Laurent" className="h-5" />
      </div>
    </div>
  );
};

// --- Collage mosaic for slide 2 (deterministic, no random on SSR) ---
const CollageMosaic: React.FC<{ images?: string[]; mode?: 'images' | 'brandTiles' | 'collabs' }> = ({ images = [], mode = 'images' }) => {
  // Mode 1: stylized brand tiles (no product photos)
  if (mode === 'brandTiles') {
    const tiles = [
      { label: 'LV', sub: 'Louis Vuitton', grad: 'from-[#262626] to-[#000000]' },
      { label: 'GG', sub: 'Gucci',         grad: 'from-[#0f5132] to-[#052e16]' },
      { label: 'CD', sub: 'Dior',          grad: 'from-[#1f2937] to-[#111827]' },
      { label: 'YSL', sub: 'Saint Laurent',grad: 'from-[#111827] to-[#000000]' },
      { label: 'CH', sub: 'Chanel',        grad: 'from-[#0f172a] to-[#020617]' },
      { label: 'PR', sub: 'Prada',         grad: 'from-[#1e293b] to-[#0f172a]' },
    ];
    return (
      <div className="w-full h-full grid grid-cols-3 gap-4 p-6">
        {tiles.map((t, idx) => (
          <motion.div
            key={t.label}
            className={`relative w-full h-full min-h-[120px] rounded-xl border border-white/10 overflow-hidden bg-gradient-to-br ${t.grad}`}
            animate={{ scale: [1, 1.02, 1], rotate: [0, -0.4, 0] }}
            transition={{ duration: 6 + idx * 0.3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* soft lights overlay */}
            <div className="absolute inset-0 opacity-[.08] bg-[radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_80%,white,transparent_35%)]" />
            <div className="relative z-10 grid place-items-center h-full text-white select-none">
              <div className="text-4xl md:text-5xl font-black tracking-widest">{t.label}</div>
              <div className="text-[10px] md:text-xs mt-1 uppercase tracking-[.2em] opacity-70">{t.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // Mode 1.5: collaborations tiles (deterministic, no random)
  if (mode === 'collabs') {
    const tiles = FEATURED_COLLABS.slice(0, 6); // 6 tiles in the mosaic
    return (
      <div className="w-full h-full grid grid-cols-3 gap-4 p-6">
        {tiles.map((c, idx) => (
          <motion.div
            key={c.title}
            className="relative w-full h-full min-h[120px] rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0b0b0b] to-[#1a1a1a]"
            animate={{ scale: [1, 1.02, 1], rotate: [0, -0.25, 0] }}
            transition={{ duration: 6 + idx * 0.25, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* image (optional) */}
            {c.images && c.images[0] && (
              <img
                src={c.images[0]}
                alt={c.title}
                className="absolute inset-0 w-full h-full object-contain pt-4 px-4 pb-16 opacity-95"
                style={{ objectPosition: 'center 32%', transform: 'translateY(-6%)' }}
              />
            )}
            {/* soft lights overlay */}
            <div className="absolute inset-0 opacity-[.08] bg-[radial-gradient(60%_40%_at_20%_20%,white,transparent),radial-gradient(45%_35%_at_80%_80%,white,transparent)]" />
            {/* labels */}
            <div className="absolute inset-x-3 bottom-3 z-20 text-white drop-shadow">
              <div className="text-xs uppercase tracking-[.16em] opacity-70">{c.where || "Collaboration"}</div>
              <div className="text-sm md:text-base font-extrabold leading-tight">{c.title}</div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // Mode 2 (default): image collage (kept as-is)
  const pool = (images || []).filter(Boolean);
  const fallback = [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761419549/Goyard-PNG-HD-Quality_mkgvle.png",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761420942/pngtree-hermes-birkin-bag-png-image_13325744_xlfsae.png",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761421933/Chanel-Classic-Flap-Bag-Maxi_2_yuyct5.png",
  ];
  const picks = Array.from({ length: 6 }, (_, i) => (pool[i % (pool.length || fallback.length)] || fallback[i % fallback.length]));

  return (
    <div className="w-full h-full grid grid-cols-3 gap-4 p-6">
      {picks.map((src, idx) => (
        <motion.div
          key={idx}
          className="w-full h-full min-h-[120px] rounded-xl bg-white/5 border border-white/10 grid place-items-center overflow-hidden"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 6 + idx * 0.35, repeat: Infinity, ease: "easeInOut" }}
        >
          <img src={src} alt="" className="max-w-[90%] max-h-[90%] object-contain" />
        </motion.div>
      ))}
    </div>
  );
};

// --- Intro slides overlay (multi-slide, full black screen) ---
type IntroSlide = {
  title: React.ReactNode;
  text?: React.ReactNode;
  image?: string; // single image variant
  images?: string[]; // multi-image variant
};

function IntroSlides({
  open,
  onClose,
  slides,
}: {
  open: boolean;
  onClose: () => void;
  slides: IntroSlide[];
}) {
  const [isDesktopIntro, setIsDesktopIntro] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktopIntro(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  const [i, setI] = React.useState(0);
  const total = slides.length;

  // PNG belts pool comes from the first slide images
  const beltPool = React.useMemo(() => {
    const imgs = (slides?.[0]?.images ?? []).filter(Boolean);
    // Fallback to a minimal set if first slide has no images
    return imgs.length ? imgs : [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761419549/Goyard-PNG-HD-Quality_mkgvle.png",
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761420942/pngtree-hermes-birkin-bag-png-image_13325744_xlfsae.png",
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761421933/Chanel-Classic-Flap-Bag-Maxi_2_yuyct5.png",
    ];
  }, [slides]);

  // Deterministic, seeded picker for belt images
  const seededPick = React.useCallback((pool: string[], count: number, seed: number) => {
    // simple LCG PRNG — deterministic on server and client
    let s = seed >>> 0;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      out.push(pool[Math.floor(rand() * pool.length)]);
    }
    // seeded shuffle
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }, []);

  const beltImgs1 = React.useMemo(() => seededPick(beltPool, 14, 1337), [beltPool, seededPick]);
  const beltImgs2 = React.useMemo(() => seededPick(beltPool, 14, 7331), [beltPool, seededPick]);

  // Mobile concierge sample requests, rotate every 3.5s
  const mobileConciergeSamples = React.useMemo(
    () => [
      "Ищу New Balance 2002R, 42 EU, до 20 000₽.",
      "Нужна сумка Jacquemus Le Chiquito в чёрном цвете.",
      "Ищу Louis Vuitton Keepall 45, состояние не ниже 8/10.",
      "Ищу Dior B23, 41 EU, до 90 000₽.",
      "Нужен пуховик Moncler, размер 2, бюджет до 180 000₽.",
      "Подберите женские кроссовки Nike Vomero, 38.5 EU, до 25 000₽.",
      "Нужен рюкзак Goyard, тёмный, до 350 000₽.",
      "Ищу парфюм Maison Francis Kurkdjian Baccarat Rouge 540, 70 мл.",
    ],
    []
  );
  const [mobileConciergeIdx, setMobileConciergeIdx] = React.useState(0);
  // Если слайдов нет — мягко закрываем после монтирования, чтобы не дергать state во время render
  React.useEffect(() => {
    if (open && slides.length === 0) {
      const id = requestAnimationFrame(() => onClose());
      return () => cancelAnimationFrame(id);
    }
  }, [open, slides, onClose]);

  React.useEffect(() => {
    if (!open) return;
    if (!mobileConciergeSamples.length) return;
    const id = window.setInterval(() => {
      setMobileConciergeIdx((prev) =>
        (prev + 1) % mobileConciergeSamples.length
      );
    }, 3500);
    return () => window.clearInterval(id);
  }, [open, mobileConciergeSamples]);

  const currentMobileConciergeSample =
    mobileConciergeSamples.length
      ? mobileConciergeSamples[mobileConciergeIdx % mobileConciergeSamples.length]
      : "";
  const guardRef = React.useRef(true);
  const touchStartY = React.useRef<number | null>(null);

  const goNext = React.useCallback(() => {
    setI((prev) => {
      if (prev < total - 1) return prev + 1;
      onClose();
      return prev;
    });
  }, [total, onClose]);

  const goPrev = React.useCallback(() => {
    setI((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  // Lock body scroll while open
  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Keyboard + Wheel + Touch navigation (throttled)
  React.useEffect(() => {
    if (!open) return;

    const throttle = () => {
      guardRef.current = false;
      setTimeout(() => (guardRef.current = true), 600);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!guardRef.current) return;
      if (e.deltaY > 0) goNext();
      else goPrev();
      throttle();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        if (!guardRef.current) return;
        goNext();
        throttle();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        if (!guardRef.current) return;
        goPrev();
        throttle();
      } else if (e.key === "Escape") {
        setTimeout(() => onClose(), 0);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY.current == null) return;
      const dy = (touchStartY.current - (e.touches[0]?.clientY ?? touchStartY.current));
      if (Math.abs(dy) < 50) return;
      if (!guardRef.current) return;
      if (dy > 0) goNext();
      else goPrev();
      throttle();
      touchStartY.current = null;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel as any);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart as any);
      window.removeEventListener("touchmove", onTouchMove as any);
    };
  }, [open, goNext, goPrev]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="introSlides"
          className="fixed inset-0 z-[9999] bg-black text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Skip */}
          <div className="absolute top-4 right-4 z-[10000]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-sm"
            >
              Пропустить
            </button>
          </div>

          {/* Dots */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[10000]">
            {slides.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Слайд ${idx + 1}`}
                onClick={() => setI(idx)}
                className={`w-2 h-2 rounded-full transition ${idx === i ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>

          {/* Decorative diagonal PNG belts — only on the very first slide */}
          {i === 0 && <DiagonalBelts images1={beltImgs1} images2={beltImgs2} />}
          {/* Slide content */}
          <div className="relative z-[2] w-full h-full grid place-items-center">
            <div className="w-[92%] max-w-[1200px] mx-auto min-h-[70vh] py-10 grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-10">
              {/* Text */}
              <motion.div
                key={`text-${i}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="order-2 md:order-1 text-center md:text-left px-2 sm:px-0 relative"
              >
                <div
                  className={
                    "text-3xl sm:text-4xl md:text-6xl font-extrabold leading-tight mx-auto md:mx-0 " +
                    (i === 1 ? "max-w-[22rem] sm:max-w-[28rem]" : "max-w-[24rem] sm:max-w-[30rem] md:max-w-none")
                  }
                >
                  {slides[i]?.title}
                </div>
                {slides[i]?.text && (
                  <p className="mt-4 text-base md:text-lg text-white/80 max-w-[26rem] sm:max-w-[32rem] md:max-w-none mx-auto md:mx-0">
                    {slides[i]?.text}
                  </p>
                )}
                {i === 1 && <StatsRow />}

                <div className="mt-8 flex items-center gap-3 justify-center md:justify-start">
                  <button
                    type="button"
                    onClick={goNext}
                    className="px-5 py-2.5 rounded-full bg-white text-black font-semibold"
                  >
                    {i < total - 1 ? "Далее" : "Войти в Premium"}
                  </button>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={goPrev}
                      className="px-5 py-2.5 rounded-full border border-white/20"
                    >
                      Назад
                    </button>
                  )}
                </div>

                {/* Mobile-only lightweight animated accents */}
                {!isDesktopIntro && i !== 0 && (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    {i === 1 && (
                      <motion.div
                        className="flex flex-col sm:flex-row items-center gap-2 text-[11px] text-white/80 w-full max-w-xs"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                      >
                        <motion.div
                          className="w-full sm:w-auto px-4 py-2 rounded-full border border-white/25 bg-white/12 backdrop-blur-sm text-center"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        >
                          Топ‑бренды: LV · Gucci · Dior
                        </motion.div>
                        <motion.div
                          className="w-full sm:w-auto px-4 py-2 rounded-full border border-white/20 bg-white/8 backdrop-blur-sm text-center"
                          animate={{ y: [0, 4, 0] }}
                          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                        >
                          Редкие капсулы и лимитки
                        </motion.div>
                      </motion.div>
                    )}

                    { i === 2 && (
                      <motion.div
                        className="w-full max-w-xs rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm px-4 py-3 text-left text-xs text-white/85"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                      >
                        <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/60">
                          Консьерж-поиск
                        </div>

                        <div className="rounded-xl bg-white/10 px-3 py-2 mb-2 min-h-[48px] flex items-center">
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                              key={currentMobileConciergeSample}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.35, ease: "easeInOut" }}
                              className="w-full"
                            >
                              {currentMobileConciergeSample}
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce [animation-delay:-160ms]" />
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce [animation-delay:-80ms]" />
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" />
                          <span className="ml-1 text-[10px] text-white/70">консьерж печатает…</span>
                        </div>
                      </motion.div>
                    )}

                    {i === 3 && (
                      <motion.div
                        className="w-full max-w-xs rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm px-4 py-3 text-left text-xs text-white/85"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                      >
                        <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/60">
                          Проверка подлинности
                        </div>
                        <ul className="space-y-1">
                          {[
                            "Серийные номера и QR‑метки",
                            "Материалы, фурнитура, прошивка",
                            "Фото‑отчёт и финальный контроль",
                          ].map((text, idx) => (
                            <motion.li
                              key={text}
                              className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1"
                              animate={{ opacity: [0.6, 1, 0.6] }}
                              transition={{
                                duration: 2.4,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: idx * 0.4,
                              }}
                            >
                              <span className="inline-block w-3 h-3 rounded-full border border-white/40 bg-white/20" />
                              {text}
                            </motion.li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Image(s) — скрываем на первом слайде, чтобы осталась только диагональная лента */}
              {i !== 0 && isDesktopIntro && (
                <motion.div
                  key={`img-${i}`}
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.98, opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className={`order-1 md:order-2 w-full ${i === 3 ? 'md:min-h-[560px] lg:min-h-[620px]' : 'aspect-[4/3]'} rounded-2xl bg-white/5 border border-white/10 overflow-hidden grid place-items-center`}
                >
                  {(() => {
                    const slide = slides[i];
                    const imgs = (slide?.images && slide.images.length > 0)
                      ? slide.images
                      : (slide?.image ? [slide.image] : []);

                    // Special layout for slide #3 (index 2) — concierge mini-form
                    if (i === 2) {
                      return <ConciergeSlideArt />;
                    }
                    // Special layout for slide #2 (index 1) — collaborations mosaic
                    if (i === 1) {
                      return <CollageMosaic mode="collabs" images={imgs} />;
                    }
                    // Special layout for slide #4 (index 3) — authenticity certification
                    if (i === 3) {
                      return <AuthSlideArt />;
                    }

                    if (imgs.length <= 1) {
                      return (
                        <img
                          src={imgs[0] || ''}
                          alt="premium slide"
                          className="max-w-[90%] max-h-[90%] object-contain"
                        />
                      );
                    }

                    return (
                      <div className={`w-full h-full grid ${imgs.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-4 p-6 place-items-center`}>
                        {imgs.slice(0, 3).map((src, idx) => (
                          <img
                            key={idx}
                            src={src}
                            alt={`premium ${idx + 1}`}
                            className="max-w-full max-h-full object-contain"
                          />
                        ))}
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function PremiumPage() {
  const [whyOpen, setWhyOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState<string | null>(null);
  const [mobileMenuSubOpen, setMobileMenuSubOpen] = useState<string | null>(null);
  const freezeScrollYRef = useRef(0);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    const prevPos = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;

    if (mobileMenuOpen || mobileFiltersOpen) {
      freezeScrollYRef.current = window.scrollY;
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${freezeScrollYRef.current}px`;
      body.style.width = "100%";
    } else {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevPos;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      if (freezeScrollYRef.current) {
        window.scrollTo(0, freezeScrollYRef.current);
      }
    }

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevPos;
      body.style.top = prevTop;
      body.style.width = prevWidth;
    };
  }, [mobileMenuOpen, mobileFiltersOpen]);
  // Always show the intro overlay initially
  const [showAnimation, setShowAnimation] = useState(true);
    // Показывать интро только один раз: если флаг уже стоит в localStorage — сразу скрываем
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const seen = window.localStorage.getItem("premium_intro_seen");
        if (seen === "1") {
          setShowAnimation(false);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Expect API like /api/premium/products that returns { products: Product[] } or Product[]
  const [products, setProducts] = useState<any[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        // Primary: dedicated premium API endpoint (Next.js route: /app/api/premium/products/route.ts)
        const tryUrls = [
          "/api/premium/products?limit=500",
          // Backward-compat in case you created a non-api route by mistake
          "/premium/products?limit=500",
        ];

        for (const url of tryUrls) {
          const res = await fetch(url, { cache: "no-store", signal: controller.signal });
          if (!res.ok) continue;

          const data = await res.json();
          const items = Array.isArray((data as any)?.products)
            ? (data as any).products
            : Array.isArray(data)
            ? (data as any)
            : [];

          if (!cancelled) {
            setProducts(items);
            setProductsError(null);
          }
          return;
        }

        throw new Error("primary premium endpoint(s) failed");
      } catch (e: any) {
        if (controller.signal.aborted) return;
        console.warn('Premium API fallback to /api/products?premium=1', e);
        try {
          const res2 = await fetch('/api/products?premium=1&limit=500', { cache: 'no-store', signal: controller.signal });
          if (res2.ok) {
            const data2 = await res2.json();
            const items2 = Array.isArray(data2?.products)
              ? data2.products
              : Array.isArray(data2)
              ? data2
              : [];

            if (!cancelled) {
              setProducts(items2);
              setProductsError(null);
            }
          } else if (!cancelled) {
            setProductsError('Не удалось загрузить премиум-товары');
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          console.error('Failed to load products for Premium page', err);
          if (!cancelled) {
            setProducts([]);
            setProductsError('Не удалось загрузить премиум-товары');
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);


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


  // (removed effect that tied intro to ?intro=1)

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
    const handleIntroClose = React.useCallback(() => {
    setShowAnimation(false);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("premium_intro_seen", "1");
      }
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    setTitle("Stage Premium");
    document.body.style.overflow = showAnimation ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
      setTitle("Stage Shoes");
    };
  }, [setTitle, showAnimation]);
  // NOTE: Слайды используют Cloudinary. Замените PUBLIC_ID_* на ваши public_id из Cloudinary. Первый слайд уже использует Goyard пример.
  const introSlides = useMemo<IntroSlide[]>(
    () => [
      {
        title: (
          <>
            Stage{" "}
            <span className="inline-block bg-white text-black px-3 py-1 rounded-md">
              Premium
            </span>
          </>
        ),
        text: "Только эксклюзивы, лимитированные дропы и прямые поставки.",
        images: [
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761419549/Goyard-PNG-HD-Quality_mkgvle.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761420942/pngtree-hermes-birkin-bag-png-image_13325744_xlfsae.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761421933/Chanel-Classic-Flap-Bag-Maxi_2_yuyct5.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761423661/22522176_52531776_1000_rv8csy.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761424004/16825556_33337766_1000_exbsjd.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761424167/30234510_1_gof5k5.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761424306/19310350_54360349_1000_mtz20y.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761424544/3SH118YJPH069_E02_bl7lis.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761424845/item-d94f9865-ae0f-4a3c-90bc-56f404bf6e6c_gjo7sq.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761424994/f301ee3b-b263-3633-a9f3-61f6c850f7d6_ceznag.png"
        ],
      },
      {
        title: "Эксклюзивные коллекции и коллаборации",
        text: "Редкие пары и капсулы. Каждую позицию проверяем вручную.",
        images: [
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761426648/e42b6044_e48e_11ef_8461_3cecef222b53_c991bbc8_e495_11ef_8461_3cecef222b53_g8unrc.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761425480/premium_slide2_02.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761425480/premium_slide2_03.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761425480/premium_slide2_04.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761425480/premium_slide2_05.png",
          "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761425480/premium_slide2_06.png",
        ],
      },
      {
        title: "Консьерж и лимитированные релизы",
        text: "Найдём нужный размер/силуэт. Предзаказы на дропы.",
        image:
          "https://res.cloudinary.com/dhufbfxcy/image/fetch/f_auto,q_auto,w_1600,h_1200,c_fill,b_black/l_text:Arial_64_bold:%D0%9A%D0%BE%D0%BD%D1%81%D1%8C%D0%B5%D1%80%D0%B6%20%D0%B8%20%D0%BB%D0%B8%D0%BC%D0%B8%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5%20%D1%80%D0%B5%D0%BB%D0%B8%D0%B7%D1%8B,co_white,g_north_west,x_80,y_80/l_PUBLIC_ID_PHONE_MOCK,w_680,c_fit,g_east,x_120,e_shadow/l_PUBLIC_ID_DROP_CARD,w_420,c_fit,g_center,x_-60,y_80,e_shadow/https://singlecolorimage.com/get/000000/1600x1200",
      },
      {
        title: "Подлинность",
        text: "Сертификаты, проверка и контроль качества перед отправкой.",
        image:
          "https://res.cloudinary.com/dhufbfxcy/image/fetch/f_auto,q_auto,w_1600,h_1200,c_fill,b_black/l_text:Arial_64_bold:%D0%9F%D0%BE%D0%B4%D0%BB%D0%B8%D0%BD%D0%BD%D0%BE%D1%81%D1%82%D1%8C%20%D0%B8%20%D0%BF%D1%80%D0%BE%D0%B2%D0%B5%D1%80%D0%BA%D0%B0,co_white,g_north_west,x_80,y_80/l_PUBLIC_ID_TAG,w_500,c_fit,g_west,x_120,y_-20,e_shadow/l_PUBLIC_ID_CERT,w_520,c_fit,g_center,y_120,e_shadow/l_PUBLIC_ID_QR,w_220,c_fit,g_east,x_140,y_-10,e_shadow/https://singlecolorimage.com/get/000000/1600x1200",
      },
    ],
    []
  );


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
    [products]
  );

  // Итоговый список для грида по выбранному полу
  const currentPremium = useMemo(() => {
    if (gender === 'men')   return premiumOnly.filter((p: any) => p.gender === 'men'   || p.gender === 'unisex');
    if (gender === 'women') return premiumOnly.filter((p: any) => p.gender === 'women' || p.gender === 'unisex');
    if (gender === 'unisex') return premiumOnly; // показать все
    return premiumOnly; // по умолчанию — всё
  }, [gender, premiumOnly]);

  // --- Interactive curator (brand + price) ---
  // --- Brand helpers (parse brands from products.ts / API) ---
  const normalizeBrands = (p: any): string[] => {
    const rawNames = new Set<string>();

    const pushName = (raw: unknown) => {
      if (typeof raw !== "string") return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      // схлопываем лишние пробелы, но не трогаем тире и регистр
      const normalized = trimmed.replace(/\s+/g, " ");
      rawNames.add(normalized);
    };

    const pushFrom = (val: unknown) => {
      if (!val) return;
      if (typeof val === "string") {
        pushName(val);
      } else if (Array.isArray(val)) {
        val.forEach(pushFrom);
      } else if (typeof val === "object") {
        const obj = val as any;
        if (typeof obj.name === "string") pushName(obj.name);
        if (typeof obj.title === "string") pushName(obj.title);
        if (typeof obj.label === "string") pushName(obj.label);
      }
    };

    // 1) Явные ожидаемые поля с "читаемыми" именами брендов
    pushFrom((p as any).Brand);
    pushFrom((p as any).brand);
    pushFrom((p as any).brandName);
    pushFrom((p as any).brands);
    pushFrom((p as any).brandObj);

    // 2) Дополнительно пробегаемся по всем ключам с подстрокой "brand",
    // но игнорируем слаги, логотипы, картинки, id и прочие тех. поля
    try {
      Object.entries(p || {}).forEach(([key, value]) => {
        if (!/brand/i.test(key)) return;
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("slug") ||
          lowerKey.includes("logo") ||
          lowerKey.includes("image") ||
          lowerKey.includes("icon") ||
          lowerKey.endsWith("id") ||
          lowerKey.endsWith("_id") ||
          lowerKey.endsWith("code")
        ) {
          return;
        }
        pushFrom(value);
      });
    } catch {
      // на всякий случай не падаем, если объект странный
    }

    // 3) Убираем дубликаты вроде "Nike" и "nike" — оставляем первое встретившееся
    const result: string[] = [];
    const seen = new Set<string>();

    Array.from(rawNames).forEach((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(name);
    });

    return result;
  };

  const [curatorOpen, setCuratorOpen] = useState(false);
  const [pickedBrands, setPickedBrands] = useState<string[]>([]);
  const [brandQuery, setBrandQuery] = useState("");

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
      .map((p: any) =>
        normalizeCategory(
          (p as any).categorySlug ??
          (p as any).categoryDbSlug ??
          (p as any).category ??
          (p as any).categoryId ??
          (p as any).main ??
          (p as any).type
        )
      )
      .filter((v): v is string => !!v);
    const uniq = Array.from(new Set(canon));
    // упорядочим как в CANONICAL_ORDER
    return CANONICAL_ORDER.filter((k) => uniq.includes(k));
  }, [filteredPremium]);

  // Разложим товары по категориям (после всех фильтров бренда/цены)
  const productsByCategory = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of filteredPremium) {
      const key = normalizeCategory(
        (p as any).categorySlug ??
        (p as any).categoryDbSlug ??
        (p as any).category ??
        (p as any).categoryId ??
        (p as any).main ??
        (p as any).type
      );
      if (!key) continue;
      (map[key] ||= []).push(p);
    }
    return map;
  }, [filteredPremium]);

  const availableSubsByCat = useMemo(() => {
    const extractSub = (p: any) =>
      (p as any).subcategory ??
      (p as any).subCategory ??
      (p as any).subCat ??
      (p as any).sub ??
      null;

    const map: Record<string, string[]> = {};
    for (const cat of premiumCategories) {
      const list = productsByCategory[cat] || [];
      const subs = Array.from(
        new Set(
          list
            .map((p: any) => extractSub(p))
            .filter((v): v is string => !!v)
        )
      );
      const orderedPreferred = getOrderedSubcategories(cat as any).filter((s) =>
        subs.includes(s)
      );
      const tail = subs.filter((s) => !orderedPreferred.includes(s));
      map[cat] = [...orderedPreferred, ...tail];
    }
    return map;
  }, [premiumCategories, productsByCategory]);

  const subsForCategory = (cat: string) => {
    const arr = availableSubsByCat[cat];
    if (arr && arr.length) return arr;
    return getOrderedSubcategories(cat as any);
  };

  const GridCard = ({ item }: { item: any }) => {
    const imgs = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    const primary = (item as any).imageUrl || imgs[0] || "/img/placeholder.png";
    const secondary = imgs.find((u) => u && u !== primary);
    const gallery = getPreviewImages(item);

    return (
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

        <SwipeablePreview
          images={gallery.length ? gallery : [primary, secondary].filter(Boolean) as string[]}
          alt={item.name}
          className="w-full h-[190px] sm:h-[210px] md:h-[220px] bg-white flex items-center justify-center"
        />

        <div className="p-3">
          <p className="text-sm font-semibold line-clamp-2">{item.name}</p>
          <p className="text-xs text-gray-500 mt-1">от {item.price}₽</p>
        </div>
      </Link>
    );
  };
  const mainDimmed = mobileMenuOpen || mobileFiltersOpen;

  const headerOffsetPx = useMemo(() => {
    try {
      const cs = getComputedStyle(document.documentElement);
      const h = parseFloat(cs.getPropertyValue("--header-h")) || 72;
      const safe = parseFloat(cs.getPropertyValue("--safe-top")) || 0;
      return Math.round(h + safe + 10);
    } catch {
      return 84;
    }
  }, []);

  const scrollToAnchor = useCallback((key: string) => {
    const el = document.querySelector<HTMLElement>(`[data-anchor="${key}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = window.scrollY + rect.top - headerOffsetPx;
    window.scrollTo({ top, behavior: "smooth" });
  }, [headerOffsetPx]);

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



  
    
  type ConciergeProps = { open: boolean; setOpen: (v: boolean) => void };
  const Concierge: React.FC<ConciergeProps> = ({ open, setOpen }) => {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Лочим скролл страницы, пока открыт модал
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const preventScroll = (e: Event) => {
      e.preventDefault();
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("keydown", onEsc);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("wheel", preventScroll as any);
      window.removeEventListener("touchmove", preventScroll as any);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, setOpen]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setOk(null);
    setErr(null);

    // ВАЖНО: запоминаем форму ДО всех await
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);

    // Собираем полезные поля
    const raw = Object.fromEntries(fd.entries());

    const rawCategory = String(raw.category || "").trim();
    const normalizedCategory = rawCategory.toLowerCase();
    const categoryLabel = LABELS[normalizedCategory] || rawCategory;

    const payload = {
      name: String(raw.name || "").trim(),
      contact: String(raw.contact || "").trim(),
      category: categoryLabel,
      size: String(raw.size || "").trim(),
      notes: String(raw.notes || "").trim(),
      source: "premium-modal",
    };

    // Файлы -> base64
    const files = (fd.getAll("photos") as File[]).filter(
      (f) => f && f.size > 0
    );
    let attachments: { name: string; type: string; data: string }[] = [];

    if (files.length) {
      attachments = await Promise.all(
        files.map(
          (f) =>
            new Promise<{ name: string; type: string; data: string }>(
              (resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  const base64 = result.split(",")[1] || "";
                  resolve({ name: f.name, type: f.type, data: base64 });
                };
                reader.readAsDataURL(f);
              }
            )
        )
      );
    }

    try {
      const resp = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, attachments }),
      });

      if (!resp.ok) {
        throw new Error("Failed");
      }

      setOk(
        "Ваша заявка успешно отправлена. В ближайшее время с вами свяжется менеджер."
      );

      // теперь ресетим САМОЙ формы, а не e.currentTarget (который уже null)
      form.reset();
    } catch (error) {
      console.error("[concierge] submit failed", error);
      setErr("Не удалось отправить заявку. Попробуйте ещё раз чуть позже.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* фон, по клику закрывает */}
          <div
            className="absolute inset-0"
            onClick={() => setOpen(false)}
          />

          <motion.div
            className="relative z-[10000] w-[90%] max-w-[320px] md:max-w-lg max-h-[70vh] md:max-h-[82vh] overflow-y-auto rounded-xl md:rounded-2xl bg-neutral-950 border border-white/12 p-3 md:p-6 text-white shadow-[0_14px_48px_rgba(0,0,0,0.6)]"
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
          >
            {/* крестик */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-white/60 hover:text-white text-sm"
              aria-label="Закрыть"
            >
              ✕
            </button>

            <h3 className="text-sm md:text-lg font-semibold mb-1">
              Консьерж-сервис Stage
            </h3>
            <p className="hidden md:block text-xs text-white/60 mb-3 leading-snug">
              Прикрепите фото товара или примеров стиля — мы найдём нужную модель,
              проверим подлинность и подберём лучший вариант по бюджету.
            </p>

            <form onSubmit={onSubmit} className="space-y-2 md:space-y-3 text-[13px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="text-xs text-white/70 block mb-1">
                    Имя
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="Как к вам обращаться"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/70 block mb-1">
                    Контакт
                  </label>
                  <input
                    name="contact"
                    required
                    placeholder="Телефон или @Telegram / WhatsApp"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="text-xs text-white/70 block mb-1">
                    Категория
                  </label>
                  <select
                    name="category"
                    defaultValue="footwear"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/40"
                  >
                    <option value="footwear">Обувь</option>
                    <option value="clothes">Одежда</option>
                    <option value="bags">Сумки</option>
                    <option value="accessories">Аксессуары</option>
                    <option value="fragrance">Парфюмерия</option>
                    <option value="headwear">Головные уборы</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/70 block mb-1">
                    Размеры
                  </label>
                  <input
                    name="size"
                    placeholder="Напр. 42 EU, рост 182"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/70 block mb-1">
                  Комментарий
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Что ищете: бренд, модель, цвет, бюджет, ссылки…"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40 resize-none"
                />
              </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-white/70 block mb-1">
                    Фото (опционально)
                  </label>
                  <input
                    type="file"
                  name="photos"
                  multiple
                  accept="image/*"
                  className="block w-full text-xs text-white/80 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20 cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-white/50">
                  Прикрепите фото желаемого товара или примеров стиля — так мы быстрее найдём то, что нужно.
                </p>
              </div>

              {/* сообщения об успехе / ошибке */}
              {ok && (
                <div className="mt-1 text-sm text-emerald-400">
                  {ok}
                </div>
              )}
              {err && (
                <div className="mt-1 text-sm text-red-400">
                  {err}
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-1">
                <p className="text-[10px] md:text-[11px] text-white/40 leading-snug">
                  Отправляя заявку, вы соглашаетесь с обработкой персональных данных.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full md:w-auto rounded-full bg-white text-black text-sm font-semibold px-5 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Отправка…" : "Отправить заявку"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

  const [conciergeOpen, setConciergeOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setConciergeOpen(true);
    window.addEventListener("open-concierge", onOpen as any);
    return () => window.removeEventListener("open-concierge", onOpen as any);
  }, []);
  // Quick View
  const [quickItem, setQuickItem] = useState<any | null>(null);

  return (
    <>
      <IntroSlides
        open={showAnimation}
        onClose={handleIntroClose}
        slides={introSlides}
      />

      {/* Мобильная верхняя панель */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-black/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2"
              aria-label="Открыть меню"
            >
              <Menu size={22} />
            </button>
            <Link href="/" className="font-bold text-lg">
              Stage <span className="text-black/60">Premium</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="p-2"
              aria-label="Фильтры"
            >
              <Filter size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Мобильное боковое меню */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-white/75 backdrop-blur-lg"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 bottom-0 w-[86%] max-w-[420px] bg-white shadow-2xl overflow-y-auto"
              initial={{ x: -100 }}
              animate={{ x: 0 }}
              exit={{ x: -100 }}
              transition={{ type: "spring", damping: 25 }}
            >
              <div className="p-4 border-b border-black/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Меню</h2>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2">
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-1">
                  <Link
                    href="/"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>🏠</span>
                    <span>Главная</span>
                  </Link>
                  <Link
                    href="/premium"
                    className="flex items-center gap-3 p-3 rounded-lg bg-black/5 font-semibold"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Crown size={18} />
                    <span>Premium</span>
                  </Link>
                  <Link
                    href="/#catalog"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>🛍️</span>
                    <span>Каталог</span>
                  </Link>
                  <button
                    onClick={() => { setConciergeOpen(true); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 w-full text-left"
                  >
                    <span>💬</span>
                    <span>Консьерж-сервис</span>
                  </button>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold mb-3">Категории</h3>
                <div className="space-y-2">
                  {premiumCategories.map((cat) => {
                    const orderedSubs = subsForCategory(cat as any);
                    const isOpen = mobileMenuSubOpen === cat;
                    const activeSub = subByMain[cat] ?? null;
                    const label = LABELS[cat] || cat;
                    return (
                      <div key={cat} className="rounded-xl bg-white/90 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between px-3 py-3">
                          <Link
                            href={`#${cat}`}
                            onClick={(e) => {
                              e.preventDefault();
                              setMobileMenuOpen(false);
                              setMobileCategoryOpen(cat);
                              setTimeout(() => scrollToAnchor(cat), 220);
                            }}
                            className="font-medium text-left flex-1 pr-2"
                          >
                            {label}
                          </Link>
                          <button
                            className="p-2 rounded-full hover:bg-black/5 transition"
                            onClick={() => setMobileMenuSubOpen(isOpen ? null : cat)}
                            aria-label="Раскрыть подкатегории"
                          >
                            <ChevronDown
                              size={16}
                              className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="px-3 pb-3 space-y-1"
                            >
                              <button
                                onClick={() => {
                                  setSubByMain((prev) => ({ ...prev, [cat]: null }));
                                  setMobileMenuOpen(false);
                                  setMobileCategoryOpen(cat);
                                  setTimeout(() => scrollToAnchor(cat), 220);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                                  activeSub === null
                                    ? "bg-black text-white"
                                    : "bg-black/5 text-black hover:bg-black/10"
                                }`}
                              >
                                Все
                              </button>
                              {orderedSubs.map((sub) => (
                                <button
                                  key={`${cat}-${sub}`}
                                  onClick={() => {
                                    setSubByMain((prev) => ({ ...prev, [cat]: sub }));
                                    setMobileMenuOpen(false);
                                    setMobileCategoryOpen(cat);
                                    setTimeout(() => scrollToAnchor(cat), 220);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                                    activeSub === sub
                                      ? "bg-black text-white"
                                      : "bg-black/5 text-black hover:bg-black/10"
                                  }`}
                                >
                                  {LABELS[sub] || sub}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Мобильные фильтры (bottom sheet) */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileFiltersOpen(false)}
            />
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", damping: 25 }}
            >
              <div className="sticky top-0 bg-white border-b border-black/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold">Фильтры</h2>
                  <button onClick={() => setMobileFiltersOpen(false)} className="p-2">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-black/40" />
                  <input
                    type="text"
                    placeholder="Поиск бренда..."
                    value={brandQuery}
                    onChange={(e) => setBrandQuery(e.target.value)}
                    className="flex-1 text-sm py-1 px-2 border-b border-black/10 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-4 space-y-6">
                {/* Пол */}
                <div>
                  <h3 className="font-semibold mb-3">Пол</h3>
                  <div className="flex flex-wrap gap-2">
                    {['men', 'women', 'unisex'].map((g) => (
                      <button
                        key={g}
                        onClick={() => setGender(g as any)}
                        className={`px-4 py-2 rounded-full text-sm border ${
                          gender === g ? 'bg-black text-white border-black' : 'border-black/10 hover:bg-black/5'
                        }`}
                      >
                        {g === 'men' ? 'Мужское' : g === 'women' ? 'Женское' : 'Унисекс'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Бренды */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Бренды</h3>
                    {pickedBrands.length > 0 && (
                      <button
                        onClick={() => setPickedBrands([])}
                        className="text-sm text-black/60 hover:text-black"
                      >
                        Сбросить
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {filteredBrands.map((brand) => {
                      const active = pickedBrands.includes(brand);
                      return (
                        <button
                          key={brand}
                          onClick={() =>
                            setPickedBrands((prev) =>
                              prev.includes(brand)
                                ? prev.filter((b) => b !== brand)
                                : [...prev, brand]
                            )
                          }
                          className={`flex items-center gap-3 w-full p-2 rounded-lg ${
                            active ? 'bg-black/5' : 'hover:bg-black/5'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                            active ? 'bg-black border-black' : 'border-black/20'
                          }`}>
                            {active && <div className="w-2 h-2 bg-white rounded-sm" />}
                          </div>
                          <span className="text-sm">{brand}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Цена */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Цена до: {maxPrice}₽</h3>
                    <button
                      onClick={() => setMaxPrice(priceBounds.max)}
                      className="text-sm text-black/60 hover:text-black"
                    >
                      Сбросить
                    </button>
                  </div>
                  <input
                    type="range"
                    min={Math.floor(priceBounds.min)}
                    max={Math.ceil(priceBounds.max)}
                    step={1}
                    value={Math.min(maxPrice, Math.ceil(priceBounds.max))}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full h-2 bg-black/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black"
                  />
                  <div className="flex justify-between text-xs text-black/60 mt-2">
                    <span>{priceBounds.min}₽</span>
                    <span>{priceBounds.max}₽</span>
                  </div>
                </div>

                {/* Результаты */}
                <div className="pt-4 border-t border-black/10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold">
                      {filteredPremium.length} товаров
                    </span>
                    <button
                      onClick={() => {
                        setPickedBrands([]);
                        setMaxPrice(priceBounds.max);
                      }}
                      className="text-sm text-black/60 hover:text-black"
                    >
                      Сбросить всё
                    </button>
                  </div>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-full py-3 bg-black text-white font-semibold rounded-lg"
                  >
                    Показать результаты
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div
        className={`relative transition-all duration-150 ${
          mainDimmed ? 'pointer-events-none select-none opacity-40 blur-sm' : 'opacity-100'
        }`}
        aria-hidden={mainDimmed}
      >
      {/* Premium-aware sticky header */}
      { !showAnimation ? (
        <>
        <div className="hidden md:block relative w-full z-10">
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
        {/* Мобильный заголовок с мини-облаком брендов */}
        <div className="md:hidden w-full px-4 pt-4 pb-6">
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-black/5 premium-hero-anim">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -left-8 top-4 h-32 w-32 rounded-full bg-black/5 blur-3xl animate-pulse" />
              <div className="absolute right-[-6px] bottom-[-10px] h-28 w-28 rounded-full bg-[#f8e6ff] blur-3xl animate-pulse" />
              <motion.div
                className="absolute inset-0"
                initial={{ background: "radial-gradient(120% 80% at 0% 0%, rgba(255,215,0,0.12), transparent 50%)" }}
                animate={{ background: [
                  "radial-gradient(120% 80% at 0% 0%, rgba(255,215,0,0.08), transparent 50%)",
                  "radial-gradient(120% 80% at 100% 20%, rgba(99,102,241,0.12), transparent 50%)",
                  "radial-gradient(120% 80% at 60% 100%, rgba(16,185,129,0.12), transparent 50%)",
                  "radial-gradient(120% 80% at 0% 0%, rgba(255,215,0,0.08), transparent 50%)",
                ]}}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="relative p-5 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-1 text-xs font-semibold shadow-sm">
                <Crown size={14} />
                <span>Stage Premium</span>
              </div>
              <h1 className="text-[22px] leading-tight font-extrabold text-black">
                Добро пожаловать в Stage Premium
              </h1>
              <p className="text-sm text-black/70 leading-snug">
                Эксклюзивы, редкие лоты и лимитированные дропы. Всё в одном месте.
              </p>
            </div>
            <div className="absolute inset-0 pointer-events-none">
              <div className="floating-dot fd1" />
              <div className="floating-dot fd2" />
              <div className="floating-dot fd3" />
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
          className="group fixed bottom-5 right-5 z-[60] inline-flex items-center justify-center rounded-full bg-black text-white px-5 py-2.5 font-semibold shadow-lg hover:shadow-xl"
          aria-label="Открыть консьерж"
          whileHover={{ y: -3, scale: 1.03, boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 360, damping: 20 }}
        >
          <div className="flex items-center gap-2 text-sm">
            <span>💬</span>
            <span>Консьерж</span>
          </div>
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
                    <SwipeablePreview
                      images={getPreviewImages(item)}
                      alt={item.name}
                      className="w-full h-[180px] bg-white"
                    />
                    <div className="p-3">
                      <p className="text-sm font-semibold line-clamp-2">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-1">от {item.price}₽</p>
                    </div>
                  </Link>
              </div>
            );

            return (
              <>
                {/* mobile: inertial horizontal scroll, no marquee jank */}
                <div className="md:hidden -mx-4 px-4 mb-6">
                  <div className="flex overflow-x-auto gap-3 pb-3 snap-x snap-mandatory scrollbar-hide">
                    {top.map((it) => (
                      <div key={`m-${it.id}`} className="snap-start">
                        <Card item={it} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* desktop marquee rows */}
                <div className="hidden md:block">
                  <div className="marquee marquee-right mb-6">
                    <div className="track">
                      {[...rowA, ...rowA].map((it, i) => (
                        <div key={`a-${it.id}-${i}`} className="mr-5 last:mr-0">
                          <Card item={it} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="marquee marquee-left">
                    <div className="track">
                      {[...rowB, ...rowB].map((it, i) => (
                        <div key={`b-${it.id}-${i}`} className="mr-5 last:mr-0">
                          <Card item={it} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {premiumCategories.map((key: any) => {
          const listAll = productsByCategory[key] || [];
          if (!listAll.length) return null;

          const orderedSubs = subsForCategory(key as any).filter((sub) =>
            listAll.some((p: any) => {
              const val =
                (p as any).subcategory ??
                (p as any).subCategory ??
                (p as any).subCat ??
                (p as any).sub;
              return val === sub;
            })
          );
          const activeSub = subByMain[key] ?? null;
          const list = activeSub
            ? listAll.filter((p: any) => {
                const val =
                  (p as any).subcategory ??
                  (p as any).subCategory ??
                  (p as any).subCat ??
                  (p as any).sub;
                return val === activeSub;
              })
            : listAll;
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
      </div>
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
        /* Floating dots for mobile hero */
        .premium-hero-anim .floating-dot {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0,0,0,0.22), rgba(0,0,0,0));
          opacity: 0.5;
        }
        .premium-hero-anim .fd1 { left: 16%; top: 12%; animation: floatDot 7s ease-in-out infinite; }
        .premium-hero-anim .fd2 { right: 14%; top: 24%; animation: floatDot 8s ease-in-out infinite 0.9s; }
        .premium-hero-anim .fd3 { left: 22%; bottom: 16%; animation: floatDot 9s ease-in-out infinite 1.3s; }
        @keyframes floatDot {
          0%   { transform: translateY(0); opacity: .45; }
          50%  { transform: translateY(-6px); opacity: .8; }
          100% { transform: translateY(0); opacity: .45; }
        }
      `}</style>
    </>
  );
}
