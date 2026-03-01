/* eslint-disable */
"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion, Variants } from "framer-motion";
import { useTitle } from "@/context/TitleContext"; // Импортируем контекст
import { useMotionBudget } from "@/components/MotionBudgetProvider";
import Link from "next/link";
import { PremiumConcierge } from "@/components/PremiumConcierge";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ChevronDown, Search, Filter, X, Menu, Crown } from "lucide-react";

const wrapIndex = (min: number, max: number, v: number) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

const swipeConfidenceThreshold = 1200; // было 9000 — на мобилках часто не срабатывало
const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;

// Same image swipe reveal as on the main page
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

const CARD_SWIPE_VARIANTS_REDUCED = {
  enter: {
    x: 0,
    clipPath: "inset(0 0 0 0)",
    opacity: 0,
    scale: 1,
    zIndex: 2,
  },
  center: {
    x: 0,
    clipPath: "inset(0 0 0 0)",
    opacity: 1,
    scale: 1,
    zIndex: 2,
  },
  exit: {
    x: 0,
    opacity: 0,
    scale: 1,
    zIndex: 1,
  },
};

const getPreviewImages = (item: any): string[] => {
  if (!item) return [];
  const imgs = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
  if (imgs.length) return imgs;
  if (item?.imageUrl) return [item.imageUrl];
  if (item?.image) return [item.image];
  return [];
};

