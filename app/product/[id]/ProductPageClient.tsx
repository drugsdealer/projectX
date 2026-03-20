'use client';

import React, { useState, useRef, useEffect } from "react";
// Fisher-Yates shuffle utility
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Normalize brand to URL slug for /brand/[slug]
function brandSlugFrom(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const RECENT_STORAGE_KEY = "recent_products_v1";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Navigation, Pagination } from "swiper/modules";
import SizeSelector from '@/components/shared/SizeSelector';
import { useToast } from "@/context/ToastContext";
import { useCart } from "@/context/CartContext";
import { useUser } from "@/user/UserContext";
import "swiper/css";
import "swiper/css/mousewheel";
import "swiper/css/navigation";
import "swiper/css/pagination";

import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Heart } from "lucide-react";
import { normalizeProduct, type NormalizedProduct } from "@/lib/normalizeProduct";
import { getOrCreateEventsSessionId, trackShopEvent } from "@/lib/events-client";


// --- Local minimal types to replace removed "@/data/products" ---
type BagDimensions = { width: number; height: number; depth: number };

// Use the shared normalized product shape everywhere on this page
type Product = NormalizedProduct;

// Narrow helper type for bags (kept only for casts where needed)
type BagProduct = {
  category: "bags";
  dimensions: BagDimensions;
  sizes?: any;
  images: string[];
  name: string;
  price: number;
  id: number;
};

// Narrow helper type for perfumes, using fragranceNotes from NormalizedProduct
type PerfumeProduct = {
  category: "perfume";
  fragranceNotes: NonNullable<NormalizedProduct["fragranceNotes"]>;
};

// Узкий тип для цветовых вариантов (то, что прилетает в product.colorVariants)
type ColorVariant = {
  id: number;
  name: string;
  price: number;
  images: string[];
};

// Fallback size charts used by the local SizeChartTable if needed
const sizeCharts = {
  // Верх (футболки, худи, свитшоты, куртки и т.п.)
  clothingTop: [
    { label: 'XXS', ru: 40, chestCm: 80, shouldersCm: 38, lengthCm: 64 },
    { label: 'XS',  ru: 42, chestCm: 84, shouldersCm: 40, lengthCm: 66 },
    { label: 'S',   ru: 44, chestCm: 88, shouldersCm: 42, lengthCm: 68 },
    { label: 'M',   ru: 46, chestCm: 92, shouldersCm: 44, lengthCm: 70 },
    { label: 'L',   ru: 48, chestCm: 96, shouldersCm: 46, lengthCm: 72 },
  ],
  // Низ (штаны, джинсы, джоггеры и т.п.)
  clothingBottom: [
    { label: 'XXS', ru: 40, waistCm: 60, hipsCm: 86, inseamCm: 76 },
    { label: 'XS',  ru: 42, waistCm: 64, hipsCm: 90, inseamCm: 78 },
    { label: 'S',   ru: 44, waistCm: 68, hipsCm: 94, inseamCm: 80 },
    { label: 'M',   ru: 46, waistCm: 72, hipsCm: 98, inseamCm: 82 },
    { label: 'L',   ru: 48, waistCm: 76, hipsCm: 102, inseamCm: 84 },
  ],
  shoes: [
    { eu: 35,   ru: 35,   us: 4.5, footCm: 22.5 },
    { eu: 35.5, ru: 35.5, us: 5,   footCm: 23.0 },
    { eu: 36,   ru: 36,   us: 5.5, footCm: 23.5 },
    { eu: 36.5, ru: 36.5, us: 6,   footCm: 23.8 },
    { eu: 37,   ru: 37,   us: 6.5, footCm: 24.0 },
    { eu: 38,   ru: 38,   us: 7.5, footCm: 24.5 },
    { eu: 39,   ru: 39,   us: 8,   footCm: 25.0 },
    { eu: 40,   ru: 40,   us: 8.5, footCm: 25.5 },
    { eu: 41,   ru: 41,   us: 9,   footCm: 26.0 },
    { eu: 42,   ru: 42,   us: 9.5, footCm: 26.5 },
    { eu: 43,   ru: 43,   us: 10,  footCm: 27.0 },
    { eu: 44,   ru: 44,   us: 10.5, footCm: 27.5 },
    { eu: 45,   ru: 45,   us: 11,  footCm: 28.0 },
  ],
  rings: [
    { size: 15, fingerCm: 4.7 },
    { size: 16, fingerCm: 5.0 },
    { size: 17, fingerCm: 5.3 },
    { size: 18, fingerCm: 5.6 },
    { size: 19, fingerCm: 5.9 },
  ],
  bracelets: [
    { size: 'XS', wristCm: 14 },
    { size: 'S',  wristCm: 16 },
    { size: 'M',  wristCm: 18 },
    { size: 'L',  wristCm: 20 },
    { size: 'XL', wristCm: 22 },
  ],
};



const BagVisualization = ({
  dimensions,
  product,
}: {
  dimensions: BagDimensions;
  product: Product;
}) => {
  const { width, height, depth } = dimensions;

  // Все значения ниже — в сантиметрах!
  const items = [
    { label: "iPhone 16", dimensions: { width: 7.15, height: 14.66, depth: 0.78 }, diagonal: 6.1 },
    { label: "iPhone 16 Pro Max", dimensions: { width: 7.78, height: 16.07, depth: 0.83 }, diagonal: 6.7 },
    { label: "MacBook Air 13", dimensions: { width: 30.41, height: 21.24, depth: 1.13 }, diagonal: 13.6 },
    { label: "Косметичка", dimensions: { width: 6, height: 9, depth: 4 }, diagonal: 3.5 },
    { label: "Книга (A5)", dimensions: { width: 14.8, height: 21, depth: 1 }, diagonal: 9.7 }
  ];

  const fittedItems = items.map(item => ({
    ...item,
    fits: item.dimensions.width <= width &&
          item.dimensions.height <= height &&
          item.dimensions.depth <= depth
  }));

  return (
    <div className="relative w-full bg-white rounded-xl p-6 flex flex-col items-center gap-6">
      <div className="relative w-60 h-60 rounded-xl overflow-visible">
        <Image
          src="/img/сумка (1).png"
          alt="Сумка"
          fill
          className="object-contain"
        />
      <div className="absolute right-[57px] top-[78px] flex flex-col items-center" style={{ transform: 'rotate(-6deg)' }}>
        <div className="w-[1.5px] h-[88px] bg-gray-500" />
        <span 
        className="text-xs text-gray-700 ml-2"
        style={{
          position: 'absolute',
          left: '6px',  
          top: '50%',  
          transform: 'translateY(-50%)'
        }}
      >
        {depth} см
      </span>
    </div>
        <div className="absolute bottom-[33px] left-[13%] flex flex-col items-center" style={{ transform: 'rotate(8deg)' }}>
          <div className="w-[115px] h-px bg-gray-500" />
          <span className="mt-1 text-xs text-gray-700">{height} см</span>
        </div>
        <div className="absolute right-[40px] bottom-[40px] flex flex-col items-center" style={{ transform: 'rotate(-45deg)' }}>
        <div className="w-[36px] h-px bg-gray-500" />
        <span className="mt-1 text-xs text-gray-700 ml-[8px] flex items-baseline" style={{ transform: 'rotate(45deg)' }}>
          {width}<span className="ml-[1px] text-[0.65rem]">см</span>
        </span>
      </div>
      </div>
    </div>
  );
};

