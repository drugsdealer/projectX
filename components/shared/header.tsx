'use client';

import { cn } from "@/lib/utils";
import { Container } from "./container";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Button } from "../ui/button";
import { ShoppingCart, UserRound, CircleChevronRight, DoorOpen, DoorClosed, Search, Heart, X, Menu } from "lucide-react";
import { useTitle } from "@/context/TitleContext";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useDiscount } from "@/context/DiscountContext";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/user/UserContext";

type ProductLite = {
  id: number | string;
  name: string;
  imageUrl?: string | null;
  price?: number | null;
  Brand?: { name?: string | null };
  brand?: { name?: string | null };
};

const STAGE_SUGGESTIONS = [
  "Yeezy",
  "Supreme",
  "Nike Dunk",
  "New Balance 990",
  "Adidas Campus",
];


const HISTORY_KEY = "searchHistory.v1";

const BURGER_LINKS: Array<{ label: string; href: string; badge?: string }> = [
  { label: "Каталог", href: "/" },
  { label: "Premium", href: "/premium", badge: "NEW" },
  { label: "Обувь", href: "/search?category=%D0%BE%D0%B1%D1%83%D0%B2%D1%8C" },
  { label: "Одежда", href: "/search?category=%D0%BE%D0%B4%D0%B5%D0%B6%D0%B4%D0%B0" },
  { label: "Аксессуары", href: "/search?category=%D0%B0%D0%BA%D1%81%D0%B5%D1%81%D1%81%D1%83%D0%B0%D1%80%D1%8B" },
  { label: "Парфюм", href: "/search?category=%D0%BF%D0%B0%D1%80%D1%84%D1%8E%D0%BC" },
  { label: "Избранное", href: "/favorites_item" },
  { label: "Корзина", href: "/cart" },
  { label: "Поиск", href: "/search" },
];

// Mobile-only haptics (works mainly on Android/Chrome; iOS usually ignores Vibration API)
const haptic = (pattern: number | number[] = 12) => {
  if (typeof window === "undefined") return;

  // Respect accessibility preferences
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduce) return;

  // Only fire on touch / coarse-pointer devices (mobile/tablet)
  const isTouch = (navigator as any).maxTouchPoints > 0;
  const isCoarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  if (!isTouch && !isCoarse) return;

  if ("vibrate" in navigator) {
    (navigator as any).vibrate(pattern);
  }
};



interface Props {
  className?: string;
}

export const Header: React.FC<Props> = ({ className }) => {
  const { title } = useTitle();
  const { cartItems, postponedItems, getPostponedKey } = useCart();

  const { activeItems, activeTotalAmount } = React.useMemo(() => {
    const active = Array.isArray(cartItems)
      ? cartItems.filter((item) => !postponedItems.includes(getPostponedKey(item)))
      : [];

    const total = active.reduce((sum, item) => {
      const rawPrice = (item as any).price;
      const rawQty = (item as any).quantity;

      const price = typeof rawPrice === "number" ? rawPrice : Number(rawPrice) || 0;
      const qty = typeof rawQty === "number" ? rawQty : Number(rawQty) || 1;

      return sum + price * qty;
    }, 0);

    return { activeItems: active, activeTotalAmount: total };
  }, [cartItems, postponedItems, getPostponedKey]);
  const { discount, applyDiscount, resetDiscount } = useDiscount();

  const pathname = usePathname();
  const isPremiumPage = pathname?.startsWith('/premium');
  const [lastSection, setLastSection] = useState<string | null>(null);
  const [lastGender, setLastGender] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem('lastSection');
      setLastSection(v);
      const g = sessionStorage.getItem('lastGender');
      setLastGender(g);
    } catch {}
  }, [pathname]);

  const onProductPage = pathname?.startsWith('/product/');
  const onPremiumRoute = pathname?.startsWith('/premium');

  const premiumTarget = `/premium${lastGender ? `?gender=${encodeURIComponent(lastGender)}` : ''}`;
  const logoTarget = onPremiumRoute || (onProductPage && lastSection === 'premium') ? premiumTarget : '/';

  const handleLogoClick = () => {
    try {
      if (logoTarget.startsWith('/premium')) {
        sessionStorage.setItem('premiumEntry', 'logo');
      } else {
        sessionStorage.setItem('premiumEntry', 'default');
      }
    } catch {}
  };

  const isHome = pathname === "/";
  const { user } = useUser();
  const [isAtTop, setIsAtTop] = useState(true);

  // React to external UI signals (e.g. Premium curator open) to blur/put header to background
  const [curatorOpenRemote, setCuratorOpenRemote] = useState(false);
  useEffect(() => {
    const onCurator = (e: any) => {
      try {
        setCuratorOpenRemote(Boolean(e?.detail?.open));
      } catch {
        setCuratorOpenRemote(false);
      }
    };
    window.addEventListener('ui:curator', onCurator as any);
    return () => window.removeEventListener('ui:curator', onCurator as any);
  }, []);

  const headerRef = useRef<HTMLElement | null>(null);

  // Measure header height and expose as CSS var for sticky blocks
  useEffect(() => {
    const setHeight = () => {
      if (!headerRef.current) return;
      const h = headerRef.current.offsetHeight;
      document.documentElement.style.setProperty("--header-h", `${h}px`);
      try {
        window.dispatchEvent(new CustomEvent("ui:header-height", { detail: { height: h } }));
      } catch {}
    };
    setHeight();
    window.addEventListener("resize", setHeight);
    return () => window.removeEventListener("resize", setHeight);
  }, []);

