'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

type Slide = {
  src: string;
  alt?: string;
};

const SLIDES: Slide[] = [
  { src: '/img/MMbanner1.jpg', alt: 'Autumn–Winter 2026 — Look 1' },
  { src: '/img/MMbanner2.jpg', alt: 'Autumn–Winter 2026 — Look 2' },
];

const AUTO_MS = 8000;

export default function BannerMargiela() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setIndex((i) => (i + 1) % SLIDES.length);
    timer.current = window.setInterval(tick, AUTO_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const current = SLIDES[index];
  const goToCollection = (href: string) => (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(href);
  };

  return (
    <section className="relative w-full overflow-hidden bg-[#111]" data-no-hero-tap>
      <div className="absolute inset-0">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={current.src}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          >
            <motion.img
              src={current.src}
              alt={current.alt ?? ''}
              className="h-full w-full object-cover select-none pointer-events-none"
              initial={{ scale: 1.04 }}
              animate={{ scale: 1 }}
              transition={{ duration: AUTO_MS / 2000, ease: 'easeOut' }}
            />
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/20 to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-12 lg:px-16">
        <div className="min-h-[70vh] md:min-h-[84vh] flex items-end md:items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center pb-16 md:pb-0"
          >
            <div className="text-xs tracking-[0.2em] text-white/80 font-semibold mb-3">
              NEW ARRIVALS
            </div>

            <h1 className="text-white font-serif text-[28px] md:text-[36px] lg:text-[40px] leading-snug">
              Autumn–Winter 2026 Collection
            </h1>

            <div
              className="mt-6 flex items-center justify-center gap-8 relative z-20"
              data-no-hero-tap
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={goToCollection('/MaisonMargiela/woman-collection')}
                onTouchStart={goToCollection('/MaisonMargiela/woman-collection')}
                className="text-white text-sm md:text-base font-semibold border-b border-white/80 hover:border-white transition pointer-events-auto"
              >
                WOMEN
              </button>

              <button
                type="button"
                onClick={goToCollection('/MaisonMargiela/man-collection')}
                onTouchStart={goToCollection('/MaisonMargiela/man-collection')}
                className="text-white text-sm md:text-base font-semibold border-b border-white/80 hover:border-white transition pointer-events-auto"
              >
                MEN
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 pb-6 flex items-center justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-white' : 'w-3 bg-white/50 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
