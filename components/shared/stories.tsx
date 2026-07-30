"use client";

declare global {
  interface Window {
    __storyPaused?: boolean;
    __storyTimer?: ReturnType<typeof setTimeout>;
  }
}

import { useState, useEffect, useCallback, useRef } from "react";
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

export function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [active, setActive] = useState<Story | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [cursorSide, setCursorSide] = useState<"left" | "right" | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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
  }, []);

  const goNext = useCallback(() => {
    if (!active) return;
    const index = stories.findIndex((s) => s.id === active.id);
    const next = stories[index + 1];
    setSheetOpen(false);
    if (next) {
      setActive(next);
      setActiveSlide(0);
      setSeen((prev) => (prev.includes(next.id) ? prev : [...prev, next.id]));
    } else {
      setActive(null);
      setActiveSlide(0);
    }
  }, [active, stories]);

  const goPrev = useCallback(() => {
    if (!active) return;
    const index = stories.findIndex((s) => s.id === active.id);
    const prev = stories[index - 1];
    setSheetOpen(false);
    if (prev) {
      setActive(prev);
      setActiveSlide(0);
      setSeen((p) => (p.includes(prev.id) ? p : [...p, prev.id]));
    }
  }, [active, stories]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
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
    if (isPaused || sheetOpen) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (activeSlide < active.slides.length - 1) {
        setActiveSlide(activeSlide + 1);
      } else {
        goNext();
      }
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, activeSlide, isPaused, sheetOpen, goNext]);

  if (stories.length === 0) return null;

  const currentSlide = active?.slides[activeSlide];
  const slideProducts = currentSlide?.products ?? [];

  return (
    <div className="flex justify-center gap-4 px-4 py-5">
      {stories.map((story) => (
        <div key={story.id} className="flex flex-col items-center">
          <div
            onClick={() => {
              setActive(story);
              setActiveSlide(0);
              setSeen((prev) => (prev.includes(story.id) ? prev : [...prev, story.id]));
            }}
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[9999] animate-[fadeIn_0.3s_ease-out]">
          <div
            aria-hidden
            className="hidden md:block absolute inset-0 bg-cover bg-center scale-110 blur-3xl opacity-40 pointer-events-none"
            style={{ backgroundImage: `url(${currentSlide.image})` }}
          />
          <div
            className="relative mt-12 w-[92%] max-w-xs md:max-w-sm lg:max-w-md md:h-[600px] lg:h-[720px] bg-transparent rounded-xl overflow-hidden max-sm:mt-0 max-sm:w-full max-sm:h-full max-sm:max-w-full max-sm:rounded-none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              if (x > rect.width / 2) setCursorSide("right");
              else setCursorSide("left");
            }}
            onMouseLeave={() => setCursorSide(null)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
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
              key={activeSlide}
              className="w-full h-full transition-opacity duration-500 opacity-0 animate-[fadeSlide_0.5s_ease-out_forwards]"
            >
              <img
                src={currentSlide.image}
                alt={active.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2">
              {active.slides.map((slide, i) => (
                <div
                  key={slide.id}
                  className="h-1 w-14 bg-white/30 rounded overflow-hidden"
                >
                  {i === activeSlide && (
                    <div
                      key={activeSlide}
                      className={`h-full bg-white animate-[progress_5s_linear_forwards] ${
                        isPaused || sheetOpen ? "[animation-play-state:paused]" : ""
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setActive(null);
                setActiveSlide(0);
              }}
              className="absolute top-3 right-3 text-white text-2xl z-20"
            >
              ×
            </button>

            {/* градиент + подпись слайда + кнопка «Товары из сторис» */}
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
                <span className="text-[13px] font-bold uppercase tracking-[0.2em]">
                  Товары из сторис
                </span>
              </button>
            )}

            {/* шторка с товарами */}
            <div
              className={`absolute inset-x-0 bottom-0 z-30 bg-white rounded-t-2xl transition-transform duration-300 ease-out ${
                sheetOpen ? "translate-y-0" : "translate-y-full"
              }`}
              style={{ maxHeight: "70%" }}
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <span className="text-sm font-bold uppercase tracking-[0.15em] text-black">
                  Товары из сторис
                </span>
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
              <div
                className="overflow-y-auto px-4 pb-5 space-y-3"
                style={{ maxHeight: "calc(70vh - 56px)" }}
              >
                {slideProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={product.href}
                    className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2.5 hover:border-black transition"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-black truncate">{product.name}</div>
                      {product.subtitle && (
                        <div className="text-xs text-neutral-500 truncate">{product.subtitle}</div>
                      )}
                      {typeof product.price === "number" && (
                        <div className="text-sm font-bold text-black mt-0.5">
                          {formatPrice(product.price)}
                        </div>
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

          {(() => {
            const index = stories.findIndex((s) => s.id === active.id);
            const next = stories[index + 1];
            return next ? (
              <div className="absolute right-6 max-sm:right-3 max-sm:bottom-3 top-1/2 -translate-y-1/2 max-sm:top-auto max-sm:-translate-y-0 flex flex-col items-center text-white z-[99999]">
                <button
                  onClick={goNext}
                  className="text-xl mb-1 cursor-pointer select-none"
                >
                  →
                </button>
                
                
              </div>
            ) : null;
          })()}
          {(() => {
            const index = stories.findIndex((s) => s.id === active.id);
            const prev = stories[index - 1];
            return prev ? (
              <div className="absolute left-8 max-sm:left-6 max-sm:bottom-8 top-1/2 -translate-y-1/2 max-sm:top-auto max-sm:-translate-y-0 flex flex-col items-center text-white z-[99999]">
                <button
                  onClick={goPrev}
                  className="text-xl mb-1 cursor-pointer select-none"
                >
                  ←
                </button>
               
              </div>
            ) : null;
          })()}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes fadeSlide {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
