"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

type DeliveryInfoModalProps = {
  open: boolean;
  variant: "moscow" | "russia";
  onClose: () => void;
};

export const DeliveryInfoModal: React.FC<DeliveryInfoModalProps> = ({
  open,
  variant,
  onClose,
}) => {
  // На сервере document недоступен — ничего не рендерим
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="delivery-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-4 text-sm text-gray-800"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-4 text-2xl text-gray-500 hover:text-black"
              aria-label="Закрыть условия доставки"
            >
              ×
            </button>

            {variant === "moscow" ? (
              <>
                <h3 className="text-xl font-bold text-center mb-2">
                  Доставка по Москве и области
                </h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Самовывоз</strong> — Москва, ул. Примерная, д. 10.
                    График работы: 10:00–21:00.
                  </li>
                  <li>
                    <strong>Курьерская доставка</strong> по Москве —{" "}
                    <strong>499 ₽</strong>.
                  </li>
                </ul>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-center mb-2">
                  Условия доставки по Москве и РФ
                </h3>

                <div>
                  <h4 className="text-lg font-semibold mb-1">
                    📦 Доставка по Москве:
                  </h4>
                  <p>
                    Мы предлагаем два удобных варианта получения вашего заказа
                    в пределах Москвы:
                  </p>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>
                      <strong>Самовывоз</strong> — по адресу: Москва, ул.
                      Примерная, д. 10. График работы: 10:00–21:00.
                    </li>
                    <li>
                      <strong>Курьерская доставка</strong> — по городу Москве.
                      Стоимость услуги — <strong>499 ₽</strong>.
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-lg font-semibold mb-1">
                    🚚 Доставка по России:
                  </h4>
                  <p>
                    Доставляем по всей России надёжными транспортными
                    компаниями.
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};