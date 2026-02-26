"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
// (promo-only view)

const LoyaltyPage = () => {
  // promo-only

  useEffect(() => {
    // Не включаем stage-mode, чтобы не перезаписывать цвета в globals.css
    return () => {};
  }, []);

  // Глобальный фон — лёгкий и без «швов»
  const stageGlow = "rgba(0,0,0,0.06)";

  useEffect(() => {
    // отключено для промо-only
  }, [stageGlow]);

  const BackdropFX = () => (
    <div id="stage-fx" className="pointer-events-none fixed inset-0 -z-20 overflow-hidden loyalty-fx">
      {/* базовый мягкий слой */}
      <span
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 40% 30%, rgba(255,255,255,0.06), transparent 60%)",
        }}
      />
      {/* динамический слой */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <span
          className="block w-[140vw] h-[70vh] sm:w-[120vw] sm:h-[80vh] opacity-70 will-change-transform motion-safe:animate-[glowDrift_22s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(ellipse at center, var(--stage-glow), transparent 70%)",
          }}
        />
      </div>
      {/* дополнительная вспышка справа */}
      <div className="hidden md:block absolute top-[18%] right-[10%] pointer-events-none">
        <span
          className="block w-[40vw] h-[40vh] opacity-40 will-change-transform motion-safe:animate-[glowDrift_28s_ease-in-out_infinite_reverse]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.05), transparent 70%)",
          }}
        />
      </div>
      {/* симметричная вспышка слева для баланса */}
      <div className="hidden md:block absolute top-[22%] left-[8%] pointer-events-none">
        <span
          className="block w-[28vw] h-[28vh] opacity-30 will-change-transform motion-safe:animate-[glowDrift_26s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.045), transparent 70%)",
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="loyalty-root relative min-h-screen flex flex-col items-center justify-start px-4 sm:px-6 md:px-8 py-8 md:py-12 text-black">
      {typeof window !== "undefined" ? createPortal(<BackdropFX />, document.body) : null}

      {/* Минималистичное промо лояльности */}
      <div className="relative z-10 w-full max-w-6xl mx-auto mt-6 sm:mt-8">
        <div className="loyalty-promo border border-black/10 bg-white/80 backdrop-blur-xl rounded-3xl px-6 sm:px-8 py-6 sm:py-7 overflow-hidden text-black">
          <div className="absolute -inset-1 pointer-events-none loyalty-ring" />
          <div className="absolute inset-0 pointer-events-none promo-sheen" />
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.32em] text-black/50">Stage Loyalty</div>
              <div className="mt-2 text-2xl sm:text-3xl font-semibold text-black">
                Запуск программы — совсем скоро
              </div>
              <p className="mt-2 text-sm sm:text-base text-black/60 leading-relaxed max-w-2xl">
                Минималистичный люкс‑подход: уровни, персональные привилегии и ранние дропы.
                Следи за обновлениями в Telegram канале StageStore.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href="https://t.me/stagestore"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2 text-sm font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition"
                >
                  Перейти в Telegram
                  <span className="text-white/70">→</span>
                </a>
                <span className="text-xs text-black/50">Обновления и ранние анонсы</span>
              </div>
            </div>
            <div className="promo-journey">
              {["Bronze", "Silver", "Gold", "Black"].map((label, index) => (
                <div key={label} className="journey-step">
                  <span className="journey-dot" />
                  <span className="journey-label">{label}</span>
                  {index < 3 ? <span className="journey-line" /> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-black/60">
            <span className="promo-pill">Кэшбэк по уровням</span>
            <span className="promo-pill">Ранний доступ</span>
            <span className="promo-pill">Закрытые офферы</span>
          </div>
        </div>
      </div>

      {/* Убираем дополнительный слой, который мог создавать границу */}
      <style jsx global>{`
        @keyframes fillProgress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        @keyframes glowDrift {
          0%, 100% {
            transform: translate3d(0,0,0) scale(1);
          }
          25% {
            transform: translate3d(-10px, -6px, 0) scale(1.03);
          }
          50% {
            transform: translate3d(8px, 10px, 0) scale(1.05);
          }
          75% {
            transform: translate3d(-6px, 4px, 0) scale(1.02);
          }
        }

        /* Убедимся, что нет границ у body и html */
        body.stage-mode, html.stage-mode {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }

        /* Убираем возможные границы у контейнеров */
        .glass-block {
          border: none !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
        }

        /* Убираем любой локальный стеклянный фон контейнера — он и давал прямоугольный шов */
        .stage-mode .stage-glass {
          position: static;
          isolation: auto;
          background: transparent !important;
          box-shadow: none !important;
        }
        .stage-mode .stage-glass::before {
          content: none !important;   /* полностью отключаем псевдо-слой */
        }

        /* В stage-mode дочерние «стеклянные» блоки не должны создавать свой собственный шов */
        .stage-mode .glass-block {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* делаем фон GPU-дружелюбным и за слоем контента */
        #stage-fx,
        #stage-fx * {
          filter: none !important;           /* избегаем blur: дорогой по рендеру */
          backdrop-filter: none !important;
        }
        #stage-fx { z-index: -20; pointer-events: none; }
        .loyalty-fx {
          opacity: 0.5;
        }

        /* изоляция основного контейнера, чтобы не мигал при апдейтах */
        .loyalty-root { isolation: isolate; contain: paint; }

        /* уважаем настройки пользователей на снижение анимации */
        @media (prefers-reduced-motion: reduce) {
          .motion-safe\:animate-\[glowDrift_22s_ease-in-out_infinite\],
          .motion-safe\:animate-\[glowDrift_28s_ease-in-out_infinite_reverse\],
          .motion-safe\:animate-\[glowDrift_26s_ease-in-out_infinite\] {
            animation: none !important;
          }
        }

        /* мобильная подгонка подписей под точками */
        @media (max-width: 767px) {
          .loyalty-root .dot-label {
            transform: translateX(-50%);
          }
        }

        /* Подстраховка от горизонтального скролла на iOS */
        html.stage-mode, body.stage-mode {
          overflow-x: hidden;
        }

        /* Чуть более плавная смена оттенка фона */
        :root {
          transition: --stage-glow 300ms ease-in-out;
        }

        .loyalty-promo {
          position: relative;
          border-color: rgba(0, 0, 0, 0.12);
        }
        .promo-sheen {
          background: linear-gradient(110deg, transparent, rgba(0,0,0,0.08), transparent);
          animation: promoSheen 6.5s ease-in-out infinite;
        }
        .promo-journey {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 240px;
        }
        .journey-step {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0,0,0,0.12);
          color: rgba(0,0,0,0.75);
          font-size: 12px;
          overflow: hidden;
          animation: floatChip 4.8s ease-in-out infinite;
        }
        .journey-step:nth-child(2) { animation-delay: 0.8s; }
        .journey-step:nth-child(3) { animation-delay: 1.6s; }
        .journey-step:nth-child(4) { animation-delay: 2.4s; }
        .journey-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #111;
          box-shadow: 0 0 10px rgba(0,0,0,0.35);
        }
        .journey-line {
          position: absolute;
          left: 20px;
          top: 100%;
          width: 2px;
          height: 14px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.3), transparent);
        }
        .promo-pill {
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.12);
          background: rgba(0,0,0,0.04);
        }
        .loyalty-ring {
          border-radius: 28px;
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.06),
            0 0 40px rgba(0,0,0,0.08),
            0 0 120px rgba(0,0,0,0.06);
          animation: ringPulse 5.8s ease-in-out infinite;
        }
        .loyalty-promo::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(120% 120% at 15% 20%, rgba(0,0,0,0.06), transparent 55%),
            radial-gradient(120% 120% at 85% 80%, rgba(0,0,0,0.05), transparent 60%);
          animation: auraDrift 9s ease-in-out infinite;
        }
        .loyalty-promo::before {
          content: "";
          position: absolute;
          inset: -60%;
          background: conic-gradient(from 0deg, transparent, rgba(0,0,0,0.08), transparent);
          opacity: 0.45;
          animation: slowRotate 18s linear infinite;
          pointer-events: none;
        }
        @keyframes ringPulse {
          0% {
            opacity: 0.55;
            transform: scale(0.985);
          }
          50% {
            opacity: 1;
            transform: scale(1.01);
          }
          100% {
            opacity: 0.55;
            transform: scale(0.985);
          }
        }
        @keyframes auraDrift {
          0% { transform: translate3d(0,0,0); opacity: 0.45; }
          50% { transform: translate3d(2%, -3%, 0); opacity: 0.7; }
          100% { transform: translate3d(0,0,0); opacity: 0.45; }
        }
        @keyframes slowRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .journey-step {
          position: relative;
          overflow: hidden;
        }
        .journey-step::after {
          content: "";
          position: absolute;
          inset: -40%;
          background: linear-gradient(120deg, transparent, rgba(0,0,0,0.08), transparent);
          animation: chipSheen 5.5s ease-in-out infinite;
        }
        @keyframes chipSheen {
          0% { transform: translateX(-60%); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateX(60%); opacity: 0; }
        }
        @keyframes promoSheen {
          0% { transform: translateX(-120%); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes floatChip {
          0% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .promo-journey {
            width: 100%;
          }
          .journey-line {
            left: 18px;
          }
        }
      `}</style>
    </div>
  );
};

export default LoyaltyPage;
