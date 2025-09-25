'use client';

import { cn } from "@/lib/utils";
import { Container } from "./container";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Button } from "../ui/button";
import { ShoppingCart, UserRound, CircleChevronRight, DoorOpen, DoorClosed } from "lucide-react";
import { useTitle } from "@/context/TitleContext";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useDiscount } from "@/context/DiscountContext";
import { usePathname } from "next/navigation";
import { useUser } from "@/user/UserContext";



interface Props {
  className?: string;
}

export const Header: React.FC<Props> = ({ className }) => {
  const { title } = useTitle();
  const { cartItems, postponedItems } = useCart();

  const activeItems = cartItems.filter(item => !postponedItems.includes(item.id));
  const activeTotalAmount = activeItems.reduce((sum, item) => sum + item.price, 0);
  const { discount, setDiscount } = useDiscount();

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
    setIsAtTop(window.scrollY < 10);
  };

  if (isHome) {
    handleScroll(); // Прямо при монтировании
    window.addEventListener("scroll", handleScroll);
  }

  return () => {
    if (isHome) {
      window.removeEventListener("scroll", handleScroll);
    }
  };
}, [isHome]);

  useEffect(() => {
    const d = localStorage.getItem("discount");
    if (d) setDiscount(parseFloat(d));
    else setDiscount(0);
  }, []);

  return (
    <header
      ref={headerRef}
      className={cn(
        isHome ? 'fixed top-0 left-0' : 'relative',
        'w-full z-[200] transition-all duration-300',
        !isHome
          ? 'bg-white/80 backdrop-blur border-b shadow-md'
          : isAtTop
          ? 'bg-transparent backdrop-blur-none border-transparent shadow-none'
          : 'bg-white/80 backdrop-blur border-b shadow-md',
        className
      )}
      style={{ pointerEvents: 'none' }} // чтобы картинка могла “поглощать” header визуально
    >
      <div style={{ pointerEvents: 'auto' }}>
        <Container className="flex items-center justify-end py-4 relative">
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
                  Зарегистрироваться
                </Button>
              </Link>
            )}
            <Link href="/cart">
              <Button className="group relative px-5 py-3 flex items-center justify-between gap-4 min-w-[160px]">
                <div className="text-sm font-semibold leading-tight text-left">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={discount > 0 ? 'discounted' : 'normal'}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.25 }}
                    >
                      {discount > 0 ? (
                        <>
                          <div className="text-white text-lg font-bold">
                            ${(activeTotalAmount * (1 - discount)).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-400 line-through -mt-1">
                            ${activeTotalAmount.toLocaleString()}
                          </div>
                        </>
                      ) : (
                        <div className="text-white text-lg font-bold">
                          ${activeTotalAmount.toLocaleString()}
                        </div>
                      )}
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