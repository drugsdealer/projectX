'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

type Slide = {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  mutedTitle: string;
  text: string;
  cta: { label: string; href: string };
  align: 'left' | 'right';
};

const SLIDES: Slide[] = [
  {
    src: '/img/MMbanner1.jpg',
    alt: 'Maison Margiela новая коллекция',
    eyebrow: 'Maison Margiela / New collection',
    title: 'Maison',
    mutedTitle: 'Margiela',
    text: 'Новая коллекция Maison Margiela: чистые силуэты, спокойная палитра и проверенные оригинальные позиции.',
    cta: { label: 'Смотреть коллекцию', href: '/MaisonMargiela/man-collection' },
    align: 'left',
  },
  {
    src: '/img/MMbanner2.jpg',
    alt: 'Stage Store premium selection',
    eyebrow: 'Stage Store / Premium edit',
    title: 'Curated',
    mutedTitle: 'Originals',
    text: 'Премиальная подборка редких размеров, обуви и аксессуаров в одной витрине.',
    cta: { label: 'Открыть Premium', href: '/premium' },
    align: 'right',
  },
];

const AUTO_MS = 7000;

export default function BannerMargiela() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const slide = SLIDES[index];
  const isRight = slide.align === 'right';

  const go = useCallback((next: number, direction: 1 | -1) => {
    setDir(direction);
    setIndex((next + SLIDES.length) % SLIDES.length);
  }, []);

  const goNext = useCallback(() => go(index + 1, 1), [go, index]);
  const goPrev = useCallback(() => go(index - 1, -1), [go, index]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(goNext, AUTO_MS);
  }, [goNext]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  const handleNav = (next: number, direction: 1 | -1) => {
    go(next, direction);
    resetTimer();
  };

  return (
    <section
      className="relative h-full w-full overflow-hidden bg-[#090907] text-white select-none"
      data-no-hero-tap
      onTouchStart={(e) => {
        touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        if (!touchRef.current) return;
        const dx = e.changedTouches[0].clientX - touchRef.current.x;
        const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.y);
        touchRef.current = null;
        if (Math.abs(dx) > 48 && Math.abs(dx) > dy) {
          if (dx < 0) handleNav(index + 1, 1);
          else handleNav(index - 1, -1);
        }
      }}
    >
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={slide.src}
          custom={dir}
          className="absolute inset-0"
          initial={{ x: dir > 0 ? '100%' : '-100%', scale: 1.03 }}
          animate={{ x: 0, scale: 1 }}
          exit={{ x: dir > 0 ? '-10%' : '10%', opacity: 0 }}
          transition={{ x: { type: 'spring', stiffness: 220, damping: 34 }, opacity: { duration: 0.25 }, scale: { duration: 1.2 } }}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={index === 0}
            sizes="100vw"
            className="object-cover object-center opacity-88"
          />
          <div
            className="absolute inset-0"
            style={{
              background: isRight
                ? 'radial-gradient(circle at 28% 42%, rgba(255,255,255,0.06), transparent 28%), linear-gradient(270deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.52) 38%, rgba(0,0,0,0.08) 72%, rgba(0,0,0,0.24) 100%)'
                : 'radial-gradient(circle at 72% 42%, rgba(255,255,255,0.06), transparent 28%), linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.52) 38%, rgba(0,0,0,0.08) 72%, rgba(0,0,0,0.24) 100%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/82 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div
        className="relative z-10 flex h-full items-end px-5 pb-16 pt-28 sm:px-8 sm:pb-20 lg:px-16"
        style={{ justifyContent: isRight ? 'flex-end' : 'flex-start' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${index}`}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[980px]"
            style={{ textAlign: isRight ? 'right' : 'left' }}
          >
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.34em] text-white/55">
              {slide.eyebrow}
            </p>

            <h1 className="max-w-5xl text-[clamp(4rem,14vw,11.5rem)] font-black uppercase leading-[0.78] tracking-[-0.09em]">
              {slide.title}
              <span className="block text-white/42">{slide.mutedTitle}</span>
            </h1>

            <div
              className="mt-7 flex max-w-2xl flex-col gap-5 sm:flex-row sm:items-center"
              style={{ marginLeft: isRight ? 'auto' : 0 }}
              data-no-hero-tap
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <p className="max-w-md text-sm font-medium leading-6 text-white/62 sm:text-base">
                {slide.text}
              </p>
              <Link
                href={slide.cta.href}
                className="group inline-flex w-fit shrink-0 items-center justify-center rounded-full bg-white px-7 py-3.5 text-[11px] font-black uppercase tracking-[0.22em] text-black transition duration-300 hover:bg-black hover:text-white"
              >
                {slide.cta.label}
                <span className="ml-3 transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-6 right-5 z-20 hidden text-right text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35 sm:block lg:right-16">
        {String(index + 1).padStart(2, '0')}
        <span className="mx-1 text-white/20">/</span>
        {String(SLIDES.length).padStart(2, '0')}
      </div>

      <div className="absolute bottom-6 left-5 right-5 z-20 flex items-center justify-between gap-4 sm:left-auto sm:right-40 sm:w-[210px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleNav(index - 1, -1);
          }}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/15 text-lg text-white/70 backdrop-blur transition hover:border-white hover:text-white"
          data-no-hero-tap
          aria-label="Предыдущий баннер"
        >
          ←
        </button>
        <div className="hidden h-px flex-1 bg-white/20 sm:block">
          <motion.div
            key={`progress-${index}`}
            className="h-px bg-white"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: AUTO_MS / 1000, ease: 'linear' }}
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleNav(index + 1, 1);
          }}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/15 text-lg text-white/70 backdrop-blur transition hover:border-white hover:text-white"
          data-no-hero-tap
          aria-label="Следующий баннер"
        >
          →
        </button>
      </div>
    </section>
  );
}