const ItemCheck = ({ ok, label, size }: { 
  ok: boolean; 
  label: string; 
  size?: string 
}) => (
  <li className="flex items-start gap-3 min-w-[200px]">
    <div className="mt-1">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${
        ok ? 'bg-green-500' : 'bg-red-500'
      }`}>
        {ok ? '✓' : '✕'}
      </div>
    </div>
    <div className="flex flex-col w-full">
      <div className="flex justify-between items-center w-full">
        <p className="font-medium">{label}</p>
        {size && <p className="text-sm text-gray-600 whitespace-nowrap">{size}</p>}
      </div>
    </div>
  </li>
);





const SizeChartTable = ({
  rows,
  matchKey,
  selectedSize
}: {
  rows: any[];
  matchKey: string;
  selectedSize: string | number | null;
}) => (
  <table className="w-full text-sm text-left border border-gray-300 bg-white rounded-md shadow">
    <thead className="bg-gray-100 text-xs uppercase text-gray-600">
      <tr>
        {Object.keys(rows[0]).map((key) => {
          let label: string;
          switch (key) {
            case 'label':
              label = 'РАЗМЕР';
              break;
            case 'ru':
              label = '🇷🇺 RUS';
              break;
            case 'eu':
              label = '🇪🇺 EU';
              break;
            case 'us':
              label = '🇺🇸 US';
              break;
            case 'chestCm':
              label = 'ГРУДЬ, СМ';
              break;
            case 'shouldersCm':
              label = 'ПЛЕЧИ, СМ';
              break;
            case 'lengthCm':
              label = 'ДЛИНА ИЗДЕЛИЯ, СМ';
              break;
            case 'waistCm':
              label = 'ТАЛИЯ, СМ';
              break;
            case 'hipsCm':
              label = 'БЁДРА, СМ';
              break;
            case 'inseamCm':
              label = 'ДЛИНА НОГИ, СМ';
              break;
            case 'footCm':
              label = 'ДЛИНА СТОПЫ, СМ';
              break;
            case 'wristCm':
              label = 'ОБХВАТ ЗАПЯСТЬЯ, СМ';
              break;
            case 'fingerCm':
              label = 'ОБХВАТ ПАЛЬЦА, СМ';
              break;
            default:
              label = key.toUpperCase();
          }
          return (
            <th key={key} className="px-3 py-2 border">
              {label}
            </th>
          );
        })}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => {
        const isActive =
          selectedSize != null && String(row[matchKey]) === String(selectedSize);

        return (
          <tr
            key={i}
            className={`transition-colors border ${
              isActive ? 'bg-blue-100 font-semibold' : ''
            }`}
          >
            {Object.values(row).map((value, j) => (
              <td key={j} className="px-3 py-2 border">{String(value)}</td>
            ))}
          </tr>
        );
      })}
    </tbody>
  </table>
);

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const productId = isNaN(Number(id)) ? -1 : Number(id);
  const [product, setProduct] = useState<Product | null>(null);
  // сырой объект из API, без normalizeProduct — нужен как безопасный источник размеров/объёма
  const [rawProduct, setRawProduct] = useState<any | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Всегда начинаем просмотр товара с вершины страницы
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [productId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [oneRes, listRes] = await Promise.all([
          fetch(`/api/products/${productId}?include=relations`),
          fetch(`/api/products`),
        ]);
        const oneJson = oneRes.ok ? await oneRes.json() : null;
        const listJson = listRes.ok ? await listRes.json() : null;

        // Нормализованный товар с бэка
        const p = oneJson?.product ? normalizeProduct(oneJson.product) : null;
        const raw = oneJson?.product ?? null;

        // Цветовые варианты приходят отдельным полем из API — аккуратно пробрасываем их в объект товара
        const serverColorVariants = Array.isArray(oneJson?.colorVariants)
          ? oneJson.colorVariants
          : [];

        if (p && serverColorVariants.length) {
          (p as any).colorVariants = serverColorVariants;
        }
        if (raw && serverColorVariants.length) {
          (raw as any).colorVariants = serverColorVariants;
        }

        const list = Array.isArray(listJson?.products)
          ? listJson.products.map((item: any) => normalizeProduct(item))
          : [];

        if (!cancelled) {
          setRawProduct(raw);
          setProduct(p);
          setAllProducts(list);
          setDisplayedImages(
            p?.images?.length ? p.images : p?.imageUrl ? [p.imageUrl] : []
          );
          setLoading(false);
        }
      } catch (e) {
        console.error('[product page] load failed:', e);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [productId]);
  // Premium flag
  const isPremium = Boolean((product as any)?.premium);
  // Remember section, gender and last viewed product for header logo navigation
  useEffect(() => {
    try {
      // premium / default
      sessionStorage.setItem('lastSection', isPremium ? 'premium' : 'default');

      // gender: 'men' | 'women' | 'unisex' (fallback to 'unisex' if нет)
      const g = (product as any)?.gender;
      const safeGender = typeof g === 'string' && g.length ? g : 'unisex';
      sessionStorage.setItem('lastGender', safeGender);

      // last viewed product id (для возврата к конкретному товару в списке)
      if (product?.id) {
        sessionStorage.setItem('lastProductId', String(product.id));
      }
    } catch {
      // ignore storage errors (Safari private mode и т.д.)
    }
  }, [isPremium, product?.id, product]);
  // Normalize brand names for badges (supports product.brand or product.brands)
  const productBrands: string[] = React.useMemo(() => {
    const src = (product as any)?.brands ?? (product as any)?.brand;
    if (Array.isArray(src)) return src.filter(Boolean);
    if (typeof src === "string" && src) return [src];
    return [];
  }, [product]);
const primaryBrand: string | null = React.useMemo(() => (productBrands[0] ?? null), [productBrands]);
const brandLogoSrc: string | undefined = (product as any)?.brandLogo;
const { addToCart } = useCart();
const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
const [displayedImages, setDisplayedImages] = useState<string[]>([]);
const [isFavProduct, setIsFavProduct] = useState(false);
const { user } = useUser();

  // Sticky header state and refs
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyHeader(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
      }
    );

    if (titleRef.current) {
      observer.observe(titleRef.current);
    }

    return () => {
      if (titleRef.current) {
        observer.unobserve(titleRef.current);
      }
    };
  }, []);


  const getPriceBySize = () => {
    if (!product) return 0;
    if (!selectedSize) return product.price;

    const sourceSizes: any =
      (product as any)?.sizes ??
      (rawProduct as any)?.sizes ??
      null;

    const prices = sourceSizes?.prices as Record<string, number> | undefined;
    if (prices && typeof prices === "object") {
      const key = String(selectedSize);
      const value = prices[key];
      if (typeof value === "number") {
        return value;
      }
    }

    return product.price;
  };
  const getMinPriceInfo = (p: Product | null | undefined) => {
    if (!p) return { price: 0, sizeLabel: null as string | null };
    const priceMap = (p as any)?.sizes?.prices;
    if (priceMap && typeof priceMap === 'object') {
      const entries = Object.entries(priceMap).filter(
        ([, value]) => typeof value === 'number'
      ) as Array<[string, number]>;
      if (entries.length > 0) {
        let minEntry = entries[0];
        for (let i = 1; i < entries.length; i++) {
          if (entries[i][1] < minEntry[1]) {
            minEntry = entries[i];
          }
        }
        const [sizeLabel, price] = minEntry;
        return { price, sizeLabel };
      }
    }
    return { price: p.price, sizeLabel: null as string | null };
  };

  const relatedColorProducts: ColorVariant[] = React.useMemo(() => {
    if (!product) return [];

    // 1) Нормальный путь — используем colorVariants, которые вернул API для этого товара
    const fromApi = (product as any).colorVariants as any[] | undefined;

    if (Array.isArray(fromApi) && fromApi.length) {
      return fromApi
        .filter((v) => v && typeof v.id === 'number' && v.id !== product.id)
        .map((v) => {
          const images: string[] = Array.isArray(v.images) && v.images.length
            ? v.images
            : v.imageUrl
            ? [String(v.imageUrl)]
            : [];

          return {
            id: Number(v.id),
            name: String(v.name ?? ''),
            price: typeof v.price === 'number' ? v.price : product.price,
            images,
          };
        });
    }

    // 2) Fallback — старое поведение по имени, но только внутри той же категории
    const baseName = product.name?.split('(')[0]?.trim() ?? '';

    return allProducts
      .filter(
        (p) =>
          p.id !== product.id &&
          p.category === product.category &&
          p.name.startsWith(baseName)
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        images: p.images,
      }));
  }, [product, allProducts]);

  // States
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [bestsellerProducts, setBestsellerProducts] = useState<Product[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | number | null>(() => {
    const sizeData = (product as any)?.sizes?.available;
    return sizeData && sizeData.length > 0 ? sizeData[0] : null;
  });
  const [showError, setShowError] = useState(false);
  const [cartStatus, setCartStatus] = useState<
    "default" | "pending" | "canceled" | "added"
  >("default");
  const [showMobileBar, setShowMobileBar] = useState(true);
  const [showBadgeText, setShowBadgeText] = useState(false);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showBadgeText) return;
      if (badgeRef.current && !badgeRef.current.contains(event.target as Node)) {
        setShowBadgeText(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showBadgeText]);
  useEffect(() => {
    // Авто-показ бейджа при заходе на страницу товара
    setShowBadgeText(true);
    const timer = setTimeout(() => {
      setShowBadgeText(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [galleryProgress, setGalleryProgress] = useState(0);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const [showSizeChart, setShowSizeChart] = useState(false);
  // Restock notify modal state
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockEmail, setRestockEmail] = useState("");
  const [restockTouched, setRestockTouched] = useState(false);
  const emailValid = React.useMemo(() => /^(?:[a-zA-Z0-9_.'%+-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(restockEmail), [restockEmail]);
  // Restock size state and available sizes helper
  const [restockSize, setRestockSize] = useState<string | number | null>(null);
  const availableSizes: Array<string | number> = React.useMemo(() => {
    const fromProduct = (product as any)?.sizes?.available;
    const fromRaw = (rawProduct as any)?.sizes?.available;

    const src = fromProduct ?? fromRaw ?? [];
    return Array.isArray(src) ? (src as Array<string | number>) : [];
  }, [product, rawProduct]);
  const { showToast } = useToast();
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  // Delivery modal state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  // Moscow availability modal state
  const [showMoscowModal, setShowMoscowModal] = useState(false);
  // Brand logo tooltip state
  const [showBrandTooltip, setShowBrandTooltip] = useState(false);

  // Brand center overlay + slide-up panel
  const [brandPanelOpen, setBrandPanelOpen] = useState(false);
  const brandOverlayTimeout = useRef<NodeJS.Timeout | null>(null);

  const openBrandPanel = () => {
    if (brandOverlayTimeout.current) clearTimeout(brandOverlayTimeout.current);
    setBrandPanelOpen(true);
  };
  const scheduleCloseBrandPanel = (delay = 200) => {
    if (brandOverlayTimeout.current) clearTimeout(brandOverlayTimeout.current);
    brandOverlayTimeout.current = setTimeout(() => setBrandPanelOpen(false), delay);
  };

  
  const sizeRefs = useRef<Record<string | number, HTMLButtonElement | null>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);
  const scrollRaf = useRef<number | null>(null);
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 300], [0, -70]);
  const heroFade = useTransform(scrollY, [0, 200], [1, 0.85]);

useEffect(() => {
  if (!product?.id) return;
  try {
    const raw = localStorage.getItem("favoriteProducts");
    const arr: any[] = raw ? JSON.parse(raw) : [];
    const exists = Array.isArray(arr) && arr.some((p) => String(p.id) === String(product.id));
    setIsFavProduct(Boolean(exists));
  } catch {
    setIsFavProduct(false);
  }
}, [product?.id]);


// Touch detection (used for mobile swiper)
useEffect(() => {
  const detect = () => {
    try {
      const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
      const touchCapable =
        ("ontouchstart" in window) ||
        ((navigator as any)?.maxTouchPoints ?? 0) > 0 ||
        ((navigator as any)?.msMaxTouchPoints ?? 0) > 0;
      const small = window.matchMedia?.("(max-width: 767px)")?.matches ?? false;
      setIsTouchDevice(Boolean(coarse || touchCapable || small));
    } catch {
      setIsTouchDevice(true);
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

// Persist current product in "recently viewed" (localStorage)
useEffect(() => {
  if (!product?.id) return;
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [String(product.id), ...list.filter((id) => id !== String(product.id))].slice(0, 12);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}, [product?.id]);

// Build recentProducts from ids stored in localStorage (preserve order, exclude current product)
useEffect(() => {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids) || ids.length === 0) {
      setRecentProducts([]);
      return;
    }
    const map = new Map<string, Product>(allProducts.map((p) => [String(p.id), p as Product]));
    const items: Product[] = [];
    ids.forEach((id) => {
      const key = String(id);
      if (key === String(product?.id)) return;
      const found = map.get(key);
      if (found) items.push(found);
    });
    setRecentProducts(items);
  } catch {
    setRecentProducts([]);
  }
}, [allProducts, product?.id]);

useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    if (brandOverlayTimeout.current) clearTimeout(brandOverlayTimeout.current);
    if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
  };
}, []);

useEffect(() => {
  lastScrollY.current = typeof window !== 'undefined' ? window.scrollY : 0;
  const handleScroll = () => {
    if (scrollRaf.current) return;
    scrollRaf.current = window.requestAnimationFrame(() => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      if (Math.abs(delta) > 6) {
        if (delta > 0 && currentY > 120) {
          setShowMobileBar(false);
        } else {
          setShowMobileBar(true);
        }
        lastScrollY.current = currentY;
      }
      scrollRaf.current = null;
    });
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', handleScroll);
    if (scrollRaf.current) {
      cancelAnimationFrame(scrollRaf.current);
      scrollRaf.current = null;
    }
  };
}, []);

  const handleGalleryScroll = () => {
    const el = galleryRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) {
      setGalleryProgress(0);
      return;
    }
    setGalleryProgress(el.scrollLeft / maxScroll);
  };

  useEffect(() => {
    // Автовыбор первого доступного размера (если есть) и приведение типов
    if (!product) return;
    const avail = availableSizes.map(String);
    if (avail.length === 0) {
      setSelectedSize(null);
      return;
    }
    // Если текущий selectedSize отсутствует или тип не совпадает — выставляем первый доступный
    if (selectedSize == null || !avail.includes(String(selectedSize))) {
      setSelectedSize((availableSizes as any)[0] ?? null);
    }
  }, [product, availableSizes]);

  useEffect(() => {
    if (!product) return;
    let cancelled = false;

    const fallbackSimilar = () => {
      const basePool = allProducts.filter((p) => p.id !== product.id && p.category === (product as any).category);
      const onlyPremium = Boolean((product as any)?.premium);
      const pool: Product[] = onlyPremium
        ? (basePool.filter((p) => Boolean((p as any)?.premium)) as Product[])
        : (basePool.filter((p) => !Boolean((p as any)?.premium)) as Product[]);

      const currentGender = (product as any)?.gender as string | undefined;
      let prioritized: Product[];
      if (currentGender) {
        const same = pool.filter((p) => (p as any)?.gender === currentGender) as Product[];
        const other = pool.filter((p) => (p as any)?.gender !== currentGender) as Product[];
        prioritized = [...shuffle(same), ...shuffle(other)].slice(0, 10);
      } else {
        prioritized = shuffle(pool).slice(0, 10);
      }
      if (!cancelled) setSimilarProducts(prioritized);
    };

    const loadPersonalized = async () => {
      try {
        const sessionId = getOrCreateEventsSessionId();
        const categoryId = Number((rawProduct as any)?.categoryId);
        const params = new URLSearchParams({
          limit: "10",
          exclude: String(product.id),
          seed: String(Date.now()),
          sessionId,
        });
        if (Number.isFinite(categoryId) && categoryId > 0) {
          params.set("categoryId", String(categoryId));
        }

        const res = await fetch(`/api/recommendations/personal?${params.toString()}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("recommendations");
        const data = await res.json().catch(() => ({} as any));
        const items = Array.isArray(data?.items) ? data.items : [];
        const normalized = items.map((item: any) => normalizeProduct(item));
        if (!normalized.length) {
          fallbackSimilar();
          return;
        }
        if (!cancelled) {
          setSimilarProducts(normalized.slice(0, 10));
        }
      } catch {
        fallbackSimilar();
      }
    };

    loadPersonalized();
    return () => {
      cancelled = true;
    };
  }, [product, rawProduct, allProducts]);

  useEffect(() => {
    if (!product?.id) return;

    void trackShopEvent({
      eventType: "PRODUCT_VIEW",
      productId: product.id,
      metadata: {
        brandId: (rawProduct as any)?.brandId ?? null,
        categoryId: (rawProduct as any)?.categoryId ?? null,
      },
    }).catch(() => {});
  }, [product?.id, rawProduct]);

  useEffect(() => {
    let cancelled = false;

    const fallback = () => {
      const fallbackItems = allProducts.filter((p) => !p.premium).slice(0, 10);
      if (!cancelled) setBestsellerProducts(fallbackItems);
    };

    const loadBestsellers = async () => {
      try {
        const res = await fetch(`/api/recommendations/bestsellers?limit=10&days=90`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("bestsellers");
        const data = await res.json().catch(() => ({} as any));
        const items = Array.isArray(data?.items) ? data.items : [];
        const normalized = items.map((item: any) => normalizeProduct(item));
        if (!normalized.length) {
          fallback();
          return;
        }
        if (!cancelled) setBestsellerProducts(normalized.slice(0, 10));
      } catch {
        fallback();
      }
    };

    loadBestsellers();
    return () => {
      cancelled = true;
    };
  }, [allProducts]);

// Основная логика добавления товара
const handleAddToCart = () => {
  if (!product) return;

  if (requiresSizeSelection() && !selectedSize) {
    setShowError(true);
    return;
  }

  setCartStatus("pending");

  if (timerRef.current) clearTimeout(timerRef.current);
  if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);

  timerRef.current = setTimeout(() => {
    addToCart({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: currentPrice,
      image: displayedImages?.[0] ?? product.images?.[0] ?? "/img/fallback.jpg",
      size: selectedSize != null ? String(selectedSize) : undefined,
    });
    showToast({
      title: product.name,
      details: `${selectedSize ?? "—"} · ${currentPrice.toLocaleString('ru-RU')}₽`
    });
    setCartStatus("added");
    cancelTimerRef.current = setTimeout(() => {
      setCartStatus("default");
    }, 2800); 
  }, 2800); 
};

