"use client";

/**
 * Выбор косметички в подарок — одна на заказ, любого бренда акции.
 *  • PouchCollage — вырезанные косметички «парят» над фоном; по клику — выбрать.
 *  • PouchPicker — все модели карточками + «Сюрприз» (не выбирать — положим случайную).
 * Выбор (id) хранится в куке beauty_gift и при оформлении заказа попадает в Order.giftChoice.
 */
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { BEAUTY_COLORS as C, fontDisplay, fontMono } from "./theme";
import {
  BEAUTY_GIFT_COOKIE,
  BEAUTY_POUCHES,
  findPouch,
  sanitizeGiftChoice,
  type BeautyBrand,
  type BeautyPouch,
} from "@/lib/promo-beauty";

const COOKIE_DAYS = 45;

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${BEAUTY_GIFT_COOKIE}=([^;]*)`));
  return m ? sanitizeGiftChoice(m[1]) : null;
}

function writeCookie(id: string | null) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = id
    ? `${BEAUTY_GIFT_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; SameSite=Lax${secure}`
    : `${BEAUTY_GIFT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** id выбранной косметички; null — «сюрприз» (положим случайную). */
export function useGiftChoice() {
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => setChoice(readCookie()), []);
  const choose = useCallback((id: string | null) => {
    setChoice(id);
    writeCookie(id);
  }, []);
  return { choice, choose };
}

/** Косметички брендов, у которых есть товары в акции (порядок — как в настройках). */
export function pouchesFor(brands: BeautyBrand[]) {
  const keys = new Set(brands.map((b) => b.key));
  return BEAUTY_POUCHES.filter((p) => keys.has(p.brand.key));
}

// Раскладка «парящих» косметичек: позиция, ширина и наклон в % от блока (до 6 штук).
const SLOTS = [
  { left: 0, top: 4, width: 46, rot: -8 },
  { left: 52, top: 0, width: 46, rot: 6 },
  { left: 26, top: 30, width: 48, rot: -2 },
  { left: 2, top: 56, width: 44, rot: 7 },
  { left: 54, top: 52, width: 44, rot: -6 },
  { left: 28, top: 76, width: 42, rot: 3 },
];

export function PouchCollage({
  pouches,
  choice,
  onChoose,
}: {
  pouches: BeautyPouch[];
  choice: string | null;
  onChoose: (id: string) => void;
}) {
  // Чередуем бренды, чтобы рядом лежали разные: Dior, Gucci, Dior…
  const groups = new Map<string, BeautyPouch[]>();
  for (const p of pouches) groups.set(p.brand.key, [...(groups.get(p.brand.key) ?? []), p]);
  const lists = [...groups.values()];
  const mixed: BeautyPouch[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) for (const l of lists) if (l[i]) mixed.push(l[i]);
  const items = mixed.slice(0, SLOTS.length);
  const tall = items.length > 3;

  return (
    <div className="relative w-full max-w-[560px] mx-auto" style={{ aspectRatio: tall ? "1 / 1.08" : "1 / 0.75" }}>
      {items.map((p, i) => {
        const s = SLOTS[i];
        const on = choice === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChoose(p.id)}
            aria-pressed={on}
            aria-label={`Выбрать косметичку ${p.brand.name}: ${p.name}`}
            className="bw-float absolute block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            style={
              {
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.width}%`,
                zIndex: on ? 20 : 10 + i,
                "--rot": `${s.rot}deg`,
                animationDelay: `${-i * 1.3}s`,
                animationDuration: `${6 + (i % 3)}s`,
              } as React.CSSProperties
            }
          >
            <span className="bw-float-inner relative block" style={{ aspectRatio: "4 / 3", transform: on ? "scale(1.1)" : undefined }}>
              <Image
                src={p.image}
                alt=""
                fill
                sizes="(max-width: 768px) 46vw, 260px"
                className="object-contain"
                style={{
                  filter: on
                    ? `drop-shadow(0 0 0.5px ${C.accent}) drop-shadow(0 18px 22px rgba(120,50,60,.38))`
                    : "drop-shadow(0 14px 16px rgba(120,50,60,.24))",
                }}
              />
            </span>
            {on && (
              <span
                className={`${fontMono.className} absolute left-1/2 -bottom-1 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 text-[10px] uppercase tracking-[.12em]`}
                style={{ background: C.ink, color: C.cream }}
              >
                Ваш выбор
              </span>
            )}
          </button>
        );
      })}
      <style>{`
        .bw-float { transform: rotate(var(--rot)); animation-name: bw-drift; animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-direction: alternate; }
        .bw-float-inner { transition: transform .35s ease; }
        .bw-float:hover { z-index: 30 !important; }
        .bw-float:hover .bw-float-inner { transform: scale(1.08) !important; }
        @keyframes bw-drift {
          from { transform: rotate(var(--rot)) translate3d(0, 0, 0); }
          to { transform: rotate(calc(var(--rot) * -0.4)) translate3d(0, -12px, 0); }
        }
        @media (prefers-reduced-motion: reduce) { .bw-float { animation: none; } }
      `}</style>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PouchPicker({
  pouches,
  choice,
  onChoose,
}: {
  pouches: BeautyPouch[];
  choice: string | null;
  onChoose: (id: string | null) => void;
}) {
  const label = `${fontMono.className} text-[10px] leading-[14px] tracking-[.14em] uppercase`;
  const chosen = findPouch(choice);
  const options = [
    ...pouches.map((p) => ({ id: p.id, brand: p.brand.name, name: p.name, note: p.note, image: p.image, surprise: false })),
    { id: "", brand: "Любая", name: "Сюрприз", note: "Положим случайную", image: "", surprise: true },
  ];

  return (
    <div>
      <div className="mb-6 text-[15px] leading-6" style={{ color: C.text }} aria-live="polite">
        {chosen ? (
          <>
            Ваш выбор: <b>{chosen.brand.name} — {chosen.name}</b>
          </>
        ) : (
          "Пока не выбрали — положим случайную косметичку"
        )}
      </div>
      <div
        className="-mx-4 px-4 md:mx-0 md:px-0 flex md:grid md:grid-cols-4 gap-3 md:gap-5 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-2 md:pb-0"
        role="radiogroup"
        aria-label="Косметичка в подарок"
      >
        {options.map((o) => {
          const on = o.surprise ? !chosen : chosen?.id === o.id;
          return (
            <button
              key={o.id || "surprise"}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChoose(o.surprise ? null : o.id)}
              className="group relative shrink-0 w-[68%] sm:w-[44%] md:w-auto snap-start text-left transition-transform duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: on ? C.cream : "rgba(251,243,238,.55)",
                border: on ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                padding: on ? 0 : 1,
              }}
            >
              <span className="relative block" style={{ aspectRatio: "4 / 3" }}>
                {o.surprise ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    {pouches.slice(0, 3).map((p, i) => (
                      <span
                        key={p.id}
                        className="absolute"
                        style={{
                          width: "46%",
                          aspectRatio: "4 / 3",
                          transform: `translateX(${(i - 1) * 52}%) rotate(${(i - 1) * 10}deg)`,
                          zIndex: i === 1 ? 2 : 1,
                        }}
                      >
                        <Image src={p.image} alt="" fill sizes="120px" className="object-contain" style={{ filter: "drop-shadow(0 8px 10px rgba(120,50,60,.22))" }} />
                      </span>
                    ))}
                    <span className={`${fontDisplay.className} absolute right-3 top-2 text-[34px] leading-none`} style={{ color: C.accent }} aria-hidden="true">
                      ?
                    </span>
                  </span>
                ) : (
                  <Image
                    src={o.image}
                    alt={`Косметичка ${o.brand} — ${o.name}`}
                    fill
                    sizes="(max-width: 768px) 68vw, 280px"
                    className="object-contain p-5 transition-transform duration-500 group-hover:scale-[1.06]"
                    style={{ filter: "drop-shadow(0 14px 16px rgba(120,50,60,.22))" }}
                  />
                )}
              </span>
              <span className="block px-4 pb-4">
                <span className={label} style={{ color: C.inkMuted }}>
                  {o.brand}
                </span>
                <span className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[15px] leading-5 font-bold">{o.name}</span>
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                    style={{ background: on ? C.ink : "transparent", color: C.cream, border: on ? "none" : `1px solid ${C.line}` }}
                  >
                    {on && <CheckIcon />}
                  </span>
                </span>
                <span className="block text-[13px] leading-[18px] mt-1" style={{ color: C.inkMuted }}>
                  {o.note}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
