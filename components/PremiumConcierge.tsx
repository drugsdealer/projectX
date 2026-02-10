"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LABELS: Record<string, string> = {
  footwear: 'Обувь',
  clothes: 'Одежда',
  bags: 'Сумки',
  accessories: 'Аксессуары',
  fragrance: 'Парфюмерия',
  headwear: 'Головные уборы',
};

type ConciergeProps = { open: boolean; setOpen: (v: boolean) => void };

export const PremiumConcierge: React.FC<ConciergeProps> = ({ open, setOpen }) => {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Лочим скролл страницы, пока открыт модал
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const preventScroll = (e: Event) => {
      e.preventDefault();
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("keydown", onEsc);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("wheel", preventScroll as any);
      window.removeEventListener("touchmove", preventScroll as any);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, setOpen]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setOk(null);
    setErr(null);

    // Запоминаем форму ДО всех await
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);

    // Собираем полезные поля
    const raw = Object.fromEntries(fd.entries());

    const rawCategory = String(raw.category || "").trim();
    const normalizedCategory = rawCategory.toLowerCase();
    const categoryLabel = LABELS[normalizedCategory] || rawCategory;

    const payload = {
      name: String(raw.name || "").trim(),
      contact: String(raw.contact || "").trim(),
      category: categoryLabel,
      size: String(raw.size || "").trim(),
      notes: String(raw.notes || "").trim(),
      source: "premium-modal",
    };

    // Файлы -> base64
    const files = (fd.getAll("photos") as File[]).filter(
      (f) => f && f.size > 0
    );
    let attachments: { name: string; type: string; data: string }[] = [];

    if (files.length) {
      attachments = await Promise.all(
        files.map(
          (f) =>
            new Promise<{ name: string; type: string; data: string }>(
              (resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  const base64 = result.split(",")[1] || "";
                  resolve({ name: f.name, type: f.type, data: base64 });
                };
                reader.readAsDataURL(f);
              }
            )
        )
      );
    }

    try {
      const resp = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, attachments }),
      });

      if (!resp.ok) {
        throw new Error("Failed");
      }

      setOk(
        "Ваша заявка успешно отправлена. В ближайшее время с вами свяжется менеджер."
      );

      form.reset();
    } catch (error) {
      console.error("[concierge] submit failed", error);
      setErr("Не удалось отправить заявку. Попробуйте ещё раз чуть позже.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* фон, по клику закрывает */}
          <div
            className="absolute inset-0"
            onClick={() => setOpen(false)}
          />

          <motion.div
            className="relative z-[10000] w-[90%] max-w-[320px] md:max-w-lg max-h-[85vh] md:max-h-[82vh] overflow-y-auto rounded-xl md:rounded-2xl bg-neutral-950 border border-white/12 p-3 md:p-6 pb-8 md:pb-6 text-white shadow-[0_14px_48px_rgba(0,0,0,0.6)]"
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
          >
            {/* крестик */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-white/60 hover:text-white text-sm"
              aria-label="Закрыть"
            >
              ✕
            </button>

            <h3 className="text-sm md:text-lg font-semibold mb-1">
              Консьерж-сервис Stage
            </h3>
            <p className="hidden md:block text-xs text-white/60 mb-3 leading-snug">
              Прикрепите фото товара или примеров стиля — мы найдём нужную модель,
              проверим подлинность и подберём лучший вариант по бюджету.
            </p>

            <form onSubmit={onSubmit} className="space-y-2 md:space-y-3 text-[13px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="text-xs text-white/70 block mb-1">
                    Имя
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="Как к вам обращаться"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/70 block mb-1">
                    Контакт
                  </label>
                  <input
                    name="contact"
                    required
                    placeholder="Телефон или @Telegram / WhatsApp"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="text-xs text-white/70 block mb-1">
                    Категория
                  </label>
                  <select
                    name="category"
                    defaultValue="footwear"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/40"
                  >
                    <option value="footwear">Обувь</option>
                    <option value="clothes">Одежда</option>
                    <option value="bags">Сумки</option>
                    <option value="accessories">Аксессуары</option>
                    <option value="fragrance">Парфюмерия</option>
                    <option value="headwear">Головные уборы</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/70 block mb-1">
                    Размеры
                  </label>
                  <input
                    name="size"
                    placeholder="Напр. 42 EU, рост 182"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/70 block mb-1">
                  Комментарий
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Что ищете: бренд, модель, цвет, бюджет, ссылки…"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-white/40 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-white/70 block mb-1">
                  Фото (опционально)
                </label>
                <input
                  type="file"
                  name="photos"
                  multiple
                  accept="image/*"
                  className="block w-full text-xs text-white/80 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20 cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-white/50">
                  Прикрепите фото желаемого товара или примеров стиля — так мы быстрее найдём то, что нужно.
                </p>
              </div>

              {/* сообщения об успехе / ошибке */}
              {ok && (
                <div className="mt-1 text-sm text-emerald-400">
                  {ok}
                </div>
              )}
              {err && (
                <div className="mt-1 text-sm text-red-400">
                  {err}
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-1">
                <p className="text-[10px] md:text-[11px] text-white/40 leading-snug">
                  Отправляя заявку, вы соглашаетесь с обработкой персональных данных.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full md:w-auto rounded-full bg-white text-black text-sm font-semibold px-5 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Отправка…" : "Отправить заявку"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