useEffect(() => {
  const handleScroll = () => {
    if (!isHome) return;
    const hero = document.getElementById("home-hero");
    if (hero) {
      const rect = hero.getBoundingClientRect();
      const h = headerRef.current?.offsetHeight ?? 80;
      // если низ hero ушел за верх header — переключаем на белый
      setIsAtTop(rect.bottom > h + 1);
      return;
    }
    setIsAtTop(window.scrollY < 10);
  };

  if (isHome) {
    handleScroll(); // Прямо при монтировании
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
  }

  return () => {
    if (isHome) {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    }
  };
}, [isHome]);

  // Discount state is restored in DiscountProvider; avoid overriding here.

  const [isStageMode, setIsStageMode] = useState(false);
  const router = useRouter();
  const [mSearchOpen, setMSearchOpen] = useState(false);
  const [mSearchValue, setMSearchValue] = useState("");

  const [burgerOpen, setBurgerOpen] = useState(false);
  const openBurger = () => setBurgerOpen(true);
  const closeBurger = () => setBurgerOpen(false);

  useEffect(() => {
    if (!burgerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBurger();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [burgerOpen]);
  const mSearchRef = useRef<HTMLInputElement | null>(null);

  // Search suggestions: persistent history + random products
  const [history, setHistory] = useState<string[]>([]);
  const [randomProducts, setRandomProducts] = useState<ProductLite[]>([]);

  const openMobileSearch = () => {
    setMSearchOpen(true);
  };
  const closeMobileSearch = () => {
    setMSearchOpen(false);
    // preserve `mSearchValue` so user can reopen and continue typing
  };
  const handleMobileSearchToggle = () => {
    haptic(10);
    if (!mSearchOpen) {
      openMobileSearch();
      return;
    }
    // If open and empty — collapse
    if (mSearchValue.trim() === "") {
      closeMobileSearch();
      return;
    }
    // If open and has value — submit
    addToHistory(mSearchValue.trim());
    router.push(`/search?q=${encodeURIComponent(mSearchValue.trim())}`);
  };
  const handleMobileSearchClear = () => {
    haptic(8);
    if (mSearchValue.trim() === "") {
      // second press on empty — collapse
      closeMobileSearch();
    } else {
      setMSearchValue("");
      // keep focus in the field
      setTimeout(() => mSearchRef.current?.focus(), 0);
    }
  };

  // ---- Persistent search history helpers ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const saveHistory = (arr: string[]) => {
    setHistory(arr);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch {}
  };

  const addToHistory = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...history.filter(v => v.toLowerCase() !== t.toLowerCase())].slice(0, 10);
    saveHistory(next);
  };

  const clearHistory = () => saveHistory([]);

  useEffect(() => {
    if (mSearchOpen) {
      const id = requestAnimationFrame(() => mSearchRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [mSearchOpen]);

  // Load random products for suggestions when the search opens
  useEffect(() => {
    if (!mSearchOpen) return;
    let aborted = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/products?take=32`);
        const data = await res.json();
        const list: ProductLite[] = Array.isArray(data) ? data : (data.items || data.rows || []);
        const shuffled = list.sort(() => Math.random() - 0.5).slice(0, 8);
        if (!aborted) setRandomProducts(shuffled);
      } catch {}
    };
    load();
    return () => { aborted = true; };
  }, [mSearchOpen]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsStageMode(document.documentElement.classList.contains("stage-mode"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    setIsStageMode(document.documentElement.classList.contains("stage-mode"));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      className={cn(
        isHome ? 'fixed top-0 left-0' : 'relative',
        'w-full z-40 transition-all duration-500',
        // when curator is open we visually push header to background
        curatorOpenRemote ? 'opacity-40 blur-sm' : '',
        (isHome && isAtTop)
          ? 'bg-transparent border-transparent shadow-none'
          : 'bg-white border-b border-black/10 shadow-sm',
        className
      )}
      style={{ pointerEvents: 'none' }} // чтобы картинка могла “поглощать” header визуально
    >
      <div style={{ pointerEvents: curatorOpenRemote ? 'none' : 'auto' }}>
        {/* Burger drawer */}
        <AnimatePresence>
          {burgerOpen && (
            <motion.div
              key="burger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999]"
            >
              <div className="absolute inset-0 bg-black/45" onClick={closeBurger} />

              <motion.aside
                initial={{ x: -340 }}
                animate={{ x: 0 }}
                exit={{ x: -340 }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
                className={cn(
                  "absolute left-0 top-0 h-full w-[86vw] max-w-[340px] p-4 sm:p-5 shadow-2xl",
                  isStageMode
                    ? "bg-[rgba(18,18,18,0.92)] backdrop-blur-xl border-r border-white/10 text-white"
                    : "bg-white/92 backdrop-blur-xl border-r border-black/10 text-black"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image src="/img/IMG_0363.PNG" alt="Logo" width={54} height={50} />
                    <div className="text-sm font-semibold">Stage Store</div>
                  </div>
                  <button
                    type="button"
                    aria-label="Закрыть"
                    onClick={closeBurger}
                    className="h-10 w-10 inline-flex items-center justify-center rounded-lg hover:opacity-80"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div
                  className={cn(
                    "mt-4 rounded-xl ring-1 overflow-hidden",
                    isStageMode ? "ring-white/10" : "ring-black/10"
                  )}
                >
                  <div
                    className={cn(
                      "px-3 py-2 text-xs opacity-60",
                      isStageMode ? "bg-white/5" : "bg-black/5"
                    )}
                  >
                    Категории
                  </div>
                  <nav className="flex flex-col">
                    {BURGER_LINKS.map((l) => (
                      <Link
                        key={l.href + l.label}
                        href={l.href}
                        onClick={() => {
                          closeBurger();
                          try {
                            haptic(8);
                          } catch {}
                        }}
                        className={cn(
                          "px-3 py-3 flex items-center justify-between text-sm font-medium transition",
                          isStageMode ? "hover:bg-white/5" : "hover:bg-black/5"
                        )}
                      >
                        <span>{l.label}</span>
                        {l.badge ? (
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full ring-1",
                              isStageMode
                                ? "bg-white/10 ring-white/15 text-white/80"
                                : "bg-black/5 ring-black/10 text-black/70"
                            )}
                          >
                            {l.badge}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </nav>
                </div>

                <div className="mt-4">
                  {user ? (
                    <Link
                      href="/user"
                      onClick={() => {
                        closeBurger();
                        try {
                          haptic(8);
                        } catch {}
                      }}
                      className={cn(
                        "w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ring-1",
                        isStageMode
                          ? "bg-white/10 ring-white/15 hover:bg-white/15"
                          : "bg-black/5 ring-black/10 hover:bg-black/10"
                      )}
                    >
                      <UserRound size={16} />
                      Профиль
                    </Link>
                  ) : (
                    <Link
                      href="/register"
                      onClick={() => {
                        closeBurger();
                        try {
                          haptic(8);
                        } catch {}
                      }}
                      className={cn(
                        "w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ring-1",
                        isStageMode
                          ? "bg-white/10 ring-white/15 hover:bg-white/15"
                          : "bg-black/5 ring-black/10 hover:bg-black/10"
                      )}
                    >
                      <DoorClosed size={16} />
                      Войти
                    </Link>
                  )}
                </div>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="md:hidden px-3 py-2">
          <div className="flex items-center justify-between">
            {/* LEFT ICONS: search (toggle input), favorites */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Меню и поиск"
                onClick={() => {
                  haptic(10);
                  router.push('/search');
                }}
                className="h-10 w-10 inline-flex items-center justify-center bg-transparent hover:bg-transparent p-0 focus-visible:outline-none"
              >
                <Image
                  src="https://res.cloudinary.com/dhufbfxcy/image/upload/v1768669741/free-icon-search-1828057_l8up8k.png"
                  alt="Меню и поиск"
                  width={18}
                  height={18}
                  className="opacity-90"
                />
              </button>
              <Link href="/favorites_item" aria-label="Избранное">
                <Button variant="ghost" className="h-10 w-10 p-0 flex items-center justify-center border-none bg-transparent hover:bg-transparent focus-visible:ring-0">
                  <Heart size={18} />
                </Button>
              </Link>
            </div>

            {/* CENTER LOGO */}
            <Link href={logoTarget} onClick={handleLogoClick} className="flex items-center justify-center" aria-label="На главную">
              <Image src="/img/IMG_0363.PNG" alt="Logo" width={70} height={66} />
            </Link>

            {/* RIGHT ICONS: profile/login, cart */}
            <div className="flex items-center gap-2">
              {user ? (
                <Link href="/user" aria-label="Профиль">
                  <Button variant="ghost" className="h-10 w-10 p-0 flex items-center justify-center border-none bg-transparent hover:bg-transparent focus-visible:ring-0">
                    <UserRound size={18} />
                  </Button>
                </Link>
              ) : (
                <Link href="/register" aria-label="Войти">
                  <Button variant="ghost" className="h-10 w-10 p-0 flex items-center justify-center border-none bg-transparent hover:bg-transparent focus-visible:ring-0">
                    <DoorClosed size={18} />
                  </Button>
                </Link>
              )}
              <Link href="/cart" aria-label="Корзина" className="relative">
                <Button variant="ghost" className="h-10 w-10 p-0 flex items-center justify-center border-none bg-transparent hover:bg-transparent focus-visible:ring-0">
                  <ShoppingCart className="h-5 w-5" strokeWidth={2} />
                </Button>
                {activeItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-black text-white text-[10px] leading-none h-4 min-w-[16px] px-1">
                    {activeItems.length}
                  </span>
                )}
              </Link>
            </div>
          </div>
          {/* Mobile expanding search */}
          <AnimatePresence>
            {mSearchOpen && (
              <motion.div
                key="mobile-search"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="relative mt-2"
              >
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  exit={{ scaleX: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{ transformOrigin: 'left center' }}
                >
                  <div
                    className={cn(
                      "flex items-center rounded-lg px-3 h-11 shadow-sm ring-1",
                      isStageMode
                        ? "bg-[rgba(26,26,26,0.9)] text-white ring-white/10"
                        : "bg-white text-black ring-black/10"
                    )}
                  >
                    <Search size={18} className={cn("shrink-0", isStageMode ? "text-white/70" : "text-black/60")} />
                    <input
                      ref={mSearchRef}
                      value={mSearchValue}
                      onChange={(e) => setMSearchValue(e.target.value)}
                      placeholder="Поиск по каталогу"
                      className={cn(
                        "ml-2 flex-1 bg-transparent outline-none placeholder:opacity-60",
                        isStageMode ? "text-white" : "text-black"
                      )}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && mSearchValue.trim() !== "") {
                          addToHistory(mSearchValue.trim());
                          router.push(`/search?q=${encodeURIComponent(mSearchValue.trim())}`);
                        }
                      }}
                    />
                    <button
                      type="button"
                      aria-label={mSearchValue ? "Очистить" : "Свернуть поиск"}
                      onClick={handleMobileSearchClear}
                      className="ml-2 h-7 w-7 inline-flex items-center justify-center rounded-md hover:opacity-80"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </motion.div>

                {/* Suggestions panel: History → Stage suggestions → Random products */}
                <div
                  className={cn(
                    "mt-2 rounded-xl ring-1 overflow-hidden",
                    isStageMode ? "bg-[rgba(26,26,26,0.92)] ring-white/10 text-white" : "bg-white ring-black/10 text-black"
                  )}
                >
                  {/* History */}
                  {history.length > 0 && (
                    <div className="px-3 py-2 border-b border-black/5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs opacity-60">История поиска</span>
                        <button onClick={clearHistory} className="text-xs opacity-60 hover:opacity-100">Очистить</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {history.map((h) => (
                          <button
                            key={`h-${h}`}
                            onClick={() => { addToHistory(h); router.push(`/search?q=${encodeURIComponent(h)}`); closeMobileSearch(); }}
                            className={cn("px-2.5 py-1 rounded-md text-sm ring-1",
                              isStageMode ? "ring-white/15 hover:bg-white/5" : "ring-black/10 hover:bg-black/5")}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stage Store suggestions (5) */}
                  <div className="px-3 py-2 border-b border-black/5">
                    <div className="text-xs opacity-60 mb-1.5">Подсказки Stage Store</div>
                    <div className="flex flex-wrap gap-1.5">
                      {STAGE_SUGGESTIONS.map((s) => (
                        <button
                          key={`s-${s}`}
                          onClick={() => { addToHistory(s); router.push(`/search?q=${encodeURIComponent(s)}`); closeMobileSearch(); }}
                          className={cn("px-2.5 py-1 rounded-md text-sm ring-1",
                            isStageMode ? "ring-white/15 hover:bg-white/5" : "ring-black/10 hover:bg-black/5")}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Random products */}
                  <div className="px-3 py-2">
                    <div className="text-xs opacity-60 mb-2">Предложенные товары</div>
                    <div className="grid grid-cols-3 gap-3">
                      {randomProducts.map((p) => (
                        <button key={String(p.id)} onClick={() => { router.push(`/product/${p.id}`); closeMobileSearch(); }} className="text-left">
                          <div className="aspect-square w-full overflow-hidden rounded-md bg-black/5">
                            {p.imageUrl ? (
                              <Image src={p.imageUrl} alt={p.name} width={200} height={200} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs opacity-60">no image</div>
                            )}
                          </div>
                          <div className="mt-1 text-xs line-clamp-1">{p.name}</div>
                          {p.price != null && <div className="text-xs opacity-70">{Number(p.price).toLocaleString('ru-RU')} ₽</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Container className="hidden md:flex items-center justify-between py-4 relative">
          <div className="flex items-center gap-3">
            <Link href="/search" aria-label="Меню и поиск">
              <Button variant="outline" className="flex items-center gap-1.5">
                <Image
                  src="https://res.cloudinary.com/dhufbfxcy/image/upload/v1768669741/free-icon-search-1828057_l8up8k.png"
                  alt="Меню и поиск"
                  width={16}
                  height={16}
                  className="opacity-90"
                />
                <span className="hidden md:inline">Меню & поиск</span>
              </Button>
            </Link>
            <Link href="/favorites_item">
              <Button variant="outline" className="flex items-center gap-1.5">
                <Heart size={16} />
                <span className="hidden md:inline">Избранное</span>
              </Button>
            </Link>
          </div>
          <div className="absolute left-1/2 transform -translate-x-1/2 z-10">
            <Link href={logoTarget} onClick={handleLogoClick} className="flex items-center gap-4 hover:opacity-80 transition">
              <Image src="/img/IMG_0363.PNG" alt="Logo" width={85} height={80} />
              <div className="sr-only">{title}</div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/user">
                <Button variant="outline" className="flex items-center gap-1.5">
                  <UserRound size={16} />
                  Профиль
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button variant="outline" className="flex items-center gap-1.5 group">
                  <div className="relative flex items-center">
                    <DoorClosed size={16} className="group-hover:hidden transition-all duration-200" />
                    <DoorOpen size={16} className="hidden group-hover:block transition-all duration-200" />
                  </div>
                  Войти
                </Button>
              </Link>
            )}
            <Link href="/cart">
              <Button className="group relative px-5 py-3 flex items-center justify-between gap-4 min-w-[160px]">
                <div className="text-sm font-semibold leading-tight text-left">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={(discount.type === "AMOUNT" ? discount.value > 0 : discount.value > 0) ? 'discounted' : 'normal'}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.25 }}
                    >
                      {(() => {
                        const hasDiscount =
                          discount.type === "AMOUNT" ? discount.value > 0 : discount.value > 0;
                        const discountAmount =
                          discount.type === "AMOUNT"
                            ? discount.value
                            : activeTotalAmount * discount.value;
                        const discountedTotal = Math.max(0, activeTotalAmount - discountAmount);
                        return hasDiscount ? (
                          <>
                            <div className="text-white text-lg font-bold">
                              {discountedTotal.toLocaleString("ru-RU")}₽
                            </div>
                            <div className="text-xs text-gray-400 line-through -mt-1">
                              {activeTotalAmount.toLocaleString("ru-RU")}₽
                            </div>
                          </>
                        ) : (
                          <div className="text-white text-lg font-bold">
                            {activeTotalAmount.toLocaleString("ru-RU")}₽
                          </div>
                        );
                      })()}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-1 transition-all duration-300 group-hover:opacity-0">
                  <ShoppingCart className="h-4 w-4 text-white" strokeWidth={2} />
                  <b className="text-white">{activeItems.length}</b>
                </div>

                <CircleChevronRight
                  size={20}
                  className="absolute right-5 top-1/2 -translate-y-1/2 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-white"
                />
              </Button>
            </Link>
          </div>
        </Container>
      </div>
    </header>
  );
};
