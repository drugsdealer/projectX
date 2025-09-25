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
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Navigation } from "swiper/modules";
import "swiper/css/effect-fade";
import { EffectFade } from "swiper/modules";
import SizeSelector from '@/components/shared/SizeSelector';
import { useToast } from "@/context/ToastContext";
import { useCart } from "@/context/CartContext";
import "swiper/css";
import "swiper/css/mousewheel";
import { cn } from "@/lib/utils";
import "swiper/css/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  products, 
  sizeCharts, 
  Product, 
  ClothingProduct, 
  ShoeProduct, 
  JewelryProduct, 
  RingProduct, 
  BagProduct, 
  PerfumeProduct, 
  BagDimensions, 
  BagCapacity 
} from "@/data/products";


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
        {Object.keys(rows[0]).map((key) => (
          <th key={key} className="px-3 py-2 border">
            {key === 'ru' ? '🇷🇺 RU' : 
             key === 'eu' ? '🇪🇺 EU' : 
             key === 'us' ? '🇺🇸 US' : key.toUpperCase()}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr
          key={i}
          className={`transition-colors border ${
            row[matchKey] === selectedSize ? 'bg-blue-100 font-semibold' : ''
          }`}
        >
          {Object.values(row).map((value, j) => (
            <td key={j} className="px-3 py-2 border">{String(value)}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = isNaN(Number(id)) ? -1 : Number(id);
  const product: Product | undefined = products.find(p => p.id === productId);
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
  const [displayedImages, setDisplayedImages] = useState<string[]>(product?.images || []);

  // Sticky header state and refs
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const titleRef = useRef<HTMLDivElement | null>(null);

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

  const prices = (product as any)?.sizes?.prices;
  if (prices && typeof prices === 'object') {
    return prices[selectedSize] ?? product.price;
  }

  return product?.price;
};

  const baseName = product?.name?.split('(')[0]?.trim() ?? '';
  const relatedColorProducts = product
  ? products.filter((p) => p.name.startsWith(baseName) && p.id !== product.id)
  : [];
  
  // States
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | number | null>(() => {
    const sizeData = (product as any)?.sizes?.available;
    return sizeData && sizeData.length > 0 ? sizeData[0] : null;
  });
  const [showError, setShowError] = useState(false);
  const [cartStatus, setCartStatus] = useState<
    "default" | "pending" | "canceled" | "added"
  >("default");
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBadgeText, setShowBadgeText] = useState(false);
  const cancelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});
  const [showSizeChart, setShowSizeChart] = useState(false);
  // Restock notify modal state
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockEmail, setRestockEmail] = useState("");
  const [restockTouched, setRestockTouched] = useState(false);
  const emailValid = React.useMemo(() => /^(?:[a-zA-Z0-9_.'%+-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(restockEmail), [restockEmail]);
  // Restock size state and available sizes helper
  const [restockSize, setRestockSize] = useState<string | number | null>(null);
  const availableSizes: Array<string | number> = React.useMemo(() => {
    return ((product as any)?.sizes?.available ?? []) as Array<string | number>;
  }, [product]);
  const { showToast } = useToast();
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);


useEffect(() => {
  if (product) {
    const viewed = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
    const updated = [product.id, ...viewed.filter((id: number) => id !== product.id)].slice(0, 6);
    localStorage.setItem("recentlyViewed", JSON.stringify(updated));
  }
}, [product]);

useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    if (brandOverlayTimeout.current) clearTimeout(brandOverlayTimeout.current);
  };
}, []);

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

    // Базовый пул: та же категория, исключаем текущий товар
    const basePool = products.filter((p) => p.id !== product.id && p.category === product.category);

    // Если текущий товар премиум — показываем только премиум в рекомендациях.
    // Если нет — оставляем текущую логику (скрываем премиум из рекомендаций).
    const onlyPremium = Boolean((product as any)?.premium);
    const pool: Product[] = onlyPremium
      ? (basePool.filter((p) => Boolean((p as any)?.premium)) as Product[])
      : (basePool.filter((p) => !Boolean((p as any)?.premium)) as Product[]);

    // Предпочитаем товары того же "gender" (если он задан у товара).
    // Ожидаем, что в данных может быть p.gender: 'men' | 'women' | 'unisex' | undefined
    const currentGender = (product as any)?.gender as string | undefined;

    let prioritized: Product[];
    if (currentGender) {
      const same = pool.filter((p) => (p as any)?.gender === currentGender) as Product[];
      const other = pool.filter((p) => (p as any)?.gender !== currentGender) as Product[];

      // Перемешиваем отдельно и берём сперва те, что совпадают по полу
      const TARGET = 10;
      const sameShuffled = shuffle(same);
      const otherShuffled = shuffle(other);
      prioritized = [...sameShuffled, ...otherShuffled].slice(0, TARGET);
    } else {
      prioritized = shuffle(pool).slice(0, 10);
    }

    setSimilarProducts(prioritized);
  }, [product]);

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
      name: product.name,
      price: getPriceBySize(),
      image: displayedImages?.[0] ?? product.images?.[0] ?? "/img/fallback.jpg",
      size: selectedSize ?? "N/A"
    });
     showToast({
      title: product.name,
      details: `${selectedSize ?? "—"} · ${getPriceBySize().toLocaleString('ru-RU')}₽`
    });
    setCartStatus("added");
    cancelTimerRef.current = setTimeout(() => {
      setCartStatus("default");
    }, 2800); 
  }, 2800); 
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
    if (!product || product.oneSize) return false;
    return (
      product.category === 'clothing' ||
      product.category === 'shoes' ||
      product.category === 'perfume' ||
      (product.category === 'jewelry' && (product as JewelryProduct).jewelryType === 'ring')
    );
  };

  const renderSizeSelector = () => {
    if (!product) return null;

    const sizes = (product as any).sizes;
    if (!sizes) return null;

    const isBag = product.category === 'bags';

    return (
      <div className={isBag ? 'w-full max-w-full' : ''}>
        <SizeSelector
          type={product.category as 'clothing' | 'shoes' | 'jewelry' | 'perfume'}
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
        return <SizeChartTable rows={sizeCharts.clothing} matchKey="label" selectedSize={selectedSize} />;
      case 'shoes':
        return <SizeChartTable rows={sizeCharts.shoes} matchKey="size" selectedSize={selectedSize} />;
      case 'jewelry': {
        const type = (product as JewelryProduct).jewelryType;
        if (type === 'ring') return <SizeChartTable rows={sizeCharts.rings} matchKey="size" selectedSize={selectedSize} />;
        if (type === 'bracelet') return <SizeChartTable rows={sizeCharts.bracelets} matchKey="size" selectedSize={selectedSize} />;
        break;
      }
      default:
        return null;
    }
  };

  const renderBagDimensions = () => {
    if (!product || product.category !== 'bags') return null;
    return (
      <BagVisualization
        dimensions={(product as BagProduct).dimensions}
        product={product}
      />
    );
  };

  // Define fittedItems for bags only (все значения — в сантиметрах)
  const fittedItems = product?.category === 'bags'
    ? [
        { label: "iPhone 16", dimensions: { width: 7.15, height: 14.66, depth: 0.78 }, diagonal: 6.1 },
        { label: "iPhone 16 Pro Max", dimensions: { width: 7.78, height: 16.07, depth: 0.83 }, diagonal: 6.7 },
        { label: "MacBook Air 13", dimensions: { width: 30.41, height: 21.24, depth: 1.13 }, diagonal: 13.6 },
        { label: "Косметичка", dimensions: { width: 6, height: 9, depth: 4 }, diagonal: 3.5 },
        { label: "Книга (A5)", dimensions: { width: 14.8, height: 21, depth: 1 }, diagonal: 9.7 }
      ]
      .sort((a, b) => a.diagonal - b.diagonal)
      .map(item => ({
        ...item,
        fits:
          item.dimensions.width <= (product as BagProduct).dimensions.width &&
          item.dimensions.height <= (product as BagProduct).dimensions.height &&
          item.dimensions.depth <= (product as BagProduct).dimensions.depth,
      }))
    : [];

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
      <main className="flex-grow pt-20 px-4 sm:px-6 lg:px-8 mx-auto w-full max-w-[1800px] relative">

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
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-1">{product.name}</p>
                    <p className="text-sm text-gray-600">
                      {getPriceBySize().toLocaleString('ru-RU')}₽
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
        {(() => {
          // Handler and ref for Premium badge hover effect
          const premiumRef = React.useRef<HTMLButtonElement | null>(null);
          const onPremiumMove = (e: React.MouseEvent<HTMLButtonElement>) => {
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            el.style.setProperty('--x', x + '%');
            el.style.setProperty('--y', y + '%');
          };
          return (
            <div
              ref={titleRef}
              className="absolute z-20 top-22 left-[55%] transform -translate-x-1/2 pointer-events-none select-none max-w-[90%] break-words"
            >
              <div className="flex items-center gap-3">
                <h1 className="text-[clamp(1.2rem,3.5vw,2rem)] font-bold text-black leading-tight text-left break-words whitespace-normal">
                  {product.name}
                </h1>
                {isPremium && (
                  <button
                    type="button"
                    ref={premiumRef}
                    onMouseMove={onPremiumMove}
                    className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-black border border-black/20 text-[11px] font-semibold shadow-sm cursor-pointer overflow-hidden group"
                    aria-label="Товар премиум-категории"
                  >
                    {/* мягкий подсвет под курсором */}
                    <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{background: "radial-gradient(120px 60px at var(--x,50%) var(--y,50%), rgba(0,0,0,0.06), transparent 60%)"}} />

                    {/* звёздочка — плавный твинг при наведении */}
                    <motion.svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="relative z-[1] w-3.5 h-3.5 fill-current"
                      whileHover={{ rotate: [0, 12, -12, 0], scale: [1, 1.12, 1] }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      aria-hidden="true"
                    >
                      <path d="M12 2.5l2.8 6.1 6.7.6-5.1 4.4 1.6 6.6L12 16.9 6 20.2l1.6-6.6-5.1-4.4 6.7-.6L12 2.5z"/>
                    </motion.svg>

                    <span className="relative z-[1]">Premium</span>

                    {/* маленькая вспышка‑спарк при ховере */}
                    <span className="pointer-events-none absolute -right-1 -top-1 w-2 h-2 rounded-full bg-black opacity-0 group-hover:opacity-100 animate-ping" />
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        <div className="grid grid-cols-1 lg:grid-cols-2 items-start w-full max-w-none gap-12">
          {/* Product gallery */}
          <div
            className={"relative w-full h-[80vh] lg:h-[90vh] overflow-hidden rounded-2xl shadow-2xl z-10 bg-white p-4"}
          >
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
                        href={`/brand/${encodeURIComponent(brandSlugFrom(primaryBrand!))}${(product as any)?.gender ? `?gender=${encodeURIComponent((product as any).gender)}` : ''}`}
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
            <div
              className="absolute top-4 left-4 flex items-center gap-2 rounded-xl bg-white/90 backdrop-blur-sm border border-black/10 shadow-lg z-40 cursor-pointer px-3 h-10 select-none"
              onMouseEnter={() => setShowBadgeText(true)}
              onMouseLeave={() => setShowBadgeText(false)}
              aria-label="Все товары в StageStore строго оригинальные"
            >
              <motion.div
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: showBadgeText ? 1.05 : 1, opacity: 1 }}
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="relative w-5 h-5 flex items-center justify-center"
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
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: showBadgeText ? 1 : 0, width: showBadgeText ? 'auto' : 0 }}
                transition={{ duration: 0.35 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Все товары в StageStore строго оригинальные.
              </motion.span>
            </div>

            <Swiper
             key={product.id}
              direction="vertical"
              mousewheel={{
                forceToAxis: true,
                releaseOnEdges: true,
                sensitivity: 1,
              }}
              loop={true}
              modules={[Mousewheel]}
              className="w-full h-full pt-20"
              onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
            >
              {product.images.map((image, index) => (
                <SwiperSlide key={index} className="relative">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Image
                      src={image}
                      alt={product.name}
                      fill
                      className="object-cover"
                      priority
                    />
                  </motion.div>
                </SwiperSlide>
              ))}
            </Swiper>

            <div className="absolute right-8 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-10">
              {product.images.map((_, index) => (
                <span
                  key={index}
                  className={`w-2.5 h-2.5 rounded-full transition ${
                    activeIndex === index ? 'bg-white' : 'bg-gray-400 opacity-50'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="sticky top-8 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-3 min-h-[32px]">
                {/* Бейджи брендов под заголовком товара удалены по требованию */}
              </div>
            <div className="flex items-center h-full">
              {(() => {
                const current = getPriceBySize();
                const oldPrice = (product as any)?.oldPrice as number | undefined;
                const showOld = typeof oldPrice === 'number' && oldPrice > current;
                return (
                  <div className="flex items-baseline gap-2">
                    {showOld && (
                      <span className="relative inline-block text-gray-400 text-xl lg:text-2xl old-price-strike">
                        {oldPrice.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}₽
                        <style jsx>{`
                          .old-price-strike {
                            /* fallback for non-Tailwind environments */
                            /* position: relative; display: inline-block; */
                          }
                          .old-price-strike::before,
                          .old-price-strike::after {
                            content: '';
                            position: absolute;
                            left: 0;
                            width: 100%;
                            height: 2px;
                            background: rgba(239, 68, 68, 0.7); /* bg-red-500/70 */
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
                        <span className="strike-3"></span>
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <p className="text-3xl lg:text-4xl font-bold text-black mt-1 lg:mt-0 drop-shadow-sm">
                        {current.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}₽
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
            </div>
            {product && (
              <div className="p-6 border rounded-xl bg-gray-50 mt-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Image src="/img/информация.png" alt="Информация" width={24} height={24} />
                  <h3 className="text-lg lg:text-xl font-semibold">Описание товара</h3>
                </div>
                <div className="text-gray-700 text-sm leading-relaxed space-y-2">
                  {product.category === 'perfume' ? (
                    <>
                      <p><strong>• Аромат:</strong> Стойкий, раскрывается постепенно, подходит как для дня, так и для вечера</p>
                      <p><strong>• Ассоциации:</strong> {product.fragranceNotes.top.includes('ваниль') ? '🍦' : ''}{product.fragranceNotes.top.includes('роза') ? '🌹' : ''}{product.fragranceNotes.top.includes('бергамот') ? '🍋' : ''} и другие ноты</p>
                    </>
                  ) : (
                    <>
                      <p><strong>• Материалы:</strong> {product.material ?? "натуральная кожа / премиум текстиль"}</p>
                      <p><strong>• Комфорт:</strong> {product.features ?? "лёгкость, гибкость и поддержка стопы"}</p>
                      <p><strong>• Дизайн:</strong> {product.styleNotes ?? "минимализм, адаптивный силуэт"}</p>
                    </>
                  )}
                  <p>{product.description}</p>
                </div>
              </div>
            )}
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
                        src={colorProduct.images[0]}
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
            {product.category === 'perfume' && (
              <div className="mt-6 space-y-1 text-sm text-gray-700">
                <p><strong>Верхние ноты:</strong> {(product as PerfumeProduct).fragranceNotes.top.join(', ')}</p>
                <p><strong>Средние ноты:</strong> {(product as PerfumeProduct).fragranceNotes.middle.join(', ')}</p>
                <p><strong>Базовые ноты:</strong> {(product as PerfumeProduct).fragranceNotes.base.join(', ')}</p>
              </div>
            )}
            {product.category === 'bags' ? (
              <div className="space-y-6 mt-4">
                {/* Слайдер размеров - на всю ширину */}
                <div className="w-full">
                  {(product as BagProduct).sizes && (
                    <div className="w-full">
                      {renderSizeSelector()}
                    </div>
                  )}
                </div>

                {/* Ниже два блока в ряд */}
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Логотип и помощь — только для bags и только на десктопе */}
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
                    {/* Удалён блок логотипа и помощи */}
                  </div>
                </div>
              </div>
            ) : (requiresSizeSelection() && product.category !== 'bags') ? (
              <div className="space-y-4">
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
                    ⚠ Выберите, пожалуйста, {product.category === 'perfume' ? 'объем' : 'размер'}
                  </p>
                )}
              </div>
            ) : null}
            <div className="flex gap-4 mt-6">
              <Button className="flex-grow">
                С чем сочетать?
              </Button>
              <button
                className={`relative flex-grow px-6 py-3 font-semibold rounded-lg transition-all duration-300 overflow-hidden ${
                  cartStatus === "pending" ? "bg-gray-400 text-white" :
                  cartStatus === "added" ? "bg-gray-500 text-white" :
                  cartStatus === "canceled" ? "bg-gray-300 text-black" :
                  "bg-black text-white"
                }`}
                onClick={cartStatus === "pending" ? handleCancel : handleAddToCart}
                disabled={cartStatus === 'added'}
              >
                <span className="relative z-10">
                {cartStatus === "pending"
                  ? "Отменить"
                  : cartStatus === "canceled"
                  ? "Отменено ❌"
                  : cartStatus === "added"
                  ? "Добавлено ✅"
                  : `Добавить в корзину – ${getPriceBySize().toLocaleString('ru-RU')}₽`}
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
          </div>
        </div>
        <div className="col-span-full mt-12 w-full max-w-[1800px] mx-auto px-4 relative">
          <div className="relative z-0 mt-12">
            <h2 className="text-xl font-semibold text-center text-gray-700 mb-6">
              Вам может понравиться
            </h2>
            <Swiper
              modules={[Navigation]}
              loop={false}
              freeMode={true}
              breakpoints={{
                320: { slidesPerView: 1.2, spaceBetween: 12 },
                640: { slidesPerView: 2.2, spaceBetween: 16 },
                1024: { slidesPerView: 4, spaceBetween: 20 },
                1440: { slidesPerView: 5, spaceBetween: 24 },
              }}
              className="w-full max-w-full overflow-hidden"
            >
              {similarProducts.map((similarProduct) => (
                <SwiperSlide key={similarProduct.id} style={{ width: '260px' }}>
                  <Link 
                    href={`/product/${similarProduct.id}`} 
                    className="block h-full group"
                  >
                    <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
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
                      <div className="p-4 flex-grow">
                        <div className="flex items-center gap-2">
                          {similarProduct.brandLogo && (
                            <div className="w-16 h-16 relative">
                              <Image
                                src={similarProduct.brandLogo}
                                alt="Логотип бренда"
                                fill
                                className="object-contain"
                                priority
                              />
                            </div>
                          )}
                          <h3 className="font-semibold text-xs md:text-sm line-clamp-2">
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
                        <p className="text-gray-600 mt-1 text-xs md:text-sm">
                          {similarProduct.price.toLocaleString()}₽
                        </p>
                      </div>
                    </div>
                  </Link>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
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
      </main>

      {/* Footer */}
      <footer className="w-full bg-black text-white py-12 mt-auto">
        <div className="px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto">
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
              <p className="text-gray-400">
                Оригинальные кроссовки и одежда от ведущих мировых брендов.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Меню</h3>
              <ul className="space-y-2">
                <li><Link href="/" className="text-gray-400 hover:text-white transition">Главная</Link></li>
                <li><Link href="/products" className="text-gray-400 hover:text-white transition">Каталог</Link></li>
                <li><Link href="/about" className="text-gray-400 hover:text-white transition">О нас</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Помощь</h3>
              <ul className="space-y-2">
                <li><Link href="/shipping" className="text-gray-400 hover:text-white transition">Доставка</Link></li>
                <li><Link href="/returns" className="text-gray-400 hover:text-white transition">Возврат</Link></li>
                <li><Link href="/size-guide" className="text-gray-400 hover:text-white transition">Таблица размеров</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Контакты</h3>
              <address className="not-italic text-gray-400">
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

          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm mb-4 md:mb-0">
              © {new Date().getFullYear()} StageStore. Все права защищены.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}