const getDisplayBadge = (item: any): string => {
  const raw = String(item?.badge || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (upper === "PREMIUM" || upper === "EXCLUSIVE") return "";
  return raw;
};

// Персистим последний кадр превью по ключу набора изображений,
// чтобы не сбрасывать все карточки при ререндере списка и при размонтаже
const previewIndexStore = new Map<string, number>();

const loadSavedIndex = (key: string): number => {
  if (!key) return 0;
  const mem = previewIndexStore.get(key);
  if (typeof mem === "number") return mem;
  try {
    const raw = sessionStorage.getItem(`premium_preview_${key}`);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const saveIndex = (key: string, value: number) => {
  previewIndexStore.set(key, value);
  try {
    sessionStorage.setItem(`premium_preview_${key}`, String(value));
  } catch {
    // ignore
  }
};

type SwipeablePreviewProps = {
  images: string[];
  alt: string;
  className?: string;
  cacheKey?: string;
};

const SwipeablePreview = React.memo(function SwipeablePreviewComponent({
  images,
  alt,
  className = "",
  cacheKey,
}: SwipeablePreviewProps) {
  const { motionLevel } = useMotionBudget();
  const reduceMotion = motionLevel === "reduced";
  const balancedMotion = motionLevel === "balanced";
  const [isTouch, setIsTouch] = React.useState(false);
  const [touchActionMode, setTouchActionMode] = React.useState<"pan-y" | "none">("pan-y");
  const [brokenSrcs, setBrokenSrcs] = React.useState<Set<string>>(() => new Set());

  const imagesKey = React.useMemo(
    () => cacheKey ?? `${alt || "item"}::${(images || []).join("|")}`,
    [cacheKey, alt, images]
  );

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

  const [activeIdx, setActiveIdx] = React.useState(() => loadSavedIndex(imagesKey));
  const activeIdxRef = React.useRef(activeIdx);
  const [swipeDir, setSwipeDir] = React.useState<"left" | "right">("left");
  const swipeBlockTsRef = React.useRef(0);

  const swipeStateRef = React.useRef<{
    startX: number;
    startY: number;
    active: boolean;
    lastStepTs: number;
    pointerId: number | null;
    intent: "h" | "v" | null;
  }>({ startX: 0, startY: 0, active: false, lastStepTs: 0, pointerId: null, intent: null });

  React.useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  React.useEffect(() => {
    setActiveIdx((prev) => {
      const max = Math.max(0, (images?.length || 1) - 1);
      const next = Math.min(Math.max(prev, 0), max);
      activeIdxRef.current = next;
      return next;
    });
  }, [images]);

  React.useEffect(() => {
    saveIndex(imagesKey, activeIdx);
  }, [imagesKey, activeIdx]);

  const prefetchAround = React.useCallback(
    (idx: number) => {
      try {
        if (typeof window === "undefined") return;
        if (!Array.isArray(images) || images.length <= 1) return;
        if (reduceMotion) return;
        const nextSrc = images[Math.min(idx + 1, images.length - 1)];
        const prevSrc = images[Math.max(idx - 1, 0)];
        const pool = balancedMotion ? [nextSrc] : [nextSrc, prevSrc];
        pool.forEach((src) => {
          if (!src) return;
          const img = new window.Image();
          img.src = src;
        });
      } catch {}
    },
    [balancedMotion, images, reduceMotion]
  );

  if (!images?.length) {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="text-gray-400">Нет изображения</div>
      </div>
    );
  }

  const activeSrc = images?.[activeIdx] || images?.[0] || "/img/placeholder.png";
  const displaySrc = brokenSrcs.has(activeSrc) ? "/img/placeholder.png" : activeSrc;

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-white ${className}`}
      style={{ touchAction: isTouch ? touchActionMode : undefined, WebkitUserSelect: "none", userSelect: "none" }}
      onMouseMove={(e) => {
        if (isTouch) return;
        if (!images?.length || images.length <= 1) return;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = rect.width > 0 ? x / rect.width : 0;
        let idx = Math.floor(ratio * images.length);
        if (idx < 0) idx = 0;
        if (idx >= images.length) idx = images.length - 1;
        if (idx === activeIdx) return;
        setSwipeDir(idx > activeIdx ? "left" : "right");
        setActiveIdx(idx);
      }}
      onMouseLeave={() => {
        if (isTouch) return;
        if (!images?.length || images.length <= 1) return;
        if (activeIdx === 0) return;
        setSwipeDir("right");
        setActiveIdx(0);
      }}
      onPointerDown={(e) => {
        if (!isTouch) return;
        if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
        if (!images?.length || images.length <= 1) return;
        setTouchActionMode("pan-y");
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
        if (!isTouch) return;
        const st = swipeStateRef.current;
        if (!st.active) return;
        if (st.pointerId !== null && e.pointerId !== st.pointerId) return;
        if (!images?.length || images.length <= 1) return;

        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;

        if (st.intent === null) {
          const SLOP = 10;
          if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
          st.intent = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
          if (st.intent === "h") setTouchActionMode("none");
        }

        if (st.intent === "v") return;

        e.preventDefault();
        e.stopPropagation();

        const THRESHOLD = 72;
        if (Math.abs(dx) < THRESHOLD) return;

        const now = Date.now();
        if (st.lastStepTs && now - st.lastStepTs < 160) return;

        const dir: "left" | "right" = dx < 0 ? "left" : "right";
        const delta = dir === "left" ? 1 : -1;

        const maxIdx = images.length - 1;
        let nextIdx = activeIdxRef.current + delta;
        if (nextIdx < 0) nextIdx = 0;
        if (nextIdx > maxIdx) nextIdx = maxIdx;

        if (nextIdx !== activeIdxRef.current) {
          activeIdxRef.current = nextIdx;
          setSwipeDir(dir);
          setActiveIdx(nextIdx);
          prefetchAround(nextIdx);
          swipeBlockTsRef.current = Date.now();
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
        setTouchActionMode("pan-y");
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
        setTouchActionMode("pan-y");
      }}
      onLostPointerCapture={() => {
        swipeStateRef.current.active = false;
        swipeStateRef.current.lastStepTs = 0;
        swipeStateRef.current.pointerId = null;
        swipeStateRef.current.intent = null;
        setTouchActionMode("pan-y");
      }}
      onClickCapture={(e) => {
        if (Date.now() - swipeBlockTsRef.current < 620) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <AnimatePresence initial={false} mode="sync" custom={swipeDir}>
        <motion.div
          key={`${activeSrc}-${displaySrc}`}
          custom={swipeDir}
          variants={reduceMotion ? CARD_SWIPE_VARIANTS_REDUCED : CARD_SWIPE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: reduceMotion ? 0.14 : balancedMotion ? 0.22 : 0.32,
            ease: [0.22, 1, 0.36, 1],
            opacity: { duration: reduceMotion ? 0.1 : 0.16, ease: "linear" },
            scale: { duration: reduceMotion || balancedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] },
          }}
          className="absolute inset-0 transform-gpu"
          style={{ willChange: reduceMotion ? "opacity" : "transform, clip-path" }}
        >
          <img
            src={displaySrc}
            alt={alt}
            className="absolute inset-0 w-full h-full object-contain"
            onError={() => {
              if (!activeSrc || activeSrc === "/img/placeholder.png") return;
              setBrokenSrcs((prev) => {
                if (prev.has(activeSrc)) return prev;
                const next = new Set(prev);
                next.add(activeSrc);
                return next;
              });
            }}
          />
        </motion.div>
      </AnimatePresence>

      {images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${reduceMotion ? "duration-150" : balancedMotion ? "duration-200" : "duration-300"} ease-out ${
                i === activeIdx ? "w-5 bg-black/50" : "w-1.5 bg-black/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  const keyPrev = prev.images?.join("|") || "";
  const keyNext = next.images?.join("|") || "";
  return keyPrev === keyNext && prev.alt === next.alt && prev.className === next.className;
});


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

// Минимальный локальный компонент чипсов подкатегорий (мемоизирован)
const SubcategoryChips: React.FC<{ subcategories: string[]; active: string | null; onChange: (sub: string | null) => void; }> = React.memo(({ subcategories, active, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {subcategories.map((sub) => (
      <button
        key={sub}
        type="button"
        onClick={() => onChange(sub)}
        className={`px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${active === sub ? 'bg-black text-white border-black' : 'bg-white text-black border-black/20 hover:bg-black hover:text-white hover:border-black'}`}
      >
        {LABELS[sub] || sub}
      </button>
    ))}
  </div>
), (prev, next) => {
  return prev.active === next.active && 
         prev.subcategories.length === next.subcategories.length &&
         prev.subcategories.every((s, i) => s === next.subcategories[i]);
});

const PremiumAura: React.FC = () => {
  const sparkles = [
    { left: "12%", top: "22%", size: 6, delay: 0 },
    { left: "28%", top: "62%", size: 5, delay: 1.2 },
    { left: "46%", top: "18%", size: 4, delay: 2.1 },
    { left: "62%", top: "52%", size: 5, delay: 0.6 },
    { left: "78%", top: "26%", size: 6, delay: 1.8 },
    { left: "84%", top: "68%", size: 4, delay: 2.6 },
  ];
  return (
    <div
      className="relative overflow-hidden rounded-2xl w-full h-[220px] sm:h-[280px] lg:h-[420px] shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
      style={{ clipPath: "inset(0 round 18px)", contain: "layout style paint" }}
    >
      <div
        className="absolute inset-0 rounded-2xl p-[1px]"
        style={{
          background:
            "conic-gradient(from 120deg at 50% 50%, rgba(212,175,55,0.6), rgba(0,0,0,0), rgba(212,175,55,0.2), rgba(0,0,0,0), rgba(212,175,55,0.5))",
        }}
      >
        <div
          className="relative h-full w-full rounded-[16px] overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(250,247,240,0.98) 40%, rgba(245,242,236,0.98) 100%)",
          }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute -left-24 -top-20 h-64 w-64 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle at 30% 30%, rgba(212,175,55,0.18), transparent 70%)" }}
              animate={{ x: [0, 36, 0], y: [0, 26, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[-10%] top-[6%] h-72 w-72 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle at 60% 40%, rgba(18,18,18,0.10), transparent 70%)" }}
              animate={{ x: [0, -28, 0], y: [0, 20, 0], scale: [1, 1.06, 1] }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute left-[34%] bottom-[-24%] h-72 w-72 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle at 40% 60%, rgba(16,185,129,0.10), transparent 70%)" }}
              animate={{ x: [0, 20, 0], y: [0, -24, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -left-1/2 top-[42%] h-24 w-[200%]"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                filter: "blur(10px)",
                opacity: 0.7,
              }}
              animate={{ x: ["-12%", "12%", "-12%"] }}
              transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
                opacity: 0.12,
              }}
            />
            {sparkles.map((s, idx) => (
              <motion.span
                key={`${s.left}-${s.top}-${idx}`}
                className="absolute rounded-full"
                style={{
                  left: s.left,
                  top: s.top,
                  width: s.size,
                  height: s.size,
                  background: "radial-gradient(circle, rgba(212,175,55,0.85), rgba(212,175,55,0))",
                }}
                animate={{ opacity: [0.2, 0.85, 0.2], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
              />
            ))}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.08), transparent 35%, transparent 65%, rgba(0,0,0,0.08))",
              }}
            />
          </div>
          <div className="relative h-full w-full p-6 flex flex-col items-start justify-end gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/90 text-white px-3 py-1 text-[10px] font-semibold tracking-[0.3em]">
              <span>STAGE</span>
              <span className="text-[9px] opacity-70">PREMIUM</span>
            </div>
            <p className="font-extrabold tracking-tight leading-tight text-3xl md:text-5xl text-black max-w-[760px]">
              Добро пожаловать в Stage{" "}
              <span className="relative inline-block">
                Premium
                <img
                  src="/img/звездочка.png"
                  alt="Premium"
                  className="absolute -top-1 right-[-6px] md:-top-2 md:-right-3 w-5 h-5 md:w-6 md:h-6 drop-shadow-[0_0_6px_rgba(0,0,0,0.15)]"
                />
              </span>{" "}
              — здесь находятся эксклюзивы и уникальные предложения
            </p>
          </div>
        </div>
      </div>
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

const MemoDiagonalBelts = React.memo(DiagonalBelts);

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

const MemoCollageMosaic = React.memo(CollageMosaic);

// Hook: mount children only when section enters viewport (reduces initial render cost)
function SectionMount({ children, rootMargin = '400px' }: { children: React.ReactNode; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    let obs: IntersectionObserver | null = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          if (obs) obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs && obs.disconnect();
  }, [mounted, rootMargin]);

  return <div ref={ref}>{mounted ? children : <div style={{ minHeight: 220 }} />}</div>;
}

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
    if (i < total - 1) {
      setI(i + 1);
    } else {
      setTimeout(() => onClose(), 0);
    }
  }, [i, total, onClose]);

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

// Анимированная обёртка для товаров с фадом и слайдом на скролле
const AnimatedGridItem = React.memo(({ children, index }: { children: React.ReactNode; index: number }) => {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          // Отсоединяем после первого срабатывания
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "50px" }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
});

// GridCard мемоизирован чтобы не пересоздаваться при каждом render
const GridCard = React.memo(({
  item,
  rememberPremiumScroll,
  buildProductHref,
  getPreviewImages,
  isRestoreTarget,
}: any) => {
  const imgs = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const primary = (item as any).imageUrl || imgs[0] || "/img/placeholder.png";
  const secondary = imgs.find((u: any) => u && u !== primary);
  const gallery = getPreviewImages(item);
  const displayBadge = getDisplayBadge(item);

  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <Link
        id={`premium-product-${item.id}`}
        href={buildProductHref(item.id)}
        onClick={() => rememberPremiumScroll(item.id)}
        className={`relative group block rounded-2xl overflow-hidden bg-white border shadow-sm transition-all duration-300 w-full h-full ${
          isRestoreTarget
            ? "border-[#2563eb]/40 shadow-[0_0_0_8px_rgba(37,99,235,0.18)] animate-pulse"
            : "border-black/10 hover:shadow-xl"
        }`}
      >
        {displayBadge && (
          <span
            className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
            style={{
              background:
                displayBadge === "NEW"
                  ? "linear-gradient(135deg,#60a5fa,#2563eb)"
                  : displayBadge === "HIT"
                  ? "linear-gradient(135deg,#34d399,#059669)"
                  : "linear-gradient(135deg,#000000,#111111)",
            }}
          >
            {displayBadge}
          </span>
        )}

        <SwipeablePreview
          cacheKey={`grid-${item.id}`}
          images={gallery.length ? gallery : [primary, secondary].filter(Boolean) as string[]}
          alt={item.name}
          className="w-full h-[190px] sm:h-[210px] md:h-[220px] bg-white flex items-center justify-center"
        />

        <div className="p-3">
          <p className="text-sm font-semibold line-clamp-2">{item.name}</p>
          <p className="text-xs text-gray-500 mt-1">от {item.price}₽</p>
        </div>
      </Link>
    </motion.div>
  );
}, (prev, next) => {
  // Кастомное сравнение props для memo
  // Функции не меняются (useCallback), поэтому сравниваем только item данные
  return prev.item.id === next.item.id && 
         prev.item.name === next.item.name &&
         prev.item.price === next.item.price &&
         prev.item.premium === next.item.premium &&
         prev.item.badge === next.item.badge &&
         prev.item.images?.length === next.item.images?.length &&
         prev.item.imageUrl === next.item.imageUrl &&
         prev.isRestoreTarget === next.isRestoreTarget;
});

export default function PremiumPage() {
  const { motionLevel, reduceMotion: adaptiveReduceMotion, isMotionPaused } = useMotionBudget();
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
          const res = await fetch(url, { signal: controller.signal });
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
          const res2 = await fetch('/api/products?premium=1&limit=500', { signal: controller.signal });
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
  const prefersReducedMedia = useReducedMotion();
  const prefersReduced = prefersReducedMedia || adaptiveReduceMotion || motionLevel !== "full";

  // A/B выключатель тяжёлых FX: если низкий FPS или пользователь просит меньше анимаций
  const [lowFps, setLowFps] = useState(false);
  const allowFX = motionLevel === "full" && !prefersReduced && !lowFps && !isMotionPaused;


  // (removed effect that tied intro to ?intro=1)

  // Замер FPS ~1 сек и обновление каждые 3 сек
  useEffect(() => {
    if (prefersReduced || isMotionPaused) {
      setLowFps(true);
      return;
    }
    let raf = 0, frames = 0; let start = performance.now();
    let cancelled = false;
    const sample = () => {
      frames++;
      const now = performance.now();
      if (now - start >= 1000) {
        const fps = frames * 1000 / (now - start);
        setLowFps(fps < 35);
        frames = 0; start = now;
      }
      if (!cancelled) raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
    const interval = setInterval(() => { /* просто продлеваем сэмплинг */ }, 3000);
    return () => { cancelled = true; cancelAnimationFrame(raf); clearInterval(interval); };
  }, [prefersReduced, isMotionPaused]);

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
    if (motionLevel !== "full") {
      setShowAnimation(false);
    }
  }, [motionLevel]);
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
  const normalizeProductGender = useCallback((value: unknown): Exclude<Gender, null> => {
    const raw = String(value ?? "").toLowerCase().trim();
    if (!raw) return "unisex";
    if (["men", "man", "male", "m", "м", "муж", "мужское", "мужской"].includes(raw)) return "men";
    if (["women", "woman", "female", "w", "ж", "жен", "женское", "женский"].includes(raw)) return "women";
    if (["unisex", "унисекс", "уни", "u"].includes(raw)) return "unisex";
    return "unisex";
  }, []);
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

  // Restore once after returning from product page — with smooth animation
  useEffect(() => {
    try {
      const should = sessionStorage.getItem('premium_restore');
      if (should === '1') {
        const headerOffsetForRestore = (() => {
          try {
            const cs = getComputedStyle(document.documentElement);
            const h = parseFloat(cs.getPropertyValue("--header-h")) || 72;
            const safe = parseFloat(cs.getPropertyValue("--safe-top")) || 0;
            return Math.round(h + safe + 10);
          } catch {
            return 84;
          }
        })();
        const y = parseFloat(sessionStorage.getItem('premium_scroll') || '0');
        const lastProductId = sessionStorage.getItem('premium_last_product_id');
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

        const doSmoothScroll = (target: number) => {
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

        const runRestore = (attempt = 0) => {
          if (lastProductId) {
            const el = document.getElementById(`premium-product-${lastProductId}`);
            if (el) {
              const rect = el.getBoundingClientRect();
              const targetY = Math.max(0, window.scrollY + rect.top - headerOffsetForRestore - 14);
              doSmoothScroll(targetY);
              setRestoredPremiumProductId(lastProductId);
              window.setTimeout(() => {
                setRestoredPremiumProductId((prev) => (prev === lastProductId ? null : prev));
              }, 2200);
              return;
            }
            if (attempt < 24) {
              window.setTimeout(() => runRestore(attempt + 1), 80);
              return;
            }
          }
          const fallbackY = Number.isFinite(y) ? y : 0;
          doSmoothScroll(fallbackY);
        };

        // If the intro overlay is shown, wait until it closes, then scroll
        if (showAnimation) {
          const id = setInterval(() => {
            if (!showAnimation) {
              clearInterval(id);
              // next frame to ensure layout settled
              requestAnimationFrame(() => runRestore(0));
            }
          }, 50);
          return () => clearInterval(id);
        }

        // Otherwise scroll immediately after paint
        requestAnimationFrame(() => runRestore(0));
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
    () => products.filter((p: any) => p?.premium === true),
    [products]
  );

  const genderStats = useMemo(() => {
    let men = 0;
    let women = 0;
    let unisex = 0;
    for (const p of premiumOnly) {
      const g = normalizeProductGender((p as any)?.gender);
      if (g === "men") men += 1;
      else if (g === "women") women += 1;
      else unisex += 1;
    }
    return { men, women, unisex };
  }, [premiumOnly, normalizeProductGender]);

  const genderViewCounts = useMemo(
    () => ({
      men: genderStats.men + genderStats.unisex,
      women: genderStats.women + genderStats.unisex,
      unisex: genderStats.unisex,
    }),
    [genderStats]
  );

  useEffect(() => {
    if (gender !== null) return;
    if (!premiumOnly.length) return;
    const options: Array<Exclude<Gender, null>> = [];
    if (genderStats.men > 0) options.push("men");
    if (genderStats.women > 0) options.push("women");
    if (genderStats.unisex > 0) options.push("unisex");
    if (options.length === 1) setGender(options[0]);
  }, [gender, premiumOnly.length, genderStats.men, genderStats.women, genderStats.unisex]);

  // Итоговый список для грида по выбранному полу
  const currentPremium = useMemo(() => {
    if (!premiumOnly.length) return [];
    if (gender === 'men') {
      return premiumOnly.filter((p: any) => {
        const g = normalizeProductGender((p as any)?.gender);
        return g === "men" || g === "unisex";
      });
    }
    if (gender === 'women') {
      return premiumOnly.filter((p: any) => {
        const g = normalizeProductGender((p as any)?.gender);
        return g === "women" || g === "unisex";
      });
    }
    if (gender === 'unisex') {
      return premiumOnly.filter((p: any) => normalizeProductGender((p as any)?.gender) === "unisex");
    }
    return premiumOnly;
  }, [gender, premiumOnly, normalizeProductGender]);

  // --- Interactive curator (brand + price) ---
  // --- Компонент для анимированного счётчика (оптимизированный) ---
  const AnimatedCounter = React.memo(function AnimatedCounterComponent({ value }: { value: number }) {
    const [displayValue, setDisplayValue] = useState(value);
    const rafRef = useRef<number | null>(null);
    
    useEffect(() => {
      if (displayValue === value) return;
      
      const startValue = displayValue;
      const difference = value - startValue;
      const duration = 300; // ms (немного быстрее)
      const startTime = performance.now();
      
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing: easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startValue + difference * eased);
        setDisplayValue(current);
        
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      
      rafRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }, [value, displayValue]);

    return <span className="tabular-nums">{displayValue}</span>;
  });

  // --- Brand helpers (parse brands from products.ts / API) - ОПТИМИЗИРОВАННЫЙ ---
  const normalizeBrands = React.useCallback((p: any): string[] => {
    if (!p) return [];
    
    const rawNames = new Set<string>();

    const pushName = (raw: unknown) => {
      if (typeof raw !== "string") return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      const normalized = trimmed.replace(/\s+/g, " ");
      rawNames.add(normalized);
    };

    const pushSlug = (raw: unknown) => {
      if (typeof raw !== "string") return;
      const slugged = raw
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (slugged) pushName(slugged);
    };

    const pushFrom = (val: unknown) => {
      if (!val) return;
      if (typeof val === "string") {
        pushName(val);
      } else if (typeof val === "object" && val !== null) {
        const obj = val as any;
        if (typeof obj.name === "string") pushName(obj.name);
        if (typeof obj.title === "string") pushName(obj.title);
        if (typeof obj.label === "string") pushName(obj.label);
      }
    };

    // 1) Явные ожидаемые поля
    pushFrom((p as any).Brand);
    pushSlug((p as any).Brand?.slug);
    pushFrom((p as any).brand);
    pushSlug((p as any).brandSlug ?? (p as any).brand_slug);
    pushFrom((p as any).brandName);
    pushFrom((p as any).brands);
    pushSlug((p as any).slug);

    return Array.from(rawNames);
  }, []);

  const [curatorOpen, setCuratorOpen] = useState(false);
  const [pickedBrands, setPickedBrands] = useState<string[]>([]);
  const [brandQuery, setBrandQuery] = useState("");
  const [topViewedItem, setTopViewedItem] = useState<string | null>(null);

  // Оставляем поиск бренда всегда открытым (на десктопе), чтобы не было ощущения что он "не работает"
  const [brandSearchOpen, setBrandSearchOpen] = useState(true);
  const brandSearchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (brandSearchOpen && brandSearchInputRef.current) {
      brandSearchInputRef.current.focus();
    }
  }, [brandSearchOpen]);

  const [showAllBrands, setShowAllBrands] = useState(false);

  const allBrandsInPremium = useMemo(() => {
    if (!currentPremium?.length) return [];
    const brands = new Map<string, string>(); // key: lowercase, value: original case
    for (const p of currentPremium) {
      const pBrands = normalizeBrands(p);
      for (const b of pBrands) {
        const lowerKey = b.toLowerCase();
        if (!brands.has(lowerKey)) {
          brands.set(lowerKey, b);
        }
      }
    }
    return Array.from(brands.values()).sort();
  }, [currentPremium, normalizeBrands]);

  const normalizedBrandQuery = useMemo(() => brandQuery.trim().toLowerCase(), [brandQuery]);

  const filteredBrands = useMemo(() => {
    if (!allBrandsInPremium?.length) return [];
    if (!normalizedBrandQuery) return allBrandsInPremium;
    return allBrandsInPremium.filter(b => b.toLowerCase().includes(normalizedBrandQuery));
  }, [allBrandsInPremium, normalizedBrandQuery]);

  const visibleBrands = useMemo(() => {
    if (!filteredBrands?.length) return [];
    if (normalizedBrandQuery) return filteredBrands;
    if (showAllBrands) return filteredBrands;
    return filteredBrands.slice(0, 6);
  }, [filteredBrands, showAllBrands, normalizedBrandQuery]);
  
  const hiddenCount = useMemo(() => Math.max(0, (filteredBrands?.length ?? 0) - 6), [filteredBrands]);

  const priceBounds = useMemo(() => {
    if (!currentPremium?.length) return { min: 0, max: 0 };
    let min = Infinity, max = -Infinity;
    for (const p of currentPremium) {
      const price = Number(p.price) || 0;
      if (price < min) min = price;
      if (price > max) max = price;
    }
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
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

  const filteredPremium = useMemo(() => {
    if (!currentPremium?.length) return [];
    
    // Оптимизация: кэшируем нормализованные бренды каждого товара
    const hasPickedBrands = pickedBrands.length > 0;
    const pickedSet = new Set(pickedBrands);
    const hasMaxPrice = maxPrice < priceBounds.max && maxPrice > 0;
    
    return currentPremium.filter((p: any) => {
      if (hasMaxPrice && (Number(p.price) || 0) > maxPrice) return false;
      
      if (hasPickedBrands) {
        const itemBrands = normalizeBrands(p);
        if (!itemBrands.some(b => pickedSet.has(b))) return false;
      }
      
      if (normalizedBrandQuery) {
        const itemBrands = normalizeBrands(p);
        if (!itemBrands.some(b => b.toLowerCase().includes(normalizedBrandQuery))) return false;
      }
      
      return true;
    });
  }, [currentPremium, pickedBrands, maxPrice, priceBounds.max, normalizedBrandQuery, normalizeBrands]);

  // Динамически соберём список категорий премиум-товаров (footwear, bags, accessories, ...)
  const premiumCategories = useMemo(() => {
    if (!filteredPremium?.length) return [];
    const cats = new Set<string>();
    for (const p of filteredPremium) {
      const cat = normalizeCategory(
        (p as any).categorySlug ??
        (p as any).categoryDbSlug ??
        (p as any).category ??
        (p as any).categoryId ??
        (p as any).main ??
        (p as any).type
      );
      if (cat) cats.add(cat);
    }
    return CANONICAL_ORDER.filter(k => cats.has(k));
  }, [filteredPremium]);

  // Разложим товары по категориям (после всех фильтров бренда/цены)
  const productsByCategory = useMemo(() => {
    if (!filteredPremium?.length) return {};
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
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(p);
      }
    }
    return map;
  }, [filteredPremium]);

  const availableSubsByCat = useMemo(() => {
    if (!premiumCategories?.length) return {};
    
    const extractSub = (p: any) =>
      (p as any).subcategory ??
      (p as any).subCategory ??
      (p as any).subCat ??
      (p as any).sub ??
      null;

    const map: Record<string, string[]> = {};
    for (const cat of premiumCategories) {
      const list = productsByCategory[cat] || [];
      if (!list.length) continue;
      
      const subs = new Set<string>();
      for (const p of list) {
        const sub = extractSub(p);
        if (sub) subs.add(sub);
      }
      
      const orderedPreferred = getOrderedSubcategories(cat as any).filter(s => subs.has(s));
      const tail = Array.from(subs).filter(s => !orderedPreferred.includes(s)).sort();
      map[cat] = [...orderedPreferred, ...tail];
    }
    return map;
  }, [premiumCategories, productsByCategory]);

  const subsForCategory = (cat: string) => {
    const arr = availableSubsByCat[cat];
    if (arr && arr.length) return arr;
    return getOrderedSubcategories(cat as any);
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

  // --- remember & restore scroll for Premium page when navigating to product and back ---
  const [restoredPremiumProductId, setRestoredPremiumProductId] = useState<string | null>(null);
  const rememberPremiumScroll = useCallback((productId?: string | number) => {
    try {
      sessionStorage.setItem('premium_scroll', String(window.scrollY || 0));
      sessionStorage.setItem('premium_restore', '1');
      if (productId !== undefined && productId !== null) {
        sessionStorage.setItem('premium_last_product_id', String(productId));
      }
      if (gender) sessionStorage.setItem('premium_gender', gender);
      sessionStorage.setItem('premium_filters_snapshot', JSON.stringify({ subByMain, maxPrice, pickedBrands }));
    } catch {}
  }, [gender, subByMain, maxPrice, pickedBrands]);

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

      const showMore = useCallback((k: string) => setVisibleByMain(prev => ({ ...prev, [k]: (prev[k] || 12) + 12 })), []);


  const showMenTab = gender === null || gender === 'men' || (isDesktop && hoverTabs);
  const showWomenTab = gender === null || gender === 'women' || (isDesktop && hoverTabs);
  const menDisabled = genderViewCounts.men === 0 && gender !== "men";
  const womenDisabled = genderViewCounts.women === 0 && gender !== "women";
  const unisexDisabled = genderViewCounts.unisex === 0 && gender !== "unisex";

  const buildProductHref = useCallback((id: string | number) => {
    const params = new URLSearchParams();
    params.set('origin', 'premium');
    const g = gender || searchParams.get('gender');
    if (g === 'men' || g === 'women') params.set('gender', g);
    return `/premium/product/${id}?${params.toString()}`;
  }, [gender, searchParams]);



  
    
  const [conciergeOpen, setConciergeOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setConciergeOpen(true);
    window.addEventListener("open-concierge", onOpen as any);
    return () => window.removeEventListener("open-concierge", onOpen as any);
  }, []);

  // Broadcast curator open state so shared header can react (blur/go to background)
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('ui:curator', { detail: { open: Boolean(curatorOpen) } }));
    } catch {}
  }, [curatorOpen]);
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
      <div className={`md:hidden fixed top-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md border-b border-black/10 pointer-events-auto transition-all duration-150 ${(mainDimmed || curatorOpen) ? 'opacity-40 blur-sm' : ''}`}>
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
              onClick={() => setCuratorOpen((v) => !v)}
              className="p-2"
              aria-label="Премиум подборщик"
            >
              <span className="text-xl">🧭</span>
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
                        <div className="flex items-start justify-between px-3 py-3">
                          <div className="flex-1 pr-2">
                            <Link
                              href={`#${cat}`}
                              onClick={(e) => {
                                e.preventDefault();
                                setMobileMenuOpen(false);
                                setMobileCategoryOpen(cat);
                                setTimeout(() => scrollToAnchor(cat), 220);
                              }}
                              className="font-medium text-left block"
                            >
                              {label}
                            </Link>

                            {/* Quick visible subcategories on mobile next to category */}
                            {orderedSubs && orderedSubs.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2 md:hidden">
                                {orderedSubs.slice(0, 5).map((sub) => (
                                  <button
                                    key={`${cat}-quick-${sub}`}
                                    onClick={() => {
                                      setSubByMain((prev) => ({ ...prev, [cat]: sub }));
                                      setMobileMenuOpen(false);
                                      setMobileCategoryOpen(cat);
                                      setTimeout(() => scrollToAnchor(cat), 220);
                                    }}
                                    className={`px-3 py-1 rounded-full text-sm transition border ${
                                      (subByMain[cat] ?? null) === sub ? 'bg-black text-white border-black' : 'bg-white text-black/80 border-black/10 hover:bg-black/5'
                                    }`}
                                  >
                                    {LABELS[sub] || sub}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
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
        className={`relative z-0 transition-all duration-150 ${
          mainDimmed ? 'pointer-events-none select-none opacity-40 blur-sm' : 'opacity-100'
        }`}
        aria-hidden={mainDimmed}
      >
      {/* Premium-aware sticky header */}
      { !showAnimation ? (
        <>
        <div className={`hidden md:block relative w-full z-20 overflow-hidden pointer-events-auto transition-all duration-150 ${(mainDimmed || curatorOpen) ? 'opacity-40 blur-sm' : ''}`}>
          <div className="w-full px-6 md:px-10 py-6 overflow-hidden">
            <div
              ref={tiltRef}
              onMouseMove={onTiltMove}
              onMouseLeave={onTiltLeave}
              style={{
                transformStyle: 'preserve-3d',
                transform: allowFX ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.s})` : undefined,
                transition: 'transform .25s ease',
              }}
              className="w-full"
            >
              <PremiumAura />
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


        </>
      ) : null }



      {/* Контент Premium страницы */}
      <section className="px-6 md:px-10 pb-16">
        {/* Кнопка перехода на обычный магазин */}
        <div className="max-w-[1200px] mx-auto mb-8 flex justify-center md:justify-start">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-black/20 bg-white hover:bg-black hover:text-white text-black font-semibold text-sm transition-all duration-300 shadow-sm hover:shadow-lg"
          >
            <svg
              className="w-4 h-4 transition-transform group-hover:-translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>В Stage Store!</span>
          </Link>
        </div>

        {/* Выбор категории: Мужчины / Женщины */}
        <div className="max-w-[1200px] mx-auto mt-6">
          <h2 className="text-2xl md:text-4xl font-extrabold text-black mb-6 md:mb-8 text-center">
            Выберите пол для отображения коллекций
          </h2>

          {/* Мобильный компактный блок с анимацией */}
          <div className="md:hidden flex flex-col items-center gap-3">
            <div className="w-full flex items-center justify-center">
              <div className="flex gap-2 rounded-full border border-black/10 bg-white/70 backdrop-blur px-2 py-2 shadow-sm">
                {(["men", "women", "unisex"] as const).map((g) => {
                  const active = gender === g;
                  const label = g === "men" ? "Мужское" : g === "women" ? "Женское" : "Унисекс";
                  const count = g === "men" ? genderViewCounts.men : g === "women" ? genderViewCounts.women : genderViewCounts.unisex;
                  const disabled = count === 0;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        if (!disabled) setGender(g);
                      }}
                      disabled={disabled}
                      className={`relative px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 overflow-hidden ${
                        active 
                          ? "bg-black text-white shadow-lg" 
                          : "text-black/60 hover:text-black"
                      }`}
                      style={{
                        perspective: "1000px",
                      }}
                    >
                      {/* Фоновый слой для активной кнопки */}
                      {active && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black"
                          layoutId="active-bg"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          style={{ borderRadius: "9999px" }}
                        />
                      )}
                      
                      {/* Текст с анимацией */}
                      <motion.span
                        className="relative block"
                        initial={false}
                        animate={{
                          scale: active ? 1 : 0.95,
                          opacity: active ? 1 : disabled ? 0.35 : 0.7,
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        {label}
                        <span className="ml-1 text-[10px] opacity-70">({count})</span>
                      </motion.span>

                      {/* Ripple эффект при клике */}
                      {active && (
                        <motion.div
                          className="absolute inset-0 rounded-full bg-white/20"
                          initial={{ scale: 0, opacity: 1 }}
                          animate={{ scale: 2, opacity: 0 }}
                          transition={{ duration: 0.6 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Индикатор выбора */}
            {gender && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="text-xs text-black/50 font-medium"
              >
                Выбрано: {gender === "men" ? "Мужское" : gender === "women" ? "Женское" : "Унисекс"}
                <span className="ml-1">•</span>
                <span className="ml-1">
                  {gender === "men"
                    ? genderViewCounts.men
                    : gender === "women"
                      ? genderViewCounts.women
                      : genderViewCounts.unisex} товаров
                </span>
              </motion.div>
            )}
          </div>

          {/* Десктопная версия переключателя */}
          <div className="hidden md:flex relative w-full items-center justify-center"
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
                    tabIndex={menDisabled ? -1 : 0}
                    onMouseEnter={() => setShowSwapHint(true)}
                    onMouseLeave={() => setShowSwapHint(false)}
                    onClick={() => { if (!menDisabled) setGender('men'); }}
                    onKeyDown={(e) => {
                      if (menDisabled) return;
                      if (e.key === 'Enter' || e.key === ' ') { setGender('men'); }
                    }}
                    aria-disabled={menDisabled}
                    className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-colors ${menDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${gender==='men' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={gender === 'men' ? { opacity: 0, x: 140, scale: 0.9, filter: 'blur(2px)' } : { opacity: 0, x: -40, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    aria-label="Мужская коллекция"
                  >
                    Мужская коллекция <span className="ml-2 text-xs opacity-70">({genderViewCounts.men})</span>
                  </motion.div>
                )}
                {showWomenTab && (
                  <motion.div
                    layout
                    key="women-tab"
                    role="button"
                    tabIndex={womenDisabled ? -1 : 0}
                    onMouseEnter={() => setShowSwapHint(true)}
                    onMouseLeave={() => setShowSwapHint(false)}
                    onClick={() => { if (!womenDisabled) setGender('women'); }}
                    onKeyDown={(e) => {
                      if (womenDisabled) return;
                      if (e.key === 'Enter' || e.key === ' ') { setGender('women'); }
                    }}
                    aria-disabled={womenDisabled}
                    className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-colors ${womenDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${gender==='women' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={gender === 'women' ? { opacity: 0, x: 140, scale: 0.9, filter: 'blur(2px)' } : { opacity: 0, x: 40, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    aria-label="Женская коллекция"
                  >
                    Женская коллекция <span className="ml-2 text-xs opacity-70">({genderViewCounts.women})</span>
                  </motion.div>
                )}
                {/* Унисекс кнопка */}
                <motion.div
                  layout
                  key="unisex-tab"
                  role="button"
                  tabIndex={unisexDisabled ? -1 : 0}
                  onClick={() => { if (!unisexDisabled) setGender('unisex'); }}
                  onKeyDown={(e) => {
                    if (unisexDisabled) return;
                    if (e.key === 'Enter' || e.key === ' ') { setGender('unisex'); }
                  }}
                  aria-disabled={unisexDisabled}
                  className={`px-5 py-2.5 rounded-full text-sm md:text-base font-semibold transition-colors ${unisexDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${gender==='unisex' ? 'bg-black text-white' : 'text-black hover:bg-black/5'}`}
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={gender === 'unisex' ? { opacity: 0, x: 140, scale: 0.9, filter: 'blur(2px)' } : { opacity: 0, x: 40, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  aria-label="Унисекс"
                >
                  Унисекс <span className="ml-2 text-xs opacity-70">({genderViewCounts.unisex})</span>
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
              className="mx-auto flex items-center gap-2 px-5 py-3 rounded-full bg-black text-white font-semibold shadow hover:shadow-md active:scale-[.98] transition md:hidden"
            >
              <span>🧭 Премиум-подборщик</span>
              <span className="text-xs opacity-80">({filteredPremium.length || 0} товаров)</span>
            </button>

          {/* Мобильный Bottom Sheet для подборщика */}
          <AnimatePresence>
            {curatorOpen && (
              <motion.div
                className="md:hidden fixed inset-0 z-[90]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  onClick={() => setCuratorOpen(false)}
                />
                <motion.div
                  className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  exit={{ y: 100 }}
                  transition={{ type: "spring", damping: 25 }}
                >
                  {/* Sticky header с z-index чтобы бренды не лезли */}
                  <div className="sticky top-0 z-40 bg-gradient-to-b from-white to-white/95 border-b border-black/10 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🧭</span>
                        <h2 className="text-xl font-bold">Премиум-подборщик</h2>
                      </div>
                      <button 
                        onClick={() => setCuratorOpen(false)} 
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition flex-shrink-0"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <p className="text-xs text-black/60">Фильтруй по брендам и цене, чтобы найти идеальный товар</p>
                  </div>

                  {/* Content */}
<div className="p-4 space-y-5">
  {/* Бренды секция */}
  <div>
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <span>🏷️</span>
        <span>Бренды</span>
      </h3>
      {pickedBrands.length > 0 && (
        <button
          type="button"
          onClick={() => setPickedBrands([])}
          className="text-xs bg-black/5 hover:bg-black/10 px-2.5 py-1 rounded-full transition"
        >
          Снять ({pickedBrands.length})
        </button>
      )}
    </div>

            {/* Поиск бренда */}
            <div className="relative mb-3">
              <div className="relative w-full">
                <input
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  placeholder="Найти бренд..."
                  className="w-full h-10 rounded-xl border border-black/10 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  autoComplete="off"
                  inputMode="search"
                />
                <svg
                  width={16}
                  height={16}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none"
                >
                  <circle cx={11} cy={11} r={7} />
                  <line x1={16.5} y1={16.5} x2={21} y2={21} />
                </svg>
              </div>
            </div>

            {/* Brand cloud - исправленный список */}
            <div 
              className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain pr-3"
              style={{ 
                WebkitOverflowScrolling: "touch", 
                touchAction: "pan-y",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(0,0,0,0.3) transparent"
              }}
            >
              {filteredBrands.length === 0 ? (
                <p className="text-sm text-black/40 text-center py-4">Бренд не найден</p>
              ) : (
                (showAllBrands ? filteredBrands : filteredBrands.slice(0, 6)).map((b) => {
                  const active = pickedBrands.includes(b);
                  return (
                    <motion.button
                      key={b}
                      type="button"
                      onClick={() =>
                        setPickedBrands((prev) =>
                          prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
                        )
                      }
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition ${
                        active 
                          ? "bg-black text-white border-black shadow-md" 
                          : "bg-white border-black/10 text-black hover:bg-black/5"
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                        active ? "border-white" : "border-black/20"
                      }`}>
                        {active && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-sm font-medium text-left flex-1 truncate">{b}</span>
                      {active && <span className="flex-shrink-0">✓</span>}
                    </motion.button>
                  );
                })
              )}
            </div>

            {/* Кнопка показать все/скрыть - ТОЛЬКО ОДНА */}
            {filteredBrands.length > 6 && (
              <button
                type="button"
                className="w-full mt-3 px-3 py-2.5 rounded-full text-sm border border-black/10 bg-white text-black hover:bg-black/5 font-semibold transition"
                onClick={() => setShowAllBrands((v) => !v)}
              >
                {showAllBrands ? "← Скрыть" : `Показать все (+${filteredBrands.length - 6})`}
              </button>
            )}
          </div>

          {/* Цена секция */}
          <div className="border-t border-black/10 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>💰</span>
                <span>Максимальная цена</span>
              </h3>
              {maxPrice < priceBounds.max && (
                <button
                  type="button"
                  onClick={() => setMaxPrice(priceBounds.max)}
                  className="text-xs bg-black/5 hover:bg-black/10 px-2.5 py-1 rounded-full transition"
                >
                  Сбросить
                </button>
              )}
            </div>

            <div className="space-y-3">
              {/* Price value display */}
              <motion.div
                className="text-center"
                key={maxPrice}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-2xl font-bold text-black">{maxPrice}₽</div>
                <div className="text-xs text-black/50 mt-1">
                  Из {priceBounds.min}₽ до {priceBounds.max}₽
                </div>
              </motion.div>

              {/* Slider */}
              <input
                type="range"
                min={Math.floor(priceBounds.min)}
                max={Math.ceil(priceBounds.max)}
                step={1}
                value={Math.min(maxPrice, Math.ceil(priceBounds.max))}
                onChange={(e) =>
                  setMaxPrice(Math.min(Number(e.target.value), Math.ceil(priceBounds.max)))
                }
                className="w-full h-2.5 bg-black/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
              />
            </div>
          </div>

          {/* Результаты */}
          <div className="border-t border-black/10 pt-4">
            <motion.div
              className="bg-gradient-to-r from-black/5 to-black/5 rounded-xl p-3.5 mb-4"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-xs text-black/60 mb-1">Подходит товаров</div>
              <div className="text-2xl font-bold">
                {/* Убедитесь, что AnimatedCounter компонент существует */}
                {filteredPremium.length}
              </div>
            </motion.div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setCuratorOpen(false);
                }}
                className="w-full px-4 py-3 rounded-full bg-black text-white font-semibold shadow-md active:scale-[.97] transition"
              >
                Применить фильтры
              </button>
              <button
                type="button"
                onClick={() => { 
                  setPickedBrands([]); 
                  setMaxPrice(priceBounds.max); 
                  setBrandQuery("");
                  setShowAllBrands(false);
                }}
                className="w-full px-4 py-2.5 rounded-full border border-black/10 bg-white text-black font-semibold hover:bg-black/5 transition"
              >
                Сбросить всё
              </button>
            </div>
          </div>
        </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Десктопная версия */}
            <button
            type="button"
            onClick={() => setCuratorOpen((v) => !v)}
            className="hidden md:flex mx-auto items-center gap-2 px-5 py-3 rounded-full bg-black text-white font-semibold shadow hover:shadow-md active:scale-[.98] transition mb-4"
          >
            <span>🧭 Премиум-подборщик</span>
            <span className="text-xs opacity-80">({filteredPremium.length || 0} товаров)</span>
          </button>

          <AnimatePresence initial={false}>
            {curatorOpen && (
              <motion.div
                key="curator"
                initial={{ opacity: 0, y: -8, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.995 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="hidden md:flex justify-center"
              >
                <div className="w-full max-w-[1120px] px-4">
                  <motion.div
                    initial={{ y: -8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="mt-5 rounded-2xl border border-black/10 bg-white/90 backdrop-blur p-4 md:p-6 shadow-sm w-full z-[90]"
                  >
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-2">Бренды</p>

                      {/* --- Search + Clear + Brand cloud with show more --- */}
                      <>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="relative flex-1 max-w-xs">
                            <input
                              ref={brandSearchInputRef}
                              type="text"
                              placeholder="Поиск бренда…"
                              value={brandQuery}
                              onChange={(e) => setBrandQuery(e.target.value)}
                              className="w-full rounded-full border border-black/10 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                            />
                            <svg
                              width={18}
                              height={18}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40"
                            >
                              <circle cx={11} cy={11} r={7} />
                              <line x1={16.5} y1={16.5} x2={21} y2={21} />
                            </svg>
                          </div>

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
                        <div className="max-h-40 overflow-y-auto overflow-x-hidden overscroll-contain pr-2 flex flex-wrap gap-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.2) transparent' }}>
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
                        <div className="text-sm text-gray-700">Подходит товаров: <span className="font-semibold"><AnimatedCounter value={filteredPremium.length} /></span></div>
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stage Store Top */}
        <div className="max-w-[1200px] mx-auto mt-16 px-4 md:px-0">
          {/* Заголовок с премиум-стилем */}
          <div className="mb-8 md:mb-12">
            <div className="inline-block mb-3">
              <span className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-black/60">
                ⭐ Хиты продаж
              </span>
            </div>
            
            <h3 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-black via-black/90 to-black bg-clip-text text-transparent mb-3">
              Stage Store Top
            </h3>

            <div className="w-20 h-1.5 bg-gradient-to-r from-black to-black/40 rounded-full" />
            
            <p className="text-sm md:text-base text-black/60 mt-4 max-w-2xl">
              Лучшие товары месяца, отобранные нашей экспертной командой. Только проверенные бренды и редкие находки.
            </p>
          </div>

          {/* helper to pick some top items */}
          {(() => {
            // возьмём до 10 премиум-товаров (категории в Top сейчас не фильтруем)
            const base = filteredPremium.length ? filteredPremium : (gender ? currentPremium : premiumOnly);
            const top = base.slice(0, 10);
            const rowA = top.slice(0, Math.ceil(top.length / 2));
            const rowB = top.slice(Math.ceil(top.length / 2));

            const Card = ({ item, index }: { item: any; index: number }) => {
              const isViewed = topViewedItem === item.id;
              const ref = useRef<HTMLDivElement | null>(null);
              const displayBadge = getDisplayBadge(item);

              useEffect(() => {
                const observer = new IntersectionObserver(
                  ([entry]) => {
                    if (entry.isIntersecting) {
                      setTopViewedItem(item.id);
                    }
                  },
                  {
                    threshold: 0.6, // срабатывает когда 60% элемента видно
                  }
                );

                if (ref.current) {
                  observer.observe(ref.current);
                }

                return () => {
                  if (ref.current) {
                    observer.unobserve(ref.current);
                  }
                };
              }, [item.id]);

              return (
                <motion.div
                  ref={ref}
                  className="relative group rounded-2xl"
                  whileHover={{ y: -8, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                {/* Блеск при наведении */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ["0%", "100%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    initial={{ x: "-100%" }}
                  />
                </div>

                <Link
                  id={`premium-product-${item.id}`}
                  href={buildProductHref(item.id)}
                  onClick={() => rememberPremiumScroll(item.id)}
                  className={`relative block rounded-2xl overflow-hidden bg-white border hover:border-black/30 shadow-sm hover:shadow-xl transition-all duration-300 min-w-[240px] max-w-[240px] ${
                    restoredPremiumProductId === String(item.id)
                      ? "border-[#2563eb]/45 shadow-[0_0_0_8px_rgba(37,99,235,0.18)] animate-pulse"
                      : "border-black/10"
                  }`}
                >
                  {displayBadge && (
                    <span
                      className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
                      style={{
                        background:
                          displayBadge === "NEW"
                            ? "linear-gradient(135deg,#60a5fa,#2563eb)"
                            : displayBadge === "HIT"
                            ? "linear-gradient(135deg,#34d399,#059669)"
                            : "linear-gradient(135deg,#000000,#111111)",
                      }}
                    >
                      {displayBadge}
                    </span>
                  )}
                  <SwipeablePreview
                    cacheKey={`top-${item.id}`}
                    images={getPreviewImages(item)}
                    alt={item.name}
                    className="w-full h-[180px] bg-white"
                  />
                  <div className="p-3">
                    <p className="text-sm font-semibold line-clamp-2">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-1">от {item.price}₽</p>
                  </div>
                </Link>
                </motion.div>
              );
            };

            return (
              <>
                {/* mobile: inertial horizontal scroll, no marquee jank */}
                <div className="md:hidden -mx-4 px-4 mb-6 overflow-hidden">
                  <div className="flex overflow-x-auto gap-3 pb-3 snap-x snap-mandatory scrollbar-hide">
                    {top.map((it, idx) => (
                      <div key={`m-${it.id}`} className="snap-start">
                        <Card item={it} index={idx} />
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
                          <Card item={it} index={i % rowA.length} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="marquee marquee-left">
                    <div className="track">
                      {[...rowB, ...rowB].map((it, i) => (
                        <div key={`b-${it.id}-${i}`} className="mr-5 last:mr-0">
                          <Card item={it} index={rowA.length + (i % rowB.length)} />
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

              {/* Чипы подкатегорий (Все + доступные подкатегории) - только на мобильном */}
              <div className="md:hidden mb-4">
                <SubcategoryChips
                  subcategories={orderedSubs as any}
                  active={activeSub}
                  onChange={(sub) => setSubByMain((prev) => ({ ...prev, [key]: sub }))}
                />
              </div>
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
              <SectionMount>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 mt-6">
                  {sliced.map((it: any, idx: number) => (
                    <AnimatedGridItem key={`grid-${it.id}`} index={idx}>
                      <GridCard 
                        item={it} 
                        rememberPremiumScroll={rememberPremiumScroll}
                        buildProductHref={buildProductHref}
                        getPreviewImages={getPreviewImages}
                        isRestoreTarget={restoredPremiumProductId === String(it.id)}
                      />
                    </AnimatedGridItem>
                  ))}
                </div>
              </SectionMount>
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
                      <Link href={buildProductHref(quickItem.id)} onClick={() => rememberPremiumScroll(quickItem.id)} className="px-5 py-2.5 rounded-full bg-black text-white font-semibold hover:shadow-md active:scale-[.98] transition">Открыть страницу товара</Link>
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
      <PremiumConcierge open={conciergeOpen} setOpen={setConciergeOpen} />

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
          will-change: auto;
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
