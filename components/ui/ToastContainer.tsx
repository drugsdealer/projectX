'use client';

import { useToast } from '@/context/ToastContext';
import { AnimatePresence, motion } from 'framer-motion';
import Link from "next/link";
import { ShoppingCart, Heart } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts } = useToast();

  return (
    <div className="fixed top-5 right-5 space-y-4 z-[9999]">
      <AnimatePresence>
        {toasts.map((toast) => {
          const text = `${toast.title} ${toast.details || ""}`;
          const isRegister = /зарегистр/i.test(text);
          const isFavorite = /избран/i.test(text);
          const href = isRegister ? "/register" : isFavorite ? "/favorites_item" : "/cart";
          const hint = isRegister
            ? "Нажмите, чтобы перейти к регистрации"
            : isFavorite
            ? "Нажмите, чтобы перейти в избранное"
            : "Нажмите, чтобы перейти в корзину";
          return (
            <Link key={toast.id} href={href}>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-black text-white px-5 py-3 rounded-lg shadow-lg min-w-[250px] max-w-sm cursor-pointer hover:bg-gray-800 transition border border-white/10"
            >
              <div className="flex justify-between items-center">
                <p className="font-semibold">{toast.title}</p>
                {isFavorite ? (
                  <Heart size={18} className="text-white opacity-70" />
                ) : (
                  <ShoppingCart size={18} className="text-white opacity-70" />
                )}
              </div>
              {toast.details && (
                <p className="text-sm text-gray-300 mt-1">{toast.details}</p>
              )}
              <p className="text-xs text-gray-400 mt-1 italic">{hint}</p>
            </motion.div>
          </Link>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
