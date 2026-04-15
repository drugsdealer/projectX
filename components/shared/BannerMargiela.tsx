'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

type Slide = {
  src: string;
  alt?: string;
  eyebrow: string;
  headline: string[];
  sub: string;
  cta: { label: string; href: string };
  align: 'left' | 'right';
};

const SLIDES: Slide[] = [
  {
    src: '/img/MMbanner1.jpg',
    alt: 'Stage Store — Коллекция 2026',
    eyebrow: 'НОВАЯ КОЛЛЕКЦИЯ — 2026',
    headline: ['DROP', 'SS26'],
    sub: 'Свежие дропы. Оригинальные модели. Мировая доставка.',
    cta: { label: 'СМОТРЕТЬ', href: '/category/footwear' },
    align: 'left',
  },
  {
    src: '/img/MMbanner2.jpg',
    alt: 'Stage Store — Коллекция 2026',
    eyebrow: 'STAGE STORE — 2026',
    headline: ['NEW', 'WAVE.'],
    sub: 'Одежда. Обувь. Аксессуары. Только оригинал.',
    cta: { label: 'КАТАЛОГ', href: '/category/clothes' },
    align: 'right',
  },
];

const AUTO_MS = 6000;

export default function BannerMargiela() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mobile touch swipe
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  // Desktop: which arrow side is hovered
  const [hoveredArrow, setHoveredArrow] = useState<'left' | 'right' | null>(null);

  const go = useCallback((nextIdx: number, d: 1 | -1) => {
    setDir(d);
    setIndex(nextIdx);
  }, []);

  const goNext = useCallback(() => go((index + 1) % SLIDES.length, 1), [index, go]);
  const goPrev = useCallback(() => go((index - 1 + SLIDES.length) % SLIDES.length, -1), [index, go]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(goNext, AUTO_MS);
  }, [goNext]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const slide = SLIDES[index];
  const isRight = slide.align === 'right';

  return (
    <section
      className="relative w-full h-full overflow-hidden bg-black select-none"
      data-no-hero-tap
      // ── Mobile: swipe or tap half ──
      onTouchStart={(e) => {
        touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        if (!touchRef.current) return;
        const dx = e.changedTouches[0].clientX - touchRef.current.x;
        const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.y);
        const ex = e.changedTouches[0].clientX;
        const startX = touchRef.current.x;
        touchRef.current = null;

        // Swipe gesture (fast / long drag)
        if (Math.abs(dx) > 44 && dy < Math.abs(dx)) {
          if (dx < 0) { goNext(); resetTimer(); }
          else         { goPrev(); resetTimer(); }
          return;
        }

        // Tap on left / right half (small movement)
        if (Math.abs(dx) <= 10 && dy <= 10) {
          const halfW = (e.currentTarget as HTMLElement).offsetWidth / 2;
          if (ex < halfW) { goPrev(); resetTimer(); }
          else             { goNext(); resetTimer(); }
        }
      }}
      // ── Desktop: track mouse position for arrow visibility ──
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const third = rect.width / 3;
        if (x < third)             setHoveredArrow('left');
        else if (x > third * 2)    setHoveredArrow('right');
        else                       setHoveredArrow(null);
      }}
      onMouseLeave={() => setHoveredArrow(null)}
    >
      {/* ── BACKGROUND PHOTO ── */}
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={index}
          custom={dir}
          className="absolute inset-0"
          variants={{
            enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%' }),
            center: { x: 0 },
            exit:  (d: number) => ({ x: d > 0 ? '-8%' : '8%', opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x:       { type: 'spring', stiffness: 280, damping: 32 },
            opacity: { duration: 0.3 },
          }}
        >
          <motion.img
            src={slide.src}
            alt={slide.alt ?? ''}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: AUTO_MS / 1000, ease: 'easeOut' }}
            draggable={false}
          />

          {/* Side gradient */}
          <div
            className="absolute inset-0"
            style={{
              background: isRight
                ? 'linear-gradient(to left,  rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.08) 70%, transparent 100%)'
                : 'linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.08) 70%, transparent 100%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* ── TEXT ── */}
      <div
        className="absolute inset-0 z-10 flex flex-col justify-center"
        style={{
          alignItems: isRight ? 'flex-end' : 'flex-start',
          padding: '0 clamp(24px, 6vw, 96px)',
          paddingBottom: 80,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`txt-${index}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: isRight ? 'right' : 'left' }}
          >
            {/* Eyebrow */}
            <div
              className="inline-flex items-center gap-2.5 mb-5"
              style={{ flexDirection: isRight ? 'row-reverse' : 'row' }}
            >
              <span className="block w-8 h-[1.5px] bg-white/60" />
              <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.25em] text-white/60 uppercase">
                {slide.eyebrow}
              </span>
            </div>

            {/* Headline */}
            <div>
              {slide.headline.map((word, i) => (
                <div key={`${index}-w-${i}`} className="overflow-hidden">
                  <motion.span
                    className="block text-white font-black uppercase"
                    style={{
                      fontSize: 'clamp(70px, 20vw, 170px)',
                      letterSpacing: '-0.02em',
                      lineHeight: 0.87,
                    }}
                    initial={{ y: '105%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.55, delay: 0.05 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {word}
                  </motion.span>
                </div>
              ))}
            </div>

            {/* Subtitle */}
            <motion.p
              className="mt-4 sm:mt-5 text-white/55 text-sm sm:text-base font-medium tracking-wide max-w-xs"
              style={{ marginLeft: isRight ? 'auto' : 0 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.32, duration: 0.45 }}
            >
              {slide.sub}
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.4 }}
              className="mt-6 sm:mt-8"
              data-no-hero-tap
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              style={{ display: 'flex', justifyContent: isRight ? 'flex-end' : 'flex-start' }}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); router.push(slide.cta.href); }}
                className="group relative overflow-hidden px-8 py-3.5 bg-white text-black text-[11px] font-black tracking-[0.2em] uppercase active:scale-95 transition-transform"
                style={{ borderRadius: 0 }}
              >
                <span aria-hidden className="absolute inset-0 bg-black translate-x-[-101%] group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                <span className="relative z-10 group-hover:text-white transition-colors duration-200 delay-75">
                  {slide.cta.label}
                </span>
              </button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── DESKTOP ARROWS — appear on hover near edge ── */}
      <AnimatePresence>
        {hoveredArrow === 'left' && (
          <motion.button
            key="arrow-left"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); resetTimer(); }}
            className="hidden md:flex absolute left-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 items-center justify-center border border-white/30 text-white/70 hover:border-white hover:text-white backdrop-blur-sm bg-black/15 text-xl"
            style={{ borderRadius: 0 }}
            data-no-hero-tap
          >
            ←
          </motion.button>
        )}
        {hoveredArrow === 'right' && (
          <motion.button
            key="arrow-right"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.18 }}
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); resetTimer(); }}
            className="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 items-center justify-center border border-white/30 text-white/70 hover:border-white hover:text-white backdrop-blur-sm bg-black/15 text-xl"
            style={{ borderRadius: 0 }}
            data-no-hero-tap
          >
            →
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── PROGRESS BARS ── */}
      <div
        className="absolute bottom-5 left-0 right-0 z-20 flex gap-1.5"
        style={{ padding: '0 clamp(24px, 6vw, 96px)' }}
        data-no-hero-tap
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); go(i, i > index ? 1 : -1); resetTimer(); }}
            className="relative h-[2px] flex-1 bg-white/20 overflow-hidden"
            style={{ borderRadius: 0 }}
          >
            {i === index && (
              <motion.span
                key={`p-${index}`}
                className="absolute inset-y-0 left-0 bg-white"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: AUTO_MS / 1000, ease: 'linear' }}
              />
            )}
            {i < index && <span className="absolute inset-0 bg-white" />}
          </button>
        ))}
      </div>

      {/* ── SLIDE COUNTER (desktop) ── */}
      <div className="hidden md:flex absolute bottom-4 right-6 z-20 items-center gap-1.5 font-mono text-[11px] tracking-widest text-white/30">
        <span className="text-white/70 font-bold">{String(index + 1).padStart(2, '0')}</span>
        <span>/</span>
        <span>{String(SLIDES.length).padStart(2, '0')}</span>
      </div>
    </section>
  );
}
