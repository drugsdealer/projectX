"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { ChevronUp, ChevronRight, X } from "lucide-react";

type StoryProduct = {
  id: number;
  name: string;
  subtitle: string | null;
  price: number | null;
  image: string;
  href: string;
};

type Slide = {
  id: number;
  image: string;
  thumb: string;
  caption: string | null;
  description: string | null;
  products: StoryProduct[];
};

type Story = {
  id: number;
  title: string;
  slides: Slide[];
};

const SLIDE_DURATION = 5000;

const formatPrice = (price?: number | null) => {
  if (typeof price !== "number" || Number.isNaN(price)) return "";
  return `${Math.round(price).toLocaleString("ru-RU")} ₽`;
};

function loadSeen(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("seenStories.v2");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
      }
    }
    const legacy = localStorage.getItem("seenStories");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
      }
    }
  } catch {}
  return [];
}

// Тихая предзагрузка картинки в кэш браузера — устраняет "лаги"/бланк-кадр при переходе.
function preload(src?: string | null) {
  if (!src || typeof window === "undefined") return;
  const img = new Image();
  img.src = src;
}

function PeekCard({
  story,
  side,
  onClick,
}: {
  story: Story;
  side: "left" | "right";
  onClick: () => void;
}) {
  const cover = story.slides[0];
  if (!cover) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={story.title}
      className={`hidden md:block relative shrink-0 w-[200px] lg:w-[240px] h-[78%] rounded-2xl overflow-hidden opacity-55 hover:opacity-80 scale-[0.94] hover:scale-[0.96] transition-all duration-200 cursor-pointer ${
        side === "left" ? "origin-right" : "origin-left"
      }`}
    >
      <img src={cover.image} alt={story.title} className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute top-3 left-3 right-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/70 shrink-0 bg-white/20">
          <img src={cover.thumb} alt="" className="w-full h-full object-cover" />
        </div>
        <span className="text-[11px] font-semibold text-white/90 truncate">{story.title}</span>
      </div>
    </button>
  );
}

