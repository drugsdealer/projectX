'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  subtitle?: string;
  telegramUrl?: string;
  telegramText?: string;
};

const fmtDate = (v?: string | Date | null) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU');
};

const promoLabel = (promo: PromoCodeItem) => {
  const type = String(promo?.discountType || '').toUpperCase();
  if (type === 'PERCENT' && Number(promo?.percentOff) > 0) return `-${Number(promo.percentOff)}%`;
  if (type === 'AMOUNT' && Number(promo?.amountOff) > 0) return `-${Number(promo.amountOff).toLocaleString('ru-RU')} ₽`;
  return 'Промо';
};

export default function HomePromoRail({
  promoCodes,
  eyebrow = 'Промокоды',
  title = 'Билеты на скидку',
  subtitle = 'Показываем только общедоступные промокоды без лимита использований.',
  telegramUrl = 'https://t.me/stagestore',
  telegramText = 'В Telegram ещё больше промокодов и быстрые анонсы акций.',
}: Props) {
  const { reduceMotion, motionLevel, isMotionPaused } = useMotionBudget();
  const balancedMotion = motionLevel === "balanced";
  const [fallbackPromos, setFallbackPromos] = useState<PromoCodeItem[]>([]);
  const [showAmbientPlanes, setShowAmbientPlanes] = useState(false);
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
    const loadFallbackPromos = async () => {
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

    loadFallbackPromos();
    return () => {
      cancelled = true;
    };
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (flightTimerRef.current) {
        window.clearTimeout(flightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => {
      if (reduceMotion) {
        setShowAmbientPlanes(false);
        return;
      }
      const small = window.matchMedia("(max-width: 1024px)").matches;
      // In balanced mode keep ambient planes on desktop, but fewer CSS effects are already reduced globally.
      setShowAmbientPlanes(!small);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [reduceMotion]);

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
        else if (errCode === 'expired') setClaimError('Срок действия промокода истек.');
        else if (errCode === 'not_started') setClaimError('Промокод еще не активен.');
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
      setClaimError('Ошибка сети. Попробуй еще раз.');
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
    <section className="relative overflow-hidden rounded-[34px] border border-black/10 bg-[#f4efe6] p-4 text-[#15130f] shadow-[0_24px_90px_rgba(0,0,0,0.08)] sm:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.92),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.72),rgba(255,255,255,0.1)_48%,rgba(0,0,0,0.045))]" />
        <div className="absolute right-[-12%] top-[-42%] h-[360px] w-[360px] rounded-full border border-black/10" />
        <div className="absolute bottom-[-46%] left-[42%] h-[340px] w-[340px] rounded-full bg-black/[0.035]" />
        {showAmbientPlanes ? (
          <div className={`ticket-scan ${isMotionPaused ? "paused" : ""}`} />
        ) : null}
      </div>

      <div className="relative z-10">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-black/10 bg-white/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-black/55 backdrop-blur">
              {eyebrow}
            </div>
            <h4 className="mt-3 text-2xl font-black tracking-[-0.05em] text-black sm:text-4xl">{title}</h4>
            <p className="mt-2 max-w-xl text-sm leading-6 text-black/55">{subtitle}</p>
            {claimError ? <p className="mt-1 text-xs text-rose-600">{claimError}</p> : null}
          </div>
          <div ref={profileTargetRef} className="shrink-0 self-start lg:self-auto">
            <Link
              href="/profile/promocodes"
              className="inline-flex rounded-full border border-black/15 bg-white/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-black/65 backdrop-blur transition hover:bg-black hover:text-white"
            >
              Все промокоды
            </Link>
          </div>
        </div>

        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {uniqueVisiblePromos.length === 0 ? (
            <div className="ticket-empty relative min-h-[178px] w-[250px] shrink-0 snap-start overflow-hidden rounded-[24px] border border-dashed border-black/20 bg-white/45 p-5 text-sm leading-6 text-black/55 backdrop-blur">
              <div className="mb-8 text-[10px] font-bold uppercase tracking-[0.22em] text-black/35">No active tickets</div>
              Сейчас нет активных общедоступных промокодов. Следи за обновлениями в Telegram.
            </div>
          ) : null}

          {uniqueVisiblePromos.map((promo) => {
            const codeUpper = String(promo?.code || '').trim().toUpperCase();
            const isOwned = ownedCodes.has(codeUpper);
            const isClaiming = claimingCode === codeUpper;
            const end = fmtDate(promo?.endsAt);
            return (
              <button
                key={`promo-${promo.code}`}
                type="button"
                disabled={isClaiming}
                onClick={(e) => claimPromo(codeUpper, e.currentTarget)}
                className={`promo-ticket group relative min-h-[178px] w-[250px] shrink-0 snap-start overflow-hidden rounded-[24px] border border-black/12 bg-[#fffaf1] p-4 text-left shadow-[0_18px_42px_rgba(0,0,0,0.08)] transition ${reduceMotion || balancedMotion ? "" : "hover:-translate-y-1 hover:shadow-[0_24px_58px_rgba(0,0,0,0.12)]"} disabled:cursor-wait disabled:opacity-70`}
                aria-label={`${isOwned ? 'Промокод уже в профиле' : 'Забрать промокод'} ${codeUpper}`}
              >
                <span className="pointer-events-none absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f4efe6]" />
                <span className="pointer-events-none absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f4efe6]" />
                <span className="pointer-events-none absolute inset-y-0 left-[72%] border-l border-dashed border-black/12" />

                <div className="border-b border-dashed border-black/14 pb-3 pr-12">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                      {promo.code}
                    </span>
                    <span className="text-lg font-black tracking-[-0.04em] text-black">{promoLabel(promo)}</span>
                  </div>
                </div>

                <div className="mt-3 line-clamp-2 pr-8 text-sm font-bold leading-5 text-black/78">
                  {promo.description || 'Скидка по общедоступному промокоду'}
                </div>
                <div className="mt-3 text-[11px] font-semibold text-black/45">
                  {promo.minSubtotal ? `от ${Number(promo.minSubtotal).toLocaleString('ru-RU')} ₽` : 'Без минимальной суммы'}
                </div>
                {end ? <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-black/38">до {end}</div> : null}

                <div className="absolute bottom-4 right-4 inline-flex rounded-full border border-black/12 bg-black/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-black/70 transition group-hover:bg-black group-hover:text-white">
                  {isOwned ? 'В профиле' : isClaiming ? 'Сохраняем...' : 'Забрать билет'}
                </div>
              </button>
            );
          })}

          <a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            className={`relative min-h-[178px] w-[250px] shrink-0 snap-start overflow-hidden rounded-[24px] border border-black/12 bg-black p-4 text-white shadow-[0_18px_42px_rgba(0,0,0,0.12)] transition ${reduceMotion || balancedMotion ? "" : "hover:-translate-y-1 hover:shadow-[0_24px_58px_rgba(0,0,0,0.18)]"}`}
          >
            <div className="absolute right-[-34px] top-[-34px] h-24 w-24 rounded-full border border-white/12" />
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Telegram</div>
            <div className="mt-5 max-w-[170px] text-xl font-black leading-none tracking-[-0.05em] text-white">Больше промокодов в канале</div>
            <div className="mt-3 text-xs leading-5 text-white/58">{telegramText}</div>
            <div className="mt-5 inline-flex rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-black">
              Перейти
            </div>
          </a>
        </div>
      </div>

      {flyingTicket ? (
        <div className="pointer-events-none fixed left-0 top-0 z-[80]">
          <div
            className={`rounded-xl border border-black/15 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-black/80 shadow-lg transition-transform ${reduceMotion ? "duration-200" : balancedMotion ? "duration-500" : "duration-700"}`}
            style={{
              transform: isFlightActive
                ? `translate(${flyingTicket.endX - 56}px, ${flyingTicket.endY - 16}px) scale(0.5) rotate(-12deg)`
                : `translate(${flyingTicket.startX - 56}px, ${flyingTicket.startY - 16}px) scale(1) rotate(0deg)`,
              transitionTimingFunction: reduceMotion || balancedMotion ? "ease-out" : "cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            {flyingTicket.code}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .ticket-scan {
          position: absolute;
          left: -25%;
          top: 0;
          height: 100%;
          width: 28%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.38), transparent);
          transform: skewX(-18deg);
          animation: ticket-scan 8s ease-in-out infinite;
          animation-play-state: ${isMotionPaused ? "paused" : "running"};
          will-change: transform, opacity;
        }
        .ticket-scan.paused {
          animation-play-state: paused;
        }
        .promo-ticket::after,
        .ticket-empty::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 12px 12px, rgba(0, 0, 0, 0.045) 0 1px, transparent 1.5px) 0 0 / 22px 22px;
          opacity: 0.28;
          mix-blend-mode: multiply;
        }
        .promo-ticket::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(115deg, transparent 0%, transparent 42%, rgba(255, 255, 255, 0.72) 50%, transparent 58%, transparent 100%);
          transform: translateX(-120%);
          transition: transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .promo-ticket:hover::before {
          transform: translateX(120%);
        }
        @keyframes ticket-scan {
          0% {
            opacity: 0;
            transform: translateX(0) skewX(-18deg);
          }
          12% {
            opacity: 0.7;
          }
          42% {
            opacity: 0;
            transform: translateX(520%) skewX(-18deg);
          }
          100% {
            opacity: 0;
            transform: translateX(520%) skewX(-18deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticket-scan,
          .promo-ticket::before {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
