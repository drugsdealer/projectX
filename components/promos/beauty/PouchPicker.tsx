"use client";

/**
 * Выбор косметички в подарок.
 *  • PouchCollage — «парящие полароиды»: все косметички вперемешку, по клику — выбрать.
 *  • PouchPicker — по бренду: три модели + «Сюрприз» (не выбирать — положим случайную).
 * Выбор хранится в куке beauty_gift и при оформлении заказа попадает в Order.giftChoice.
 */
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { BEAUTY_COLORS as C, fontDisplay, fontMono } from "./theme";
import {
  BEAUTY_GIFT_COOKIE,
  BEAUTY_PROMO,
  findPouch,
  formatRub,
  sanitizeGiftChoice,
  type BeautyBrand,
  type BeautyGiftChoice,
} from "@/lib/promo-beauty";

const COOKIE_DAYS = 45;

function readCookie(): BeautyGiftChoice {
  if (typeof document === "undefined") return {};
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${BEAUTY_GIFT_COOKIE}=([^;]*)`));
  return m ? sanitizeGiftChoice(decodeURIComponent(m[1])) : {};
}

function writeCookie(choice: BeautyGiftChoice) {
  const value = encodeURIComponent(JSON.stringify(choice));
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${BEAUTY_GIFT_COOKIE}=${value}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; SameSite=Lax${secure}`;
}

/** Выбор косметичек: { dior: "dior-miss-bow" }. Отсутствие ключа — «сюрприз». */
export function useGiftChoice() {
  const [choice, setChoice] = useState<BeautyGiftChoice>({});
  useEffect(() => setChoice(readCookie()), []);
  const choose = useCallback((brandKey: string, pouchId: string | null) => {
    setChoice((prev) => {
      const next = { ...prev };
      if (pouchId) next[brandKey] = pouchId;
      else delete next[brandKey];
      writeCookie(next);
      return next;
    });
  }, []);
  return { choice, choose };
}

// Раскладка полароидов: позиция и наклон в % от блока (до 6 штук).
const SLOTS = [
  { left: 2, top: 4, width: 46, rot: -7 },
  { left: 50, top: 0, width: 44, rot: 5 },
  { left: 27, top: 30, width: 46, rot: 2 },
  { left: 0, top: 54, width: 44, rot: 5 },
  { left: 54, top: 50, width: 44, rot: -5 },
  { left: 26, top: 70, width: 44, rot: -2 },
];

