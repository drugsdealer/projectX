"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  mode?: "inline" | "sticky";
  subcatsByCat?: Record<string, string[]>;
  activeSub?: Record<string, string | null>;
  onSelectSub?: (cat: string, sub: string | null) => void;
};
type Tab = { key: string; label: string };

const LABELS: Record<string, string> = {
  footwear: "Обувь",
  clothes: "Одежда",
  bags: "Сумки",
  accessories: "Аксессуары",
  fragrance: "Парфюмерия",
  headwear: "Головные уборы",
};
const ORDER = ["footwear", "clothes", "bags", "accessories", "fragrance", "headwear"];
const SUBCATS: Record<string, string[]> = {
  footwear: ["Кроссовки", "Ботинки", "Сникеры", "Сандалии"],
  clothes: ["Худи", "Футболки", "Деним", "Куртки"],
  bags: ["Тоуты", "Кросс-боди", "Рюкзаки"],
  accessories: ["Кепки", "Очки", "Ремни"],
  fragrance: ["Новинки", "Бестселлеры", "Унисекс"],
  headwear: ["Кепки", "Панамы", "Бини"],
};
const SUB_LABELS: Record<string, string> = {
  sneakers: "Кроссовки",
  boots: "Ботинки",
  sandals: "Сандалии",
  tshirts: "Футболки",
  hoodies: "Худи",
  bags: "Сумки",
  totes: "Тоуты",
  "cross-body": "Кросс-боди",
};

const formatSubLabel = (sub: string) => {
  const key = sub.toLowerCase();
  if (SUB_LABELS[key]) return SUB_LABELS[key];
  return sub.charAt(0).toUpperCase() + sub.slice(1);
};

