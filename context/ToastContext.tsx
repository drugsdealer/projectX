'use client';

import { createContext, useContext, useState } from "react";

type Toast = {
  id: number;
  title: string;
  details: string;
};

type ToastContextType = {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: number) => void; 
};

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

 const showToast = (toast: Omit<Toast, 'id'>) => {
  const newToast: Toast = {
    id: Date.now(), // Уникальный ID
    title: toast.title,
    details: toast.details,
  };

  setToasts([newToast]);

  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== newToast.id));
  }, 3000);
};
  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};