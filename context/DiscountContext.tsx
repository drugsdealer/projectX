'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface DiscountContextType {
  discount: number;
  setDiscount: (value: number) => void;
  resetDiscount: () => void;
}

const DiscountContext = createContext<DiscountContextType | undefined>(undefined);

export const DiscountProvider = ({ children }: { children: ReactNode }) => {
  const [discount, setDiscountState] = useState<number>(0);

  // Загрузка скидки из localStorage при монтировании
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("discount");
      if (stored) setDiscountState(parseFloat(stored));
    }
  }, []);

  // Сохраняем скидку в localStorage при каждом изменении
  useEffect(() => {
    localStorage.setItem("discount", discount.toString());
  }, [discount]);

  // Установка скидки
  const setDiscount = (value: number) => {
    setDiscountState(value);
  };

  // Сброс скидки и удаление промокода
  const resetDiscount = () => {
    setDiscountState(0);
    localStorage.removeItem("discount");
    localStorage.removeItem("promoCode");
  };

  return (
    <DiscountContext.Provider value={{ discount, setDiscount, resetDiscount }}>
      {children}
    </DiscountContext.Provider>
  );
};

// Хук для использования контекста
export const useDiscount = (): DiscountContextType => {
  const context = useContext(DiscountContext);
  if (!context)
    throw new Error("useDiscount must be used within DiscountProvider");
  return context;
};