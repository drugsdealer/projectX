"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StageCard from "./StageCard";

interface StageWalletProps {
  onLevelChange?: (level: "Silver" | "Gold" | "Platinum") => void;
}

const levels = [
  { id: 0, level: "BRONZE", bonus: "+3%", progress: 1 },
  { id: 1, level: "SILVER", bonus: "+10%", progress: 0.63 },
  { id: 2, level: "GOLD", bonus: "+25%", progress: 0.3 },
  { id: 3, level: "PLATINUM", bonus: "+50%", progress: 0.1 },
];

const StageWallet: React.FC<StageWalletProps> = ({ onLevelChange }) => {
  const userSpent = 50000;
  const requiredAmounts = { Bronze: 0, Silver: 10000, Gold: 150000, Platinum: 300000 };

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const levelsMap = ["Bronze", "Silver", "Gold", "Platinum"];
    onLevelChange?.(levelsMap[activeIndex] as "Silver" | "Gold" | "Platinum");
  }, [activeIndex, onLevelChange]);

  const nextCard = () => setActiveIndex((prev) => (prev + 1) % levels.length);

  return (
    <section className="relative w-full flex flex-col items-center justify-center py-10 bg-transparent">
      <div className="relative h-[220px] w-[340px]">
        <AnimatePresence>
          {levels.map((card, i) => {
            const indexDiff = (i - activeIndex + levels.length) % levels.length;
            const levelName = card.level.charAt(0).toUpperCase() + card.level.slice(1).toLowerCase();
            const isUnlocked = userSpent >= requiredAmounts[levelName as keyof typeof requiredAmounts];
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 30, rotateY: 10 }}
                animate={{
                  opacity: indexDiff === 0 ? 1 : 0.3,
                  y: indexDiff * 20,
                  scale: indexDiff === 0 ? 1.05 : 0.9,
                  zIndex: levels.length - indexDiff,
                  rotateY: indexDiff * -5,
                  filter: indexDiff === 0 ? "brightness(1.2) drop-shadow(0 0 12px rgba(255,255,255,0.15))" : "brightness(0.6)",
                }}
                exit={{ opacity: 0, y: -20, rotateY: -10 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                onClick={nextCard}
              >
                <StageCard
                  level={card.level}
                  bonus={card.bonus}
                  progress={card.progress}
                  active={indexDiff === 0}
                />
                {!isUnlocked && (
                  <div className="absolute top-3 right-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-6 h-6 text-gray-300 drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 10V8a4 4 0 10-8 0v2m-2 0h12v10H6V10z"
                      />
                    </svg>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <button
        onClick={nextCard}
        className="mt-10 text-sm uppercase tracking-wider text-gray-300 hover:text-white transition-colors"
      >
        Смотреть следующий уровень →
      </button>
    </section>
  );
};

export default StageWallet;