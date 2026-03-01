"use client";
import { Container } from "@/components/shared/container";
import { Title } from "@/components/shared/title";
import { TopBar } from "@/components/shared/top-bar";
import { ProductsGroupList } from "@/components/shared/products-group-list";
import { useState, useEffect, useRef, useMemo, useCallback, memo, Fragment, type MutableRefObject } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Stories } from "@/components/shared/stories";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import { Autoplay, Pagination } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "react-feather";
import { useUser } from "@/user/UserContext";
import BannerMargiela from "@/components/shared/BannerMargiela";
import { getOrCreateEventsSessionId } from "@/lib/events-client";
import HomeFeedInsert from "@/components/home/HomeFeedInsert";
import HomePromoRail from "@/components/home/HomePromoRail";
import CmsPromoBlock from "@/components/home/promos/CmsPromoBlock";
import { renderAuthorHomePromo } from "@/components/home/promos/author-promos";
import type { HomeCmsPromoConfig, HomePromoProduct } from "@/components/home/promos/types";
import { useMotionBudget, type MotionLevel } from "@/components/MotionBudgetProvider";
// Локальные подписи основных категорий
const LABELS: Record<string, string> = {
  footwear: 'Обувь',
  clothes: 'Одежда',
  bags: 'Сумки',
  accessories: 'Аксессуары',
  fragrance: 'Парфюмерия',
  headwear: 'Головные уборы',
};

type TopBrandSignal = {
  brandId: number;
  brandName: string;
  views: number;
  addToCart: number;
  purchases: number;
  brandClicks: number;
  weightedScore: number;
  slug?: string | null;
  logoUrl?: string | null;
};

type HomePromocodeSpacePayload = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  telegramUrl?: string;
  telegramText?: string;
  campaigns?: Array<{
    id: string;
    badge: string;
    title: string;
    subtitle: string;
    href: string;
    tone?: "sale" | "drop" | "base";
  }>;
};

type HomeCampaignItem = NonNullable<HomePromocodeSpacePayload["campaigns"]>[number];

const hashText = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const seededRandom = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

function buildCampaignIndexMap(
  count: number,
  campaigns: HomeCampaignItem[],
  seedSource: string
): Map<number, HomeCampaignItem> {
  const out = new Map<number, HomeCampaignItem>();
  if (count < 4 || campaigns.length === 0) return out;

  const tilesCount = Math.min(campaigns.length, Math.max(1, Math.floor(count / 10)));
  const rnd = seededRandom(hashText(seedSource));

  const indexes = Array.from({ length: count }, (_, i) => i);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }

  const shuffledCampaigns = [...campaigns];
  for (let i = shuffledCampaigns.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffledCampaigns[i], shuffledCampaigns[j]] = [shuffledCampaigns[j], shuffledCampaigns[i]];
  }

  const pickedIndexes = indexes.slice(0, tilesCount);
  for (let i = 0; i < pickedIndexes.length; i += 1) {
    out.set(pickedIndexes[i], shuffledCampaigns[i % shuffledCampaigns.length]);
  }

  return out;
}

function pickSeeded<T>(source: T[], count: number, seedSource: string): T[] {
  if (!Array.isArray(source) || source.length === 0 || count <= 0) return [];
  const rnd = seededRandom(hashText(seedSource));
  const pool = [...source];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}


