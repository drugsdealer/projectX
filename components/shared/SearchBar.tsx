"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Clock, TrendingUp } from "lucide-react";
import { useAutocomplete } from "@/hooks/useAutocomplete";
import { cn } from "@/lib/utils";

const HISTORY_KEY = "searchHistory.v1";
const POPULAR = ["Yeezy", "Supreme", "Nike Dunk", "New Balance 990", "Adidas Campus"];

interface Props {
  /** True when the header is transparent (homepage, scrolled to top) */
  isTransparent?: boolean;
}

export function SearchBar({ isTransparent = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { products, brands, loading, active } = useAutocomplete(value);

  // Sync history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pushHistory = useCallback(
    (term: string) => {
      const t = term.trim();
      if (!t) return;
      const next = [t, ...history.filter((h) => h.toLowerCase() !== t.toLowerCase())].slice(0, 8);
      setHistory(next);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
    },
    [history],
  );

  const navigate = useCallback(
    (term: string) => {
      const t = term.trim();
      if (!t) return;
      pushHistory(t);
      router.push(`/search?q=${encodeURIComponent(t)}`);
      setOpen(false);
      setValue("");
    },
    [pushHistory, router],
  );

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) navigate(value);
    if (e.key === "Escape") {
      setOpen(false);
      setValue("");
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && (active || history.length > 0 || POPULAR.length > 0);

  return (
    <div ref={containerRef} className="relative">
      {/* Input pill */}
      <div
        style={{ width: open ? 240 : 148 }}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 h-9 transition-[width,border-color,background-color] duration-200 ease-out",
          isTransparent && !open
            ? "border-white/25 bg-white/10 text-white"
            : "border-black/15 bg-transparent text-black",
          open && "border-black/25 shadow-sm",
        )}
      >
        <Search size={14} className="shrink-0 opacity-50" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Поиск…"
          className={cn(
            "flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:opacity-50",
            isTransparent && !open ? "text-white" : "text-black",
          )}
        />
        <AnimatePresence>
          {value && (
            <motion.button
              key="clear"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 0.5, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              whileHover={{ opacity: 0.9 }}
              transition={{ duration: 0.12 }}
              type="button"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
              }}
            >
              <X size={13} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-[calc(100%+8px)] w-72 rounded-2xl border border-black/10 bg-white shadow-2xl shadow-black/8 overflow-hidden z-50"
          >
            {active ? (
              /* ── Live results ── */
              <div className="p-2">
                {loading && (
                  <div className="px-3 py-3 flex items-center gap-2 text-xs text-black/40">
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                    >
                      Ищем…
                    </motion.span>
                  </div>
                )}

                {!loading && brands.length === 0 && products.length === 0 && (
                  <div className="px-3 py-5 text-sm text-black/35 text-center">
                    Ничего не найдено
                  </div>
                )}

                {brands.map((b) => (
                  <button
                    key={b.slug}
                    onClick={() => {
                      router.push(`/brand/${b.slug}`);
                      setOpen(false);
                      setValue("");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-black/5 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-black/6 flex items-center justify-center shrink-0 text-[10px] font-bold text-black/30">
                      B
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{b.name}</div>
                      <div className="text-xs text-black/40">Бренд</div>
                    </div>
                  </button>
                ))}

                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      pushHistory(value);
                      router.push(`/product/${p.id}`);
                      setOpen(false);
                      setValue("");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-black/5 transition"
                  >
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/5 shrink-0">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.name}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm line-clamp-1">{p.name}</div>
                      <div className="text-xs text-black/40">
                        {p.brandName && <span>{p.brandName}</span>}
                        {p.brandName && p.price != null && <span> · </span>}
                        {p.price != null && (
                          <span>{Number(p.price).toLocaleString("ru-RU")} ₽</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {(brands.length > 0 || products.length > 0) && (
                  <button
                    onClick={() => navigate(value)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 mt-0.5 text-xs text-black/45 hover:text-black hover:bg-black/5 rounded-xl transition"
                  >
                    <Search size={11} />
                    Все результаты для «{value}»
                  </button>
                )}
              </div>
            ) : (
              /* ── Empty state: history + popular ── */
              <div className="p-2">
                {history.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="flex items-center gap-1.5 text-xs text-black/40">
                        <Clock size={11} />
                        История
                      </span>
                      <button
                        onClick={clearHistory}
                        className="text-xs text-black/40 hover:text-black transition"
                      >
                        Очистить
                      </button>
                    </div>
                    {history.slice(0, 5).map((h) => (
                      <button
                        key={h}
                        onClick={() => navigate(h)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-black/5 transition"
                      >
                        <Clock size={12} className="opacity-25 shrink-0" />
                        {h}
                      </button>
                    ))}
                    <div className="my-1.5 mx-2 border-t border-black/6" />
                  </>
                )}

                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-black/40">
                  <TrendingUp size={11} />
                  Популярные запросы
                </div>
                {POPULAR.map((s) => (
                  <button
                    key={s}
                    onClick={() => navigate(s)}
                    className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-black/5 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
