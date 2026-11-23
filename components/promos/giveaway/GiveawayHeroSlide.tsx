"use client";

/**
 * Фон слайда «Розыгрыш» в верхнем слайдере главной: графитовый фон с голубым свечением Telegram
 * и картинка поста розыгрыша, как плакат на скотче. Текст и кнопку рисует сам слайдер (BannerMargiela).
 */
import Image from "next/image";
import { GIVEAWAY } from "@/lib/promo-giveaway";

export default function GiveawayHeroSlide({ priority }: { priority?: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: "radial-gradient(90% 80% at 75% 35%, #1d3b52 0%, #141a20 45%, #0b0c0d 100%)" }}
    >
      {/* Номера Margiela на фоне */}
      <div
        className="pointer-events-none absolute -right-[4%] top-[8%] hidden select-none font-mono text-[11vw] font-bold leading-none text-white/[0.04] sm:block"
        aria-hidden="true"
      >
        0 1 2 3 4 5 <span className="text-white/[0.09]">6</span>
        <br />7 8 9 10 11
      </div>

      {/* Плакат: на телефоне — сверху по центру, на компьютере — справа */}
      <div className="absolute left-1/2 top-[12%] h-[42%] -translate-x-1/2 sm:left-auto sm:right-[8%] sm:top-[13%] sm:h-[70%] sm:translate-x-0 lg:right-[12%]" style={{ aspectRatio: "4 / 5" }}>
        <div className="gw-float relative h-full w-full">
          <span className="absolute -top-2.5 left-1/2 z-10 h-6 w-[38%] -translate-x-1/2 -rotate-3 bg-white/60 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative h-full w-full bg-white p-[2.5%] shadow-[0_40px_80px_-20px_rgba(42,171,238,.45)]">
            <div className="relative h-full w-full">
              <Image src={GIVEAWAY.image} alt="Розыгрыш: шапка MM6 и аромат Maison Margiela Replica" fill priority={priority} sizes="(max-width: 640px) 60vw, 460px" className="object-cover" />
            </div>
          </div>
          {/* Значок Telegram на углу плаката */}
          <span className="absolute -bottom-4 -left-4 grid h-14 w-14 place-items-center rounded-full bg-[#2AABEE] text-white shadow-lg sm:h-16 sm:w-16">
            <svg viewBox="0 0 24 24" className="h-7 w-7 -translate-x-[1px] sm:h-8 sm:w-8" fill="currentColor" aria-hidden="true">
              <path d="M21.94 4.3a1.2 1.2 0 0 0-1.62-1.33L2.9 9.7c-1.16.46-1.15 1.1-.2 1.4l4.47 1.4 1.72 5.3c.2.58.1.81.71.81.47 0 .68-.21.94-.47l2.26-2.2 4.7 3.47c.86.48 1.49.23 1.7-.8l2.74-14.3ZM8.6 12.2l9.63-6.07c.48-.29.92-.13.56.19l-8.25 7.44-.32 3.42L8.6 12.2Z" />
            </svg>
          </span>
        </div>
      </div>

      {/* Затемнение под текст слайдера */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/30 to-transparent sm:h-1/3" />

      <style jsx>{`
        .gw-float {
          transform: rotate(3deg);
          animation: gw-hero-float 6s ease-in-out infinite alternate;
        }
        @keyframes gw-hero-float {
          from { transform: rotate(3deg) translateY(0); }
          to { transform: rotate(1deg) translateY(-12px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gw-float { animation: none; }
        }
      `}</style>
    </div>
  );
}
