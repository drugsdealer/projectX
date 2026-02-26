"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// 1. Создаём контекст с типами
interface TitleContextType {
  title: string;
  setTitle: (title: string) => void;
}

const TitleContext = createContext<TitleContextType | undefined>(undefined);

// 2. Создаём провайдер контекста
export const TitleProvider = ({ children }: { children: ReactNode }) => {
  const [title, setTitle] = useState("Stage Sneakers");

  return (
    <TitleContext.Provider value={{ title, setTitle }}>
      {children}
    </TitleContext.Provider>
  );
};

// 3. Создаём хук для использования контекста
export const useTitle = () => {
  const context = useContext(TitleContext);
  if (!context) {
    throw new Error("useTitle must be used within a TitleProvider");
  }
  return context;
};