export function Categories({ mode = "inline", subcatsByCat, activeSub, onSelectSub }: Props) {
  const hostId = mode === "inline" ? "cats-inline-host" : "cats-sticky-host";
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const moRef = useRef<MutationObserver | null>(null);
  const isSwipingRef = useRef(false); // Отслеживаем режим свайпа

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string | null>(null);

  // Слушаем глобальный флаг свайпа
  useEffect(() => {
    const handleSwipeStart = () => { isSwipingRef.current = true; };
    const handleSwipeEnd = () => { isSwipingRef.current = false; };
    
    document.addEventListener("swipe:start", handleSwipeStart);
    document.addEventListener("swipe:end", handleSwipeEnd);
    
    return () => {
      document.removeEventListener("swipe:start", handleSwipeStart);
      document.removeEventListener("swipe:end", handleSwipeEnd);
    };
  }, []);

  const rebuildTabs = useCallback(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-anchor]"));
    if (!sections.length) return;
    const keys = sections.map((el) => el.getAttribute("data-anchor") || "").filter(Boolean) as string[];
    const uniq = Array.from(new Set(keys));
    const known = ORDER.filter((k) => uniq.includes(k));
    const rest = uniq.filter((k) => !ORDER.includes(k));
    const ordered = [...known, ...rest];

    setTabs(ordered.map((k) => ({ key: k, label: LABELS[k] ?? k })));
    if (!active && ordered.length) setActive(ordered[0]);
  }, [active]);

  const headerOffset = useMemo(() => {
    try {
      const cs = getComputedStyle(document.documentElement);
      const h = parseFloat(cs.getPropertyValue("--header-h")) || 72;
      const safe = parseFloat(cs.getPropertyValue("--safe-top")) || 0;
      return Math.round(h + safe + 10);
    } catch {
      return 84;
    }
  }, []);

  const centerActive = useCallback((key: string) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const el = wrap.querySelector<HTMLElement>(`[data-tab="${key}"]`);
    if (!el) return;
    const wrapRect = wrap.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target = Math.max(0, wrap.scrollLeft + (elRect.left - wrapRect.left) + elRect.width / 2 - wrapRect.width / 2);
    wrap.scrollTo({ left: target, behavior: "smooth" });
  }, []);

  const smoothScrollToAnchor = useCallback((key: string) => {
    const el = document.querySelector<HTMLElement>(`[data-anchor="${key}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = window.scrollY + rect.top - headerOffset;
    window.scrollTo({ top, behavior: "smooth" });
    try { window.dispatchEvent(new CustomEvent("category:select", { detail: { anchor: key } })); } catch {}
    history.replaceState(null, "", `#${key}`);
    setTimeout(() => centerActive(key), 150);
  }, [centerActive, headerOffset]);

  const onTabClick = useCallback((key: string) => {
    setActive(key);
    smoothScrollToAnchor(key);
  }, [smoothScrollToAnchor]);

  useEffect(() => {
    if (ioRef.current) { ioRef.current.disconnect(); ioRef.current = null; }
    
    // На мобильном (< 768px) отключаем IntersectionObserver
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;
    
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-anchor]"));
    if (!sections.length) return;

    let updateTimeout: NodeJS.Timeout;

    ioRef.current = new IntersectionObserver((entries) => {
      // Если сейчас свайп фото - игнорируем обновление
      if (isSwipingRef.current) return;

      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => (b.intersectionRatio||0)-(a.intersectionRatio||0));
      let next: string | null = null;
      if (visible.length) {
        next = visible[0].target.getAttribute("data-anchor");
      } else {
        const byTop = entries.map(e => ({ key: e.target.getAttribute("data-anchor"), top: e.boundingClientRect.top }))
                             .sort((a,b) => Math.abs(a.top) - Math.abs(b.top));
        next = byTop[0]?.key ?? null;
      }
      // Debounce обновления active категории
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        if (next && next !== active) { setActive(next); centerActive(next); }
      }, 50);
    }, { root: null, rootMargin: `-${headerOffset}px 0px -65% 0px`, threshold: [0,0.01,0.25,0.5,0.75,1] });

    sections.forEach(el => ioRef.current!.observe(el));
    return () => { 
      clearTimeout(updateTimeout);
      ioRef.current?.disconnect(); 
      ioRef.current = null; 
    };
  }, [headerOffset, centerActive, active]);

  useEffect(() => {
    rebuildTabs();
    if (moRef.current) { moRef.current.disconnect(); moRef.current = null; }
    moRef.current = new MutationObserver((muts) => {
      if (muts.some(m => Array.from(m.addedNodes).some(n => (n as HTMLElement)?.nodeType === 1))) {
        rebuildTabs();
      }
    });
    moRef.current.observe(document.body, { childList: true, subtree: true });
    return () => { moRef.current?.disconnect(); moRef.current = null; };
  }, [rebuildTabs]);

  if (!tabs.length) {
    return (
      <div id={hostId} className="w-full overflow-hidden">
        <div className="h-10 rounded-xl bg-black/[0.04]" />
      </div>
    );
  }

  return (
    <div id={hostId} className="relative">
      <div
        ref={wrapRef}
        role="tablist"
        aria-label="Категории"
        aria-orientation="horizontal"
        className="
          w-full max-w-full md:max-w-none
          flex flex-wrap md:flex-nowrap items-center gap-1.5 md:gap-4
          overflow-x-auto overflow-y-hidden scrollbar-none
          md:whitespace-nowrap
          md:snap-x md:snap-mandatory
          [-webkit-overflow-scrolling:touch]
          [overscroll-behavior-x:contain]
          [touch-action:pan-x]
          px-2 md:px-1 py-1.5 md:py-2.5
          h-auto md:h-12
        "
        style={{ WebkitOverflowScrolling: "touch" as any }}
      >
        {tabs.map(({ key, label }) => {
          const isActive = key === active;
          return (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              key={key}
              role="tab"
              aria-selected={isActive}
              data-tab={key}
              onClick={() => onTabClick(key)}
              className={`
                group relative snap-center select-none overflow-hidden
                px-2.5 md:px-4 py-2
                text-[13px] md:text-[15px] leading-none whitespace-nowrap
                rounded-lg md:rounded-xl border
                transition-colors duration-200
                ${isActive
                  ? "bg-black text-white border-black shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                  : "bg-white text-black/70 border-black/10 hover:border-black/30 hover:text-black"}
              `}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {!isActive ? (
                <span className="pointer-events-none absolute inset-0 rounded-lg md:rounded-xl bg-black/[0.04] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              ) : null}
              <span className="relative inline-block font-semibold">{label}</span>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {active && (subcatsByCat?.[active]?.length || SUBCATS[active]) && (
          <motion.div
            key={active}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex items-center gap-1.5 md:gap-2 overflow-x-auto scrollbar-none px-1 sm:px-0 pb-1"
          >
            <button
              type="button"
              onClick={() => onSelectSub?.(active, null)}
              className={`inline-flex items-center px-2.5 md:px-3 py-1.5 rounded-full border text-[12px] sm:text-sm font-medium transition whitespace-nowrap ${
                activeSub?.[active] == null
                  ? "bg-black text-white border-black"
                  : "bg-white border-black/10 text-black/70 hover:border-black/30"
              }`}
            >
              Все
            </button>
            {(subcatsByCat?.[active] ?? SUBCATS[active] ?? []).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => onSelectSub?.(active, sub)}
                className={`inline-flex items-center px-2.5 md:px-3 py-1.5 rounded-full border text-[12px] sm:text-sm font-medium transition whitespace-nowrap ${
                  activeSub?.[active] === sub
                    ? "bg-black text-white border-black"
                    : "bg-white border-black/10 text-black/70 hover:border-black/30"
                }`}
              >
                {formatSubLabel(sub)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Categories;
