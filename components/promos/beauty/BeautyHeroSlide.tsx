"use client";

/**
 * Фон слайда «Бьюти-неделя» в верхнем слайдере главной: тёмный винный фон (чтобы белый текст
 * слайдера и прозрачная шапка читались), арка с фото Dior и парящие флаконы с параллаксом.
 * Текст и кнопку рисует сам слайдер (BannerMargiela).
 */
import Image from "next/image";
import FloatingBottles from "./FloatingBottles";
import { BEAUTY_COLORS as C, HERO_BOTTLES, fontDisplay } from "./theme";
import { BEAUTY_PROMO, formatRub } from "@/lib/promo-beauty";

const BACK = HERO_BOTTLES.filter((b) => (b.z ?? 1) === 0);
const FRONT = HERO_BOTTLES.filter((b) => (b.z ?? 1) > 0);

export default function BeautyHeroSlide({ priority }: { priority?: boolean }) {
  const brand = BEAUTY_PROMO.brands[0];
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: "radial-gradient(110% 90% at 72% 38%, #8A3456 0%, #4A1A2B 42%, #170B10 100%)" }}
    >
      {/* Арка с фото и флаконами: на телефоне — сверху по центру, на компьютере — справа */}
      <div
        className="absolute left-1/2 top-[13%] h-[44%] -translate-x-1/2 sm:left-auto sm:right-[7%] sm:top-[16%] sm:h-[70%] sm:translate-x-0 lg:right-[10%]"
        style={{ aspectRatio: "9 / 10" }}
      >
        <FloatingBottles items={BACK} eager={priority} />
        <div
          className="absolute overflow-hidden"
          style={{ left: "8%", top: 0, width: "84%", height: "100%", borderRadius: "999px 999px 0 0", zIndex: 1 }}
        >
          <Image
            src={brand.cover}
            alt={`${brand.name} — косметика`}
            fill
            priority={priority}
            sizes="(max-width: 640px) 70vw, 560px"
            className="object-cover"
          />
        </div>
        <FloatingBottles items={FRONT} style={{ zIndex: 3 }} eager={priority} />
        <div
          className="absolute hidden sm:block"
          style={{
            left: "-6%",
            top: "8%",
            width: "max(34%, 150px)",
            transform: "rotate(-6deg)",
            background: C.cream,
            color: C.ink,
            border: `1px solid ${C.ink}`,
            padding: "12px 14px 14px",
            boxShadow: "0 14px 28px rgba(0,0,0,.28)",
            zIndex: 5,
          }}
        >
          <div className="text-[10px] uppercase tracking-[.14em]" style={{ color: C.inkMuted }}>
            Подарок
          </div>
          <div className={`${fontDisplay.className} uppercase`} style={{ fontSize: 22, lineHeight: "24px", marginTop: 6, whiteSpace: "nowrap" }}>
            от {formatRub(BEAUTY_PROMO.threshold)}
          </div>
          <div style={{ fontSize: 13, lineHeight: "18px", marginTop: 4, color: C.text }}>{brand.gift}</div>
        </div>
      </div>
      {/* Затемнение снизу и слева — под текст слайдера */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 sm:h-1/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-gradient-to-r from-black/30 to-transparent sm:block" />
    </div>
  );
}
