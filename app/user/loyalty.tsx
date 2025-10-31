"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import StageWallet from "@/components/ui/StageWallet";

const LoyaltyPage = () => {
  const [currentLevel, setCurrentLevel] = useState<"Bronze" | "Silver" | "Gold" | "Platinum">("Bronze");

  // тестовые данные пользователя
  const userName = "Евгений Марамонт";
  const userPoints = 2480;

  useEffect(() => {
    // Добавляем класс stage-mode на html и body, чтобы сияние распространялось на всю страницу
    document.documentElement.classList.add("stage-mode");
    document.body.classList.add("stage-mode");

    return () => {
      document.documentElement.classList.remove("stage-mode");
      document.body.classList.remove("stage-mode");
    };
  }, []);

  // Глобальный фон — лёгкий и без «швов»
  // Цвет задаём через CSS‑переменную, чтобы не пересоздавать узлы при смене уровня
  const stageGlow =
    currentLevel === "Bronze"
      ? "rgba(255,191,0,0.10)"
      : currentLevel === "Silver"
      ? "rgba(200,200,200,0.08)"
      : currentLevel === "Gold"
      ? "rgba(255,215,0,0.10)"
      : "rgba(200,200,255,0.10)";

  useEffect(() => {
    // прокидываем цвет в CSS‑переменную
    document.documentElement.style.setProperty("--stage-glow", stageGlow);
  }, [stageGlow]);

  const BackdropFX = () => (
    <div id="stage-fx" className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      {/* базовый мягкий слой */}
      <span
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 40% 30%, rgba(255,255,255,0.06), transparent 60%)",
        }}
      />
      {/* динамический слой по уровню (GPU-friendly) */}
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

  const levelBenefits = {
    Bronze: [
      "Возврат 1% от суммы каждой покупки бонусами",
      "Доступ к стандартным акциям и предложениям",
      "Персональные рекомендации по товарам",
    ],
    Silver: [
      "Возврат 3% от суммы каждой покупки бонусами",
      "Доступ к ранним акциям и спецпредложениям",
      "Приоритетное уведомление о скидках",
      "Персональная статистика заказов",
    ],
    Gold: [
      "Возврат 4% от покупок",
      "Бесплатная доставка от 10 000 ₽",
      "Участие в закрытых распродажах",
      "Приоритетная обработка заказов",
      "Подарок на день рождения",
    ],
    Platinum: [
      "Возврат 5% бонусами",
      "Доступ к лимитированным коллекциям",
      "Персональный менеджер Stage Concierge",
      "Эксклюзивные скидки и приглашения на ивенты",
      "Ранний доступ к премиум-дропам",
    ],
  };

  return (
    <div className="loyalty-root relative min-h-screen flex flex-col items-center justify-start px-4 sm:px-6 md:px-8 py-8 md:py-12">
      {typeof window !== "undefined" ? createPortal(<BackdropFX />, document.body) : null}

      {/* Верхний заголовок по центру */}
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-center drop-shadow-[0_2px_8px_rgba(255,255,255,0.1)]">
          Stage Loyalty Wallet
        </h1>
        <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-6 justify-center lg:justify-start text-gray-100">
          {/* Имя */}
          <p className="text-base font-medium opacity-80">{userName}</p>

          {/* Разделитель */}
          <div className="hidden sm:block w-16 h-px bg-gray-600/40"></div>

          {/* Баллы */}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-white">{userPoints}</span>
            <span className="text-sm text-gray-400">баллов</span>
          </div>

          {/* Разделитель */}
          <div className="hidden sm:block w-16 h-px bg-gray-600/40"></div>

          {/* Бейдж уровня */}
          <span
            className={`px-3 sm:px-4 py-1 text-[11px] sm:text-xs md:text-sm rounded-full border shadow-inner transition-all duration-500 ${
              currentLevel === "Bronze"
                ? "bg-gradient-to-r from-amber-800 to-amber-700 text-amber-200 border-amber-600"
                : currentLevel === "Silver"
                ? "bg-gradient-to-r from-gray-600 to-gray-800 text-gray-200 border-gray-500"
                : currentLevel === "Gold"
                ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 text-yellow-100 border-yellow-600/40"
                : "bg-gradient-to-r from-gray-200/10 to-blue-200/10 text-gray-100 border-gray-400/40"
            }`}
          >
            {currentLevel} Member
          </span>
        </div>
      </div>

      {/* Контент */}
      <div className="relative z-10 flex flex-col lg:flex-row items-start justify-center w-full max-w-6xl gap-8 sm:gap-10 lg:gap-12 mt-8 lg:mt-12 stage-glass">
        {/* Stage Wallet */}
        <div className="flex-1 w-full flex flex-col items-center lg:items-end text-center relative">
          <StageWallet onLevelChange={setCurrentLevel} />

          {/* Прогресс по уровням */}
          <div className="mt-16 w-full relative flex flex-col items-center">
            <p className="text-gray-200 font-semibold text-sm sm:text-base whitespace-nowrap text-center md:absolute md:left-[105%] md:-translate-x-1/2 md:bottom-full md:mb-3 mb-3">
              До следующего уровня осталось <span className="text-white font-bold">27 500 ₽</span>
            </p>

            {/* Контейнер для прогресс-бара и сумм */}
            <div className="w-full max-w-4xl relative">
              {/* Линия прогресса */}
              <div className="relative w-full md:w-[160%] lg:w-[217%] h-[10px] sm:h-3 bg-gray-700/40 rounded-full overflow-visible mx-auto md:translate-x-4">
                {/* Заполненная часть */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/80 to-white/30 rounded-full transition-all duration-700"
                  style={{
                    width:
                      currentLevel === "Bronze"
                        ? "15%"
                        : currentLevel === "Silver"
                        ? "40%"
                        : currentLevel === "Gold"
                        ? "70%"
                        : "100%",
                  }}
                />

                {/* Точки уровней */}
                <div className="absolute top-1/2 -translate-y-1/2 left-[10%] -translate-x-1/2">
                  <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"></div>
                </div>

                <div className="absolute top-1/2 -translate-y-1/2 left-[50%] -translate-x-1/2">
                  <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"></div>
                </div>

                <div className="absolute top-1/2 -translate-y-1/2 left-[90%] -translate-x-1/2">
                  <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"></div>
                </div>
              </div>

              {/* Подписи сумм ПОД прогресс-баром - выровнены под точками */}
              <div className="relative w-full md:w-[160%] lg:w-[217%] mt-3 md:mt-2 mx-auto md:translate-x-4">
                <div className="dot-label absolute left-[10%] -translate-x-1/2 flex flex-col items-center">
                  <p className="text-xs sm:text-sm font-semibold text-gray-200 whitespace-nowrap">10 000 ₽</p>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-1">Silver</p>
                </div>

                <div className="dot-label absolute left-[50%] -translate-x-1/2 flex flex-col items-center">
                  <p className="text-xs sm:text-sm font-semibold text-gray-200 whitespace-nowrap">35 000 ₽</p>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-1">Gold</p>
                </div>

                <div className="dot-label absolute left-[90%] -translate-x-1/2 flex flex-col items-center">
                  <p className="text-xs sm:text-sm font-semibold text-gray-200 whitespace-nowrap">150 000 ₽</p>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-1">Platinum</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Преимущества */}
        <aside className="w-full lg:w-[360px] glass-block p-5 sm:p-8 text-gray-100 h-fit flex flex-col justify-start self-start mt-8 lg:mt-0">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 justify-center lg:justify-start">
            Преимущества уровня{" "}
            <span className="text-white">
              {currentLevel === "Bronze"
                ? "🔰 Stage Bronze"
                : currentLevel === "Silver"
                ? "🎁 Stage Silver"
                : currentLevel === "Gold"
                ? "✨ Stage Gold"
                : "👑 Stage Platinum"}
            </span>
          </h2>

          <ul className="space-y-2 text-sm leading-relaxed">
            {levelBenefits[currentLevel].map((benefit, i) => (
              <li key={i}>• {benefit}</li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Баланс и операции */}
      <section className="relative z-10 w-full max-w-5xl mt-20 text-gray-200">
        <h2 className="text-2xl font-semibold mb-6 text-center">Баланс и операции</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-block p-6 rounded-xl">
            <h3 className="text-lg font-semibold mb-3 text-white">Начисления</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li>+250 ₽ — покупка Nike Dunk Low</li>
              <li>+130 ₽ — бонус за Black Friday</li>
              <li>+70 ₽ — участие в ивенте</li>
            </ul>
          </div>

          <div className="glass-block p-6 rounded-xl">
            <h3 className="text-lg font-semibold mb-3 text-white">Списания</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li>-400 ₽ — оплата заказа  #1245</li>
              <li>-120 ₽ — использование промокода</li>
            </ul>
          </div>
        </div>
      </section>

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
      `}</style>
    </div>
  );
};

export default LoyaltyPage;