'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionBudget } from '@/components/MotionBudgetProvider';

type PromoCodeItem = {
  code: string;
  description?: string | null;
  discountType?: 'PERCENT' | 'AMOUNT' | string;
  percentOff?: number | null;
  amountOff?: number | null;
  minSubtotal?: number | null;
  endsAt?: string | Date | null;
};

type Props = {
  promoCodes: PromoCodeItem[];
  eyebrow?: string;
  title?: string;
  telegramUrl?: string;
  telegramText?: string;
};

const fmtDate = (v?: string | Date | null) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU');
};

const promoLabel = (promo: PromoCodeItem): { text: string; value: number; suffix: string } => {
  const type = String(promo?.discountType || '').toUpperCase();
  if (type === 'PERCENT' && Number(promo?.percentOff) > 0) {
    return { text: `-${Number(promo.percentOff)}%`, value: Number(promo.percentOff), suffix: '%' };
  }
  if (type === 'AMOUNT' && Number(promo?.amountOff) > 0) {
    return { text: `-${Number(promo.amountOff).toLocaleString('ru-RU')} ₽`, value: Number(promo.amountOff), suffix: ' ₽' };
  }
  return { text: 'Промо', value: 0, suffix: '' };
};

// Animated discount counter
function DiscountCounter({ label, reduceMotion }: { label: ReturnType<typeof promoLabel>; reduceMotion: boolean }) {
  const [displayed, setDisplayed] = useState(reduceMotion ? label.value : 0);

  useEffect(() => {
    if (reduceMotion || label.value === 0) {
      setDisplayed(label.value);
      return;
    }
    const duration = 600;
    const start = performance.now();
    const target = label.value;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [label.value, reduceMotion]);

  if (label.value === 0) return <span className="text-base font-black tracking-tight">{label.text}</span>;

  return (
    <span className="text-base font-black tabular-nums tracking-tight">
      -{displayed}{label.suffix}
    </span>
  );
}

// Single promo card
function PromoCard({
  promo,
  index,
  isOwned,
  isClaiming,
  reduceMotion,
  balancedMotion,
  onClaim,
}: {
  promo: PromoCodeItem;
  index: number;
  isOwned: boolean;
  isClaiming: boolean;
  reduceMotion: boolean;
  balancedMotion: boolean;
  onClaim: (code: string, el: HTMLElement | null) => void;
}) {
  const codeUpper = String(promo?.code || '').trim().toUpperCase();
  const label = promoLabel(promo);
  const end = fmtDate(promo?.endsAt);
  const [justClaimed, setJustClaimed] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isOwned && !isClaiming) {
      onClaim(codeUpper, e.currentTarget);
      setJustClaimed(true);
      setTimeout(() => setJustClaimed(false), 1800);
    } else {
      onClaim(codeUpper, e.currentTarget);
    }
  };

  return (
    <motion.button
      key={`promo-${promo.code}`}
      type="button"
      disabled={isClaiming}
      onClick={handleClick}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.07,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduceMotion || balancedMotion ? {} : { y: -2 }}
      className="promo-card group relative min-h-[130px] w-[190px] shrink-0 snap-start overflow-hidden rounded-xl border border-black/10 bg-white p-3.5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-shadow hover:border-black/20 hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)] disabled:cursor-wait disabled:opacity-60"
      aria-label={`${isOwned ? 'Промокод уже в профиле' : 'Забрать промокод'} ${codeUpper}`}
    >
      {/* Ticket notch cutouts */}
      <span className="pointer-events-none absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#f5f5f5] ring-1 ring-black/8" />
      <span className="pointer-events-none absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#f5f5f5] ring-1 ring-black/8" />

      {/* Top row: code + discount */}
      <div className="flex items-start justify-between gap-2 border-b border-dashed border-black/10 pb-2.5">
        <span className="rounded bg-black px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-white">
          {promo.code}
        </span>
        <DiscountCounter label={label} reduceMotion={reduceMotion} />
      </div>

      {/* Description + meta */}
      <div className="mt-2.5 flex-1">
        <div className="line-clamp-2 pr-1 text-xs font-semibold leading-snug text-black/70">
          {promo.description || 'Скидка по промокоду'}
        </div>
        <div className="mt-1.5 space-y-0.5">
          {promo.minSubtotal ? (
            <div className="text-[10px] text-black/35">
              от {Number(promo.minSubtotal).toLocaleString('ru-RU')} ₽
            </div>
          ) : null}
          {end && (
            <div className="text-[9px] font-semibold uppercase tracking-wider text-black/28">
              до {end}
            </div>
          )}
        </div>
      </div>

      {/* Claim button */}
      <div className="absolute bottom-3 right-3">
        <AnimatePresence mode="wait">
          {isOwned || justClaimed ? (
            <motion.span
              key="owned"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              className="inline-flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
            >
              ✓ Забрал
            </motion.span>
          ) : (
            <motion.span
              key="claim"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              className="inline-flex items-center gap-1 rounded-full border border-black/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black/45 transition group-hover:border-black group-hover:text-black"
            >
              {isClaiming ? '...' : 'Забрать'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

export default function HomePromoRail({
  promoCodes,
  eyebrow = 'Промокоды',
  title = 'Скидки по коду',
  telegramUrl = 'https://t.me/stagestore',
  telegramText = 'Больше кодов в канале.',
}: Props) {
  const { reduceMotion, motionLevel, isMotionPaused } = useMotionBudget();
  const balancedMotion = motionLevel === 'balanced';

  const [fallbackPromos, setFallbackPromos] = useState<PromoCodeItem[]>([]);
  const [ownedCodes, setOwnedCodes] = useState<Set<string>>(() => new Set());
  const [usedCodes, setUsedCodes] = useState<Set<string>>(() => new Set());
  const [claimingCode, setClaimingCode] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [flyingTicket, setFlyingTicket] = useState<{
    code: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [isFlightActive, setIsFlightActive] = useState(false);
  const profileTargetRef = useRef<HTMLDivElement | null>(null);
  const flightTimerRef = useRef<number | null>(null);

  const incomingPromos = useMemo(
    () => (Array.isArray(promoCodes) ? promoCodes : []),
    [promoCodes]
  );

  useEffect(() => {
    if (incomingPromos.length > 0) {
      setFallbackPromos([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const bust = `t=${encodeURIComponent(String(Date.now()))}`;
        const res = await fetch(`/api/home/promocode-space?${bust}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({} as any));
        if (cancelled) return;
        const list = Array.isArray(data?.promoCodes)
          ? data.promoCodes
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.space?.promoCodes)
          ? data.space.promoCodes
          : [];
        setFallbackPromos(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setFallbackPromos([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [incomingPromos.length]);

  useEffect(() => {
    let cancelled = false;
    const loadOwned = async () => {
      try {
        const res = await fetch('/api/promocodes/owned', {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({} as any));
        if (cancelled) return;
        const next = new Set<string>();
        const used = new Set<string>();
        const list = Array.isArray(data?.promoCodes) ? data.promoCodes : [];
        for (const item of list) {
          const code = String(item?.code || '').trim().toUpperCase();
          if (!code) continue;
          next.add(code);
          if (item?.usedAt) used.add(code);
        }
        setOwnedCodes(next);
        setUsedCodes(used);
      } catch {
        if (!cancelled) setOwnedCodes(new Set());
      }
    };
    loadOwned();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      if (flightTimerRef.current) window.clearTimeout(flightTimerRef.current);
    };
  }, []);

  const resolvedPromos = useMemo(
    () => (incomingPromos.length > 0 ? incomingPromos : fallbackPromos),
    [fallbackPromos, incomingPromos]
  );

  const startTicketFlight = (code: string, sourceEl: HTMLElement | null) => {
    if (!sourceEl || typeof window === 'undefined') return;
    const startRect = sourceEl.getBoundingClientRect();
    const targetRect = profileTargetRef.current?.getBoundingClientRect();
    const startX = startRect.left + startRect.width * 0.5;
    const startY = startRect.top + startRect.height * 0.45;
    const endX = targetRect ? targetRect.left + targetRect.width * 0.5 : window.innerWidth - 48;
    const endY = targetRect ? targetRect.top + targetRect.height * 0.5 : 44;
    if (flightTimerRef.current) window.clearTimeout(flightTimerRef.current);
    setIsFlightActive(false);
    setFlyingTicket({ code, startX, startY, endX, endY });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setIsFlightActive(true));
    });
    flightTimerRef.current = window.setTimeout(() => {
      setFlyingTicket(null);
      setIsFlightActive(false);
    }, 860);
  };

  const claimPromo = async (rawCode: string, sourceEl: HTMLElement | null) => {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) return;
    if (claimingCode === code) return;
    if (ownedCodes.has(code)) {
      startTicketFlight(code, sourceEl);
      return;
    }
    setClaimError(null);
    setClaimingCode(code);
    try {
      const res = await fetch('/api/promocodes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login?next=%2Fprofile%2Fpromocodes';
        }
        return;
      }
      if (!res.ok || !data?.ok) {
        const errCode = String(data?.error || '');
        if (errCode === 'already_claimed') setClaimError('Этот промокод уже забрали.');
        else if (errCode === 'expired') setClaimError('Срок действия истёк.');
        else if (errCode === 'not_started') setClaimError('Промокод ещё не активен.');
        else setClaimError('Не удалось забрать промокод.');
        return;
      }
      setOwnedCodes((prev) => {
        const next = new Set(prev);
        next.add(code);
        return next;
      });
      startTicketFlight(code, sourceEl);
    } catch {
      setClaimError('Ошибка сети. Попробуй ещё раз.');
    } finally {
      setClaimingCode(null);
    }
  };

  const visiblePromos = resolvedPromos.filter(
    (p) => !usedCodes.has(String(p?.code || '').trim().toUpperCase())
  );
  const uniqueVisiblePromos = Array.from(
    new Map(
      visiblePromos
        .map((promo) => [String(promo?.code || '').trim().toUpperCase(), promo] as const)
        .filter(([code]) => Boolean(code))
    ).values()
  ).slice(0, 8);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-black/10 bg-[#f5f5f5] px-4 py-4 sm:px-5 sm:py-5">
      {/* Dot grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:radial-gradient(rgba(0,0,0,1)_1px,transparent_1px)] [background-size:20px_20px]" />

      <div className="relative">
        {/* Compact header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/35 shrink-0">
              {eyebrow}
            </span>
            <span className="h-px flex-1 bg-black/10 hidden sm:block" />
            <span className="text-sm font-bold tracking-tight text-black truncate">{title}</span>
          </div>
          <div ref={profileTargetRef} />
          <AnimatePresence>
            {claimError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="shrink-0 text-[11px] text-rose-500"
              >
                {claimError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Cards scroll */}
        <div className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {uniqueVisiblePromos.length === 0 && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="relative flex min-h-[130px] w-[200px] shrink-0 snap-start flex-col justify-center rounded-xl border border-dashed border-black/15 bg-white/60 p-4"
            >
              <p className="text-xs leading-5 text-black/40">
                Сейчас нет активных промокодов. Следи за обновлениями в Telegram.
              </p>
            </motion.div>
          )}

          {uniqueVisiblePromos.map((promo, i) => {
            const codeUpper = String(promo?.code || '').trim().toUpperCase();
            return (
              <PromoCard
                key={`promo-${promo.code}`}
                promo={promo}
                index={i}
                isOwned={ownedCodes.has(codeUpper)}
                isClaiming={claimingCode === codeUpper}
                reduceMotion={reduceMotion}
                balancedMotion={balancedMotion}
                onClaim={claimPromo}
              />
            );
          })}

          {/* Telegram CTA */}
          <motion.a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: uniqueVisiblePromos.length * 0.07 + 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileHover={reduceMotion || balancedMotion ? {} : { y: -2 }}
            className="group relative min-h-[130px] w-[160px] shrink-0 snap-start overflow-hidden rounded-xl border border-black bg-black p-3.5 text-white transition-shadow hover:shadow-[0_6px_24px_rgba(0,0,0,0.22)]"
          >
            <div className="pointer-events-none absolute right-[-14px] top-[-14px] h-16 w-16 rounded-full border border-white/10" />
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/30">TG</div>
            <div className="mt-3 text-[13px] font-black leading-tight tracking-tight">
              Больше<br />кодов
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-white/40">{telegramText}</p>
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-black transition group-hover:bg-white/90">
              Открыть →
            </div>
          </motion.a>
        </div>
      </div>

      {/* Flying ticket */}
      {flyingTicket && (
        <div className="pointer-events-none fixed left-0 top-0 z-[80]">
          <div
            className={`rounded-lg bg-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-transform ${
              reduceMotion ? 'duration-200' : balancedMotion ? 'duration-500' : 'duration-700'
            }`}
            style={{
              transform: isFlightActive
                ? `translate(${flyingTicket.endX - 56}px, ${flyingTicket.endY - 16}px) scale(0.4) rotate(-10deg)`
                : `translate(${flyingTicket.startX - 56}px, ${flyingTicket.startY - 16}px) scale(1) rotate(0deg)`,
              transitionTimingFunction:
                reduceMotion || balancedMotion ? 'ease-out' : 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            {flyingTicket.code}
          </div>
        </div>
      )}

      <style jsx>{`
        .promo-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            110deg,
            transparent 0%,
            transparent 38%,
            rgba(255, 255, 255, 0.55) 50%,
            transparent 62%,
            transparent 100%
          );
          transform: translateX(-130%);
          transition: transform 550ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .promo-card:hover::before {
          transform: translateX(130%);
        }
        @media (prefers-reduced-motion: reduce) {
          .promo-card::before {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
