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
import { useParams, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const productId = isNaN(Number(id)) ? -1 : Number(id);
  const product: Product | undefined = products.find(p => p.id === productId);
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
  const { showToast } = useToast();
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  // Delivery modal state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Brand logo tooltip state
  const [showBrandTooltip, setShowBrandTooltip] = useState(false);

  
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
  };
}, []);

  useEffect(() => {
    if (!product) return;

    const similar = shuffle(
      products.filter((p) => p.id !== product.id && p.category === product.category)
    ).slice(0, 10);

    setSimilarProducts(similar);
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
    setSelectedSize(size);
  };


  const toggleSizeChart = () => setShowSizeChart(prev => !prev);

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
      <main className="flex-grow pt-12 px-4 sm:px-6 lg:px-8 mx-auto w-full max-w-[1800px] relative">
        {/* Sticky animated header */}
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
        <div
          ref={titleRef}
          className="absolute z-20 top-14 left-[55%] transform -translate-x-1/2 pointer-events-none select-none max-w-[90%] break-words"
        >
          <h1 className="text-[clamp(1.2rem,3.5vw,2rem)] font-bold text-black leading-tight text-left break-words whitespace-normal">
            {product.name}
          </h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 items-start w-full max-w-none gap-12">
          {/* Product gallery */}
          <div className="relative w-full h-[80vh] lg:h-[90vh] overflow-hidden rounded-2xl shadow-2xl z-10 bg-white p-4">
            <div
              className={`absolute top-4 left-4 flex items-center gap-2 p-2 rounded-lg bg-white shadow-lg z-10 cursor-pointer transition-all duration-500 ${
                showBadgeText ? "w-auto" : "w-[40px] h-[40px] p-1"
              }`}
              onMouseEnter={() => setShowBadgeText(true)}
              onMouseLeave={() => setShowBadgeText(false)}
            >
              <Image 
                src="/img/звездочкиии.png" 
                alt="Оригинальный товар" 
                width={30} 
                height={30} 
                priority
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className={`transition-all duration-500 ${
                showBadgeText ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}>
                Все товары в StageStore строго оригинальные.
              </span>
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
              {product.brandLogo && (
                <div 
                  className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 group w-[calc(theme(width.32)+theme(spacing.4)*2)]"
                  onMouseEnter={() => setShowBrandTooltip(true)}
                  onMouseLeave={() => setShowBrandTooltip(false)}
                >
                  <div className="relative bg-white/60 px-4 py-2 rounded-xl backdrop-blur-sm shadow-lg w-full">
                    <div className="relative w-32 h-16 mx-auto">
                      <Image
                        src={product.brandLogo}
                        alt="Логотип бренда"
                        fill
                        className="object-contain"
                        priority
                      />
                    </div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: showBrandTooltip ? 1 : 0, y: showBrandTooltip ? 0 : -5 }}
                    transition={{ duration: 0.3 }}
                    className="absolute top-full left-15 transform -translate-x-1/2 mt-2 w-[calc(theme(width.32)+theme(spacing.4)*2)] z-30 pointer-events-none"
                  >
                    <Link
                      href={`/brands/${product.brandLogo}`}
                      className="block px-4 py-2 text-sm text-black bg-white/40 backdrop-blur-md rounded-xl shadow-lg text-center hover:bg-white/60 transition pointer-events-auto"
                    >
                      Больше товаров от этого бренда
                    </Link>
                  </motion.div>
                </div>
              )}
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
                    activeIndex === index ? "bg-white" : "bg-gray-400 opacity-50"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="sticky top-8 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-3"></div>
            <div className="flex items-center h-full">
                <p className="text-3xl lg:text-4xl font-bold text-black mt-1 lg:mt-0 drop-shadow-sm">
                  {getPriceBySize().toLocaleString('ru-RU', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}₽
                </p>
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
            {/* Delivery info block */}
            <button
              onClick={() => setShowDeliveryModal(true)}
              className="flex items-center gap-3 p-4 mt-4 bg-yellow-50 border border-yellow-300 rounded-lg w-full text-left hover:bg-yellow-100 transition"
            >
              <Image
                src="/img/грузовик.png"
                alt="Иконка доставки"
                width={32}
                height={32}
              />
              <p className="font-bold text-yellow-800 text-sm sm:text-base">
                Доставка до 10 рабочих дней
              </p>
            </button>
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
        {/* Закрытие sticky контейнера */}
        <div className="col-span-full mt-12 w-full max-w-[1800px] mx-auto px-4">
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