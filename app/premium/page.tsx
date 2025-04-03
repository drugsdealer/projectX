"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTitle } from "@/context/TitleContext"; // Импортируем контекст

export default function PremiumPage() {
  const [showAnimation, setShowAnimation] = useState(true);
  const router = useRouter();
  const { setTitle } = useTitle(); // Деструктурируем метод смены заголовка

  useEffect(() => {
    setTitle("Stage Premium"); // Устанавливаем заголовок Premium

    const timer = setTimeout(() => {
      setShowAnimation(false);
      document.body.style.overflow = "auto"; // Вернуть прокрутку
    }, 1500);

    document.body.style.overflow = "hidden"; // Запретить прокрутку на время анимации

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "auto"; // Вернуть прокрутку, если вдруг компонент размонтируется
      setTitle("Stage Shoes"); // При выходе вернуть стандартное название
    };
  }, [setTitle]);

  return (
    <>
      {/* Кнопка "Назад в Stage" */}
      {!showAnimation && (
        <div className="sticky top-0 left-0 w-full bg-black p-4 z-10">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-white text-black font-bold rounded-lg shadow-md hover:bg-gray-200 transition"
          >
            Назад в Stage
          </button>
        </div>
      )}

      {/* Анимация Premium */}
      <AnimatePresence>
        {showAnimation && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 1.5 }}
            className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[9999]"
          >
            <h1 className="text-6xl font-extrabold text-white mb-8">Premium</h1>

            {/* Вращающиеся звезды */}
            <div className="relative w-64 h-64">
              {[...Array(8)].map((_, i) => (
                <motion.img
                  key={i}
                  src="/img/звездочкиии.png"
                  alt="Star"
                  className="absolute w-12 h-12"
                  style={{
                    top: `${50 + 40 * Math.sin((i / 8) * 2 * Math.PI)}%`,
                    left: `${50 + 40 * Math.cos((i / 8) * 2 * Math.PI)}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Infinity,
                    duration: 4,
                    ease: "linear",
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Контент Premium страницы */}
      <div className="p-10 text-center text-white">
        <h2 className="text-4xl font-bold mb-4">Добро пожаловать в Premium раздел!</h2>
        <p className="text-lg">
          Здесь будут располагаться эксклюзивные товары, скидки и предложения только для избранных.
        </p>
      </div>
    </>
  );
}