export function Stories({ initialStories }: { initialStories?: Story[] }) {
  const [stories, setStories] = useState<Story[]>(initialStories ?? []);
  const [active, setActive] = useState<Story | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [cursorSide, setCursorSide] = useState<"left" | "right" | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    // Сторис уже пришли с сервера вместе с первым HTML (см. app/page.tsx) —
    // повторный запрос нужен только как фоллбэк, если серверных данных не было.
    if (initialStories && initialStories.length > 0) return;
    let cancelled = false;
    fetch("/api/stories", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success) setStories(data.stories || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialStories]);

  const activeIndex = active ? stories.findIndex((s) => s.id === active.id) : -1;
  const prevStory = activeIndex > 0 ? stories[activeIndex - 1] : null;
  const nextStory = activeIndex >= 0 && activeIndex < stories.length - 1 ? stories[activeIndex + 1] : null;

  const openStory = useCallback((story: Story) => {
    setActive(story);
    setActiveSlide(0);
    setSeen((prev) => (prev.includes(story.id) ? prev : [...prev, story.id]));
  }, []);

  const goNext = useCallback(() => {
    if (!active) return;
    const index = stories.findIndex((s) => s.id === active.id);
    const next = stories[index + 1];
    setSheetOpen(false);
    if (next) {
      openStory(next);
    } else {
      setActive(null);
      setActiveSlide(0);
    }
  }, [active, stories, openStory]);

  const goPrev = useCallback(() => {
    if (!active) return;
    const index = stories.findIndex((s) => s.id === active.id);
    const prev = stories[index - 1];
    setSheetOpen(false);
    if (prev) openStory(prev);
  }, [active, stories, openStory]);

  // Предзагрузка: следующий слайд текущей сторис + обложки соседних сторис.
  useEffect(() => {
    if (!active) return;
    preload(active.slides[activeSlide + 1]?.image);
    preload(nextStory?.slides[0]?.image);
    preload(prevStory?.slides[0]?.image);
  }, [active, activeSlide, nextStory, prevStory]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") {
        setActive(null);
        setActiveSlide(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, goNext, goPrev]);

  useEffect(() => {
    setSeen(loadSeen());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("seenStories.v2", JSON.stringify(seen));
      localStorage.removeItem("seenStories");
    } catch {}
  }, [seen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia ? window.matchMedia("(hover: hover)") : null;
    const update = () => setCanHover(!!mq?.matches);
    update();
    if (mq?.addEventListener) mq.addEventListener("change", update);
    else if (mq?.addListener) mq.addListener(update);
    return () => {
      if (mq?.removeEventListener) mq.removeEventListener("change", update);
      else if (mq?.removeListener) mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    setSheetOpen(false);
  }, [activeSlide, active]);

  useEffect(() => {
    if (!active) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (isPaused || sheetOpen) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (activeSlide < active.slides.length - 1) {
        setActiveSlide(activeSlide + 1);
      } else {
        goNext();
      }
    }, SLIDE_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, activeSlide, isPaused, sheetOpen, goNext]);

  const currentSlide = active?.slides[activeSlide];
  const slideProducts = useMemo(() => currentSlide?.products ?? [], [currentSlide]);

  if (stories.length === 0) return null;

  return (
    <div className="flex justify-center gap-4 px-4 py-5">
      {stories.map((story) => (
        <div key={story.id} className="flex flex-col items-center">
          <div
            onClick={() => openStory(story)}
            className={`w-20 h-20 rounded-full overflow-hidden cursor-pointer flex items-center justify-center bg-gray-200 ${
              seen.includes(story.id)
                ? "ring-1 ring-black/40"
                : "ring-2 ring-black ring-offset-2 ring-offset-white"
            }`}
          >
            <img
              src={story.slides[0]?.thumb}
              alt={story.title}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="mt-2 text-xs font-semibold text-center text-black w-20 break-words leading-tight">
            {story.title}
          </div>
        </div>
      ))}

      {active && currentSlide && (
        <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center overflow-hidden animate-[fadeIn_0.25s_ease-out]">
          <button
            onClick={() => {
              setActive(null);
              setActiveSlide(0);
            }}
            aria-label="Закрыть"
            className="absolute top-3 right-3 md:top-6 md:right-6 z-[100] w-9 h-9 flex items-center justify-center text-white/90 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative flex items-center justify-center gap-3 lg:gap-4 w-full h-full max-sm:gap-0">
            {prevStory && <PeekCard story={prevStory} side="left" onClick={() => openStory(prevStory)} />}

            <div
              className="relative shrink-0 w-full h-full md:w-[380px] md:h-[85%] lg:w-[420px] md:rounded-2xl overflow-hidden bg-neutral-900"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                setCursorSide(x > rect.width / 2 ? "right" : "left");
              }}
              onMouseLeave={() => setCursorSide(null)}
              onTouchStart={(e) => {
                setIsPaused(true);
                const t = e.touches[0];
                touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
              }}
              onTouchEnd={(e) => {
                setIsPaused(false);
                const start = touchStart.current;
                touchStart.current = null;
                if (!start) return;
                const end = e.changedTouches[0];
                const dx = end.clientX - start.x;
                const dy = end.clientY - start.y;
                const dt = Date.now() - start.t;
                // Свайп — переключаем сторис целиком. Короткий тап — следующий/предыдущий слайд.
                if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                  if (dx < 0) goNext();
                  else goPrev();
                  return;
                }
                if (dt < 400 && Math.abs(dx) < 15 && Math.abs(dy) < 15) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = end.clientX - rect.left;
                  if (x > rect.width / 2) {
                    if (activeSlide < active.slides.length - 1) setActiveSlide(activeSlide + 1);
                    else goNext();
                  } else {
                    if (activeSlide > 0) setActiveSlide(activeSlide - 1);
                    else goPrev();
                  }
                }
              }}
              onClick={() => {
                if (!active || sheetOpen) return;
                if (cursorSide === "right") {
                  if (activeSlide < active.slides.length - 1) setActiveSlide(activeSlide + 1);
                  else goNext();
                } else if (cursorSide === "left") {
                  if (activeSlide > 0) setActiveSlide(activeSlide - 1);
                  else goPrev();
                }
              }}
              style={{
                cursor: canHover
                  ? cursorSide === "right"
                    ? "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" fill=\"white\"><text x=\"0\" y=\"24\" font-size=\"28\">→</text></svg>') 16 16, auto"
                    : cursorSide === "left"
                    ? "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" fill=\"white\"><text x=\"0\" y=\"24\" font-size=\"28\">←</text></svg>') 16 16, auto"
                    : "default"
                  : "default",
              }}
            >
              <div
                key={currentSlide.id}
                className="w-full h-full transition-opacity duration-300 opacity-0 animate-[fadeSlide_0.3s_ease-out_forwards]"
              >
                <img
                  src={currentSlide.image}
                  alt={active.title}
                  className="w-full h-full object-cover"
                  fetchPriority="high"
                />
              </div>

              <div className="absolute top-2 left-2 right-2 flex gap-1.5">
                {active.slides.map((slide, i) => (
                  <div key={slide.id} className="h-1 flex-1 bg-white/30 rounded overflow-hidden">
                    {i === activeSlide ? (
                      <div
                        key={activeSlide}
                        className={`h-full bg-white animate-[progress_5s_linear_forwards] ${
                          isPaused || sheetOpen ? "[animation-play-state:paused]" : ""
                        }`}
                      />
                    ) : i < activeSlide ? (
                      <div className="h-full bg-white" />
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="absolute top-6 left-3 right-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/70 shrink-0 bg-white/20">
                  <img src={active.slides[0]?.thumb} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-semibold text-white/95 truncate">{active.title}</span>
              </div>

              {(currentSlide.caption || currentSlide.description || slideProducts.length > 0) && (
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
              )}

              {(currentSlide.caption || currentSlide.description) &&
                (slideProducts.length > 0 ? (
                  <Link
                    href={slideProducts[0].href}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-4 right-4 z-20 text-white"
                    style={{ bottom: "3.75rem" }}
                  >
                    {currentSlide.caption && (
                      <div className="text-lg font-extrabold uppercase leading-tight">{currentSlide.caption}</div>
                    )}
                    {currentSlide.description && (
                      <div className="mt-1 text-sm text-white/85 leading-snug line-clamp-2">
                        {currentSlide.description}
                      </div>
                    )}
                  </Link>
                ) : (
                  <div className="absolute left-4 right-4 bottom-4 z-20 text-white pointer-events-none">
                    {currentSlide.caption && (
                      <div className="text-lg font-extrabold uppercase leading-tight">{currentSlide.caption}</div>
                    )}
                    {currentSlide.description && (
                      <div className="mt-1 text-sm text-white/85 leading-snug line-clamp-2">
                        {currentSlide.description}
                      </div>
                    )}
                  </div>
                ))}

              {slideProducts.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused(true);
                    setSheetOpen(true);
                  }}
                  className="absolute bottom-0 inset-x-0 z-20 flex flex-col items-center gap-0.5 pb-4 pt-2 text-white"
                >
                  <ChevronUp className="w-5 h-5" />
                  <span className="text-[13px] font-bold uppercase tracking-[0.2em]">Товары из сторис</span>
                </button>
              )}

              <div
                className={`absolute inset-x-0 bottom-0 z-30 bg-white rounded-t-2xl transition-transform duration-300 ease-out ${
                  sheetOpen ? "translate-y-0" : "translate-y-full"
                }`}
                style={{ maxHeight: "70%" }}
              >
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <span className="text-sm font-bold uppercase tracking-[0.15em] text-black">Товары из сторис</span>
                  <button
                    onClick={() => {
                      setSheetOpen(false);
                      setIsPaused(false);
                    }}
                    aria-label="Закрыть товары"
                    className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-black"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto px-4 pb-5 space-y-3" style={{ maxHeight: "calc(70vh - 56px)" }}>
                  {slideProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={product.href}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2.5 hover:border-black transition"
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-black truncate">{product.name}</div>
                        {product.subtitle && (
                          <div className="text-xs text-neutral-500 truncate">{product.subtitle}</div>
                        )}
                        {typeof product.price === "number" && (
                          <div className="text-sm font-bold text-black mt-0.5">{formatPrice(product.price)}</div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
              {sheetOpen && (
                <button
                  aria-label="Закрыть товары"
                  onClick={() => {
                    setSheetOpen(false);
                    setIsPaused(false);
                  }}
                  className="absolute inset-0 z-[25] bg-black/30"
                />
              )}
            </div>

            {nextStory && <PeekCard story={nextStory} side="right" onClick={() => openStory(nextStory)} />}
          </div>

          {nextStory && (
            <button
              onClick={goNext}
              aria-label="Следующая сторис"
              className="hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-[60] w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition"
            >
              →
            </button>
          )}
          {prevStory && (
            <button
              onClick={goPrev}
              aria-label="Предыдущая сторис"
              className="hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-[60] w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition"
            >
              ←
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes fadeSlide {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
