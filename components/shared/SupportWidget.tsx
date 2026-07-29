"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Mail } from "lucide-react";

const TELEGRAM_URL = "https://t.me/stagestore";
const SUPPORT_EMAIL = "info@stagestore.ru";

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // На premium-страницах уже есть консьерж — не дублируем виджет поддержки.
  if (pathname?.startsWith("/premium")) return null;

  return (
    <div className="fixed right-4 bottom-20 sm:right-6 sm:bottom-6 z-[900] flex flex-col items-end gap-3 pointer-events-none">
      {/* Popover-карточка */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="pointer-events-auto w-[280px] overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
          >
            {/* Шапка */}
            <div className="bg-black px-5 pt-5 pb-4 text-white">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">
                Stage Store
              </div>
              <div className="mt-1 text-lg font-bold leading-tight">Мы на связи</div>
              <p className="mt-1 text-xs text-white/60 leading-relaxed">
                Поможем с выбором, размером и подлинностью. Отвечаем ежедневно 10:00–21:00 (МСК).
              </p>
            </div>

            {/* Каналы */}
            <div className="p-4 grid gap-2">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-[#229ED9] px-4 py-3 text-white transition hover:brightness-95"
              >
                <Send size={18} />
                <span className="text-sm font-semibold">Написать в Telegram</span>
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3 text-black transition hover:bg-black/[0.04]"
              >
                <Mail size={18} className="text-black/60" />
                <span className="text-sm font-semibold">{SUPPORT_EMAIL}</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Кнопка */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Закрыть поддержку" : "Открыть поддержку"}
        className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-black text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 active:scale-95"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle size={24} />
            </motion.span>
          )}
        </AnimatePresence>
        {/* мягкий пульс, когда закрыто */}
        {!open && (
          <span className="absolute inset-0 rounded-full ring-2 ring-black/20 animate-ping [animation-duration:2.5s]" />
        )}
      </button>
    </div>
  );
}
