'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type DiscountType = "PERCENT" | "AMOUNT";
export type DiscountState = { type: DiscountType; value: number };

interface DiscountContextType {
  discount: DiscountState;
  applyDiscount: (value: number | DiscountState, type?: DiscountType) => void;
  resetDiscount: () => void;
}

const DiscountContext = createContext<DiscountContextType | undefined>(undefined);

const DEFAULT_DISCOUNT: DiscountState = { type: "PERCENT", value: 0 };
const DISCOUNT_KEY = "discount_state";
const LEGACY_DISCOUNT_KEY = "discount";

const normalizeDiscount = (input: unknown): DiscountState => {
  if (!input) return { ...DEFAULT_DISCOUNT };
  if (typeof input === "object" && input !== null) {
    const type = (input as any).type === "AMOUNT" ? "AMOUNT" : "PERCENT";
    const valueNum = Number((input as any).value ?? 0);
    return { type, value: Number.isFinite(valueNum) ? Math.max(0, valueNum) : 0 };
  }
  if (typeof input === "number") {
    return { type: "PERCENT", value: Number.isFinite(input) ? Math.max(0, input) : 0 };
  }
  const parsed = Number(input);
  if (Number.isFinite(parsed)) return { type: "PERCENT", value: Math.max(0, parsed) };
  return { ...DEFAULT_DISCOUNT };
};

export const DiscountProvider = ({ children }: { children: ReactNode }) => {
  const [discount, setDiscountState] = useState<DiscountState>(DEFAULT_DISCOUNT);

  // Загрузка скидки из localStorage при монтировании
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedState = localStorage.getItem(DISCOUNT_KEY);
        if (storedState) {
          const parsed = JSON.parse(storedState);
          setDiscountState(normalizeDiscount(parsed));
          return;
        }
      } catch {}
      const legacy = localStorage.getItem(LEGACY_DISCOUNT_KEY);
      if (legacy != null) {
        setDiscountState(normalizeDiscount(Number(legacy)));
      }
    }
  }, []);

  // Сохраняем скидку в localStorage при каждом изменении
  useEffect(() => {
    try {
      localStorage.setItem(DISCOUNT_KEY, JSON.stringify(discount));
    } catch {}
    // legacy key for backward compatibility (only percent)
    try {
      localStorage.setItem(
        LEGACY_DISCOUNT_KEY,
        discount.type === "PERCENT" ? String(discount.value) : "0"
      );
    } catch {}
  }, [discount]);

  // Применение скидки
  const applyDiscount = (value: number | DiscountState, type: DiscountType = "PERCENT") => {
    if (typeof value === "object") {
      setDiscountState(normalizeDiscount(value));
      return;
    }
    setDiscountState(normalizeDiscount({ type, value }));
  };

  // Сброс скидки и удаление промокода
  const resetDiscount = () => {
    setDiscountState({ ...DEFAULT_DISCOUNT });
    localStorage.removeItem(DISCOUNT_KEY);
    localStorage.removeItem(LEGACY_DISCOUNT_KEY);
    localStorage.removeItem("promoCode");
    localStorage.removeItem("promoType");
    localStorage.removeItem("promoValue");
    localStorage.removeItem("promoApplied");
  };

  return (
    <DiscountContext.Provider value={{ discount, applyDiscount, resetDiscount }}>
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
