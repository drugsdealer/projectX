'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCategoryStore } from '@/store/category';
import { motion, AnimatePresence, LayoutGroup, type Transition } from 'framer-motion';

const spring: Transition = { type: 'spring', stiffness: 500, damping: 30, mass: 0.5 } as const;
const glide: Transition = { type: 'tween', duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } as const;

/**
 * Categories with a subcategory panel that:
 *  - never instantly closes on first open
 *  - syncs selection with URL hash as `#<main>/<sub?>` (e.g. `#footwear/sneakers`)
 *  - supports common aliases ("tshirt", "tees" -> "tshirts") so filters always match
 */

// Localized labels
const LABELS: Record<string, string> = {
  footwear: 'Обувь',
  clothes: 'Одежда',
  headwear: 'Головные уборы',
  fragrance: 'Парфюмерия',
  accessories: 'Аксессуары',
  bags: 'Сумки',
  // bag subs
  backpacks: 'Рюкзаки',
  totes: 'Тоуты',
  crossbody: 'Сумки через плечо',
  beltbags: 'Поясные сумки',
  messengers: 'Мессенджеры',
  // subs
  sneakers: 'Кроссовки',
  boots: 'Ботинки',
  sandals: 'Сандалии',
  tshirts: 'Футболки',
  hoodies: 'Худи',
  sweatshirts: 'Свитшоты',
  pants: 'Брюки',
  shorts: 'Шорты',
  jackets: 'Куртки',
  socks: 'Носки',
  caps: 'Кепки',
  beanies: 'Шапки',
  bandanas: 'Банданы',
  bracelets: 'Браслеты',
  chains: 'Цепи',
  rings: 'Кольца',
  edt: 'Туалетная вода',
  edp: 'Парфюмированная вода',
  extrait: 'Экстракт',
  all: 'Все',
};

// Subcategory list for each main
const SUBCATEGORIES: Record<string, string[]> = {
  footwear: ['sneakers', 'boots', 'sandals'],
  clothes: ['tshirts', 'hoodies', 'sweatshirts', 'pants', 'shorts', 'jackets', 'socks'],
  headwear: ['caps', 'beanies', 'bandanas'],
  fragrance: ['edt', 'edp', 'extrait'],
  accessories: ['bracelets', 'chains', 'rings'],
  bags: ['backpacks', 'totes', 'crossbody', 'beltbags', 'messengers'],
};

// Aliases -> normalized sub keys used in products
const SUB_ALIASES: Record<string, string> = {
  tee: 'tshirts', tees: 'tshirts', tshirt: 'tshirts', tshirts: 'tshirts',
  sneaker: 'sneakers', sneakers: 'sneakers',
  boot: 'boots', boots: 'boots',
  sandal: 'sandals', sandals: 'sandals',
  backpack: 'backpacks', backpacks: 'backpacks',
  tote: 'totes', totes: 'totes', shopper: 'totes',
  crossbody: 'crossbody', 'cross-body': 'crossbody', sling: 'crossbody',
  beltbag: 'beltbags', beltbags: 'beltbags', waistbag: 'beltbags', 'waist-bag': 'beltbags', fanny: 'beltbags', fannypack: 'beltbags',
  messenger: 'messengers', messengers: 'messengers', courier: 'messengers',
};

const CATEGORIES = [
  { id: 1, name: 'Обувь', anchor: 'footwear' },
  { id: 2, name: 'Одежда', anchor: 'clothes' },
  { id: 3, name: 'Головные уборы', anchor: 'headwear' },
  { id: 4, name: 'Парфюмерия', anchor: 'fragrance' },
  { id: 5, name: 'Аксессуары', anchor: 'accessories' },
  { id: 6, name: 'Сумки', anchor: 'bags' },
] as const;

const PREMIUM_LABEL = 'Premium';

