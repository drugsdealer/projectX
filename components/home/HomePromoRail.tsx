'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  const [fallbackPromos, setFallbackPromos] = useState<PromoCodeItem[]>([]);
  const [ownedCodes, setOwnedCodes] = useState<Set<string>>(() => new Set());
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
        const list = Array.isArray(data?.promoCodes) ? data.promoCodes : [];
        for (const item of list) {
          const code = String(item?.code || '').trim().toUpperCase();
          if (code) next.add(code);
        }
        setOwnedCodes(next);
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

  const visiblePromos = resolvedPromos.slice(0, 8);
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-black/15 bg-gradient-to-br from-[#f6f8fb] via-[#fbfcff] to-[#f3f6fb] p-4 sm:p-5">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_82%,rgba(37,99,235,0.12),transparent_44%),radial-gradient(circle_at_82%_18%,rgba(29,78,216,0.10),transparent_42%)]" />
        <div className="ambient-plane plane-a">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-[#1d4ed8]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 11.5 21 3 13 21 10.2 13.8 3 11.5Z" />
            <path d="M10.2 13.8 21 3" />
          </svg>
        </div>
        <div className="ambient-plane plane-b">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 text-[#2563eb]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 11.5 21 3 13 21 10.2 13.8 3 11.5Z" />
            <path d="M10.2 13.8 21 3" />
          </svg>
        </div>
        <div className="ambient-plane plane-c">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-[#3b82f6]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 11.5 21 3 13 21 10.2 13.8 3 11.5Z" />
            <path d="M10.2 13.8 21 3" />
          </svg>
        </div>
      </div>

      <div className="relative z-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full bg-black/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/70">
              {eyebrow}
            </div>
            <h4 className="mt-2 text-[17px] font-extrabold tracking-tight text-black/90">{title}</h4>
            <p className="mt-1 text-xs text-black/60">{subtitle}</p>
            {claimError ? <p className="mt-1 text-xs text-rose-600">{claimError}</p> : null}
          </div>
          <div ref={profileTargetRef} className="shrink-0">
            <Link
              href="/profile/promocodes"
              className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-black/70 transition hover:bg-black hover:text-white"
            >
              Все промокоды
            </Link>
          </div>
        </div>

        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visiblePromos.length === 0 ? (
            <div className="w-[220px] shrink-0 snap-start rounded-2xl border border-dashed border-black/20 bg-white/70 p-3 text-xs text-black/60">
              Сейчас нет активных общедоступных промокодов. Следи за обновлениями в Telegram.
            </div>
          ) : null}

          {visiblePromos.map((promo) => {
            const codeUpper = String(promo?.code || '').trim().toUpperCase();
            const isOwned = ownedCodes.has(codeUpper);
            const isClaiming = claimingCode === codeUpper;
            const end = fmtDate(promo?.endsAt);
            return (
              <button
                key={`promo-${promo.code}`}
                type="button"
                onClick={(e) => claimPromo(codeUpper, e.currentTarget)}
                className="relative w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-black/18 bg-white px-3 pb-3 pt-2 shadow-[0_10px_22px_rgba(0,0,0,0.06)]"
              >
                <span className="pointer-events-none absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#f6f8fb]" />
                <span className="pointer-events-none absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#f6f8fb]" />

                <div className="border-b border-dashed border-black/18 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      {promo.code}
                    </span>
                    <span className="text-sm font-extrabold text-black/85">{promoLabel(promo)}</span>
                  </div>
                </div>

                <div className="mt-2 line-clamp-2 text-xs font-semibold text-black/80">
                  {promo.description || 'Скидка по общедоступному промокоду'}
                </div>
                <div className="mt-2 text-[11px] text-black/55">
                  {promo.minSubtotal ? `от ${Number(promo.minSubtotal).toLocaleString('ru-RU')} ₽` : 'Без минимальной суммы'}
                </div>
                {end ? <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-black/45">до {end}</div> : null}

                <div className="mt-2 inline-flex rounded-full border border-black/15 bg-black/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-black/75">
                  {isOwned ? 'В профиле' : isClaiming ? 'Сохраняем...' : 'Забрать билет'}
                </div>
              </button>
            );
          })}

          <a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="relative w-[220px] shrink-0 snap-start rounded-2xl border border-[#2563eb]/25 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] p-3 shadow-[0_10px_22px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1d4ed8]">Telegram</div>
            <div className="mt-2 text-sm font-extrabold leading-tight text-[#1e3a8a]">Больше промокодов в канале</div>
            <div className="mt-2 text-xs text-[#1e40af]/90">{telegramText}</div>
            <div className="mt-3 inline-flex rounded-full bg-[#1d4ed8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
              Перейти
            </div>
          </a>
        </div>
      </div>

      {flyingTicket ? (
        <div className="pointer-events-none fixed left-0 top-0 z-[80]">
          <div
            className="rounded-xl border border-black/15 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-black/80 shadow-lg transition-transform duration-700"
            style={{
              transform: isFlightActive
                ? `translate(${flyingTicket.endX - 56}px, ${flyingTicket.endY - 16}px) scale(0.5) rotate(-12deg)`
                : `translate(${flyingTicket.startX - 56}px, ${flyingTicket.startY - 16}px) scale(1) rotate(0deg)`,
              transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            {flyingTicket.code}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .ambient-plane {
          position: absolute;
          left: 0;
          top: 0;
          opacity: 0;
          filter: drop-shadow(0 4px 12px rgba(37, 99, 235, 0.2));
          will-change: opacity, transform;
        }
        .ambient-plane svg {
          animation: plane-soft-tilt 4.8s ease-in-out infinite;
        }
        .plane-a {
          left: -8%;
          top: 74%;
          animation: plane-fly-a 18s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
        .plane-b {
          left: -10%;
          top: 32%;
          animation: plane-fly-b 20s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
          animation-delay: 1.8s;
        }
        .plane-c {
          left: -12%;
          top: 58%;
          animation: plane-fly-c 22s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
          animation-delay: 4.2s;
        }
        @keyframes plane-soft-tilt {
          0%,
          100% {
            transform: rotate(-2deg);
          }
          50% {
            transform: rotate(2.5deg);
          }
        }
        @keyframes plane-fly-a {
          0% {
            opacity: 0;
            transform: translate(0, 0) rotate(-14deg) scale(0.92);
          }
          7% {
            opacity: 0.2;
          }
          18% {
            transform: translate(16vw, -8vh) rotate(8deg) scale(0.95);
          }
          26% {
            transform: translate(22vw, -15vh) rotate(82deg) scale(0.98);
          }
          34% {
            transform: translate(16vw, -22vh) rotate(156deg) scale(1);
          }
          42% {
            transform: translate(10vw, -15vh) rotate(230deg) scale(0.98);
          }
          50% {
            transform: translate(16vw, -8vh) rotate(304deg) scale(0.95);
          }
          64% {
            transform: translate(36vw, -20vh) rotate(336deg) scale(0.95);
          }
          78% {
            transform: translate(56vw, -32vh) rotate(8deg) scale(0.92);
          }
          90% {
            opacity: 0.14;
            transform: translate(72vw, -40vh) rotate(24deg) scale(0.9);
          }
          100% {
            opacity: 0;
            transform: translate(88vw, -48vh) rotate(40deg) scale(0.88);
          }
        }
        @keyframes plane-fly-b {
          0% {
            opacity: 0;
            transform: translate(0, 0) rotate(12deg) scale(0.84);
          }
          8% {
            opacity: 0.22;
          }
          18% {
            transform: translate(18vw, 2vh) rotate(2deg) scale(0.88);
          }
          28% {
            transform: translate(28vw, 10vh) rotate(-32deg) scale(0.92);
          }
          38% {
            transform: translate(20vw, 18vh) rotate(-112deg) scale(0.96);
          }
          48% {
            transform: translate(30vw, 26vh) rotate(-196deg) scale(0.98);
          }
          58% {
            transform: translate(40vw, 18vh) rotate(-274deg) scale(0.94);
          }
          68% {
            transform: translate(30vw, 10vh) rotate(-346deg) scale(0.9);
          }
          80% {
            transform: translate(54vw, 20vh) rotate(-320deg) scale(0.88);
          }
          92% {
            opacity: 0.12;
            transform: translate(72vw, 32vh) rotate(-300deg) scale(0.84);
          }
          100% {
            opacity: 0;
            transform: translate(90vw, 42vh) rotate(-282deg) scale(0.8);
          }
        }
        @keyframes plane-fly-c {
          0% {
            opacity: 0;
            transform: translate(0, 0) rotate(-8deg) scale(0.76);
          }
          10% {
            opacity: 0.18;
          }
          20% {
            transform: translate(14vw, -8vh) rotate(6deg) scale(0.8);
          }
          30% {
            transform: translate(26vw, -16vh) rotate(74deg) scale(0.84);
          }
          40% {
            transform: translate(18vw, -24vh) rotate(140deg) scale(0.88);
          }
          50% {
            transform: translate(10vw, -16vh) rotate(214deg) scale(0.84);
          }
          60% {
            transform: translate(18vw, -8vh) rotate(286deg) scale(0.8);
          }
          72% {
            transform: translate(40vw, -20vh) rotate(320deg) scale(0.84);
          }
          86% {
            opacity: 0.12;
            transform: translate(62vw, -28vh) rotate(352deg) scale(0.8);
          }
          100% {
            opacity: 0;
            transform: translate(84vw, -38vh) rotate(22deg) scale(0.78);
          }
        }
      `}</style>
    </section>
  );
}