const handleToggleFavorite = () => {
  if (!user) {
    showToast({ title: "Только для зарегистрированных", details: "Перейдите к регистрации, чтобы добавлять избранное" });
    return;
  }
  if (!product) return;
  const favItem = {
    id: product.id,
    name: product.name,
    price: currentPrice,
    size: selectedSize != null ? selectedSize : undefined,
    imageUrl: displayedImages?.[0] ?? product.images?.[0] ?? product.imageUrl ?? null,
    brand: primaryBrand ?? null,
  };
  try {
    const raw = localStorage.getItem("favoriteProducts");
    const arr: any[] = raw ? JSON.parse(raw) : [];
    const exists = Array.isArray(arr) && arr.some((p) => String(p.id) === String(favItem.id));
    let next: any[] = Array.isArray(arr) ? [...arr] : [];
    if (exists) {
      next = next.filter((p) => String(p.id) !== String(favItem.id));
      setIsFavProduct(false);
      showToast({ title: "Убрано из избранного", details: favItem.name });
    } else {
      next.push(favItem);
      setIsFavProduct(true);
      showToast({ title: "Добавлено в избранное", details: favItem.name });
    }
    localStorage.setItem("favoriteProducts", JSON.stringify(next));
    try {
      window.dispatchEvent(new Event("favorites:products:update"));
    } catch {}
  } catch {
    // ignore storage errors
  }
};