// Parse and write hash helpers (`#main/sub?`)
function parseHash() {
  if (typeof window === 'undefined') return { main: 'footwear', sub: null as string | null };
  const raw = window.location.hash.replace(/^#/, '');
  const [mainRaw, subRaw] = raw.split('/');
  const main = (mainRaw && CATEGORIES.some(c => c.anchor === mainRaw)) ? mainRaw : (window.location.pathname.startsWith('/premium') ? 'footwear' : 'footwear');
  const subKey = subRaw ? (SUB_ALIASES[subRaw.toLowerCase()] ?? subRaw.toLowerCase()) : null;
  return { main, sub: subKey };
}

function writeHash(main: string, sub: string | null) {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  u.hash = `${main}${sub ? `/${sub}` : ''}`;
  history.replaceState(null, '', u.toString());
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export const Categories: React.FC<{ className?: string; mode?: 'inline' | 'sticky' }> = ({ className, mode = 'inline' }) => {
  const router = useRouter();
  const pathname = usePathname();
  const inPremium = pathname?.startsWith('/premium');
  const primaryCtaLabel = inPremium ? 'Stage' : PREMIUM_LABEL;

  const activeId = useCategoryStore((s) => s.activeId);
  const setActiveId = useCategoryStore((s) => s.setActiveId);

  const [openPanel, setOpenPanel] = useState<null | { anchor: string; id: number }>(null);
  // Avoid reading window hash during SSR; use deterministic default, then sync on mount
  const [route, setRoute] = useState<{ main: string; sub: string | null }>({ main: 'footwear', sub: null });
  const [hydrated, setHydrated] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Detect hover-capable pointers (desktop) and manage hover-close timer
  const [isHoverCapable, setIsHoverCapable] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mm = window.matchMedia('(hover: hover) and (pointer: fine)');
    const apply = () => setIsHoverCapable(!!mm.matches);
    apply();
    try {
      // Safari/old
      if ((mm as any).addEventListener) (mm as any).addEventListener('change', apply);
      else (mm as any).addListener?.(apply);
    } catch {}
    return () => {
      try {
        if ((mm as any).removeEventListener) (mm as any).removeEventListener('change', apply);
        else (mm as any).removeListener?.(apply);
      } catch {}
    };
  }, []);

  const hoverTimerRef = useRef<number | null>(null);
  const cancelHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);
  const scheduleClosePanel = useCallback(() => {
    cancelHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => setOpenPanel(null), 120);
  }, [cancelHoverTimer]);

  useEffect(() => () => cancelHoverTimer(), [cancelHoverTimer]);
  useEffect(() => { setMounted(true); }, []);

  // hash sync
  useEffect(() => {
    setHydrated(true); // mark client hydration to allow hash-based state after mount
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    onHash(); // sync once on mount (client only)
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const tablistRef = useRef<HTMLDivElement | null>(null);

  const rafIdRef = useRef<number | null>(null);
  const lastCenterIdRef = useRef<number | null>(null);
  const userInteractingRef = useRef(false);
  const userInteractTimerRef = useRef<number | null>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  // Sticky coordination: detect when the inline instance is visible and scroll direction
  const [inlineInView, setInlineInView] = useState(true);
  const [scrollDir, setScrollDir] = useState<'up' | 'down' | null>(null);
  const [atTop, setAtTop] = useState(true);

  // Dynamic header height (comes from header.tsx via ui:header-height)
  const [headerH, setHeaderH] = useState(80);
  // Track if sticky received any inline visibility events
  const gotInlineEventRef = useRef(false);

  // Listen for header height updates
  useEffect(() => {
    const onHeaderH = (e: any) => {
      const h = Number(e?.detail?.height);
      if (!Number.isNaN(h) && h > 0) setHeaderH(h);
    };
    window.addEventListener('ui:header-height', onHeaderH as EventListener);
    return () => window.removeEventListener('ui:header-height', onHeaderH as EventListener);
  }, []);

  // Observe this instance when in inline mode and broadcast its visibility
  useEffect(() => {
    if (mode !== 'inline') return;
    if (typeof window === 'undefined') return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const inView = !!entry.isIntersecting;
        setInlineInView(inView);
        try {
          window.dispatchEvent(
            new CustomEvent('categories:inline-inview', { detail: { inView } })
          );
        } catch {}
      },
      {
        root: null,
        threshold: 0,
        // dynamic header overlap: when covered by header, treat as not in view
        rootMargin: `${-Math.max(0, headerH)}px 0px 0px 0px`,
      }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mode, headerH]);

  // In sticky mode, listen for visibility and direction events
  useEffect(() => {
    if (mode !== 'sticky') return;
    if (typeof window === 'undefined') return;
    const onInView = (e: any) => { gotInlineEventRef.current = true; setInlineInView(Boolean(e?.detail?.inView)); };
    const onDir = (e: any) => setScrollDir((e?.detail?.direction as any) ?? null);
    const onScroll = () => setAtTop(window.scrollY < 10);
    window.addEventListener('categories:inline-inview', onInView as EventListener);
    window.addEventListener('ui:scroll-direction', onDir as EventListener);
    window.addEventListener('scroll', onScroll, { passive: true } as any);
    // initial
    onScroll();
    // fallback: if no inline visibility event received, infer from scroll
    const t = window.setTimeout(() => {
      if (!gotInlineEventRef.current) {
        const y = window.scrollY;
        // if scrolled below header + 40px without any signal, assume inline is out of view
        const inferredVisible = y <= Math.max(0, headerH + 40);
        setInlineInView(inferredVisible);
      }
    }, 400);
    return () => {
      window.removeEventListener('categories:inline-inview', onInView as EventListener);
      window.removeEventListener('ui:scroll-direction', onDir as EventListener);
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(t);
    };
  }, [mode, headerH]);

  const shouldShowSticky = mode === 'sticky' ? (!inlineInView && (scrollDir === 'up' || atTop)) : true;

  const scrollActiveTabIntoView = useCallback((id: number) => {
    const container = tablistRef.current;
    if (!container) return;

    const btn = container.querySelector(`[data-tab-id="${id}"]`) as HTMLElement | null;
    if (!btn) return;

    const maxScroll = container.scrollWidth - container.clientWidth;
    if (maxScroll <= 0) { lastCenterIdRef.current = id; return; }

    const target = Math.max(
      0,
      Math.min(btn.offsetLeft + btn.offsetWidth / 2 - container.clientWidth / 2, maxScroll)
    );

    const start = container.scrollLeft;
    const delta = target - start;

    // не боремся с руками пользователя
    if (userInteractingRef.current) return;

    // уже центрировали и почти на месте — выходим
    if (lastCenterIdRef.current === id && Math.abs(delta) < 0.5) return;

    const duration = 240; // мс (longer for smoothness)
    const startTime = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    setIsAnimating(true);

    const step = (now: number) => {
      if (userInteractingRef.current) { // пользователь начал скроллить — прекращаем анимацию
        rafIdRef.current = null;
        setIsAnimating(false);
        return;
      }

      const t = Math.min(1, (now - startTime) / duration);
      container.scrollLeft = start + delta * ease(t);
      if (t < 1) {
        rafIdRef.current = requestAnimationFrame(step);
      } else {
        rafIdRef.current = null;
        lastCenterIdRef.current = id;
        setIsAnimating(false);
      }
    };

    rafIdRef.current = requestAnimationFrame(step);
  }, []);


  const byAnchor = useMemo(() => {
    const m = new Map<string, number>();
    CATEGORIES.forEach((c) => m.set(c.anchor, c.id));
    return m;
  }, []);

  // Визуально активная вкладка: если открыт панель подкатегорий — подсвечиваем её категорию,
  // иначе берём из hash/route; если ничего не найдено — используем текущее значение из стора
  const activeTabId = useMemo(() => {
    // 1) Если открыт блок подкатегорий — он главный
    if (openPanel) {
      const id = byAnchor.get(openPanel.anchor);
      if (id) return id;
    }
    // 2) Если в хэше есть main — считаем его истинным источником
    if (route?.main) {
      const id = byAnchor.get(route.main);
      if (id) return id;
    }
    // 3) Иначе — что определил IntersectionObserver/стор
    return activeId;
  }, [openPanel, byAnchor, route?.main, activeId]);


  useEffect(() => {
    if (activeTabId) scrollActiveTabIntoView(activeTabId);
  }, [activeTabId, scrollActiveTabIntoView]);

  useEffect(() => {
    const container = tablistRef.current;
    if (!container || !activeTabId) return;
    const btnWrap = container.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    const btn = btnWrap?.querySelector('button') as HTMLElement | null;
    if (!btn) return;
    const crect = container.getBoundingClientRect();
    const brect = btn.getBoundingClientRect();
    setUnderline({ left: brect.left - crect.left + container.scrollLeft + 8, width: brect.width - 16 });
  }, [activeTabId]);

  useEffect(() => {
    const onResize = () => {
      const container = tablistRef.current;
      if (!container || !activeTabId) return;
      const btnWrap = container.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
      const btn = btnWrap?.querySelector('button') as HTMLElement | null;
      if (!btn) return;
      const crect = container.getBoundingClientRect();
      const brect = btn.getBoundingClientRect();
      setUnderline({ left: brect.left - crect.left + container.scrollLeft + 8, width: brect.width - 16 });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeTabId]);

  useEffect(() => {
    const el = tablistRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (lastCenterIdRef) lastCenterIdRef.current = null;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const findSectionEl = useCallback((anchor: string, id: number) => {
    if (typeof document === 'undefined') return null;
    const sel = [`[data-anchor="${anchor}"]`, `#${anchor}`, `#category-${id}`].join(',');
    return document.querySelector(sel) as HTMLElement | null;
  }, []);

  // Compute safe header offset from CSS vars + state
  const getHeaderOffset = useCallback(() => {
    if (typeof window === 'undefined') return (headerH || 80) + 10;
    const cs = getComputedStyle(document.documentElement);
    const hVar = parseFloat(cs.getPropertyValue('--header-h')) || headerH || 80;
    const safeVar = parseFloat(cs.getPropertyValue('--safe-top')) || 0;
    return Math.max(0, hVar) + Math.max(0, safeVar) + 10; // small gap
  }, [headerH]);

  // Wait for a section element to appear (DOM may still be mounting)
  const waitForSection = useCallback(async (anchor: string, id: number, timeout = 900): Promise<HTMLElement | null> => {
    const sel = `[data-anchor="${anchor}"] , #${anchor} , #category-${id}`;
    const existing = typeof document !== 'undefined' ? (document.querySelector(sel) as HTMLElement | null) : null;
    if (existing) return existing;
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return null;
    return new Promise<HTMLElement | null>((resolve) => {
      let done = false;
      const obs = new MutationObserver(() => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el && !done) { done = true; obs.disconnect(); resolve(el); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      const t = window.setTimeout(() => { if (!done) { done = true; obs.disconnect(); resolve(null); } }, timeout);
    });
  }, []);

  // Robust scroll: rAF before scroll, then verify and correct once more
  const scrollToSection = useCallback(async (anchor: string, id: number) => {
    const el = (findSectionEl(anchor, id)) || (await waitForSection(anchor, id));
    if (!el) return false;
    const offset = getHeaderOffset();

    // allow any panel/overlay state updates to apply first
    await new Promise(requestAnimationFrame);

    const calcTarget = () => window.scrollY + el.getBoundingClientRect().top - offset;
    let targetY = calcTarget();
    window.scrollTo({ top: targetY, behavior: 'smooth' });

    // verify after layout settles a bit
    window.setTimeout(() => {
      const verify = calcTarget(); // absolute target (already includes window.scrollY)
      if (Math.abs(verify - window.scrollY) > 4) {
        window.scrollTo({ top: verify, behavior: 'smooth' });
      }
    }, 320);
    return true;
  }, [findSectionEl, waitForSection, getHeaderOffset]);

  // on initial hash – set active main
  useEffect(() => {
    const { main } = route;
    const id = byAnchor.get(main);
    if (id && id !== activeId) setActiveId(id);
  }, [route, byAnchor, activeId, setActiveId]);

  // intersection to sync activeId (supports both #category-<id> and [data-anchor]/#<anchor>)
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || openPanel) return;

    // Build (element -> categoryId) pairs from multiple selector strategies
    const pairs: Array<[HTMLElement, number]> = [];
    CATEGORIES.forEach(({ id, anchor }) => {
      const selectors = [
        `[data-anchor="${anchor}"]`,
        `#${anchor}`,
        `#category-${id}`,
      ];
      selectors.forEach((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) pairs.push([el, id]);
      });
    });

    if (!pairs.length) return;

    // Disconnect previous
    observerRef.current?.disconnect();

    // Map observed element -> id
    const elementToId = new Map<Element, number>(pairs);

    observerRef.current = new IntersectionObserver((entries) => {
      // pick the most visible entry (by ratio) that is intersecting
      const vis = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (vis[0]) {
        const id = elementToId.get(vis[0].target);
        if (id && id !== activeId && !isAnimating) {
          // Debounce quick flips between sections to avoid jitter
          const now = performance.now();
          const store: any = observerRef;
          if (!store._lastChangeTime) store._lastChangeTime = 0;
          if (!store._lastId) store._lastId = null;
          const lastTime = store._lastChangeTime as number;
          const lastId = store._lastId as number | null;
          if (lastId !== id || now - lastTime > 120) {
            store._lastChangeTime = now;
            store._lastId = id;
            setActiveId(id);
          }
        }
      }
    }, {
      // Favor the element that is near the upper-middle of the viewport
      rootMargin: '-30% 0px -60% 0px',
      threshold: [0.1, 0.25, 0.5, 0.75],
    });

    // Observe all matched elements
    pairs.forEach(([el]) => observerRef.current!.observe(el));

    return () => observerRef.current?.disconnect();
  }, [activeId, setActiveId, openPanel, isAnimating]);

  const handlePrimaryCta = useCallback(() => {
    router.push(inPremium ? '/' : '/premium');
  }, [inPremium, router]);

  const handleClick = useCallback(async (id: number, anchor: string) => {
    if (isAnimating) return;

    setActiveId(id);
    const subs = SUBCATEGORIES[anchor];

    // Desktop (hover-capable): clicking не открывает панель — только ховер
    if (isHoverCapable && Array.isArray(subs) && subs.length) {
      if (openPanel) setOpenPanel(null);
    } else if (Array.isArray(subs) && subs.length) {
      // Touch/нет hover: открываем панель по клику (старое поведение)
      setOpenPanel({ anchor, id });
      if (!inPremium) writeHash(anchor, null);
      try { window.dispatchEvent(new CustomEvent('category:select', { detail: { id, anchor } })); } catch {}
      return; // ждём выбор подкатегории
    }

    const ok = await scrollToSection(anchor, id);
    if (!inPremium) writeHash(anchor, null);
    if (!ok && !inPremium) {
      // как крайний случай
      router.push(`/#${anchor}`);
    }
  }, [setActiveId, scrollToSection, openPanel, inPremium, router, isAnimating, isHoverCapable]);

  const handlePickSub = useCallback(async (sub: string) => {
    const panel = openPanel; 
    if (!panel) return;
    const { anchor, id } = panel;

    const normalized = SUB_ALIASES[sub] ?? sub;

    try {
      window.dispatchEvent(new CustomEvent('subcategory:select', { detail: { anchor, sub: normalized } }));
      window.dispatchEvent(new CustomEvent('category:select', { detail: { id, anchor, sub: normalized } }));
    } catch {}

    const ok = await scrollToSection(anchor, id);
    if (!inPremium) writeHash(anchor, normalized === 'all' ? null : normalized);
    if (!ok && !inPremium) {
      router.push(`/#${anchor}`);
    }

    setOpenPanel(null);
  }, [openPanel, scrollToSection, inPremium, router]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === 'Escape' && openPanel) setOpenPanel(null); 
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPanel]);

  // click-outside with micro-delay so first click won't close instantly
  useEffect(() => {
    if (!openPanel) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenPanel(null);
    };
    const t = setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
    return () => { 
      clearTimeout(t); 
      document.removeEventListener('click', onDocClick, true); 
    };
  }, [openPanel]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isAnimating) return;
    
    const idx = CATEGORIES.findIndex(c => c.id === activeId);
    if (e.key === 'ArrowRight') {
      const next = CATEGORIES[(idx + 1) % CATEGORIES.length];
      handleClick(next.id, next.anchor);
    } else if (e.key === 'ArrowLeft') {
      const prev = CATEGORIES[(idx - 1 + CATEGORIES.length) % CATEGORIES.length];
      handleClick(prev.id, prev.anchor);
    }
  }, [activeId, handleClick, isAnimating]);

  const Inner = (
    <div 
      ref={rootRef} 
      data-categories-root 
      onMouseDown={(e) => e.stopPropagation()} 
      className={cn('flex flex-col items-center w-full px-0', mode === 'inline' ? 'py-0' : 'py-3', className)}
    >
      {/* (keep all existing inner content unchanged) */}
      <LayoutGroup id="categoriesTabs">
        <div
          ref={tablistRef}
          className={cn(
            'relative inline-flex gap-1 bg-gray-200 p-1 rounded-2xl shadow-lg w-auto max-w-[1200px] mx-auto',
            'overflow-x-auto overflow-y-hidden no-scrollbar whitespace-nowrap overscroll-x-contain',
            'transition-all duration-300 touch-pan-x select-none'
          )}
          role="tablist"
          aria-label="Категории"
          onKeyDown={onKeyDown}
          onPointerDown={() => {
            userInteractingRef.current = true;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
          }}
          onPointerUp={() => {
            if (userInteractTimerRef.current) window.clearTimeout(userInteractTimerRef.current);
            userInteractTimerRef.current = window.setTimeout(() => {
              userInteractingRef.current = false;
            }, 250);
          }}
          onWheel={() => {
            userInteractingRef.current = true;
            if (userInteractTimerRef.current) window.clearTimeout(userInteractTimerRef.current);
            userInteractTimerRef.current = window.setTimeout(() => {
              userInteractingRef.current = false;
            }, 250);
          }}
        >
          {/* Non-intrusive underline showing current position */}
          <motion.span
            className="absolute bottom-1 h-[3px] rounded-full bg-black/70"
            style={{ left: 0, width: 0 }}
            animate={{ left: underline.left, width: underline.width }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
          {CATEGORIES.map(({ id, name, anchor }) => (
            <div
              key={id}
              className="relative inline-block"
              data-tab-id={id}
              onMouseEnter={() => {
                if (!isHoverCapable || isAnimating) return;
                const subs = SUBCATEGORIES[anchor];
                setActiveId(id);
                if (Array.isArray(subs) && subs.length) {
                  cancelHoverTimer();
                  setOpenPanel({ anchor, id });
                } else {
                  setOpenPanel(null);
                }
              }}
              onMouseLeave={() => {
                if (!isHoverCapable) return;
                scheduleClosePanel();
              }}
            >
              {activeTabId === id ? (
                <motion.span
                  layoutId="tabActiveBg"
                  transition={spring}
                  initial={false}
                  className="absolute inset-0 rounded-2xl"
                  style={{ willChange: 'transform', zIndex: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                />
              ) : (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl"
                  style={{ opacity: 0, pointerEvents: 'none', zIndex: 0 }}
                />
              )}
              <button
                type="button"
                role="tab"
                aria-selected={activeTabId === id}
                className={cn(
                  'relative z-10 flex items-center font-bold h-11 rounded-2xl px-5 outline-none transition-all duration-300',
                  'transform hover:scale-105 focus:scale-105 active:scale-[0.98]',
                  activeTabId === id
                    ? 'text-primary font-extrabold'
                    : 'text-black/80 hover:text-black hover:bg-white/50'
                )}
                onClick={() => handleClick(id, anchor)}
                disabled={isAnimating}
              >
                {name}
              </button>
            </div>
          ))}

          <div className="inline-flex gap-1" />

          <button
            type="button"
            onClick={handlePrimaryCta}
            className={cn(
              'flex items-center font-bold h-11 rounded-2xl px-5 bg-black text-white shadow-md shadow-gray-300',
              'transition-all duration-300 transform hover:scale-105 focus:scale-105 active:scale-[0.98]',
              'hover:bg-gray-800'
            )}
            aria-label={inPremium ? 'Перейти в Stage' : 'Перейти в Premium'}
            disabled={isAnimating}
          >
            <Sparkles color="#ffffff" className="h-4 w-4 mr-2" strokeWidth={2} />
            {inPremium ? 'Stage' : PREMIUM_LABEL}
          </button>
        </div>
      </LayoutGroup>

      {/* Subcategory panel with smooth animation */}
      <AnimatePresence mode="wait">
        {openPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
                opacity: { duration: 0.2, delay: 0.1 }
              }
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.25 },
                opacity: { duration: 0.15 }
              }
            }}
            className="w-full pointer-events-auto z-20 overflow-hidden mt-2"
            onMouseEnter={cancelHoverTimer}
            onMouseLeave={() => { if (isHoverCapable) scheduleClosePanel(); }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-white/90 backdrop-blur-sm border border-black/10 rounded-2xl shadow p-3 md:p-4 max-w-[1200px] mx-auto w-full px-3 md:px-4">
              <div className="text-xs md:text-sm text-black/60 mb-2 font-semibold">
                {LABELS[openPanel.anchor] || openPanel.anchor}: выберите подкатегорию
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handlePickSub('all')}
                  className="px-4 py-2 rounded-full border text-sm font-medium bg-black text-white border-black hover:opacity-90 transition-all duration-200 transform hover:scale-105"
                >
                  Все
                </button>
                {SUBCATEGORIES[openPanel.anchor]?.map((sub: string) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handlePickSub(sub)}
                    className="px-4 py-2 rounded-full border text-sm font-medium bg-white text-black border-black/10 hover:border-black transition-all duration-200 transform hover:scale-105"
                  >
                    {LABELS[sub] || sub}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (mode === 'sticky') {
    // Render as fixed overlay under header via portal so layout never jumps
    if (!mounted) return null;
    return createPortal(
      (
        <AnimatePresence>
          {shouldShowSticky && (
            <motion.div
              key="cats-sticky-overlay"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={glide}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                top: 'calc(var(--header-h, 80px) + var(--safe-top, 0px))',
                zIndex: 160,
                pointerEvents: 'auto',
              }}
            >
              {Inner}
            </motion.div>
          )}
        </AnimatePresence>
      ),
      document.body
    );
  }

  return Inner;
};