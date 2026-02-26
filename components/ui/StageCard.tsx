

"use client";

import React from "react";

interface StageCardProps {
  level: string;
  bonus: string;
  progress: number;
  active?: boolean;
}

const StageCard: React.FC<StageCardProps> = ({ level, bonus, progress, active = false }) => {
  const cardGradient =
    level === "BRONZE"
      ? "from-amber-700/40 to-yellow-500/10"
      : level === "SILVER"
      ? "from-gray-400/30 to-white/10"
      : level === "GOLD"
      ? "from-yellow-400/30 to-yellow-100/10"
      : "from-gray-100/40 to-white/10";
  return (
    <div
      className={`wallet-card relative w-[320px] h-[200px] p-6 flex flex-col justify-between glass-block text-gray-100 transition-transform duration-500 bg-gradient-to-br ${cardGradient} ${
        active ? "z-20 scale-105" : "z-10 scale-95"
      }`}
    >
      {/* Верхняя часть: уровень */}
      <div>
        <h2 className="text-2xl font-bold uppercase tracking-widest">{level}</h2>
        <p className="text-sm text-gray-300">Stage Loyalty</p>
      </div>

      {/* Нижняя часть: бонус и прогресс */}
      <div>
        <p className="text-lg font-semibold mb-2">Бонус: {bonus}</p>
        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/40 transition-all duration-700 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Прогресс: {(progress * 100).toFixed(0)}%
        </p>
      </div>

      {/* Эффект блика */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-white/20 to-transparent opacity-0 hover:opacity-20 transition-opacity duration-700 rotate-12"></div>
      </div>
    </div>
  );
};

export default StageCard;