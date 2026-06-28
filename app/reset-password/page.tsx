"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";

type Step = "email" | "code" | "password" | "done";
type CodeState = "idle" | "loading" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // OTP
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [activeIdx, setActiveIdx] = useState(0);
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [shakeKey, setShakeKey] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [cooldown, setCooldown] = useState(0);

  // New password
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // ── Step 1: request code ──
  const requestCode = useCallback(async () => {
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      setMsg({ text: "Введите корректный email.", ok: false });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setMsg({ text: data?.message || "Слишком много запросов. Попробуйте позже.", ok: false });
        return;
      }
      // Всегда переходим к вводу кода (не раскрываем существование email).
      setEmail(mail);
      setDigits(Array(6).fill(""));
      setActiveIdx(0);
      setCodeState("idle");
      setStep("code");
      setCooldown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    } catch {
      setMsg({ text: "Ошибка сети. Попробуйте позже.", ok: false });
    } finally {
      setLoading(false);
    }
  }, [email]);

  // ── Step 2: verify code ──
  const validateCode = useCallback(
    async (code: string) => {
      setCodeState("loading");
      setMsg(null);
      try {
        const res = await fetch("/api/auth/forgot-password/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          setCodeState("error");
          setShakeKey((k) => k + 1);
          setMsg({ text: data?.message || "Неверный код.", ok: false });
          setTimeout(() => {
            setDigits(Array(6).fill(""));
            setActiveIdx(0);
            setCodeState("idle");
            setTimeout(() => inputRefs.current[0]?.focus(), 50);
          }, 700);
        } else {
          setCodeState("success");
          setTimeout(() => {
            setMsg(null);
            setStep("password");
          }, 650);
        }
      } catch {
        setCodeState("error");
        setShakeKey((k) => k + 1);
        setMsg({ text: "Ошибка сети.", ok: false });
        setTimeout(() => setCodeState("idle"), 700);
      }
    },
    [email]
  );

  // Auto-verify when 6 digits filled
  const prevDigitsRef = useRef(digits);
  useEffect(() => {
    const code = digits.join("");
    const prevCode = prevDigitsRef.current.join("");
    prevDigitsRef.current = digits;
    if (step === "code" && /^\d{6}$/.test(code) && code !== prevCode && codeState === "idle") {
      validateCode(code);
    }
  }, [digits, step, codeState, validateCode]);

  // ── Step 3: set new password ──
  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pwNew.length < 8) {
      setMsg({ text: "Пароль должен быть не короче 8 символов.", ok: false });
      return;
    }
    if (pwNew !== pwConfirm) {
      setMsg({ text: "Пароли не совпадают.", ok: false });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: digits.join(""), newPassword: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setMsg({ text: data?.message || "Не удалось изменить пароль.", ok: false });
      } else {
        setStep("done");
      }
    } catch {
      setMsg({ text: "Ошибка сети. Попробуйте позже.", ok: false });
    } finally {
      setPwLoading(false);
    }
  };

  // ── OTP input handlers ──
  const handleDigitChange = (val: string, idx: number) => {
    if (codeState !== "idle") return;
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    if (!digit) {
      next[idx] = "";
      setDigits(next);
      return;
    }
    next[idx] = digit;
    setDigits(next);
    if (idx < 5) {
      setActiveIdx(idx + 1);
      setTimeout(() => inputRefs.current[idx + 1]?.focus(), 0);
    }
  };

  const handleDigitKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (codeState !== "idle") return;
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (digits[idx]) {
        next[idx] = "";
        setDigits(next);
      } else if (idx > 0) {
        next[idx - 1] = "";
        setDigits(next);
        setActiveIdx(idx - 1);
        setTimeout(() => inputRefs.current[idx - 1]?.focus(), 0);
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      setActiveIdx(idx - 1);
      setTimeout(() => inputRefs.current[idx - 1]?.focus(), 0);
    } else if (e.key === "ArrowRight" && idx < 5) {
      setActiveIdx(idx + 1);
      setTimeout(() => inputRefs.current[idx + 1]?.focus(), 0);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = Array(6).fill("").map((_, i) => text[i] || "");
    setDigits(next);
    const last = Math.min(text.length - 1, 5);
    setActiveIdx(last);
    setTimeout(() => inputRefs.current[last]?.focus(), 0);
  };

  const digitCellClass = (idx: number) => {
    if (codeState === "success") return "border-green-500 bg-green-50 text-green-700";
    if (codeState === "error") return "border-red-400 bg-red-50 text-red-600";
    if (digits[idx]) return "border-black bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]";
    if (activeIdx === idx) return "border-black/60 bg-white";
    return "border-black/15 bg-white/60";
  };

  const pwStrength = Math.min(
    4,
    (pwNew.length >= 8 ? 1 : 0) +
      (/[A-Z]/.test(pwNew) ? 1 : 0) +
      (/\d/.test(pwNew) ? 1 : 0) +
      (/[^a-zA-Z0-9]/.test(pwNew) ? 1 : 0)
  );

  return (
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="relative bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden"
        >
          {/* Accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-black via-black/70 to-black/30" />

          <div className="p-6 sm:p-8">
            {/* Back / login link */}
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition mb-5"
            >
              <ArrowLeft size={14} /> Назад ко входу
            </button>

            <AnimatePresence mode="wait">
              {/* ── STEP: EMAIL ── */}
              {step === "email" && (
                <motion.div
                  key="email-step"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                >
                  <div className="text-[11px] uppercase tracking-[0.25em] text-black/30 font-semibold">Stage Store</div>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight">Восстановление пароля</h1>
                  <p className="mt-2 text-sm text-black/50 leading-relaxed">
                    Укажите email от аккаунта — пришлём 6-значный код для сброса пароля.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      requestCode();
                    }}
                    className="mt-6 grid gap-3"
                  >
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 inset-y-0 my-auto h-fit text-black/30" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none transition"
                      />
                    </div>

                    <AnimatePresence>
                      {msg && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`text-xs px-3 py-2 rounded-xl ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
                        >
                          {msg.text}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileTap={{ scale: 0.97 }}
                      className="mt-1 w-full rounded-2xl bg-black text-white py-3.5 text-sm font-semibold disabled:opacity-50 transition"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          />
                          Отправляем…
                        </span>
                      ) : (
                        "Отправить код"
                      )}
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {/* ── STEP: CODE ── */}
              {step === "code" && (
                <motion.div
                  key="code-step"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                >
                  <div className="text-[11px] uppercase tracking-[0.25em] text-black/30 font-semibold">Stage Store</div>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight">Введите код</h1>
                  <p className="mt-2 text-sm text-black/50 leading-relaxed">
                    Отправили 6-значный код на <span className="font-semibold text-black/70">{email}</span>.
                  </p>

                  {/* Digit inputs */}
                  <motion.div
                    key={`shake-${shakeKey}`}
                    animate={codeState === "error" ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="mt-7 flex items-center justify-center gap-2 sm:gap-2.5"
                  >
                    {digits.map((d, i) => (
                      <motion.div
                        key={i}
                        animate={
                          codeState === "success"
                            ? { y: [0, -10, 0], scale: [1, 1.12, 1] }
                            : codeState === "error"
                            ? { scale: [1, 0.9, 1] }
                            : d
                            ? { scale: [1, 1.08, 1] }
                            : { scale: 1 }
                        }
                        transition={
                          codeState === "success"
                            ? { delay: i * 0.06, duration: 0.4, type: "spring", stiffness: 300 }
                            : { duration: 0.2 }
                        }
                        className="relative"
                      >
                        <input
                          ref={(el) => {
                            inputRefs.current[i] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          onChange={(e) => handleDigitChange(e.target.value, i)}
                          onKeyDown={(e) => handleDigitKey(e, i)}
                          onFocus={() => setActiveIdx(i)}
                          onPaste={handlePaste}
                          disabled={codeState !== "idle"}
                          className={`w-11 h-14 sm:w-12 sm:h-16 rounded-2xl border-2 text-center text-xl font-bold outline-none transition-all duration-200 caret-transparent select-none ${digitCellClass(i)}`}
                        />
                        {activeIdx === i && !d && codeState === "idle" && (
                          <motion.div
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-black rounded-full pointer-events-none"
                          />
                        )}
                        {codeState === "loading" && i === 5 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80"
                          >
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                              className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full"
                            />
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Status */}
                  <div className="mt-4 h-5 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      {codeState === "success" && (
                        <motion.div
                          key="ok"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-1.5 text-sm text-green-600 font-medium"
                        >
                          <Check size={14} strokeWidth={3} /> Код подтверждён
                        </motion.div>
                      )}
                      {msg && codeState !== "success" && (
                        <motion.div
                          key="err"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-sm text-red-500 font-medium"
                        >
                          {msg.text}
                        </motion.div>
                      )}
                      {codeState === "idle" && !msg && (
                        <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-black/30">
                          {digits.filter(Boolean).length}/6
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Resend */}
                  <div className="mt-4 flex justify-center">
                    {cooldown > 0 ? (
                      <span className="text-xs text-black/40">
                        Повторная отправка через <span className="font-semibold text-black/60">{cooldown}с</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={requestCode}
                        className="text-xs text-black/50 hover:text-black underline underline-offset-2 transition"
                      >
                        Отправить код ещё раз
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setMsg(null);
                    }}
                    className="mt-5 w-full text-center text-xs text-black/40 hover:text-black/70 transition"
                  >
                    Изменить email
                  </button>
                </motion.div>
              )}

              {/* ── STEP: NEW PASSWORD ── */}
              {step === "password" && (
                <motion.div
                  key="pw-step"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                      <Check size={13} className="text-white" strokeWidth={3} />
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-green-600 font-semibold">Код подтверждён</div>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">Новый пароль</h1>
                  <p className="mt-1 text-sm text-black/50">Придумайте надёжный пароль не короче 8 символов.</p>

                  <form onSubmit={handlePasswordSave} className="mt-6 grid gap-3">
                    {pwNew.length > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((level) => {
                          const filled = level <= pwStrength;
                          const color =
                            pwStrength <= 1 ? "bg-red-400" : pwStrength <= 2 ? "bg-orange-400" : pwStrength <= 3 ? "bg-yellow-400" : "bg-green-500";
                          return (
                            <motion.div
                              key={level}
                              animate={{ scaleX: filled ? 1 : 0.3, opacity: filled ? 1 : 0.2 }}
                              style={{ transformOrigin: "left" }}
                              className={`h-1 rounded-full ${filled ? color : "bg-black/10"} transition-colors duration-300`}
                            />
                          );
                        })}
                      </motion.div>
                    )}

                    <div className="relative">
                      <input
                        type={showPwNew ? "text" : "password"}
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        placeholder="Новый пароль"
                        autoComplete="new-password"
                        className="w-full rounded-2xl border border-black/15 bg-black/[0.02] px-4 py-3 pr-11 text-sm outline-none focus:border-black/40 focus:ring-2 focus:ring-black/8 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwNew((v) => !v)}
                        className="absolute right-3.5 inset-y-0 my-auto h-fit flex items-center text-black/30 hover:text-black/60 transition"
                      >
                        {showPwNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPwConfirm ? "text" : "password"}
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        placeholder="Повторите пароль"
                        autoComplete="new-password"
                        className={`w-full rounded-2xl border px-4 py-3 pr-11 text-sm outline-none transition ${
                          pwConfirm && pwNew !== pwConfirm
                            ? "border-red-300 focus:border-red-400 bg-red-50/30"
                            : pwConfirm && pwNew === pwConfirm
                            ? "border-green-400 bg-green-50/30"
                            : "border-black/15 bg-black/[0.02] focus:border-black/40 focus:ring-2 focus:ring-black/8"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwConfirm((v) => !v)}
                        className="absolute right-3.5 inset-y-0 my-auto h-fit flex items-center text-black/30 hover:text-black/60 transition"
                      >
                        {showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      {pwConfirm && pwNew === pwConfirm && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-10 inset-y-0 my-auto h-fit flex items-center">
                          <Check size={14} className="text-green-500" strokeWidth={3} />
                        </motion.div>
                      )}
                    </div>

                    <AnimatePresence>
                      {msg && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`text-xs px-3 py-2 rounded-xl ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
                        >
                          {msg.text}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      type="submit"
                      disabled={pwLoading || pwNew.length < 8 || pwNew !== pwConfirm}
                      whileTap={{ scale: 0.97 }}
                      className="mt-1 w-full rounded-2xl bg-black text-white py-3.5 text-sm font-semibold disabled:opacity-40 transition"
                    >
                      {pwLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          />
                          Сохраняем…
                        </span>
                      ) : (
                        "Сохранить пароль"
                      )}
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {/* ── STEP: DONE ── */}
              {step === "done" && (
                <motion.div
                  key="done-step"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-6 gap-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <Check size={32} className="text-white" strokeWidth={3} />
                  </motion.div>
                  <div className="text-xl font-semibold text-center">Пароль изменён!</div>
                  <div className="text-sm text-black/50 text-center">Войдите в аккаунт с новым паролем.</div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => router.push("/login")}
                    className="mt-2 w-full rounded-2xl bg-black text-white py-3.5 text-sm font-semibold transition"
                  >
                    Войти
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