// Smooth image swipe/hover preview for product cards (isolated from page re-renders)
const CARD_SWIPE_VARIANTS = {
  // Cover-reveal: the new image is already positioned on top (x: 0) and is revealed by clipPath.
  // This removes the moment where the old image “hangs” visibly.
  enter: (dir: 'left' | 'right') => ({
    x: 0,
    // If we swipe left (next image), reveal from the right edge (start clipped from the left).
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
  // Old image stays underneath and quickly fades a bit (it is being covered anyway).
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

const ProductCardImage = memo(function ProductCardImage({
  productId,
  imagesArr,
  alt,
  isTouchDevice,
  lastSwipeRef,
  motionLevel,
}: {
  productId: string;
  imagesArr: string[];
  alt: string;
  isTouchDevice: boolean;
  lastSwipeRef: MutableRefObject<{ id: string | null; ts: number }>;
  motionLevel: MotionLevel;
}) {
  const reduceMotion = motionLevel === "reduced";
  const balancedMotion = motionLevel === "balanced";
  const [activeIdx, setActiveIdx] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right'>('left');
  const [touchActionMode, setTouchActionMode] = useState<'pan-y' | 'none'>('pan-y');
  const [brokenSrcs, setBrokenSrcs] = useState<Set<string>>(() => new Set());
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

  // Clamp idx if images array changes, update ref when clamping
  useEffect(() => {
    setActiveIdx((prev) => {
      const max = Math.max(0, (imagesArr?.length || 1) - 1);
      const next = Math.min(Math.max(prev, 0), max);
      activeIdxRef.current = next;
      return next;
    });
  }, [imagesArr]);

  const activeSrc = imagesArr?.[activeIdx] || imagesArr?.[0] || "/img/placeholder.png";
  const displaySrc = brokenSrcs.has(activeSrc) ? "/img/placeholder.png" : activeSrc;

  const prefetchAround = useCallback(
    (idx: number) => {
      try {
        if (typeof window === 'undefined') return;
        if (!Array.isArray(imagesArr) || imagesArr.length <= 1) return;
        if (reduceMotion) return;
        const nextSrc = imagesArr[Math.min(idx + 1, imagesArr.length - 1)];
        const prevSrc = imagesArr[Math.max(idx - 1, 0)];
        const pool = balancedMotion ? [nextSrc] : [nextSrc, prevSrc];
        pool.forEach((src) => {
          if (!src) return;
          const img = new window.Image();
          img.src = src;
        });
      } catch {}
    },
    [balancedMotion, imagesArr, reduceMotion]
  );

  return (
    <div
      className="relative w-full aspect-[1/1] sm:aspect-[4/3] bg-white overflow-hidden"
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

        // Decide intent once (fixes iOS “scroll steals gesture”)
        if (st.intent === null) {
          const SLOP = 10;
          if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
          st.intent = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
          if (st.intent === 'h') setTouchActionMode('none');
        }

        if (st.intent === 'v') {
          // User is scrolling vertically; do not interfere.
          return;
        }

        // Horizontal swipe: prevent page scroll + keep pointer stream
        e.preventDefault();
        e.stopPropagation();

        // Bigger threshold = less sensitivity
        const THRESHOLD = 72;
        if (Math.abs(dx) < THRESHOLD) return;

        // Cooldown between steps (prevents blasting through)
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

        // Reset baseline so another step needs another intentional move
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
          <Image
            src={displaySrc}
            alt={alt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
            priority={false}
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

      {imagesArr.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none">
          {imagesArr.map((_: string, i: number) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${reduceMotion ? "duration-150" : balancedMotion ? "duration-200" : "duration-300"} ease-out ${
                i === activeIdx ? 'w-5 bg-black/50' : 'w-1.5 bg-black/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const DiscountCampaignBrick = memo(function DiscountCampaignBrick({
  campaign,
  products,
  motionLevel,
  isMotionPaused,
}: {
  campaign: HomeCampaignItem;
  products: any[];
  motionLevel: MotionLevel;
  isMotionPaused: boolean;
}) {
  const reduceMotion = motionLevel === "reduced";
  const balancedMotion = motionLevel === "balanced";
  const safeProducts = Array.isArray(products) ? products : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = cardRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { root: null, threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActiveIdx(0);
  }, [safeProducts.length]);

  useEffect(() => {
    if (safeProducts.length <= 1 || reduceMotion || isMotionPaused || !isVisible) return;
    const timer = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % safeProducts.length);
    }, balancedMotion ? 4200 : 3200);
    return () => window.clearInterval(timer);
  }, [balancedMotion, isMotionPaused, isVisible, safeProducts.length, reduceMotion]);

  const activeProduct = safeProducts[activeIdx] || null;
  const activeImage =
    (Array.isArray(activeProduct?.images) && activeProduct.images[0]) ||
    activeProduct?.imageUrl ||
    "/img/placeholder.png";
  const activePrice = Number(activeProduct?.price ?? 0);
  const activeOldPrice = Number(activeProduct?.oldPrice ?? 0);
  const hasOldPrice = Number.isFinite(activeOldPrice) && activeOldPrice > activePrice && activePrice > 0;

  return (
    <motion.div
      ref={cardRef}
      layoutId={`discount-campaign-${campaign.id}`}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={
        reduceMotion
          ? { duration: 0.14, ease: "easeOut" }
          : balancedMotion
          ? { duration: 0.16, ease: "easeOut" }
          : { duration: 0.2, type: "spring", stiffness: 500, damping: 50 }
      }
      className="group relative rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5 hover:ring-black/10 hover:shadow-md transition-transform hover:-translate-y-0.5 will-change-transform [contain:content]"
    >
      <Link
        href={activeProduct ? `/product/${activeProduct.id}` : campaign.href}
        className="absolute inset-0 z-20"
        aria-label={activeProduct ? `Открыть ${activeProduct.name}` : `Открыть ${campaign.title}`}
      />

      <div className="relative w-full aspect-[1/1] sm:aspect-[4/3] bg-white overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {activeProduct ? (
            <motion.div
              key={`sale-img-${activeProduct?.id ?? activeIdx}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 18, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -18, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0.16 : balancedMotion ? 0.24 : 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <Image
                src={activeImage}
                alt={activeProduct?.name || "Товар со скидкой"}
                fill
                className="object-contain p-2"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
              />
            </motion.div>
          ) : (
            <motion.div
              key="sale-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center text-xs text-black/45"
            >
              Скоро появятся товары со скидкой
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-none absolute left-2 top-2 inline-flex rounded-full border border-[#c2410c]/20 bg-[#fff3e6]/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a3412]">
          {campaign.badge || "SALE"}
        </div>
      </div>

      <div className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-black/50 leading-none mb-1 pointer-events-none">
          Акция
        </div>
        <h3 className="text-sm font-semibold leading-snug line-clamp-1 pointer-events-none">
          {campaign.title}
        </h3>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`sale-text-${activeProduct?.id ?? activeIdx}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0.14 : balancedMotion ? 0.2 : 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none"
          >
            {activeProduct ? (
              <>
                <div className="mt-1 text-[12px] font-semibold text-black line-clamp-1">
                  {activeProduct?.name}
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                  {campaign.subtitle}
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{campaign.subtitle}</p>
            )}

            <div className="mt-2 flex items-baseline gap-2">
              {hasOldPrice ? (
                <span className="text-[11px] text-gray-400 line-through">
                  {activeOldPrice.toLocaleString("ru-RU")} ₽
                </span>
              ) : null}
              <span className="text-sm font-semibold">
                {activePrice > 0 ? `${activePrice.toLocaleString("ru-RU")} ₽` : "Смотреть"}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
});


export default function Home() {
  const { reduceMotion, motionLevel, isMotionPaused } = useMotionBudget();
  const balancedMotion = motionLevel === "balanced";
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);
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
    if (it?.isNew === true) res.push('NEW');
    if (isHydrated && it?.createdAt) {
      const createdDays = (Date.now() - new Date(it.createdAt).getTime()) / 86400000;
      if (createdDays <= 30) res.push('NEW');
    }
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
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productsReloadKey, setProductsReloadKey] = useState(0);
  const [personalizedHomeItems, setPersonalizedHomeItems] = useState<any[]>([]);
  const [bestsellerHomeItems, setBestsellerHomeItems] = useState<any[]>([]);
  const [topBrandSignals, setTopBrandSignals] = useState<TopBrandSignal[]>([]);
  const [cmsPromos, setCmsPromos] = useState<HomeCmsPromoConfig[]>([]);
  const [publicPromoCodes, setPublicPromoCodes] = useState<any[]>([]);
  const [promocodeSpace, setPromocodeSpace] = useState<HomePromocodeSpacePayload | null>(null);
  const [restoredHomeProductId, setRestoredHomeProductId] = useState<string | null>(null);
  const [homePromoSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000));
  const [isHomeRecsLoading, setIsHomeRecsLoading] = useState(false);
  const homeSeenRecommendationIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let retryTimer: any = null;

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const fetchProducts = async () => {
      try {
        attempts += 1;
        const res = await fetch("/api/products?includePremium=1&take=260", {
          cache: "no-store",
          credentials: "include",
        });
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
          setProductsError(null);
          setIsProductsLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        // Retry a few times to avoid "empty first load" in dev
        if (attempts < 4) {
          const delay = attempts === 1 ? 350 : attempts === 2 ? 700 : 1200;
          retryTimer = setTimeout(fetchProducts, delay);
          return;
        }
        console.error("[home] failed to load products", err);
        setProducts([]);
        setProductsError("Не удалось загрузить товары. Попробуйте ещё раз.");
        setIsProductsLoading(false);
      }
    };

    setIsProductsLoading(true);
    fetchProducts();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [extractBrand, productsReloadKey]);

  const fetchHomeRecommendations = useCallback(async (rotate = false) => {
    setIsHomeRecsLoading(true);
    const sessionId = getOrCreateEventsSessionId();
    const excludeCsv = rotate
      ? Array.from(homeSeenRecommendationIdsRef.current).join(",")
      : "";

    try {
      const params = new URLSearchParams({
        limit: "16",
        seed: String(Date.now()),
        sessionId,
      });
      if (excludeCsv) params.set("exclude", excludeCsv);

      const [personalRes, bestsellerRes] = await Promise.all([
        fetch(`/api/recommendations/personal?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/recommendations/bestsellers?limit=12&days=90`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      const personalData = await personalRes.json().catch(() => ({} as any));
      const bestsellerData = await bestsellerRes.json().catch(() => ({} as any));

      let personalItems = Array.isArray(personalData?.items) ? personalData.items : [];
      if (!personalItems.length && excludeCsv) {
        homeSeenRecommendationIdsRef.current = new Set();
        const retry = await fetch(
          `/api/recommendations/personal?limit=16&seed=${encodeURIComponent(String(Date.now()))}&sessionId=${encodeURIComponent(sessionId)}`,
          { cache: "no-store", credentials: "include" }
        );
        const retryData = await retry.json().catch(() => ({} as any));
        personalItems = Array.isArray(retryData?.items) ? retryData.items : [];
      }

      if (Array.isArray(personalItems) && personalItems.length) {
        for (const item of personalItems) {
          const id = Number(item?.id);
          if (Number.isFinite(id) && id > 0) homeSeenRecommendationIdsRef.current.add(id);
        }
      }

      setPersonalizedHomeItems(personalItems.slice(0, 16));
      setTopBrandSignals(
        Array.isArray(personalData?.topBrands)
          ? personalData.topBrands.slice(0, 12)
          : []
      );
      setBestsellerHomeItems(Array.isArray(bestsellerData?.items) ? bestsellerData.items.slice(0, 12) : []);
    } catch {
      setPersonalizedHomeItems([]);
      setTopBrandSignals([]);
      setBestsellerHomeItems([]);
    } finally {
      setIsHomeRecsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeRecommendations(false);
  }, [fetchHomeRecommendations]);

  useEffect(() => {
    let cancelled = false;

    const loadCmsPromos = async () => {
      try {
        const res = await fetch("/api/home/promos", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({} as any));
        if (cancelled) return;
        setCmsPromos(Array.isArray(data?.promos) ? data.promos : []);
      } catch {
        if (!cancelled) setCmsPromos([]);
      }
    };

    loadCmsPromos();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const extractPromosFromPayload = (payload: any): any[] => {
      if (Array.isArray(payload?.promoCodes)) return payload.promoCodes;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.space?.promoCodes)) return payload.space.promoCodes;
      if (Array.isArray(payload?.space?.items)) return payload.space.items;
      return [];
    };

    const normalizePublicUnlimitedPromos = (rows: any[]): any[] => {
      const now = Date.now();
      return (Array.isArray(rows) ? rows : []).filter((row: any) => {
        const isPublic = row?.userId == null;
        const unlimited = row?.maxRedemptions == null;
        const isActive = row?.isActive !== false;
        const startsAt = row?.startsAt ? new Date(row.startsAt).getTime() : null;
        const endsAt = row?.endsAt ? new Date(row.endsAt).getTime() : null;
        const startsOk = startsAt == null || Number.isNaN(startsAt) || startsAt <= now;
        const endsOk = endsAt == null || Number.isNaN(endsAt) || endsAt >= now;
        return isPublic && unlimited && isActive && startsOk && endsOk;
      });
    };

    const loadPromocodeSpace = async () => {
      try {
        const bust = `t=${encodeURIComponent(String(Date.now()))}`;
        const spaceRes = await fetch(`/api/home/promocode-space?${bust}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await spaceRes.json().catch(() => ({} as any));
        if (cancelled) return;

        const fromSpace = extractPromosFromPayload(data);
        const normalizedFromSpace = normalizePublicUnlimitedPromos(fromSpace);
        setPromocodeSpace(data?.space && typeof data.space === "object" ? data.space : null);

        if (normalizedFromSpace.length) {
          setPublicPromoCodes(normalizedFromSpace);
          return;
        }

        const fallbackPromosRes = await fetch(`/api/promocodes?${bust}`, {
          cache: "no-store",
          credentials: "include",
        });
        const fallbackData = await fallbackPromosRes.json().catch(() => ({} as any));
        if (cancelled) return;

        const fallbackFiltered = normalizePublicUnlimitedPromos(
          extractPromosFromPayload(fallbackData)
        );
        setPublicPromoCodes(fallbackFiltered);
      } catch {
        if (!cancelled) {
          setPublicPromoCodes([]);
          setPromocodeSpace(null);
        }
      }
    };

    loadPromocodeSpace();
    return () => {
      cancelled = true;
    };
  }, []);

  const isDiscountProduct = useCallback((product: any) => {
    const badge = String(product?.badge || "").toUpperCase();
    const price = Number(product?.price ?? product?.minPrice ?? 0);
    const oldPrice = Number(product?.oldPrice ?? 0);
    const hasPriceDrop = Number.isFinite(oldPrice) && oldPrice > 0 && oldPrice > price;
    return hasPriceDrop || badge.includes("SALE");
  }, []);

  const discountedProducts = useMemo(
    () => products.filter((product) => isDiscountProduct(product)),
    [isDiscountProduct, products]
  );

  const editorialCollections = useMemo(() => {
    const SYSTEM_BADGES = new Set(["NEW", "HIT", "SALE", "EXCLUSIVE", "PREMIUM"]);
    const grouped = new Map<string, any[]>();

    for (const product of products) {
      const rawBadge = String((product as any)?.badge || "").trim();
      if (!rawBadge) continue;
      const upper = rawBadge.toUpperCase();
      if (SYSTEM_BADGES.has(upper)) continue;
      const bucket = grouped.get(rawBadge) || [];
      if (bucket.length < 8) bucket.push(product);
      grouped.set(rawBadge, bucket);
    }

    return Array.from(grouped.entries())
      .map(([title, items]) => ({ title, items }))
      .filter((group) => group.items.length > 0)
      .slice(0, 4);
  }, [products]);

  const activeEditorial = editorialCollections[0] || null;
  const youMayLikeItems = useMemo(() => {
    const rankedBrandIds = new Map<number, number>();
    for (let i = 0; i < topBrandSignals.length; i += 1) {
      const id = Number(topBrandSignals[i]?.brandId);
      if (!Number.isFinite(id) || id <= 0) continue;
      rankedBrandIds.set(id, i);
    }

    const scored = personalizedHomeItems
      .map((item: any, index: number) => {
        const brandId = Number(item?.brandId);
        const brandRank = rankedBrandIds.has(brandId) ? rankedBrandIds.get(brandId)! : 99;
        const brandBoost = Math.max(0, 60 - brandRank * 8);
        const recScore = Number(item?.recommendation?.score ?? 0) * 100;
        const freshBoost = Math.max(0, 25 - index);
        return { item, score: recScore + brandBoost + freshBoost };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);

    if (scored.length) return scored.slice(0, 8);
    return bestsellerHomeItems.slice(0, 8);
  }, [personalizedHomeItems, bestsellerHomeItems, topBrandSignals]);

  const promoSourceItems = useMemo(() => {
    const merged = [...products, ...personalizedHomeItems, ...bestsellerHomeItems];
    const seen = new Set<number>();
    const rows: any[] = [];
    for (const item of merged) {
      const id = Number(item?.id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      rows.push(item);
    }
    return rows;
  }, [products, personalizedHomeItems, bestsellerHomeItems]);

  const authorPromoItems = useMemo<HomePromoProduct[]>(() => {
    const key = (v: any) => String(v || "").toLowerCase();
    const hasFstuSignal = (p: any) => {
      const brand = key(p?.brand || p?.brandName || extractBrand(p));
      const name = key(p?.name);
      return (
        brand.includes("fstu") ||
        brand.includes("acne") ||
        name.includes("fstu") ||
        name.includes("acne")
      );
    };

    const merged = promoSourceItems.filter(hasFstuSignal);
    const seen = new Set<number>();
    const rows: HomePromoProduct[] = [];

    for (const item of merged) {
      const id = Number(item?.id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      rows.push({
        id,
        name: String(item?.name || "Товар"),
        price:
          Number(item?.price) > 0
            ? Number(item?.price)
            : Number(item?.minPrice) > 0
            ? Number(item?.minPrice)
            : Number(item?.amount) > 0
            ? Number(item?.amount)
            : null,
        imageUrl:
          (Array.isArray(item?.images) && item.images.length
            ? String(item.images[0] || "")
            : String(item?.imageUrl || "")) || null,
        brandName: String(item?.brandName || item?.brand || extractBrand(item) || "") || null,
      });
      if (rows.length >= 8) break;
    }

    return rows;
  }, [promoSourceItems, extractBrand]);

  const cmsPromoItemsById = useMemo<Record<string, HomePromoProduct[]>>(() => {
    const result: Record<string, HomePromoProduct[]> = {};
    const key = (v: any) => String(v || "").toLowerCase();

    const toPromoItem = (item: any): HomePromoProduct => ({
      id: Number(item?.id),
      name: String(item?.name || "Товар"),
      price:
        Number(item?.price) > 0
          ? Number(item?.price)
          : Number(item?.minPrice) > 0
          ? Number(item?.minPrice)
          : Number(item?.amount) > 0
          ? Number(item?.amount)
          : null,
      imageUrl:
        (Array.isArray(item?.images) && item.images.length
          ? String(item.images[0] || "")
          : String(item?.imageUrl || "")) || null,
      brandName: String(item?.brandName || item?.brand || extractBrand(item) || "") || null,
    });

    const sourceById = new Map<number, any>();
    for (const item of promoSourceItems) {
      const id = Number(item?.id);
      if (!Number.isFinite(id) || id <= 0 || sourceById.has(id)) continue;
      sourceById.set(id, item);
    }

    for (const promo of cmsPromos) {
      const seen = new Set<number>();
      const rows: HomePromoProduct[] = [];

      if (Array.isArray(promo.productIds) && promo.productIds.length) {
        for (const pid of promo.productIds) {
          const item = sourceById.get(Number(pid));
          if (!item) continue;
          const id = Number(item?.id);
          if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
          seen.add(id);
          rows.push(toPromoItem(item));
        }
      }

      if (rows.length < promo.maxItems && Array.isArray(promo.brandQueries) && promo.brandQueries.length) {
        const needles = promo.brandQueries.map((v) => key(v)).filter(Boolean);
        for (const item of promoSourceItems) {
          if (rows.length >= promo.maxItems) break;
          const id = Number(item?.id);
          if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;

          const brand = key(item?.brand || item?.brandName || extractBrand(item));
          const name = key(item?.name);
          const hit = needles.some((needle) => brand.includes(needle) || name.includes(needle));
          if (!hit) continue;

          seen.add(id);
          rows.push(toPromoItem(item));
        }
      }

      result[promo.id] = rows.slice(0, Math.max(1, promo.maxItems || 8));
    }

    return result;
  }, [cmsPromos, promoSourceItems, extractBrand]);

  const cmsPromosByPosition = useMemo<Record<number, HomeCmsPromoConfig[]>>(() => {
    const grouped: Record<number, HomeCmsPromoConfig[]> = {};
    for (const promo of cmsPromos) {
      const pos = Number.isFinite(Number(promo?.position)) ? Math.max(0, Number(promo.position)) : 0;
      (grouped[pos] ||= []).push(promo);
    }
    return grouped;
  }, [cmsPromos]);
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

  // Каталог главной: исключаем premium-товары, но в промо-источниках они доступны.
  const catalog = useMemo(
    () => products.filter((item: any) => !Boolean(item?.premium)),
    [products]
  );
  
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

  const filtered = useMemo(() => catalog, [catalog]);

  // Сортировка поверх фильтра
  const visibleProducts = useMemo(() => sortItems(filtered, sortKey), [filtered, sortKey]);

  // Группировка отфильтрованных товаров по основным категориям
  const groupedVisible = useMemo(() => {
    const result: Record<string, any[]> = {};
    for (const p of visibleProducts) {
      const main = normalizeCategory(getRawCategory(p as any));
      (result[main] ||= []).push(p);
    }
    return result;
  }, [visibleProducts, normalizeCategory, getRawCategory]);

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
  

  const [showAnimation, setShowAnimation] = useState(false);
  const swiperRef = useRef<any>(null);
  const heroTapRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const [hoveredSide, setHoveredSide] = useState<"left" | "right" | null>(null);
  const [parallaxY, setParallaxY] = useState(0);
  const [heroFade, setHeroFade] = useState(0); // 0..1 based on scrollY
  const [isHeroInView, setIsHeroInView] = useState(true);
  const { user } = useUser();
  const [isScrollingProgrammatically, setIsScrollingProgrammatically] = useState(false);
  // Touch-only: swipe preview on product cards (do not block normal click on desktop)
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const lastSwipeRef = useRef<{ id: string | null; ts: number }>({ id: null, ts: 0 });

  // Detect touch / coarse pointer (enable swipe preview only there)
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
      const shouldRestore = sessionStorage.getItem('restoreScroll') === '1';
      if (!shouldRestore) return;

      // Сбрасываем флаг всегда, чтобы он не зависал между сессиями
      sessionStorage.removeItem('restoreScroll');
      const tsRaw = sessionStorage.getItem('restoreScrollAt');
      sessionStorage.removeItem('restoreScrollAt');

      const ts = tsRaw ? Number(tsRaw) : 0;
      if (ts && Date.now() - ts > 5 * 60 * 1000) return;

      const lastRoute = sessionStorage.getItem('lastListRoute');
      const lastProductId = sessionStorage.getItem('lastProductId');
      const lastScrollYRaw = sessionStorage.getItem('lastScrollY');
      const lastScrollY = lastScrollYRaw ? Number(lastScrollYRaw) : NaN;

      // Проверяем что возвращаемся именно на главную
      const isHomeRoute = !lastRoute || lastRoute.split('?')[0] === '/';
      if (!isHomeRoute) return;

      const highlight = (id: string) => {
        setRestoredHomeProductId(id);
        window.setTimeout(() => setRestoredHomeProductId((prev) => (prev === id ? null : prev)), 2200);
      };

      const tryRestore = (attempt = 0) => {
        if (lastProductId) {
          const el = document.getElementById(`product-${lastProductId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlight(lastProductId);
            return;
          }
        }
        if (attempt < 24) {
          window.setTimeout(() => tryRestore(attempt + 1), 80);
          return;
        }
        if (!Number.isNaN(lastScrollY)) {
          window.scrollTo({ top: lastScrollY, behavior: 'smooth' });
        }
      };

      window.setTimeout(() => tryRestore(0), 0);
    } catch {}
  }, []);
  
  useEffect(() => {
    if (searchParams.get("premium") === "true") {
      if (reduceMotion || balancedMotion) {
        setShowAnimation(false);
        return;
      }
      setShowAnimation(true);
      const timeoutId = window.setTimeout(() => {
        setShowAnimation(false);
      }, 1500);
      return () => window.clearTimeout(timeoutId);
    }
    return;
  }, [searchParams, reduceMotion, balancedMotion]);

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

  // Parallax value computed only on client, also compute heroFade
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hero = document.getElementById("home-hero");
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroInView(Boolean(entry?.isIntersecting)),
      { root: null, threshold: 0.01 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  // Parallax value computed only while hero block is visible
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf: number | null = null;

    const compute = () => {
      if (!isHeroInView) return;
      const y = window.scrollY || 0;
      setParallaxY(reduceMotion ? y * 0.04 : balancedMotion ? y * 0.07 : y * 0.1);

      // Stronger hero disappearance: 0..1 within first ~320px of scroll.
      const raw = Math.min(1, Math.max(0, y / 320));
      // Smoothstep easing for nicer feel
      const t = raw * raw * (3 - 2 * raw);
      setHeroFade(reduceMotion ? t * 0.7 : balancedMotion ? t * 0.85 : t);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        compute();
        raf = null;
      });
    };

    // initial value
    compute();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [reduceMotion, balancedMotion, isHeroInView]);

  // Для кнопки "Смотреть каталог"
  const [isHovered, setIsHovered] = useState(false);


  // --- Modal state for hero slides ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState<number | null>(null);
  const openModal = (i: number) => { setActiveSlide(i); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setActiveSlide(null); document.body.style.overflow = ''; };

  // --- Modal state for product gallery preview ---
  const [productPreviewOpen, setProductPreviewOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const [previewImageIdx, setPreviewImageIdx] = useState(0);
  
  const openProductPreview = (product: any) => {
    setPreviewProduct(product);
    setPreviewImageIdx(0);
    setProductPreviewOpen(true);
  };
  
  const closeProductPreview = () => {
    setProductPreviewOpen(false);
    setPreviewProduct(null);
    setPreviewImageIdx(0);
  };

  // Close on ESC
  useEffect(() => {
    if (!isModalOpen && !productPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (productPreviewOpen) closeProductPreview();
        else if (isModalOpen) closeModal();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isModalOpen, productPreviewOpen]);

  // Lock body scroll when modal is open
useEffect(() => {
  const originalStyle = window.getComputedStyle(document.body).overflow;
  
  if (isModalOpen || productPreviewOpen) {
    document.body.style.overflow = 'hidden';
  }
  
  return () => {
    document.body.style.overflow = originalStyle;
  };
}, [isModalOpen, productPreviewOpen]);
// Лочим скролл, пока открыт мобильный/планшетный Drawer фильтров
  
  // --- HERO SLIDES DATA ---
  <BannerMargiela />

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

  const handleHeroCta = useCallback(
    (hash?: string) => {
      if (!hash) return;
      const key = hash.replace("#", "");
      const el = document.querySelector(`[data-anchor="${key}"]`) as HTMLElement | null;
      if (el) {
        smoothScrollToElement(el);
        return;
      }
      // fallback to hash navigation
      try {
        window.location.hash = hash;
      } catch {}
    },
    [smoothScrollToElement]
  );

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
            transition={{ duration: reduceMotion ? 0.25 : 1.5, ease: "easeInOut" }}
            className="fixed bottom-0 left-0 right-0 h-screen bg-black flex justify-center items-center text-white text-4xl font-bold z-50"
          >
            <motion.span
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.5 }}
              transition={{ duration: reduceMotion ? 0.2 : 1 }}
              className="relative"
            >
              Premium
              <Image
                src="/img/звезддочкиии.png"
                alt="Stars"
                width={40}
                height={40}
                className={`absolute -top-4 -right-4 ${reduceMotion ? "" : "animate-spin"}`}
              />
              <Image
                src="/img/звездочкиии.png"
                alt="Stars"
                width={40}
                height={40}
                className={`absolute -bottom-4 -left-4 ${reduceMotion ? "" : "animate-spin"}`}
              />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>




      <motion.div
        id="home-hero"
        className="hero-bleed-top relative z-0 w-screen overflow-hidden h-[380px] md:h-[520px] lg:h-[600px] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1224] transform-gpu will-change-transform"
        style={{
          opacity: 1 - heroFade * 0.92,
          filter: reduceMotion ? "none" : balancedMotion ? `blur(${heroFade * 4}px)` : `blur(${heroFade * 10}px)`,
          transform: reduceMotion
            ? `translateY(${-heroFade * 16}px) scale(${1 - heroFade * 0.02})`
            : balancedMotion
            ? `translateY(${-heroFade * 24}px) scale(${1 - heroFade * 0.04})`
            : `translateY(${-heroFade * 36}px) scale(${1 - heroFade * 0.06})`,
        }}
        aria-hidden={heroFade > 0.98}
        onMouseLeave={() => setHoveredSide(null)}
        onTouchStart={(e) => {
          if (!isTouchDevice) return;
          const t = e.target as HTMLElement | null;
          if (t && t.closest('button, a, input, textarea, select, label, [role="button"], .hero-pagination, .swiper-pagination-bullet, [data-no-hero-tap]')) return;
          const touch = e.touches?.[0];
          if (!touch) return;
          heroTapRef.current = { x: touch.clientX, y: touch.clientY, active: true };
        }}
        onTouchEnd={(e) => {
          if (!isTouchDevice) return;
          const t = e.target as HTMLElement | null;
          if (t && t.closest('button, a, input, textarea, select, label, [role="button"], .hero-pagination, .swiper-pagination-bullet, [data-no-hero-tap]')) {
            heroTapRef.current.active = false;
            return;
          }
          const start = heroTapRef.current;
          if (!start.active) return;
          heroTapRef.current.active = false;
          const touch = e.changedTouches?.[0];
          if (!touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          // If the finger moved, treat it as swipe/scroll, not a tap
          if (Math.abs(dx) > 14 || Math.abs(dy) > 14) return;
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = touch.clientX - rect.left;
          const isRightHalf = x >= rect.width / 2;
          if (isRightHalf) swiperRef.current?.slideNext();
          else swiperRef.current?.slidePrev();
        }}
        onTouchCancel={() => {
          heroTapRef.current.active = false;
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-12 top-6 w-72 h-72 bg-emerald-400/20 blur-[90px] rounded-full" />
          <div className="absolute right-[-60px] bottom-[-80px] w-80 h-80 bg-sky-500/20 blur-[100px] rounded-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/55" />
          <div
            className="absolute inset-0 opacity-[0.18] mix-blend-soft-light"
            style={{
              backgroundImage:
                "radial-gradient(1200px 500px at 10% 10%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(900px 400px at 90% 80%, rgba(255,255,255,0.12), transparent 60%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(0deg, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "120px 120px",
            }}
          />
        </div>
        {/*
          HERO SLIDES DATA
        */}
        <BannerMargiela />
     
       
        <div
          className="hero-pagination"
          style={{
            opacity: Math.max(0, Math.min(1, 1 - heroFade * 1.2)),
            pointerEvents: heroFade > 0.9 ? "none" : "auto",
            transition: reduceMotion ? "none" : balancedMotion ? "opacity 160ms ease" : "opacity 260ms ease",
          }}
        ></div>
        {/* HERO pagination bullets styling + animation */}
        <style jsx global>{`
          /* Hero slider pagination bullets */
          .hero-pagination {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 18px !important;
            width: 100% !important;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            z-index: 60;
            pointer-events: auto;
          }

          .swiper-pagination-bullet {
            width: 18px;
            height: 2px;
            border-radius: 9999px;
            background: #ffffff;
            opacity: 1;
            position: relative;
            overflow: hidden;
            transform: translateZ(0);
            transition:
              width 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
              opacity 220ms ease,
              transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
              background-color 320ms ease,
              box-shadow 320ms ease;
            /* Только черный/белый: белая полоска + черная обводка */
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.22);
          }

          .swiper-pagination-bullet:hover {
            transform: scale(1.15);
            opacity: 0.9;
          }

          /* Active bullet becomes wider to indicate current slide */
          .swiper-pagination-bullet-active {
            width: 36px;
            transform: scale(1.05);
            background: #ffffff;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.85), 0 10px 24px rgba(0, 0, 0, 0.28);
          }

          /* Respect reduced motion */
          @media (prefers-reduced-motion: reduce) {
            .swiper-pagination-bullet,
            .swiper-pagination-bullet-active {
              transition: none !important;
            }
          }
        `}</style>

        {!isTouchDevice && hoveredSide === "left" && (
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

        {!isTouchDevice && hoveredSide === "right" && (
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

        {!isTouchDevice && (
          <>
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
          </>
        )}

      </motion.div>

      {/* Stories bar */}
      <div className="w-full">
        <Stories />
      </div>

      {/* Premium button under Stories (desktop + mobile) */}
      <div className="px-4 sm:px-6 mt-3">
        <div className="hidden sm:flex justify-center">
          <Link
            href="/premium"
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-black text-white px-6 py-3 text-sm font-semibold shadow-sm hover:bg-white hover:text-black hover:shadow-md transition"
            onClick={() => {
              try { sessionStorage.setItem("premiumEntry", "stories"); } catch {}
            }}
          >
            <span className="text-xs uppercase tracking-[0.18em] opacity-70">
              Premium
            </span>
            <span>Эксклюзивный раздел</span>
          </Link>
        </div>
        <div className="sm:hidden">
          <Link
            href="/premium"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black text-white px-5 py-2.5 text-sm font-semibold shadow-sm hover:bg-white hover:text-black hover:shadow-md transition"
            onClick={() => {
              try { sessionStorage.setItem("premiumEntry", "stories"); } catch {}
            }}
          >
            <span className="text-xs uppercase tracking-[0.16em] opacity-70">
              Premium
            </span>
            <span>Эксклюзивный раздел</span>
          </Link>
        </div>
      </div>

      <div className="h-4 sm:h-6" />
      <Container className="mt-10 pb-14">
        <div className="grid grid-cols-1 gap-6">
          {/* PRODUCTS BY CATEGORY */}
          <section className="space-y-10">
            {isProductsLoading ? (
              <ProductsSkeleton />
            ) : (
              <>
                {productsError && (
                  <div className="text-center text-sm text-gray-500 py-8 space-y-3">
                    <div>{productsError}</div>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:border-black hover:text-black transition"
                      onClick={() => {
                        setProductsError(null);
                        setIsProductsLoading(true);
                        setProductsReloadKey((k) => k + 1);
                      }}
                    >
                      Повторить
                    </button>
                  </div>
                )}

                {!productsError && !sectionOrder.length && (
                  <div className="text-center text-sm text-gray-500 py-8">
                    По выбранным фильтрам ничего не найдено
                  </div>
                )}

                {!productsError && (
                  <div className="space-y-4 px-3 sm:px-0">
                    <HomePromoRail
                      promoCodes={publicPromoCodes}
                      eyebrow={promocodeSpace?.eyebrow}
                      title={promocodeSpace?.title}
                      subtitle={promocodeSpace?.subtitle}
                      telegramUrl={promocodeSpace?.telegramUrl}
                      telegramText={promocodeSpace?.telegramText}
                    />
                  </div>
                )}

                {sectionOrder.map((main, sectionIndex) => {
                  const items = groupedVisible[main] || [];
                  if (!items.length) return null;

                  const anchorId = idMap[main] ? `category-${idMap[main]}` : undefined;
                  const displayLimit = visibleByCat[main] ?? DEFAULT_COUNT;
                  const displayList = items.slice(0, displayLimit);
                  const canShowLess = displayLimit > DEFAULT_COUNT;
                  const hasMore = items.length > displayList.length;
                  const cmsPromosAtSection = cmsPromosByPosition[sectionIndex] || [];
                  const authorPromoNode = renderAuthorHomePromo(sectionIndex, authorPromoItems);
                  const campaignPool = Array.isArray(promocodeSpace?.campaigns)
                    ? promocodeSpace.campaigns
                    : [];
                  const campaignByIndex = buildCampaignIndexMap(
                    displayList.length,
                    campaignPool,
                    `${homePromoSeed}-${main}-${sectionIndex}-${displayLimit}`
                  );
                  const sectionDiscounted = items.filter((product) => isDiscountProduct(product));
                  const campaignProductsById = new Map<string, any[]>(
                    campaignPool.map((campaign) => {
                      const preferredPool = sectionDiscounted.length ? sectionDiscounted : discountedProducts;
                      const fallbackPool = preferredPool.length ? preferredPool : items;
                      const picked = pickSeeded(
                        fallbackPool,
                        6,
                        `${homePromoSeed}-${main}-${sectionIndex}-${campaign.id}`
                      );
                      return [campaign.id, picked];
                    })
                  );

                  return (
                    <Fragment key={`sec-wrap-${main}`}>
                      {sectionIndex === 1 && (
                        <div className="px-3 sm:px-0">
                          <HomeFeedInsert
                            title="Бестселлеры"
                            subtitle="Популярные товары по общей статистике пользователей."
                            items={bestsellerHomeItems}
                            variant="bestseller"
                            eyebrow="Бестселлеры"
                            emptyHint="Пока не собрали статистику бестселлеров."
                          />
                        </div>
                      )}
                      {authorPromoNode ? (
                        <div className="px-3 sm:px-0">
                          {authorPromoNode}
                        </div>
                      ) : null}
                      {cmsPromosAtSection.map((promo) => (
                        <div key={`cms-promo-${promo.id}`} className="px-3 sm:px-0">
                          <CmsPromoBlock promo={promo} items={cmsPromoItemsById[promo.id] || []} />
                        </div>
                      ))}
                      {sectionIndex === 3 && (
                        <div className="px-3 sm:px-0">
                          <HomeFeedInsert
                            title={activeEditorial ? `Авторская подборка: ${activeEditorial.title}` : "Авторские подборки"}
                            subtitle="Темы задаются в админке через поле `badge` у товаров."
                            items={activeEditorial?.items || []}
                            variant="editorial"
                            eyebrow="Авторская подборка"
                            emptyHint="Добавьте товарам общий badge в админке, и подборка появится здесь."
                          />
                        </div>
                      )}
                      {sectionIndex === 4 && (
                        <div className="px-3 sm:px-0">
                          <HomeFeedInsert
                            title="Вам может понравиться"
                            subtitle="Подборка формируется по аналитике просмотров, поисков, кликов по брендам и добавлений в корзину."
                            items={youMayLikeItems}
                            variant="personal"
                            eyebrow="Персонально"
                            ctaLabel={isHomeRecsLoading ? "Обновление..." : "Обновить"}
                            onCtaClick={() => {
                              if (isHomeRecsLoading) return;
                              fetchHomeRecommendations(true);
                            }}
                            emptyHint="Собираем персональные сигналы."
                          />
                        </div>
                      )}

                      <div
                        key={`sec-${main}`}
                        data-anchor={main}
                        id={anchorId}
                        className="scroll-mt-[calc(var(--header-h,72px)+16px)] px-3 sm:px-0"
                        style={{ scrollMarginTop: 'calc(var(--header-h,72px) + 16px)' }}
                      >
                      <div className="mb-3 flex items-baseline justify-between">
                        <h3 className="text-lg sm:text-xl font-bold">{LABELS[main] ?? main}</h3>
                        {canShowLess && (
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

                      <motion.div
                        layout={motionLevel === "full"}
                        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-5 sm:gap-4"
                      >
                        {displayList.map((product: any, productIndex: number) => {
                            const campaignSlot = campaignByIndex.get(productIndex);
                            if (campaignSlot) {
                              return (
                                <DiscountCampaignBrick
                                  key={`campaign-slot-${main}-${productIndex}-${campaignSlot.id}`}
                                  campaign={campaignSlot}
                                  products={campaignProductsById.get(campaignSlot.id) || []}
                                  motionLevel={motionLevel}
                                  isMotionPaused={isMotionPaused}
                                />
                              );
                            }
                            const imgSrc =
                              (Array.isArray(product?.images) && product.images[0]) ||
                              product?.imageUrl ||
                              "/img/placeholder.png";
                          const imagesArr =
                            Array.isArray(product?.images) && product.images.length
                              ? product.images
                              : [imgSrc];
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
                            const isRestoredHomeTarget = restoredHomeProductId === String(product.id);
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
                                layoutId={`product-card-${product.id}`}
                                key={product.id}
                                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                                transition={
                                  reduceMotion
                                    ? { duration: 0.14, ease: "easeOut" }
                                    : balancedMotion
                                    ? { duration: 0.16, ease: "easeOut" }
                                    : { duration: 0.2, type: "spring", stiffness: 500, damping: 50 }
                                }
                              >
                                <a
                                  id={`product-${product.id}`}
                                  href={`/product/${product.id}`}
                                  className={`group rounded-2xl overflow-hidden bg-white shadow-sm ring-1 transition-transform will-change-transform [contain:content] ${
                                    isRestoredHomeTarget
                                      ? `ring-[#2563eb]/45 shadow-[0_0_0_7px_rgba(37,99,235,0.18)] ${reduceMotion ? "" : "animate-pulse"}`
                                      : "ring-black/5 hover:ring-black/10 hover:shadow-md hover:-translate-y-0.5"
                                  }`}
                                  onClickCapture={(e) => {
                                    // If the user just swiped images on touch devices, do NOT navigate.
                                    if (!isTouchDevice) return;
                                    const s = lastSwipeRef.current;
                                    if (s?.id === String(product.id) && Date.now() - s.ts < 600) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }
                                  }}
                                  onClick={(e) => {
                                    if (e.defaultPrevented) return;
                                    try {
                                      sessionStorage.setItem('restoreScroll', '1');
                                      sessionStorage.setItem('restoreScrollAt', String(Date.now()));
                                      sessionStorage.setItem('lastListRoute', window.location.pathname + window.location.search);
                                      sessionStorage.setItem('lastScrollY', String(window.scrollY));
                                      sessionStorage.setItem('lastProductId', String(product.id));
                                    } catch {}
                                  }}
                                >
                                  <ProductCardImage
                                    productId={String(product.id)}
                                    imagesArr={imagesArr}
                                    alt={product.name || "Товар"}
                                    isTouchDevice={isTouchDevice}
                                    lastSwipeRef={lastSwipeRef}
                                    motionLevel={motionLevel}
                                  />
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

                      {/* Show more (always visible; disabled если нечего догружать) */}
                      <div className="mt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (!hasMore) return;
                            setVisibleByCat((p) => ({
                              ...p,
                              [main]: Math.min((p[main] ?? DEFAULT_COUNT) + LOAD_STEP, items.length),
                            }));
                          }}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-black/15 transition text-sm ${
                            hasMore ? "hover:bg-black hover:text-white" : "opacity-50 cursor-not-allowed"
                          }`}
                          aria-label="Показать больше товаров"
                          disabled={!hasMore}
                          title={hasMore ? "Показать больше" : "Больше товаров нет"}
                        >
                          <span className="text-lg leading-none" aria-hidden>＋</span>
                          <span>Показать больше</span>
                        </button>
                      </div>
                      </div>
                    </Fragment>
                  );
                })}
              </>
            )}
          </section>
        </div>
      </Container>
    </>
  );
}
