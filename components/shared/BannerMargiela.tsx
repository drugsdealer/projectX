'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

type Slide = {
  id: string;
  // Image slide
  src?: string;
  // Video slide
  videoSrc?: string;       // desktop video
  videoSrcMobile?: string; // mobile video
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
    id: 'maison-margiela',
    src: 'https://ik.imagekit.io/qowmy92ny/stage/products/gallery/Tabi_HeroBanner_16x9.jpg',
    alt: 'Maison Margiela Tabi',
    eyebrow: 'Maison Margiela / Tabi collection',
    title: 'Maison',
    mutedTitle: 'Margiela',
    text: 'Новая коллекция Maison Margiela: чистые силуэты, спокойная палитра и проверенные оригинальные позиции.',
    cta: { label: 'Смотреть коллекцию', href: '/brand/maison-margiela' },
    align: 'left',
  },
  {
    id: 'ap-swatch',
    videoSrc: 'https://ik.imagekit.io/qowmy92ny/swatch-x-AP_1920x917-v3.mov',
    videoSrcMobile: 'https://ik.imagekit.io/qowmy92ny/swatch%20x%20AP%20v7%209-16.mov',
    alt: 'Audemars Piguet × Swatch коллаборация',
    eyebrow: 'Audemars Piguet × Swatch / Limited collaboration',
    title: 'AP ×',
    mutedTitle: 'Swatch',
    text: 'Лимитированная коллаборация двух легенд: швейцарская точность встречает дерзкий дизайн.',
    cta: { label: 'Смотреть коллаборацию', href: '/search' },
    align: 'left',
  },
];

const AUTO_MS = 7000;

function SlideBackground({ slide, priority }: { slide: Slide; priority: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // autoplay video when it becomes active
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const isRight = slide.align === 'right';

  // Apply ImageKit video transformations for smaller file size
  const applyIKVideoTransform = (url: string, mobile: boolean) => {
    if (!url.includes('ik.imagekit.io')) return url;
    // Insert /tr:w-{width},q-{quality}/ after the bucket path
    // Desktop → cap at 1280px wide, quality 65
    // Mobile  → cap at 720px wide, quality 60
    const [base, file] = url.split('ik.imagekit.io/qowmy92ny/');
    if (!file) return url;
    const params = mobile ? 'tr:w-720,q-60' : 'tr:w-1280,q-65';
    return `${base}ik.imagekit.io/qowmy92ny/${params}/${file}`;
  };

  if (slide.videoSrc) {
    const rawSrc = isMobile && slide.videoSrcMobile ? slide.videoSrcMobile : slide.videoSrc;
    const src = applyIKVideoTransform(rawSrc, isMobile);
    return (
      <>
        <video
          ref={videoRef}
          key={rawSrc}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
      </>
    );
  }

  return (
    <>
      <Image
        src={slide.src!}
        alt={slide.alt}
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover object-center"
        unoptimized
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
    </>
  );
}

export default function BannerMargiela() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const suppressTapRef = useRef(0);

  const slide = SLIDES[index];
  const isRight = slide.align === 'right';

  const go = useCallback((next: number, direction: 1 | -1) => {
    setDir(direction);
    setIndex((next + SLIDES.length) % SLIDES.length);
  }, []);

  const goNext = useCallback(() => go(index + 1, 1), [go, index]);

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

  const handleMobileTap = (e: MouseEvent<HTMLElement>) => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 639px)').matches) return;
    if (Date.now() - suppressTapRef.current < 450) return;
    if ((e.target as HTMLElement | null)?.closest('[data-no-hero-tap]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      handleNav(index - 1, -1);
    } else {
      handleNav(index + 1, 1);
    }
  };

  return (
    <section
      className="relative h-full w-full overflow-hidden bg-[#090907] text-white select-none"
      onClick={handleMobileTap}
      onTouchStart={(e) => {
        touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        if (!touchRef.current) return;
        const dx = e.changedTouches[0].clientX - touchRef.current.x;
        const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.y);
        touchRef.current = null;
        if (Math.abs(dx) > 48 && Math.abs(dx) > dy) {
          suppressTapRef.current = Date.now();
          if (dx < 0) handleNav(index + 1, 1);
          else handleNav(index - 1, -1);
        }
      }}
    >
      {/* Mobile progress bullets */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+18px)] left-5 right-5 z-30 flex gap-1.5 sm:hidden">
        {SLIDES.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Перейти к баннеру ${i + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              handleNav(i, i >= index ? 1 : -1);
            }}
            className={`h-px flex-1 overflow-visible rounded-full transition-colors duration-300 ${
              i === index ? 'bg-white/32' : 'bg-white/18'
            }`}
            data-no-hero-tap
          >
            {i < index ? (
              <span className="block h-full w-full rounded-full bg-white/58" />
            ) : i === index ? (
              <span
                key={`mobile-progress-${index}`}
                className="hero-banner-progress-line block h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.82)]"
                style={{ animationDuration: `${AUTO_MS}ms` }}
              />
            ) : (
              <span className="block h-full w-0 rounded-full bg-white/58" />
            )}
          </button>
        ))}
      </div>

      {/* Slide background */}
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={slide.id}
          custom={dir}
          className="absolute inset-0"
          initial={{ x: dir > 0 ? '100%' : '-100%', scale: 1.03 }}
          animate={{ x: 0, scale: 1 }}
          exit={{ x: dir > 0 ? '-10%' : '10%', opacity: 0 }}
          transition={{ x: { type: 'spring', stiffness: 220, damping: 34 }, opacity: { duration: 0.25 }, scale: { duration: 1.2 } }}
        >
          <SlideBackground slide={slide} priority={index === 0} />
        </motion.div>
      </AnimatePresence>

      {/* Text content */}
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

            <h1 className="max-w-5xl text-[clamp(2.4rem,7vw,6.5rem)] font-bold uppercase leading-[0.88] tracking-[-0.06em]">
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

      {/* Slide counter */}
      <div className="absolute bottom-6 right-5 z-20 hidden text-right text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35 sm:block lg:right-16">
        {String(index + 1).padStart(2, '0')}
        <span className="mx-1 text-white/20">/</span>
        {String(SLIDES.length).padStart(2, '0')}
      </div>

      {/* Desktop nav arrows */}
      <div className="absolute bottom-6 left-5 right-5 z-20 hidden items-center justify-between gap-4 sm:left-auto sm:right-40 sm:flex sm:w-[210px]">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleNav(index - 1, -1); }}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/15 text-lg text-white/70 backdrop-blur transition hover:border-white hover:text-white"
          data-no-hero-tap
          aria-label="Предыдущий баннер"
        >
          ←
        </button>
        <div className="hidden h-px flex-1 bg-white/20 sm:block">
          <div
            key={`progress-${index}`}
            className="hero-banner-progress-line h-px bg-white"
            style={{ animationDuration: `${AUTO_MS}ms` }}
          />
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleNav(index + 1, 1); }}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/15 text-lg text-white/70 backdrop-blur transition hover:border-white hover:text-white"
          data-no-hero-tap
          aria-label="Следующий баннер"
        >
          →
        </button>
      </div>

      <style jsx>{`
        .hero-banner-progress-line {
          width: 100%;
          transform-origin: left center;
          animation-name: hero-banner-progress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
        @keyframes hero-banner-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-banner-progress-line { animation: none !important; transform: scaleX(1); }
        }
      `}</style>
    </section>
  );
}