const handleCancel = () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);

  setCartStatus("canceled");

  cancelTimerRef.current = setTimeout(() => {
    setCartStatus("default");
  }, 3000);
};
  const handleSizeSelect = (size: string | number) => {
    setShowError(false);
    const available: Array<string | number> | undefined = (product as any)?.sizes?.available;
    const isAvailable = Array.isArray(available) ? available.map(String).includes(String(size)) : true;
    if (!isAvailable) {
      // Открываем модалку подписки на поступление и запоминаем желаемый размер
      setRestockSize(size);
      setShowRestockModal(true);
      // Не выбираем недоступный размер
      return;
    }
    setSelectedSize(size);
  };


  const toggleSizeChart = () => setShowSizeChart(prev => !prev);

  const handleRestockSubmit = () => {
    if (!emailValid || !product) return;
    try {
      const key = 'restockRequests';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift({
        productId: product.id,
        productName: product.name,
        size: restockSize,
        email: restockEmail,
        time: Date.now(),
      });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 100)));
      setShowRestockModal(false);
      setRestockTouched(false);
    } catch (_) {
      setShowRestockModal(false);
    }
  };

  // Helper functions
  const requiresSizeSelection = () => {
    if (!product) return false;

    const sizesObj: any =
      (product as any)?.sizes ??
      (rawProduct as any)?.sizes ??
      null;
    const hasAvailableSizes =
      sizesObj &&
      Array.isArray(sizesObj.available) &&
      sizesObj.available.length > 0;

    if (!hasAvailableSizes) return false;

    if (product.category === "clothing" || product.category === "clothes") return true;
    if (product.category === "shoes") return true;
    if (product.category === "jewelry" && product.jewelryType === "ring") return true;
    if (product.category === "perfume" || product.category === "fragrance") return true;

    return false;
  };

  const renderSizeSelector = () => {
    if (!product) return null;

    const sizes =
      (product as any)?.sizes ??
      (rawProduct as any)?.sizes ??
      null;
    if (!sizes) return null;

    const isBag = product.category === 'bags';

    return (
      <div
        className={
          isBag
            ? 'w-full max-w-full overflow-x-auto px-2 sm:px-0'
            : 'w-full max-w-full overflow-x-auto px-2 sm:px-0'
        }
      >
        <SizeSelector
          type={(product.category === 'fragrance' ? 'perfume' : product.category) as 'clothing' | 'shoes' | 'jewelry' | 'perfume'}
          sizes={sizes}
          selectedSize={selectedSize}
          onSelect={handleSizeSelect}
        />
      </div>
    );
  };

  const renderSizeChartTable = () => {
    if (!product) return null;

    switch (product.category) {
      case 'clothing':
      case 'clothes': {
        const name = product.name?.toLowerCase() ?? '';
        const sub = ((product as any).subcategory ?? '').toString().toLowerCase();
        const text = `${name} ${sub}`;

        const isBottom = /джинс|брюк|штан|pants|shorts|шорты|джоггер|jogger|cargo|карго/.test(text);
        const rows = isBottom ? sizeCharts.clothingBottom : sizeCharts.clothingTop;

        return (
          <SizeChartTable
            rows={rows}
            matchKey="label"
            selectedSize={selectedSize}
          />
        );
      }
      case 'shoes': {
        const normalizedShoesSize =
          selectedSize != null
            ? parseFloat(
                String(selectedSize)
                  .replace(/,/g, '.')
                  .replace(/[^0-9.]/g, ''),
              )
            : null;

        return (
          <SizeChartTable
            rows={sizeCharts.shoes}
            matchKey="eu"
            selectedSize={normalizedShoesSize}
          />
        );
      }
      case 'jewelry': {
          const type = product.jewelryType;
        if (type === 'ring')
          return (
            <SizeChartTable
              rows={sizeCharts.rings}
              matchKey="size"
              selectedSize={selectedSize}
            />
          );
        if (type === 'bracelet')
          return (
            <SizeChartTable
              rows={sizeCharts.bracelets}
              matchKey="size"
              selectedSize={selectedSize}
            />
          );
        break;
      }
      default:
        return null;
    }
  };

  const renderBagDimensions = () => {
    if (!product || product.category !== 'bags') return null;

    const dims = (product as any).dimensions as BagDimensions | undefined | null;
    if (!dims) return null;

    return (
      <BagVisualization
        dimensions={dims}
        product={product}
      />
    );
  };

  // Define fittedItems for bags only (все значения — в сантиметрах)
  const fittedItems =
    product?.category === 'bags' && (product as any).dimensions
      ? (() => {
          const dims = (product as any).dimensions as BagDimensions;

          return [
            { label: "iPhone 16", dimensions: { width: 7.15, height: 14.66, depth: 0.78 }, diagonal: 6.1 },
            { label: "iPhone 16 Pro Max", dimensions: { width: 7.78, height: 16.07, depth: 0.83 }, diagonal: 6.7 },
            { label: "MacBook Air 13", dimensions: { width: 30.41, height: 21.24, depth: 1.13 }, diagonal: 13.6 },
            { label: "Косметичка", dimensions: { width: 6, height: 9, depth: 4 }, diagonal: 3.5 },
            { label: "Книга (A5)", dimensions: { width: 14.8, height: 21, depth: 1 }, diagonal: 9.7 },
          ]
            .sort((a, b) => a.diagonal - b.diagonal)
            .map((item) => ({
              ...item,
              fits:
                item.dimensions.width <= dims.width &&
                item.dimensions.height <= dims.height &&
                item.dimensions.depth <= dims.depth,
            }));
        })()
      : [];
  const currentPrice = getPriceBySize();
  const oldPriceValue = product ? ((product as any).oldPrice as number | undefined) : undefined;
  const showOldPrice = typeof oldPriceValue === 'number' && oldPriceValue > currentPrice;

  // Объём флакона для духов (ml)
  const perfumeVolume = React.useMemo(() => {
    if (
      !product ||
      (product.category !== "perfume" && product.category !== "fragrance")
    )
      return null;

    const anyProduct: any = product;
    const anyRaw: any = rawProduct;

    // 1) Если в sizes.available ровно одно значение — считаем его объёмом (например [100])
    const fromSizes =
      anyProduct?.sizes?.available ??
      anyRaw?.sizes?.available ??
      null;
    if (Array.isArray(fromSizes) && fromSizes.length === 1) {
      return fromSizes[0];
    }

    // 2) Иначе пробуем взять явное поле из нормализованного продукта / БД
    if (typeof anyProduct.volumeMl === "number") return anyProduct.volumeMl;
    if (typeof anyProduct.volume === "number") return anyProduct.volume;
    if (typeof anyRaw?.volumeMl === "number") return anyRaw.volumeMl;
    if (typeof anyRaw?.volume === "number") return anyRaw.volume;

    return null;
  }, [product, rawProduct]);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-xl text-gray-500">Загрузка товара...</p>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-xl text-gray-500">Товар не найден</p>
        <Link href="/" className="text-blue-600 underline ml-2">На главную</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow pt-6 md:pt-20 pb-32 md:pb-20 lg:pb-24 px-3 sm:px-6 lg:px-8 mx-auto w-full max-w-[1800px] relative z-10">

        <AnimatePresence>
          {showStickyHeader && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.3 }}
              className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-md"
            >
              <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4 py-2 px-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded overflow-hidden">
                    <Image
                      src={displayedImages[0] ?? "/img/fallback.jpg"}
                      alt={product.name}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-1">{product.name}</p>
                    <p className="text-sm text-gray-600">
                      {currentPrice.toLocaleString('ru-RU')}₽
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAddToCart}
                  className="text-sm px-4 py-2"
                >
                  В корзину
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Premium badge mouse position handler */}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 items-start w-full max-w-none gap-10 lg:gap-12">
          {/* Product gallery (desktop / tablet + mobile) */}
          <motion.div
            className="relative w-full h-auto overflow-visible"
            initial={{ opacity: 0, y: 55, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            style={{ y: heroParallax, opacity: heroFade }}
          >
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-pressed={isFavProduct}
              className="absolute top-4 right-4 z-[50] bg-transparent p-0 hover:scale-110 transition outline-none focus:outline-none"
              aria-label="Добавить в избранное"
            >
              <div className="w-10 h-10 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow">
                <Heart
                  className={`h-5 w-5 transition-colors ${
                    isFavProduct ? "text-red-500" : "text-gray-700"
                  }`}
                  strokeWidth={1.7}
                  fill={isFavProduct ? "currentColor" : "none"}
                />
              </div>
            </button>
            {primaryBrand && (
              <>
                {/* Centered brand logo overlay */}
                <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-start justify-center">
                  <motion.button
                    type="button"
                    onMouseEnter={openBrandPanel}
                    onMouseLeave={() => scheduleCloseBrandPanel(220)}
                    onFocus={openBrandPanel}
                    onBlur={() => scheduleCloseBrandPanel(220)}
                    onClick={() => setBrandPanelOpen((v) => !v)}
                    className="pointer-events-auto rounded-xl border border-gray-200 bg-white/40 backdrop-blur px-3 py-3 shadow-lg hover:shadow-xl transition-all duration-300"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    {brandLogoSrc ? (
                      <div className="relative w-[140px] h-[56px]">
                        <Image src={brandLogoSrc} alt={primaryBrand!} fill className="object-contain" />
                      </div>
                    ) : (
                      <span className="text-sm font-semibold tracking-tight text-black">{primaryBrand}</span>
                    )}
                  </motion.button>
                </div>

                {/* Slide-up brand panel at the TOP of gallery */}
                <AnimatePresence>
                  {brandPanelOpen && (
                    <motion.div
                      key="brand-panel"
                      initial={{ y: -40, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -40, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                      className="absolute left-0 right-0 z-20 px-4 mt-2 top-[120px] pointer-events-auto"
                      onMouseEnter={openBrandPanel}
                      onMouseLeave={() => scheduleCloseBrandPanel(220)}
                    >
                      <Link
                        href={`/brand/${encodeURIComponent(((product as any)?.brandSlug) || (primaryBrand ? brandSlugFrom(primaryBrand) : ''))}${(product as any)?.gender ? `?gender=${encodeURIComponent((product as any).gender)}` : ''}`}
                        className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-xl transition flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          {brandLogoSrc ? (
                            <div className="relative w-9 h-6">
                              <Image src={brandLogoSrc} alt={primaryBrand!} fill className="object-contain" />
                            </div>
                          ) : (
                            <span className="text-sm font-semibold">{primaryBrand}</span>
                          )}
                          <span className="text-sm font-medium">Ещё больше от этого бренда</span>
                        </div>
                        <motion.span
                          aria-hidden
                          initial={{ x: 0 }}
                          animate={{ x: [0, 6, 0] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                          className="text-xl leading-none pr-1"
                        >
                          →
                        </motion.span>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
                        <motion.div
              ref={badgeRef}
              className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-sm border border-black/10 shadow-lg z-40 cursor-pointer px-2 py-1 select-none"
              onClick={(e) => {
                e.stopPropagation();
                setShowBadgeText((prev) => !prev);
              }}
              aria-label="Все товары в StageStore строго оригинальные"
            >
              <motion.div
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: showBadgeText ? 1.05 : 1, opacity: 1 }}
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="relative w-5 h-5 flex items-center justify-center flex-shrink-0"
              >
                <Image
                  src="/img/галочка 2.png"
                  alt="Оригинальный товар"
                  width={18}
                  height={18}
                  className="block object-contain"
                  priority={false}
                />
              </motion.div>

              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxWidth: showBadgeText ? 320 : 0,
                  opacity: showBadgeText ? 1 : 0,
                }}
              >
                <span className="text-[11px] sm:text-xs text-gray-800 leading-snug whitespace-nowrap">
                  Все товары в StageStore строго оригинальные.
                </span>
              </div>
            </motion.div>
            {/* Product images slider or fallback */}
            {product.images && product.images.length > 0 ? (
              <>
                <div
                  ref={galleryRef}
                  onScroll={handleGalleryScroll}
                  className="w-full h-[320px] sm:h-[440px] lg:h-[500px] mt-10 overflow-x-auto overflow-y-hidden whitespace-nowrap cursor-grab active:cursor-grabbing gallery-scroll"
                >
                  {product.images.map((url, index) =>
                    url ? (
                      <div
                        key={index}
                        className="inline-block align-top w-full h-full mr-4 last:mr-0"
                      >
                        <div className="w-full h-full rounded-lg bg-white flex items-center justify-center overflow-hidden">
                          <Image
                            src={url as string}
                            alt={`Product image ${index + 1}`}
                            width={800}
                            height={800}
                            className="object-contain w-full h-full select-none pointer-events-none"
                            draggable={false}
                          />
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
                {product.images.length > 1 && (
                  <div className="mt-4 px-6 sm:px-10">
                    <div className="h-[2px] w-full bg-black/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black/60 rounded-full transition-[width] duration-150 ease-out"
                        style={{ width: `${Math.max(0, Math.min(1, galleryProgress)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <style jsx>{`
                  .gallery-scroll::-webkit-scrollbar {
                    display: none;
                  }
                  .gallery-scroll {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                  }
                `}</style>
              </>
            ) : (
              product.imageUrl && (
                <div className="w-full h-[320px] sm:h-[440px] lg:h-[500px] mt-10 rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <Image
                    src={product.imageUrl as string}
                    alt={product.name}
                    width={800}
                    height={800}
                    className="object-contain w-full h-full"
                  />
                </div>
              )
            )}
            {/* Trust Block — под слайдером (desktop) */}
            <div className="hidden lg:block w-full mt-10 mb-10 px-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="w-full rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-md px-3 py-3 sm:px-5 sm:py-5 md:px-7 md:py-6 flex flex-col gap-3"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>

                  <div className="space-y-2 max-w-2xl">
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-500">
                      Гарантии StageStore
                    </p>

                    <h3 className="text-lg md:text-xl font-semibold text-gray-900">
                      Только оригинальные товары. Ответственность на всех этапах заказа.
                    </h3>

                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                      Мы работаем только с проверенными поставщиками, фиксируем каждый этап движения пары и вручную проверяем коробку,
                      комплектацию и состояние товара перед отправкой. Если с заказом что-то идёт не так, мы берём ответственность на себя
                      и сопровождаем вас до фактического получения и проверки покупки.
                    </p>
                    <div className="hidden sm:block">
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">
                          Как мы контролируем каждый заказ:
                        </p>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                          {[
                            'Подбор у проверенного поставщика',
                            'Проверка пары и комплектации',
                            'Аккуратная упаковка',
                            'Передача в службу доставки',
                          ].map((label, index) => (
                            <motion.div
                              key={index}
                              whileHover={{ y: -2, scale: 1.02 }}
                              className="flex items-center gap-2"
                            >
                              <div className="w-6 h-6 rounded-full bg-black text-white text-[11px] flex items-center justify-center">
                                {index + 1}
                              </div>
                              <span className="text-[11px] sm:text-xs text-gray-700 max-w-[150px]">
                                {label}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Поддержка */}
                <div className="pt-1 flex flex-wrap items-center gap-1">
                  <span className="text-xs text-gray-500">Нужна помощь с заказом?</span>

                  <a
                    href="mailto:info@stagestore.ru"
                    className="px-2 py-1 rounded-full border border-gray-300 bg-white text-[10px] sm:text-xs font-medium text-gray-800 hover:bg-gray-50 transition"
                  >
                    Написать на почту
                  </a>

                  <a
                    href="https://t.me/i_like_drugs"
                    target="_blank"
                    className="px-2 py-1 rounded-full border border-gray-900 bg-black text-[10px] sm:text-xs font-medium text-white hover:bg-gray-900 transition"
                  >
                    Telegram поддержка
                  </a>
                </div>
              </motion.div>
            </div>
          </motion.div>
          <motion.div
            className="lg:sticky lg:top-8 space-y-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <div ref={titleRef} className="mb-2 pr-4">
              {/* Brand logo and name above product title */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[clamp(1.4rem,3.2vw,2.2rem)] font-bold text-black leading-tight">
                  {product.name}
                </h1>
                {isPremium && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-black border border-black/20 text-[11px] font-semibold shadow-sm"
                    aria-label="Товар премиум-категории"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                      <path d="M12 2.5l2.8 6.1 6.7.6-5.1 4.4 1.6 6.6L12 16.9 6 20.2l1.6-6.6-5.1-4.4 6.7-.6L12 2.5z"/>
                    </svg>
                    Premium
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center h-full">
                {(() => {
                  return (
                    <div className="flex items-center gap-3">
                      {showOldPrice && oldPriceValue && (
                        <span className="relative inline-block text-gray-400 text-3xl lg:text-4xl old-price-strike">
                          {oldPriceValue.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}₽
                          <span className="strike-3"></span>
                        </span>
                      )}
                      <p className="text-3xl lg:text-4xl font-bold text-black">
                        {currentPrice.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}₽
                      </p>
                      <style jsx>{`
                        .old-price-strike::before,
                        .old-price-strike::after {
                          content: '';
                          position: absolute;
                          left: 0;
                          width: 100%;
                          height: 2px;
                          background: rgba(239, 68, 68, 0.7);
                          pointer-events: none;
                        }
                        .old-price-strike::before {
                          top: 30%;
                          transform: rotate(-5deg);
                        }
                        .old-price-strike::after {
                          top: 62%;
                          transform: rotate(4deg);
                        }
                        .old-price-strike span.strike-3 {
                          position: absolute;
                          left: 0;
                          width: 100%;
                          height: 2px;
                          background: rgba(239, 68, 68, 0.7);
                          top: 52%;
                          transform: rotate(-13deg);
                          pointer-events: none;
                          content: '';
                          display: block;
                        }
                      `}</style>
                    </div>
                  );
                })()}
              </div>
            </div>
            {product && (
              <div className="p-4 md:p-6 border rounded-xl bg-gray-50 mt-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Image src="/img/информация.png" alt="Информация" width={24} height={24} />
                  <h3 className="text-lg lg:text-xl font-semibold">Описание товара</h3>
                </div>

                <div className="text-gray-700 text-sm leading-relaxed space-y-2">
                  {(() => {
                    const anyProduct: any = product;

                    // ---------- ДУХИ / АРОМАТЫ ----------
                    if (product.category === 'perfume' || product.category === 'fragrance') {
                      const notes = anyProduct.fragranceNotes ?? {};
                      const top: string[] = Array.isArray(notes.top) ? notes.top : [];
                      const middle: string[] = Array.isArray(notes.middle) ? notes.middle : [];
                      const base: string[] = Array.isArray(notes.base) ? notes.base : [];

                      // очень простая эвристика по времени и сезону
                      const allNotesText = [...top, ...middle, ...base].join(' ').toLowerCase();
                      const isFresh =
                        /цитрус|лимон|бергамот|лайм|зелень|морской|aquatic|фреш/.test(allNotesText);
                      const isSweet =
                        /ваниль|карамель|сладк|praline|тоффи/.test(allNotesText);
                      const isWarm =
                        /уд|амбра|мускус|сэндал|кедр|дерев|прян/.test(allNotesText);

                      let dayTime = 'подходит и для дня, и для вечера';
                      if (isFresh && !isWarm && !isSweet) {
                        dayTime = 'идеален для дневного ношения, офиса и повседневных выходов';
                      } else if (isWarm || isSweet) {
                        dayTime = 'лучше всего раскрывается вечером и на особых случаях';
                      }

                      let season = 'круглогодичный аромат';
                      if (isFresh && !isWarm) {
                        season = 'особенно хорошо звучит весной и летом';
                      } else if (isWarm || isSweet) {
                        season = 'максимально комфортен осенью и зимой';
                      }

                      return (
                        <>
                          {perfumeVolume && (
                            <p>
                              <strong>• Объём флакона:</strong> {perfumeVolume} мл
                            </p>
                          )}
                          {(top.length || middle.length || base.length) && (
                            <p>
                              <strong>• Основные ноты:</strong>{' '}
                              {[...top, ...middle, ...base].slice(0, 6).join(', ') || 'аккуратно сбалансированная композиция'}
                            </p>
                          )}
                          <p>
                            <strong>• Когда носить:</strong> {dayTime}
                          </p>
                          <p>
                            <strong>• Сезон:</strong> {season}
                          </p>
                          <p>
                            <strong>• Характер:</strong>{' '}
                            {anyProduct.sillageDescription ??
                              'стойкий аромат с мягким шлейфом, который раскрывается постепенно в течение дня'}
                          </p>
                        </>
                      );
                    }

                    // ---------- ЮВЕЛИРКА ----------
                    if (product.category === 'jewelry') {
                      const metal = anyProduct.metal ?? anyProduct.material ?? 'гипоаллергенный сплав';
                      const stones = anyProduct.stones ?? anyProduct.inserts ?? null;
                      const coating = anyProduct.coating ?? anyProduct.plating ?? null;
                      const jewelryType = anyProduct.jewelryType ?? 'украшение';

                      return (
                        <>
                          <p>
                            <strong>• Тип изделия:</strong> {jewelryType}
                          </p>
                          <p>
                            <strong>• Основной металл:</strong> {metal}
                          </p>
                          {stones && (
                            <p>
                              <strong>• Вставки / камни:</strong> {stones}
                            </p>
                          )}
                          {coating && (
                            <p>
                              <strong>• Покрытие:</strong> {coating}
                            </p>
                          )}
                          <p>
                            <strong>• Где уместно:</strong>{' '}
                            {anyProduct.occasion ??
                              'подходит как для повседневных образов, так и для вечерних выходов'}
                          </p>
                          <p>
                            <strong>• Уход:</strong> храните украшение отдельно от других,
                            избегайте контакта с водой, духами и бытовой химией — так покрытие дольше сохранит блеск.
                          </p>
                        </>
                      );
                    }

                    // ---------- СУМКИ ----------
                    if (product.category === 'bags') {
                      const outer = anyProduct.outerMaterial ?? anyProduct.material ?? 'натуральная или эко-кожа';
                      const inner = anyProduct.innerMaterial ?? 'плотная подкладка из текстиля';
                      const format = anyProduct.bagType ?? 'повседневная сумка';
                      const dims = anyProduct.dimensions;

                      return (
                        <>
                          <p>
                            <strong>• Формат:</strong> {format}
                          </p>
                          <p>
                            <strong>• Внешний материал:</strong> {outer}
                          </p>
                          <p>
                            <strong>• Внутренняя отделка:</strong> {inner}
                          </p>
                          {dims && typeof dims === 'object' && (
                            <p>
                              <strong>• Габариты:</strong>{' '}
                              {dims.width} × {dims.height} × {dims.depth} см
                            </p>
                          )}
                          <p>
                            <strong>• Вмещаемость:</strong>{' '}
                            {anyProduct.capacityDescription ??
                              'помещаются телефон, кошелёк, ключи и необходимые мелочи на каждый день'}
                          </p>
                          <p>
                            <strong>• Особенности:</strong>{' '}
                            {anyProduct.features ??
                              'регулируемый ремень, удобный доступ к основному отделению и аккуратная фурнитура'}
                          </p>
                        </>
                      );
                    }

                    // ---------- ОДЕЖДА / ОБУВЬ / ДРУГОЕ ----------
                    const material =
                      anyProduct.material ?? 'натуральная кожа / премиум текстиль';
                    const comfort =
                      anyProduct.features ??
                      'лёгкость, хорошая посадка и комфорт на каждый день';
                    const styleNotes =
                      anyProduct.styleNotes ??
                      'минималистичный дизайн, который просто сочетать с базовым гардеробом';

                    return (
                      <>
                        <p>
                          <strong>• Материалы:</strong> {material}
                        </p>
                        <p>
                          <strong>• Комфорт:</strong> {comfort}
                        </p>
                        <p>
                          <strong>• Дизайн:</strong> {styleNotes}
                        </p>
                      </>
                    );
                  })()}

                  {product.description && (
                    <p className="mt-2">
                      {product.description}
                    </p>
                  )}
                </div>
              </div>
            )}
            {product.category === 'bags' ? (
              <div className="space-y-6 mt-4">
                {/* Слайдер размеров - на всю ширину */}
                <div className="w-full">
                  {(product as unknown as BagProduct).sizes && (
                    <div className="w-full">
                      {renderSizeSelector()}
                    </div>
                  )}
                </div>

                {/* Ниже два блока в ряд */}
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Блок с анимацией размеров - занимает половину */}
                  <div className="lg:w-1/2">
                    {renderBagDimensions()}
                  </div>

                  {/* Блок "что помещается" - занимает вторую половину */}
                  <div className="lg:w-1/2 p-6 border rounded-xl bg-gray-50 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg lg:text-xl font-semibold">Что помещается в {product.name}</h3>
                    </div>
                    <ul className="space-y-2">
                      {fittedItems.map(item => (
                        <ItemCheck
                          key={item.label}
                          ok={item.fits}
                          label={item.label}
                          size={`${item.diagonal}"`}
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (requiresSizeSelection() && product.category !== 'bags') ? (
              <div className="space-y-4 mt-6">
                {renderSizeSelector()}
                {product.category !== 'perfume' && (
                  <p
                    onClick={toggleSizeChart}
                    className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    <span className="relative inline-block after:absolute after:left-0 after:bottom-0 after:w-full after:h-[1px] after:bg-gray-500 after:scale-x-0 hover:after:scale-x-100 after:origin-left after:transition-transform after:duration-300">
                      Таблица размеров
                    </span>
                  </p>
                )}
                <AnimatePresence>
                  {showSizeChart && product.category !== 'perfume' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="overflow-hidden"
                    >
                      {renderSizeChartTable()}
                    </motion.div>
                  )}
                </AnimatePresence>
                {showError && (
                  <p className="mt-2 text-red-600 text-sm animate-fadeIn">
                    ⚠ Выберите, пожалуйста, {product.category === 'perfume' || product.category === 'fragrance' ? 'объем' : 'размер'}
                  </p>
                )}
              </div>
            ) : null}
            {/* Delivery & Availability info */}
            {(() => {
              // Переключаем карточки по наличию конкретно выбранного размера в Москве
              const sizes: any = (product as any)?.sizes;
              const selectedKey = selectedSize != null ? String(selectedSize) : null;
              const moscowMap: Record<string, boolean> | undefined = sizes?.inStockMoscow as any;
              const moscowForSize: boolean | undefined = selectedKey && moscowMap ? moscowMap[String(selectedKey)] : undefined;

              // Если нужна выборка размера, но размер ещё не выбран — показываем подсказку
              if (requiresSizeSelection() && (selectedKey == null)) {
                return (
                  <div className="p-5 md:p-6 rounded-lg border border-gray-300 bg-white min-h-[88px] flex items-center">
                    <p className="text-sm sm:text-base text-gray-700">Пожалуйста, выберите размер, чтобы увидеть доступность и условия доставки.</p>
                  </div>
                );
              }

              // Если для выбранного размера есть наличие в Москве — показываем зелёную карточку.
              if (moscowForSize === true) {
                return (
                  <button
                    type="button"
                    onClick={() => setShowMoscowModal(true)}
                    className="flex items-center gap-4 p-5 md:p-6 rounded-lg w-full border bg-green-50 border-green-300 text-green-800 min-h-[88px] text-left hover:bg-green-100 transition"
                  >
                    <Image src="/img/1687.png" alt="В наличии" width={28} height={28} />
                    <p className="font-bold text-sm sm:text-base">
                      Этот размер сейчас в наличии в Москве
                    </p>
                  </button>
                );
              }

              // В остальных случаях — стандартный блок доставки (как раньше)
              return (
                <button
                  onClick={() => setShowDeliveryModal(true)}
                  className="flex items-center gap-4 p-5 md:p-6 bg-yellow-50 border border-yellow-300 rounded-lg w-full text-left hover:bg-yellow-100 transition min-h-[88px]"
                >
                  <Image src="/img/грузовик.png" alt="Иконка доставки" width={36} height={36} />
                  <p className="font-bold text-yellow-800 text-sm sm:text-base">
                    Доставка до 10 рабочих дней
                  </p>
                </button>
              );
            })()}
            {relatedColorProducts.length > 0 && (
              <div className="text-center my-6">
                <p className="text-center mb-2 text-sm text-gray-600">
                  <span className="font-semibold text-black">{product.name}</span> — другие расцветки:
                </p>
                <h3 className="text-lg font-semibold mb-4">Цвет</h3>
                <div className="flex justify-center flex-wrap gap-4">
                  {relatedColorProducts.map((colorProduct) => (
                    <Link
                      key={colorProduct.id}
                      href={`/product/${colorProduct.id}`}
                      className="group relative w-[140px] sm:w-[160px] aspect-square overflow-hidden rounded-xl shadow-lg"
                    >
                      <Image
                        src={colorProduct.images[0] || '/img/fallback.jpg'}
                        alt={colorProduct.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                        sizes="(max-width: 768px) 100vw, 25vw"
                        priority
                      />
                      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <p className="text-white text-sm font-semibold">{colorProduct.name}</p>
                        <p className="text-white text-xs">
                          {colorProduct.price.toLocaleString('ru-RU')}₽
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {(product.category === 'perfume' || product.category === 'fragrance') && (() => {
              const notes: any = (product as any)?.fragranceNotes ?? null;
              if (!notes) return null;

              const top: string[] = Array.isArray(notes.top) ? notes.top : [];
              const middle: string[] = Array.isArray(notes.middle) ? notes.middle : [];
              const base: string[] = Array.isArray(notes.base) ? notes.base : [];

              if (!top.length && !middle.length && !base.length) {
                // если ноты не заданы вообще — просто не показываем блок
                return null;
              }

              return (
                <div className="mt-6 space-y-1 text-sm text-gray-700">
                  <p>
                    <strong>Верхние ноты:</strong>{' '}
                    {top.length ? top.join(', ') : '—'}
                  </p>
                  <p>
                    <strong>Средние ноты:</strong>{' '}
                    {middle.length ? middle.join(', ') : '—'}
                  </p>
                  <p>
                    <strong>Базовые ноты:</strong>{' '}
                    {base.length ? base.join(', ') : '—'}
                  </p>
                </div>
              );
            })()}
            <div className="mt-6">
              <button
                className={`relative w-full px-6 py-3 font-semibold rounded-lg transition-all duration-300 overflow-hidden ${
                  cartStatus === "pending" ? "bg-gray-400 text-white" :
                  cartStatus === "added" ? "bg-gray-500 text-white" :
                  cartStatus === "canceled" ? "bg-gray-300 text-black" :
                  "bg-black text-white"
                }`}
                onClick={cartStatus === "pending" ? handleCancel : handleAddToCart}
                disabled={
                  cartStatus === "added" ||
                  (requiresSizeSelection() && selectedSize == null)
                }
              >
                <span className="relative z-10">
                {cartStatus === "pending"
                  ? "Отменить"
                  : cartStatus === "canceled"
                  ? "Отменено ❌"
                  : cartStatus === "added"
                  ? "Добавлено ✅"
                  : `Добавить в корзину – ${currentPrice.toLocaleString('ru-RU')}₽`}
              </span>
                {cartStatus === "pending" && (
                  <motion.span
                    className="absolute left-0 top-0 h-full bg-gray-500/30"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, ease: "linear" }}
                  />
                )}
              </button>
            </div>
          </motion.div>
        </div>
        {/* Trust Block — мобильная версия (перед "Вам может понравиться") */}
        <div className="block lg:hidden w-full mt-8 mb-4 px-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="w-full rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-md px-3 py-2.5 flex flex-col gap-2.5"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                  Гарантии StageStore
                </p>

                <h3 className="text-sm font-semibold text-gray-900">
                  Только оригинальные товары
                </h3>

                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Мы работаем только с проверенными поставщиками и вручную проверяем пары перед отправкой.
                </p>
              </div>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-gray-500">Нужна помощь с заказом?</span>

              <a
                href="mailto:info@stagestore.ru"
                className="px-2 py-1 rounded-full border border-gray-300 bg-white text-[10px] font-medium text-gray-800 hover:bg-gray-50 transition"
              >
                Почта
              </a>

              <a
                href="https://t.me/i_like_drugs"
                target="_blank"
                className="px-2 py-1 rounded-full border border-gray-900 bg-black text-[10px] font-medium text-white hover:bg-gray-900 transition"
              >
                Telegram
              </a>
            </div>
          </motion.div>
        </div>
        <div className="col-span-full mt-8 w-full max-w-[1800px] mx-auto px-3 sm:px-4 relative">
          <div className="relative z-0 mt-8">
            <h2 className="text-lg sm:text-xl font-semibold text-center text-gray-700 mb-4 sm:mb-6">
              Вам может понравиться
            </h2>
            <Swiper
              modules={[Navigation]}
              loop={false}
              freeMode={true}
              breakpoints={{
                320: { slidesPerView: 1.6, spaceBetween: 10 },
                480: { slidesPerView: 2.1, spaceBetween: 12 },
                768: { slidesPerView: 3, spaceBetween: 16 },
                1024: { slidesPerView: 4, spaceBetween: 20 },
                1440: { slidesPerView: 5, spaceBetween: 24 },
              }}
              className="w-full max-w-full overflow-hidden"
            >
            {similarProducts.map((similarProduct) => {
              const minInfo = getMinPriceInfo(similarProduct);
              return (
                <SwiperSlide key={similarProduct.id} style={{ width: '190px' }}>
                  <Link
                    href={`/product/${similarProduct.id}`}
                    className="block h-full group relative"
                  >
                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                      <div className="relative aspect-square w-full bg-gray-50">
                        <Image
                          src={similarProduct.images[0] || "/img/fallback.jpg"}
                          alt={similarProduct.name}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="(max-width: 768px) 50vw, 25vw"
                          priority
                        />
                      </div>
                      <div className="p-3 sm:p-4 flex-grow">
                        <div className="flex items-center gap-2">
                          {(similarProduct as any)?.brandLogo && (
                            <div className="w-10 h-10 relative hidden sm:block">
                              <Image
                                src={(similarProduct as any).brandLogo}
                                alt="Логотип бренда"
                                fill
                                className="object-contain"
                                priority
                              />
                            </div>
                          )}
                          <h3 className="font-semibold text-[11px] md:text-sm line-clamp-2">
                            {similarProduct.name}
                          </h3>
                          {(similarProduct as any)?.premium && (
                            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white text-black border border-black/20 text-[10px] font-semibold">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden="true">
                                <path d="M12 2.5l2.8 6.1 6.7.6-5.1 4.4 1.6 6.6L12 16.9 6 20.2l1.6-6.6-5.1-4.4 6.7-.6L12 2.5z"/>
                              </svg>
                              Premium
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mt-1 text-[11px] md:text-sm">
                          {`от ${minInfo.price.toLocaleString('ru-RU')}₽`}
                          {minInfo.sizeLabel && (
                            <span className="block text-[10px] text-gray-500 mt-0.5">
                              {`размер ${minInfo.sizeLabel}`}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </Link>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </div>
        {/* Бестселлеры StageStore */}
        <div className="relative z-0 mt-10 px-3 sm:px-4">
          <h2 className="text-lg sm:text-xl font-semibold text-center text-gray-700 mb-4 sm:mb-6">
            Бестселлеры StageStore 🔥
          </h2>
          <Swiper
            modules={[Navigation]}
            loop={false}
            freeMode={true}
            breakpoints={{
              320: { slidesPerView: 1.6, spaceBetween: 10 },
              480: { slidesPerView: 2.1, spaceBetween: 12 },
              768: { slidesPerView: 3, spaceBetween: 16 },
              1024: { slidesPerView: 4, spaceBetween: 20 },
              1440: { slidesPerView: 5, spaceBetween: 24 },
            }}
            className="w-full max-w-full overflow-hidden"
          >
            {bestsellerProducts.map((best) => {
                const minInfo = getMinPriceInfo(best);
                return (
                  <SwiperSlide key={best.id} style={{ width: '190px' }}>
                    <Link
                      href={`/product/${best.id}`}
                      className="block h-full group relative"
                  >
                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                      <div className="relative aspect-square w-full bg-gray-50">
                        <Image
                          src={best.images[0] || "/img/fallback.jpg"}
                          alt={best.name}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                      <div className="p-3 sm:p-4 flex-grow">
                        <h3 className="font-semibold text-[11px] md:text-sm line-clamp-2">
                          {best.name}
                        </h3>
                        <p className="text-gray-700 mt-1 text-[11px] md:text-sm">
                          {`от ${minInfo.price.toLocaleString('ru-RU')}₽`}
                          {minInfo.sizeLabel && (
                            <span className="block text-[10px] text-gray-500 mt-0.5">
                              {`размер ${minInfo.sizeLabel}`}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </Link>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
        {/* Recently viewed (read from localStorage) */}
        {recentProducts && recentProducts.length > 0 && (
          <div className="relative z-0 mt-10 px-3 sm:px-4">
            <h2 className="text-lg sm:text-xl font-semibold text-center text-gray-700 mb-4 sm:mb-6">
              Недавно просмотренные
            </h2>
            <Swiper
              modules={[Navigation, Pagination, Mousewheel]}
              loop={false}
              freeMode={true}
              spaceBetween={12}
              breakpoints={{
                320: { slidesPerView: 1.4, spaceBetween: 10 },
                480: { slidesPerView: 2, spaceBetween: 12 },
                768: { slidesPerView: 3, spaceBetween: 14 },
                1024: { slidesPerView: 4, spaceBetween: 18 },
              }}
              className="w-full max-w-full overflow-hidden"
            >
              {recentProducts.map((r) => {
                const minInfo = getMinPriceInfo(r);
                return (
                  <SwiperSlide key={`recent-${r.id}`} style={{ width: '190px' }}>
                    <Link href={`/product/${r.id}`} className="block h-full group relative">
                      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                        <div className="relative aspect-square w-full bg-gray-50">
                          <Image
                            src={r.images[0] || "/img/fallback.jpg"}
                            alt={r.name}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                        <div className="p-3 sm:p-4 flex-grow">
                          <h3 className="font-semibold text-[11px] md:text-sm line-clamp-2">
                            {r.name}
                          </h3>
                          <p className="text-gray-700 mt-1 text-[11px] md:text-sm">
                            {`от ${minInfo.price.toLocaleString('ru-RU')}₽`}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </div>
        )}

        {/* Moscow Availability Modal */}
        <AnimatePresence>
          {showMoscowModal && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 10, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="w-[92%] max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center">✓</div>
                  <h3 className="text-lg font-semibold">Размер доступен в Москве</h3>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  Отличная новость! Выбранный размер есть на московском складе. Мы можем организовать ускоренную доставку по городу или самовывоз из пункта выдачи.
                </p>
                <ul className="text-left text-sm text-gray-700 list-disc pl-5 mb-6 space-y-2">
                  <li>Быстрая доставка по Москве (1 - 3 часа)</li>
                  <li>Самовывоз сразу после оплаты</li>
                  <li>Резерв на 24 часа после подтверждения</li>
                </ul>
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setShowMoscowModal(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                  >
                    Закрыть
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Restock (size unavailable) Modal */}
        <AnimatePresence>
          {showRestockModal && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 10, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="w-[92%] max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center">!
                  </div>
                  <h3 className="text-lg font-semibold">
                    Этого размера сейчас нет в наличии{restockSize != null ? ` — ${restockSize}` : ''}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Оставьте email — мы уведомим вас, как только размер появится на складе.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={restockEmail}
                    onChange={(e) => setRestockEmail(e.target.value)}
                    onBlur={() => setRestockTouched(true)}
                    placeholder="Ваш email"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/60"
                  />
                  <button
                    disabled={!emailValid}
                    onClick={handleRestockSubmit}
                    className={`px-4 py-2 rounded-lg text-white transition ${emailValid ? 'bg-black hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'}`}
                  >
                    Отправить
                  </button>
                </div>
                {restockTouched && !emailValid && (
                  <p className="mt-2 text-xs text-red-600">Проверьте корректность email.</p>
                )}
                <button
                  className="mt-4 text-sm text-gray-500 hover:text-black"
                  onClick={() => setShowRestockModal(false)}
                >
                  Закрыть
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Delivery Modal */}
        <AnimatePresence>
          {showDeliveryModal && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full text-center"
              >
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Image
                    src="/img/IMG_0363.PNG"
                    alt="StageStore Logo"
                    width={32}
                    height={32}
                    className="rounded"
                  />
                  <h2 className="text-lg sm:text-xl font-bold">Условия доставки Stage Store</h2>
                </div>
                <p className="text-gray-700 mb-6 text-sm sm:text-base text-left">
                  Доставка осуществляется в течение <strong>5–10 рабочих дней</strong> с момента оформления заказа. В этот период включены:
                </p>
                <ul className="text-left text-sm text-gray-700 list-disc pl-5 mb-6 space-y-2">
                  <li>Оформление и подтверждение заказа</li>
                  <li>Поиск и подбор нужной модели со всего мира</li>
                  <li>Передача в службу доставки</li>
                  <li>Доставка до вашего региона</li>
                </ul>
                <p className="text-gray-700 mb-6 text-sm sm:text-base text-left">
                  Мы сотрудничаем только с проверенными поставщиками и заботимся о том, чтобы каждый заказ был выполнен идеально. Спасибо, что выбираете Stage Store!
                </p>
                <p className="text-center text-base font-bold mt-4 mb-6">
                  by Stage Store Worldwide 🌎🚛💨
                </p>
                <p className="text-xs text-gray-500 mt-2 text-left">
                  Если у вас возникли вопросы, обратитесь на почту: <a href="mailto:eldheykrut@gmail.com" className="underline hover:text-black">eldheykrut@gmail.com</a><br />
                  или напишите в Telegram: <a href="https://t.me/i_like_drugs" target="_blank" className="underline hover:text-black">@i_like_drugs</a>
                </p>
                <button
                  onClick={() => setShowDeliveryModal(false)}
                  className="mt-6 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
                >
                  Закрыть
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {product && showMobileBar && (
            <motion.div
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-3 left-0 right-0 z-40 px-3 lg:hidden pointer-events-none"
            >
              <div className="mx-auto max-w-[640px] pointer-events-auto rounded-[32px] border border-white/50 bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.2)] px-4 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[11px] text-gray-500">
                    {requiresSizeSelection()
                      ? selectedSize
                        ? `Размер ${selectedSize}`
                        : 'Выберите размер'
                      : 'Готов к отправке'}
                  </p>
                  <p className="text-xl font-semibold text-gray-900">
                    {currentPrice.toLocaleString('ru-RU')}₽
                  </p>
                </div>
                <Button
                  onClick={cartStatus === "pending" ? handleCancel : handleAddToCart}
                  className="flex-1 min-w-[150px]"
                  disabled={cartStatus === 'added'}
                >
                  {cartStatus === "pending"
                    ? "Отменить"
                    : cartStatus === "canceled"
                    ? "Отменено"
                    : cartStatus === "added"
                    ? "В корзине"
                    : "В корзину"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

    </div>
  );
}
