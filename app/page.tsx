"use client";
import { SortPopup } from "@/components/shared";
import { Container } from "@/components/shared/container";
import { Title } from "@/components/shared/title";
import { TopBar } from "@/components/shared/top-bar";
import { Filters } from "@/components/shared/filters";
import { ProductsGroupList } from "@/components/shared/products-group-list";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { products } from '@/data/products';
import { Categories } from '@/components/shared/categories';

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
  const [showAnimation, setShowAnimation] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const searchParams = useSearchParams();
  const topBarRef = useRef<HTMLDivElement>(null);
  const swiperRef = useRef<any>(null);
  const [hoveredSide, setHoveredSide] = useState<"left" | "right" | null>(null);
  const [parallaxY, setParallaxY] = useState(0);
  const [scrolledFar, setScrolledFar] = useState(false);
  const { user } = useUser();
  const [isScrollingProgrammatically, setIsScrollingProgrammatically] = useState(false);
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

  // Debug: observe scrolling flags
  useEffect(() => {
    console.log('Scroll direction:', scrollDirection, 'Scrolled far:', scrolledFar, 'At top:', isAtTop);
  }, [scrollDirection, scrolledFar, isAtTop]);

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

  // Активный фильтр подкатегорий
  const [subFilter, setSubFilter] = useState<Record<string, string | null>>({});

  // Каталог: предпочитаем НЕ‑премиум
  const catalog = useMemo(() => {
    const nonPremium = products.filter((p: any) => p?.premium !== true);
    return nonPremium.length ? nonPremium : products;
  }, []);

  // Унифицируем разные варианты названий категорий
  const normalizeCategory = useCallback((raw: any): string => {
    if (raw === undefined || raw === null) return "other";
    const vOrig = String(raw).trim();
    if (!vOrig) return "other";
    const v = vOrig.toLowerCase();

    const num = Number(v);
    if (!Number.isNaN(num)) {
      const byId: Record<number, string> = {
        1: "footwear",
        2: "clothes",
        3: "headwear",
        4: "fragrance",
        5: "accessories",
      };
      return byId[num] ?? "other";
    }

    const map: Record<string, string> = {
      "обувь": "footwear", "shoes": "footwear", "sneakers": "footwear", "кроссовки": "footwear",
      "одежда": "clothes", "clothes": "clothes", "apparel": "clothes",
      "головные уборы": "headwear", "шапки": "headwear", "headwear": "headwear",
      "парфюмерия": "fragrance", "fragrance": "fragrance", "perfume": "fragrance",
      "аксессуары": "accessories", "accessories": "accessories",
      "bags": "bags", "сумки": "bags",
    };

    return map[v] ?? v;
  }, []);

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

  const parseHash = useCallback((): { main: string | null; sub: string | null } => {
    if (typeof window === 'undefined') return { main: null, sub: null };
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return { main: null, sub: null };
    const [mainRaw, subRaw] = raw.split('/');
    const main = normalizeCategory(mainRaw);
    const sub = normalizeSub(subRaw ?? null);
    return { main, sub };
  }, [normalizeCategory, normalizeSub]);

  // --- Sorting helpers ---
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
  const ORDER = ["footwear", "clothes", "bags", "accessories", "fragrance", "headwear"] as const;
  const idMap: Record<string, number> = { 
    footwear: 1, clothes: 2, bags: 6, accessories: 5, fragrance: 4, headwear: 3 
  };

  // Группировка товаров по категориям
  const byMain = useMemo(() => {
    const result: Record<string, any[]> = {};
    for (const p of catalog) {
      const main = normalizeCategory(
        (p as any).main ?? (p as any).category ?? (p as any).categorySlug ?? (p as any).type
      );
      (result[main] ||= []).push(p);
    }
    return result;
  }, [catalog, normalizeCategory]);

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
        className="relative z-0 w-screen overflow-hidden h-[600px]" 
        onMouseLeave={() => setHoveredSide(null)}
      >
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
                    <button
                      className={`px-6 py-3 rounded-full font-bold transition-colors duration-300 ${
                        isHovered ? "bg-black text-white" : "bg-white text-black"
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

        <style jsx global>{`
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
            0% {
              width: 0%;
            }
            100% {
              width: 100%;
            }
          }

          .cursor-arrow-left {
            cursor: url("/img/arrow-left.svg"), auto;
          }
          .cursor-arrow-right {
            cursor: url("/img/arrow-right.svg"), auto;
          }
        `}</style>
      </div>

      {/* Trust / benefits bar */}
      <div className="w-full bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 border-y border-black/5">
        <div className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-black/80" xmlns="http://www.w3.org/2000/svg"><path d="M3 12h18M6 9l-3 3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 7v10a2 2 0 0 1-2 2H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <div>
              <p className="font-semibold leading-tight">Доставка и возврат</p>
              <p className="text-sm text-gray-500 leading-tight">по РФ, возврат 14 дней</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-black/80" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 10h18" stroke="currentColor" strokeWidth="1.5"/></svg>
            <div>
              <p className="font-semibold leading-tight">Оплата картой/QR</p>
              <p className="text-sm text-gray-500 leading-tight">безопасно и быстро</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-black/80" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div>
              <p className="font-semibold leading-tight">Поддержка 24/7</p>
              <p className="text-sm text-gray-500 leading-tight">мы всегда на связи</p>
            </div>
          </div>
        </div>
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
              {/* Only categories, no sort, no background */}
              <Categories mode="inline" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Inline categories + Sort (normal flow). This is the anchor we observe. */}
      <div ref={inlineCatsRef}>
        <Container className="flex items-center justify-between gap-4 mt-4">
          <div className="relative z-10">
            <Categories mode="inline" />
          </div>
          <div className="hidden sm:block relative z-10">
            <SortPopup />
          </div>
        </Container>
      </div>
      <Container className="mt-10 pb-14">
        <div className="flex gap-[80px]">
          <div className="w-[250px]">
            <Filters />
          </div>
          <div className="flex-1">
            <section className="flex flex-col gap-16">
              {ORDER.map((key) => {
                const items = byMain[key] || [];
                const activeSub = subFilter[key] ?? null;
                const visible = activeSub ? items.filter((it: any) => it.subcategory === activeSub) : items;
                const sorted = sortItems(visible, sortKey);
                if (!visible.length) return null;
                const label = LABELS[key] || key;
                const numericId = idMap[key];
                
                return (
                  <section
                    key={`home-sec-${key}`}
                    id={numericId ? `category-${numericId}` : key}
                    data-anchor={key}
                    className="max-w-[1200px] mx-auto pb-4"
                  >
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <h2 className="text-3xl md:text-4xl font-extrabold">{label}</h2>
                    </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 items-stretch">
                      {sorted.map((it: any) => (
                        <div key={`home-grid-${it.id}`} className="w-full h-full flex">
                          <a
                            id={`product-${it.id}`}
                            data-product-id={it.id}
                            href={`/product/${it.id}`}
                            className="group relative flex flex-col w-full rounded-2xl overflow-hidden bg-white border border-black/10 shadow-sm hover:shadow-md transition-transform duration-300 hover:scale-[1.02]"
                            onClick={(e) => {
                              try {
                                sessionStorage.setItem('lastListRoute', window.location.pathname + window.location.search);
                                sessionStorage.setItem('lastScrollY', String(window.scrollY));
                                sessionStorage.setItem('lastProductId', String(it.id));
                                // Раздел и пол сохраняются на странице товара
                              } catch {}
                            }}
                          >
                            {/* Image zone with fixed aspect ratio */}
                            <div className="relative w-full aspect-[4/3] bg-white p-3 overflow-hidden flex items-center justify-center">
                              {/* badges (always visible) */}
                              <div className="pointer-events-none absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
                                {computeBadges(it).map((b, bi) => (
                                  <span
                                    key={bi}
                                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide text-white shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
                                    style={{
                                      background:
                                        b === 'NEW' ? '#2563eb'
                                        : b === 'HIT' || b === 'EXCLUSIVE' ? '#111'
                                        : b.includes('%') ? '#dc2626'
                                        : '#1f2937',
                                    }}
                                  >
                                    {b}
                                  </span>
                                ))}
                              </div>
                              <img
                                src={it.images?.[0] || "/img/placeholder.png"}
                                alt={it.name}
                                width={600}
                                height={450}
                                className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.05]"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>

                            {/* Text zone with fixed height */}
                            <div className="p-3 flex flex-col min-h-[80px]">
                              <p className="text-sm font-semibold leading-snug line-clamp-2 mb-2 flex-grow">
                                {it.name}
                              </p>
                              <div className="mt-auto flex items-baseline gap-2">
                                {it?.oldPrice && Number(it.oldPrice) > Number(it.price) && (
                                  <span className="text-[11px] text-gray-400 line-through">
                                    {fmtPrice(it.oldPrice)} ₽
                                  </span>
                                )}
                                <span className="text-sm font-semibold">
                                  от {fmtPrice(it.price)} ₽
                                </span>
                              </div>
                            </div>
                          </a>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </section>
          </div>
        </div>
      </Container>
      {/* Footer */}
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

                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />

                {/* Promo strip: 3 товара, полуперекрывают границу хэдера и контента */}
                {(() => {
                  const slide = slides[activeSlide];
                  const ctas = (slide?.modal?.ctas || []);
                  const anchor = (ctas[0]?.hash || '').replace('#','');
                  const key = (anchor && (['footwear','clothes','bags','accessories','fragrance','headwear'] as const).includes(anchor as any)) ? anchor : 'clothes';
                  const pool = (byMain as any)[key] || [];
                  const promo = pool.slice(0, 3);
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
                              {/* soft top highlight to match the mockup */}
                              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/50 to-transparent" />
                            </a>
                            {/* caption */}
                            <div className="mt-2 w-full px-1">
                              <p className="text-xs md:text-sm font-medium text-gray-900 line-clamp-1">{it.name}</p>
                              <div className="mt-0.5 flex items-baseline justify-center gap-2">
                                {it?.oldPrice && Number(it.oldPrice) > Number(it.price) && (
                                  <span className="text-[10px] md:text-xs text-gray-400 line-through">
                                    {fmtPrice(it.oldPrice)} ₽
                                  </span>
                                )}
                                <span className="text-xs md:text-sm font-semibold text-black">
                                  {fmtPrice(it.price)} ₽
                                </span>
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
              <div className="p-6 md:p-8 pt-44 md:pt-52">
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