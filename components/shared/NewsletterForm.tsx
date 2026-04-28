"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type Variant = "dark" | "light";

function CheckboxRow({
  id,
  checked,
  onChange,
  isDark,
  textMuted,
  linkCls: _linkCls,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  isDark: boolean;
  textMuted: string;
  linkCls: string;
  children: React.ReactNode;
}) {
  const bg = isDark ? (checked ? "bg-white" : "bg-transparent") : (checked ? "bg-black" : "bg-transparent");
  const border = isDark ? "border-white/40" : "border-black/30";
  const checkColor = isDark ? "#000" : "#fff";

  return (
    <label className={`flex items-start gap-2.5 cursor-pointer text-xs leading-snug ${textMuted}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-[1px] shrink-0 w-4 h-4 rounded border transition-all flex items-center justify-center ${bg} ${border}`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={checkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span>{children}</span>
    </label>
  );
}

interface Props {
  source?: string;
  variant?: Variant;
  title?: string;
  subtitle?: string;
}

export function NewsletterForm({
  source = "footer",
  variant = "dark",
  title = "Будьте первыми",
  subtitle = "Подпишитесь и получайте уведомления о новых дропах и акциях раньше всех.",
}: Props) {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [consentData, setConsentData] = useState(false);
  const [consentMail, setConsentMail] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isDark = variant === "dark";

  const textPrimary = isDark ? "text-white" : "text-black";
  const textMuted = isDark ? "text-white/60" : "text-black/55";
  const inputCls = isDark
    ? "bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/60 focus:ring-white/20"
    : "bg-black/5 border-black/15 text-black placeholder-black/35 focus:border-black/40 focus:ring-black/10";
  const btnCls = isDark
    ? "bg-white text-black hover:bg-white/90"
    : "bg-black text-white hover:bg-black/85";
  const checkboxBorder = isDark ? "border-white/30" : "border-black/25";
  const linkCls = isDark ? "underline text-white/80 hover:text-white" : "underline hover:opacity-70";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentData || !consentMail) {
      setErrorMsg("Пожалуйста, подтвердите оба согласия");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consentData, consentMail, source }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Произошла ошибка, попробуйте ещё раз");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Нет соединения с сервером");
      setStatus("error");
    }
  }

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-3 py-2 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className={`w-14 h-14 rounded-full flex items-center justify-center ${isDark ? "bg-white/15" : "bg-black/8"}`}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <motion.path
                  d="M5 13l4 4L19 7"
                  stroke={isDark ? "white" : "black"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                />
              </svg>
            </motion.div>
            <div>
              <p className={`font-bold text-lg ${textPrimary}`}>Вы подписаны!</p>
              <p className={`text-sm mt-1 ${textMuted}`}>
                Будем присылать только самое интересное — без спама.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col gap-4"
          >
            {(title || subtitle) && (
              <div>
                {title && (
                  <p className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${textPrimary}`}>
                    {title}
                  </p>
                )}
                {subtitle && (
                  <p className={`mt-2 text-sm leading-relaxed ${textMuted}`}>{subtitle}</p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ваш email"
                required
                className={`flex-1 min-w-0 rounded-full border px-4 py-3 text-sm outline-none focus:ring-2 transition ${inputCls}`}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className={`w-full sm:w-auto shrink-0 rounded-full px-6 py-3 text-sm font-semibold transition disabled:opacity-60 ${btnCls}`}
              >
                {status === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
                    </svg>
                    Подождите
                  </span>
                ) : (
                  "Подписаться"
                )}
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <CheckboxRow
                id={`${uid}-data`}
                checked={consentData}
                onChange={setConsentData}
                isDark={isDark}
                textMuted={textMuted}
                linkCls={linkCls}
              >
                Я даю согласие на{" "}
                <Link href="/personal-data" className={linkCls} target="_blank">обработку персональных данных</Link>
                {" "}в соответствии с Федеральным законом №152-ФЗ.
              </CheckboxRow>

              <CheckboxRow
                id={`${uid}-mail`}
                checked={consentMail}
                onChange={setConsentMail}
                isDark={isDark}
                textMuted={textMuted}
                linkCls={linkCls}
              >
                Я соглашаюсь получать рекламные и информационные рассылки от Stage Store.
              </CheckboxRow>
            </div>

            <AnimatePresence>
              {(errorMsg || status === "error") && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-red-400"
                >
                  {errorMsg || "Произошла ошибка, попробуйте ещё раз"}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
