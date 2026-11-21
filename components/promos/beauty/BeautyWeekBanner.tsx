"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BEAUTY_COLORS as C,
  fontBody,
  fontDisplay,
  fontMono,
  fontSerif,
} from "./theme";
import { BEAUTY_PROMO, formatRub, type BeautyBrand } from "@/lib/promo-beauty";

const IMG = "/promo/beauty-week";
const THRESHOLD = formatRub(BEAUTY_PROMO.threshold);

/** Промобаннер «Бьюти-неделя» на главной. brands — бренды акции, косметика которых есть в каталоге. */
export default function BeautyWeekBanner({ brands }: { brands: BeautyBrand[] }) {
  if (!brands.length) return null;
  const brandLine = brands.length > 1 ? brands.map((b) => b.name).join(" & ") : brands[0].name;
  const gifts = `косметичка ${brands.map((b) => b.name).join(" или ")} на выбор`;
  const label = `${fontMono.className} text-[11px] md:text-[12px] tracking-[.14em] uppercase`;
  const photos =
    brands.length > 1
      ? [brands[0].cover, brands[1].cover, `${IMG}/dior-pouch-set.webp`]
      : [brands[0].cover, `${IMG}/dior-lipsticks.webp`, brands[0].giftPhoto ?? `${IMG}/dior-pouch-set.webp`];

  return (
    <Link
      href={BEAUTY_PROMO.path}
      aria-label={`${BEAUTY_PROMO.title} ${brandLine}: подарок от ${THRESHOLD}`}
      className={`${fontBody.className} group relative block w-full overflow-hidden`}
      style={{ background: C.blush, color: C.ink }}
    >
      {/* Телефон */}
      <div className="md:hidden relative">
        <div className="relative h-[250px] overflow-hidden">
          <Image src={photos[2]} alt="" fill sizes="100vw" className="object-cover" style={{ objectPosition: "50% 40%" }} />
          <div className={`${label} absolute left-4 top-4 px-2.5 py-1.5`} style={{ background: C.cream, zIndex: 5 }}>
            Подарок от {THRESHOLD}
          </div>
        </div>
        <div className="px-4 pt-5 pb-4">
          <div className={`${fontDisplay.className} uppercase font-light text-[52px] leading-[.92] tracking-[-.01em]`}>
            Бьюти-неделя
          </div>
          <div className={`${fontSerif.className} italic text-[36px] leading-[1.1] mt-1`} style={{ color: C.accent }}>
            {brandLine}
          </div>
          <div className="text-[15px] leading-[22px] mt-3" style={{ color: C.text }}>
            Косметичка на выбор в подарок к заказу от {THRESHOLD}
          </div>
          <span
            className="mt-4 flex items-center justify-center min-h-[48px] text-[15px] font-bold"
            style={{ background: C.ink, color: C.cream }}
          >
            Выбрать косметику
          </span>
        </div>
      </div>

      {/* Компьютер */}
      <div className="hidden md:flex h-[460px] lg:h-[520px]">
        <div className="flex-none w-[44%] lg:w-[640px] box-border pl-10 lg:pl-[72px] pr-8 lg:pr-12 pt-12 lg:pt-14 pb-10 lg:pb-12 flex flex-col justify-between">
          <div className={label} style={{ color: C.inkMuted }}>
            Stage Store · Beauty edit
          </div>
          <div>
            <div className={`${fontDisplay.className} uppercase font-light text-[80px] lg:text-[104px] leading-[.92] tracking-[-.01em]`}>
              Бьюти-
              <br />
              неделя
            </div>
            <div className={`${fontSerif.className} italic text-[48px] lg:text-[60px] leading-none mt-2`} style={{ color: C.accent }}>
              {brandLine}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <span
              className="inline-flex items-center min-h-[48px] px-7 text-[15px] font-bold transition-opacity group-hover:opacity-90"
              style={{ background: C.ink, color: C.cream }}
            >
              Выбрать косметику
            </span>
            <span className="text-[15px] leading-[22px]" style={{ color: C.text }}>
              Подарок от {THRESHOLD}:
              <br />
              {gifts}
            </span>
          </div>
        </div>
        <div className="relative flex-1 min-w-0 flex gap-1">
          {photos.map((src, i) => (
            <div key={src} className="relative flex-1 min-w-0 overflow-hidden">
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 1280px) 20vw, 270px"
                className="object-cover transition-transform duration-[1.2s] group-hover:scale-[1.04]"
                style={{ objectPosition: i === 2 ? "35% 50%" : "50% 50%" }}
              />
            </div>
          ))}
          <div
            className="absolute right-12 bottom-10 px-[18px] py-3.5"
            style={{
              background: C.cream,
              border: `1px solid ${C.ink}`,
              transform: "rotate(-3deg)",
              boxShadow: "0 10px 20px rgba(120,50,60,.2)",
              zIndex: 5,
            }}
          >
            <div className={label} style={{ color: C.inkMuted, fontSize: 10 }}>
              Подарок от
            </div>
            <div className={`${fontDisplay.className} text-[34px] leading-[1.05]`}>{THRESHOLD}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
