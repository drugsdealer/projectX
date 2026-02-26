"use client";

declare global {
  interface Window {
    __storyPaused?: boolean;
    __storyTimer?: ReturnType<typeof setTimeout>;
  }
}

import { useState, useEffect } from "react";
import { useRef } from "react";

type Story = {
  id: number;
  title: string;
  slides: string[];
};

const testStories: Story[] = [
  {
    id: 1,
    title: "Неделя Acne",
    slides: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763127821/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_16.43.33_ilx8ql.png",
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763133407/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_18.16.39_hu9xjn.png",
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763133813/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_18.23.26_jxd8bb.png"
    ]
  },
  {
    id: 2,
    title: "Дроп Fragment x Travis Scott",
    slides: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763129091/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_17.04.43_tdixee.png",
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763135311/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_18.48.22_u8qeuc.png"
    ]
  },
  {
    id: 3,
    title: "Распродажа Minion x Swarovski",
    slides: [
      "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763129245/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-11-14_%D0%B2_17.07.15_zgaauj.png"
    ]
  }
];

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
  const [active, setActive] = useState<Story | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [cursorSide, setCursorSide] = useState<"left" | "right" | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const goNext = () => {
    if (!active) return;
    const index = testStories.findIndex(s => s.id === active.id);
    const next = testStories[index + 1];
    if (next) {
      setActive(next);
      setActiveSlide(0);
      setSeen((prev) => (prev.includes(next.id) ? prev : [...prev, next.id]));
    } else {
      setActive(null);
      setActiveSlide(0);
    }
  };

  const goPrev = () => {
    if (!active) return;
    const index = testStories.findIndex(s => s.id === active.id);
    const prev = testStories[index - 1];
    if (prev) {
      setActive(prev);
      setActiveSlide(0);
    }
    if (prev) {
      setSeen((p) => (p.includes(prev.id) ? p : [...p, prev.id]));
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active]);

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
    if (!active) return;
    if (isPaused) return;
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
  }, [active, activeSlide, isPaused]);

  return (
    <div className="flex justify-center gap-4 px-4 py-5">
      {testStories.map((story) => (
        <div key={story.id} className="flex flex-col items-center">
          <div
            onClick={() => {
              setActive(story);
              setActiveSlide(0);
              setSeen((prev) => (prev.includes(story.id) ? prev : [...prev, story.id]));
            }}
            className={`w-20 h-20 rounded-full overflow-hidden cursor-pointer flex items-center justify-center bg-gray-200 ${
              seen.includes(story.id)
                ? "border-0"
                : "ring-2 ring-black ring-offset-2 ring-offset-white"
            }`}
          >
            <img
              src={story.slides[0]}
              alt={story.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="mt-2 text-xs font-semibold text-center text-black w-20 break-words leading-tight">
            {story.title}
          </div>
        </div>
      ))}

      {active && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[9999] animate-[fadeIn_0.3s_ease-out]">
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
              if (!active) return;
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
                src={active.slides[activeSlide]}
                alt={active.title}
                className="w-full h-full object-cover"
              />
            </div>

            <button
              className="absolute bottom-14 left-1/2 -translate-x-1/2 px-5 py-2 border border-white/70 text-white/90 rounded-full backdrop-blur-sm"
            >
              Перейти
            </button>

            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2">
              {active.slides.map((_, i) => (
                <div
                  key={i}
                  className="h-1 w-14 bg-white/30 rounded overflow-hidden"
                >
                  {i === activeSlide && (
                    <div key={activeSlide} className="h-full bg-white animate-[progress_5s_linear_forwards]" />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setActive(null);
                setActiveSlide(0);
              }}
              className="absolute top-3 right-3 text-white text-2xl"
            >
              ×
            </button>
          </div>
          {(() => {
            const index = testStories.findIndex(s => s.id === active.id);
            const next = testStories[index + 1];
            return next ? (
              <div className="absolute right-6 max-sm:right-3 max-sm:bottom-3 top-1/2 -translate-y-1/2 max-sm:top-auto max-sm:-translate-y-0 flex flex-col items-center text-white z-[99999]">
                <button
                  onClick={goNext}
                  className="text-xl mb-1 cursor-pointer select-none"
                >
                  →
                </button>
                <span className="text-xs opacity-70">Следующая</span>
                <span className="text-xs opacity-70 mb-1">сторис</span>
                <span className="text-sm font-semibold max-w-[150px] text-center leading-tight">
                  {next.title}
                </span>
              </div>
            ) : null;
          })()}
          {(() => {
            const index = testStories.findIndex(s => s.id === active.id);
            const prev = testStories[index - 1];
            return prev ? (
              <div className="absolute left-8 max-sm:left-6 max-sm:bottom-8 top-1/2 -translate-y-1/2 max-sm:top-auto max-sm:-translate-y-0 flex flex-col items-center text-white z-[99999]">
                <button
                  onClick={goPrev}
                  className="text-xl mb-1 cursor-pointer select-none"
                >
                  ←
                </button>
                <span className="text-xs opacity-70">Предыдущая</span>
                <span className="text-xs opacity-70 mb-1">сторис</span>
                <span className="text-sm font-semibold max-w-[150px] text-center leading-tight">
                  {prev.title}
                </span>
              </div>
            ) : null;
          })()}
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes progress {
            from { width: 0%; }
            to { width: 100%; }
          }
          @keyframes progress_5s {
            from { width: 0%; }
            to { width: 100%; }
          }
          @keyframes fadeSlide {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
