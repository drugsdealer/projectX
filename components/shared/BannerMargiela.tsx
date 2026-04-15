'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

type Slide = {
  src: string;
  alt?: string;
  eyebrow: string;
  headline: string[];
  sub?: string;
  cta: { label: string; href: string }[];
  align?: 'left' | 'center' | 'right';
  tint?: string;
};

const SLIDES: Slide[] = [
  {
    src: '/img/MMbanner1.jpg',
    alt: 'Stage Store — новая коллекция',
    eyebrow: 'NEW DROP 2026',
    headline: ['ТОЛЬКО', 'ОРИГИНАЛ'],
    sub: 'Эксклюзивные модели. Мировая доставка.',
    cta: [
      { label: 'СМОТРЕТЬ', href: '/category/footwear' },
    ],
    align: 'left',
    tint: 'from-black/80 via-black/30 to-transparent',
  },
  {
    src: '/img/MMbanner2.jpg',
    alt: 'Stage Store — одежда и аксессуары',
    eyebrow: 'STAGE STORE',
    headline: ['БЕЗ', 'КОМПРОМИССОВ'],
    sub: 'Одежда. Обувь. Аксессуары.',
    cta: [
      { label: 'КАТАЛОГ', href: '/category/clothes' },
    ],
    align: 'right',
    tint: 'from-black/80 via-black/30 to-transparent',
  },
];

const AUTO_MS = 6000;

export default function BannerMargiela() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLElement>(null);

  // Touch swipe
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback((next: number, d: 1 | -1) => {
    setPrev(index);
    setDir(d);
    setIndex(next);
  }, [index]);

  const next = useCallback(() => go((index + 1) % SLIDES.length, 1), [index, go]);
  const prev_ = useCallback(() => go((index - 1 + SLIDES.length) % SLIDES.length, -1), [index, go]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, AUTO_MS);
  }, [next]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const slide = SLIDES[index];

  return (
    <section
      ref={containerRef}
      className="relative w-full overflow-hidden bg-black select-none"
      style={{ height: 'min(100svh, 700px)', minHeight: 320 }}
      data-no-hero-tap
      onTouchStart={(e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        if (!touchRef.current) return;
        const dx = e.changedTouches[0].clientX - touchRef.current.x;
        const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.y);
        touchRef.current = null;
        if (Math.abs(dx) < 40 || dy > Math.abs(dx)) return;
        if (dx < 0) { next(); resetTimer(); } else { prev_(); resetTimer(); }
      }}
    >
      {/* === SLIDES === */}
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={index}
          custom={dir}
          variants={{
            enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', scale: 1.04 }),
            center: { x: 0, scale: 1 },
            exit: (d: number) => ({ x: d > 0 ? '-6%' : '6%', scale: 0.97, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ x: { type: 'spring', stiffness: 260, damping: 30 }, scale: { duration: 0.5 }, opacity: { duration: 0.25 } }}
          className="absolute inset-0"
        >
          {/* Photo */}
          <motion.img
            src={slide.src}
            alt={slide.alt ?? ''}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: AUTO_MS / 1000, ease: 'easeOut' }}
            draggable={false}
          />

          {/* Gradient tint */}
          <div
            className={`absolute inset-0 bg-gradient-to-r ${slide.tint}`}
            style={{ background: slide.align === 'right'
              ? 'linear-gradient(to left, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.28) 50%, transparent 100%)'
              : 'linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.28) 50%, transparent 100%)'
            }}
          />
          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* === TEXT BLOCK === */}
      <div
        className="absolute inset-0 z-10 flex flex-col justify-end pb-14 md:pb-0 md:justify-center px-6 sm:px-10 md:px-16 lg:px-24"
        style={{ alignItems: slide.align === 'right' ? 'flex-end' : slide.align === 'center' ? 'center' : 'flex-start' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${index}`}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-xl"
            style={{ textAlign: slide.align ?? 'left' }}
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="block w-6 h-[2px] bg-white" />
              <span className="text-[11px] font-bold tracking-[0.22em] text-white/70 uppercase">
                {slide.eyebrow}
              </span>
            </div>

            {/* Headline */}
            <div className="overflow-hidden">
              {slide.headline.map((line, i) => (
                <motion.h1
                  key={`${index}-${i}`}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.5, delay: 0.08 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="block text-white font-black uppercase leading-none tracking-tight"
                  style={{ fontSize: 'clamp(52px, 10vw, 120px)', lineHeight: 0.9 }}
                >
                  {line}
                </motion.h1>
              ))}
            </div>

            {/* Subtitle */}
            {slide.sub && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="mt-5 text-white/60 text-sm md:text-base font-medium tracking-wide"
              >
                {slide.sub}
              </motion.p>
            )}

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.4 }}
              className="mt-7 flex flex-wrap gap-3"
              style={{ justifyContent: slide.align === 'right' ? 'flex-end' : slide.align === 'center' ? 'center' : 'flex-start' }}
              data-no-hero-tap
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              {slide.cta.map((c) => (
                <button
                  key={c.href}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); router.push(c.href); }}
                  className="group relative px-8 py-3 bg-white text-black text-xs font-black tracking-[0.18em] uppercase overflow-hidden transition-colors hover:bg-white/90 active:scale-95"
                  style={{ borderRadius: 0 }}
                >
                  <span className="relative z-10">{c.label}</span>
                  {/* slide-in hover fill */}
                  <span className="absolute inset-0 bg-black translate-x-[-101%] group-hover:translate-x-0 transition-transform duration-300 ease-in-out z-0" />
                  <span className="absolute inset-0 text-white text-xs font-black tracking-[0.18em] uppercase flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 z-20">
                    {c.label}
                  </span>
                </button>
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* === ARROWS (desktop only) === */}
      <div className="hidden md:flex absolute inset-y-0 left-0 right-0 z-20 items-center justify-between px-5 pointer-events-none">
        {[{ fn: prev_, symbol: '←' }, { fn: next, symbol: '→' }].map(({ fn, symbol }, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); fn(); resetTimer(); }}
            className="pointer-events-auto w-11 h-11 flex items-center justify-center border border-white/30 text-white/60 hover:border-white hover:text-white transition-all duration-200 backdrop-blur-sm bg-white/5 hover:bg-white/10 text-lg font-light"
            style={{ borderRadius: 0 }}
          >
            {symbol}
          </button>
        ))}
      </div>

      {/* === PROGRESS BAR === */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex gap-1 px-6 sm:px-10 pb-5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); go(i, i > index ? 1 : -1); resetTimer(); }}
            className="relative h-[2px] flex-1 bg-white/25 overflow-hidden"
            style={{ borderRadius: 0 }}
            data-no-hero-tap
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {i === index && (
              <motion.span
                className="absolute inset-y-0 left-0 bg-white"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: AUTO_MS / 1000, ease: 'linear' }}
                key={`prog-${index}`}
              />
            )}
            {i < index && <span className="absolute inset-0 bg-white" />}
          </button>
        ))}
      </div>

      {/* === SLIDE NUMBER === */}
      <div className="absolute top-6 right-6 z-20 hidden md:flex items-center gap-2 text-white/40 text-xs font-mono tracking-widest">
        <span className="text-white font-bold">{String(index + 1).padStart(2, '0')}</span>
        <span>/</span>
        <span>{String(SLIDES.length).padStart(2, '0')}</span>
      </div>
    </section>
  );
}