export function PouchCollage({
  brands,
  choice,
  onChoose,
}: {
  brands: BeautyBrand[];
  choice: BeautyGiftChoice;
  onChoose: (brandKey: string, pouchId: string) => void;
}) {
  // Чередуем бренды, чтобы рядом лежали разные: Dior, Gucci, Dior…
  const list: { brand: BeautyBrand; pouch: BeautyBrand["pouches"][number] }[] = [];
  const max = Math.max(...brands.map((b) => b.pouches.length));
  for (let i = 0; i < max; i++) for (const b of brands) if (b.pouches[i]) list.push({ brand: b, pouch: b.pouches[i] });
  const items = list.slice(0, SLOTS.length);
  const tall = items.length > 3;

  return (
    <div className="relative w-full max-w-[560px] mx-auto" style={{ aspectRatio: tall ? "1 / 1.12" : "1 / 0.8" }}>
      {items.map(({ brand, pouch }, i) => {
        const s = SLOTS[i];
        const on = choice[brand.key] === pouch.id;
        return (
          <button
            key={pouch.id}
            type="button"
            onClick={() => onChoose(brand.key, pouch.id)}
            aria-pressed={on}
            aria-label={`Выбрать косметичку ${brand.name}: ${pouch.name}`}
            className="bw-polaroid absolute block text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
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
            <span
              className="block bg-white p-[6%] pb-[4%] transition-[transform,box-shadow] duration-300"
              style={{
                boxShadow: on ? "0 22px 40px rgba(120,50,60,.32)" : "0 12px 26px rgba(120,50,60,.18)",
                outline: on ? `2px solid ${C.accent}` : "none",
                transform: on ? "scale(1.06)" : undefined,
              }}
            >
              <span className="relative block" style={{ aspectRatio: "4 / 3" }}>
                <Image src={pouch.image} alt="" fill sizes="(max-width: 768px) 44vw, 250px" className="object-contain" />
              </span>
              <span className={`${fontMono.className} mt-[5%] flex items-center justify-between gap-2 text-[9px] sm:text-[10px] uppercase tracking-[.12em]`} style={{ color: C.inkMuted }}>
                <span className="truncate">{brand.name}</span>
                {on && <span style={{ color: C.accent }}>Ваш выбор</span>}
              </span>
            </span>
          </button>
        );
      })}
      <style>{`
        .bw-polaroid { transform: rotate(var(--rot)); animation-name: bw-drift; animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-direction: alternate; }
        .bw-polaroid:hover { z-index: 30 !important; }
        .bw-polaroid:hover > span { transform: scale(1.05) !important; }
        @keyframes bw-drift {
          from { transform: rotate(var(--rot)) translate3d(0, 0, 0); }
          to { transform: rotate(calc(var(--rot) * -0.4)) translate3d(0, -10px, 0); }
        }
        @media (prefers-reduced-motion: reduce) { .bw-polaroid { animation: none; } }
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
  brands,
  choice,
  onChoose,
}: {
  brands: BeautyBrand[];
  choice: BeautyGiftChoice;
  onChoose: (brandKey: string, pouchId: string | null) => void;
}) {
  const label = `${fontMono.className} text-[11px] leading-[14px] tracking-[.14em] uppercase`;
  return (
    <div className="flex flex-col gap-12 md:gap-14">
      {brands.map((b) => {
        const chosen = findPouch(b, choice[b.key]);
        const options = [...b.pouches.map((p) => ({ ...p, surprise: false })), { id: "", name: "Сюрприз", note: "Положим случайную", image: "", surprise: true }];
        return (
          <div key={b.key}>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <div className={label} style={{ color: C.inkMuted, marginBottom: 10 }}>
                  К заказу {b.name} от {formatRub(BEAUTY_PROMO.threshold)}
                </div>
                <h3 className={`${fontDisplay.className} uppercase font-light m-0 text-[30px] md:text-[40px] leading-none`}>
                  Косметичка {b.name}
                </h3>
              </div>
              <div className="text-[14px] leading-5" style={{ color: C.text }} aria-live="polite">
                {chosen ? (
                  <>
                    Ваш выбор: <b>{chosen.name}</b>
                  </>
                ) : (
                  "Не выбрали — положим случайную"
                )}
              </div>
            </div>

            <div
              className="-mx-4 px-4 md:mx-0 md:px-0 flex md:grid md:grid-cols-4 gap-3 md:gap-5 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-2 md:pb-0"
              role="radiogroup"
              aria-label={`Косметичка ${b.name}`}
            >
              {options.map((o) => {
                const on = o.surprise ? !chosen : chosen?.id === o.id;
                return (
                  <button
                    key={o.id || "surprise"}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChoose(b.key, o.surprise ? null : o.id)}
                    className="group relative shrink-0 w-[68%] sm:w-[44%] md:w-auto snap-start text-left transition-transform duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      background: o.surprise ? C.cream : "#fff",
                      border: on ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                      padding: on ? 0 : 1,
                    }}
                  >
                    <span className="relative block" style={{ aspectRatio: "4 / 3" }}>
                      {o.surprise ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          {b.pouches.map((p, i) => (
                            <span
                              key={p.id}
                              className="absolute bg-white p-1.5 transition-transform duration-500"
                              style={{
                                width: "44%",
                                transform: `translateX(${(i - 1) * 46}%) rotate(${(i - 1) * 9}deg)`,
                                boxShadow: "0 8px 16px rgba(120,50,60,.18)",
                                zIndex: i === 1 ? 2 : 1,
                              }}
                            >
                              <span className="relative block" style={{ aspectRatio: "4 / 3" }}>
                                <Image src={p.image} alt="" fill sizes="120px" className="object-contain" />
                              </span>
                            </span>
                          ))}
                          <span
                            className={`${fontDisplay.className} absolute right-3 top-2 text-[34px] leading-none`}
                            style={{ color: C.accent }}
                            aria-hidden="true"
                          >
                            ?
                          </span>
                        </span>
                      ) : (
                        <Image
                          src={o.image}
                          alt={`Косметичка ${b.name} — ${o.name}`}
                          fill
                          sizes="(max-width: 768px) 68vw, 280px"
                          className="object-contain p-4 transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      )}
                    </span>
                    <span className="block px-4 pt-1 pb-4" style={{ borderTop: o.surprise ? "none" : `1px solid ${C.blush}` }}>
                      <span className="flex items-center justify-between gap-2 pt-3">
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
      })}
    </div>
  );
}
