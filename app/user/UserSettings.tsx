import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Monitor, Smartphone, Globe, ShieldCheck, Eye, EyeOff, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function UserSettings() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canRevoke, setCanRevoke] = useState(false);
  const [cooldownHoursLeft, setCooldownHoursLeft] = useState<number | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [showPwModal, setShowPwModal] = useState(false);

  // Code input state
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Validation state
  const [codeState, setCodeState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [shakeKey, setShakeKey] = useState(0);

  // Password fields
  const [pwVerified, setPwVerified] = useState(false);
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  // Cooldown
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/user/sessions", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (res.ok && data?.success) {
          setSessions(Array.isArray(data.sessions) ? data.sessions : []);
          setCanRevoke(Boolean(data.canRevokeOthers));
          setCooldownHoursLeft(
            typeof data.cooldownHoursLeft === "number" ? data.cooldownHoursLeft : null
          );
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Scroll lock
  useEffect(() => {
    if (!showPwModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showPwModal]);

  const resetModal = useCallback(() => {
    setDigits(Array(6).fill(""));
    setActiveIdx(0);
    setCodeState("idle");
    setPwVerified(false);
    setPwNew("");
    setPwConfirm("");
    setPwMsg(null);
    setPwSaved(false);
    setPwLoading(false);
    setShakeKey(0);
  }, []);

  const closeModal = useCallback(() => {
    setShowPwModal(false);
    resetModal();
  }, [resetModal]);

  const requestCode = useCallback(async () => {
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (res.ok) {
        setCooldown(60);
        setDigits(Array(6).fill(""));
        setActiveIdx(0);
        setCodeState("idle");
        setPwVerified(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setPwMsg({ text: data?.message || "Не удалось отправить код.", ok: false });
      }
    } catch {
      setPwMsg({ text: "Ошибка сети. Попробуйте позже.", ok: false });
    }
  }, []);

  const openModal = useCallback(() => {
    resetModal();
    setShowPwModal(true);
    requestCode();
  }, [resetModal, requestCode]);

  const validateCode = useCallback(async (code: string) => {
    setCodeState("loading");
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/password-reset/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setCodeState("error");
        setShakeKey((k) => k + 1);
        setPwMsg({ text: data?.message || "Неверный код.", ok: false });
        setTimeout(() => {
          setDigits(Array(6).fill(""));
          setActiveIdx(0);
          setCodeState("idle");
          setTimeout(() => inputRefs.current[0]?.focus(), 50);
        }, 700);
      } else {
        setCodeState("success");
        setTimeout(() => setPwVerified(true), 600);
      }
    } catch {
      setCodeState("error");
      setShakeKey((k) => k + 1);
      setPwMsg({ text: "Ошибка сети.", ok: false });
      setTimeout(() => setCodeState("idle"), 700);
    }
  }, []);

  // Auto-validate when all 6 digits filled
  const prevDigitsRef = useRef(digits);
  useEffect(() => {
    const code = digits.join("");
    const prevCode = prevDigitsRef.current.join("");
    prevDigitsRef.current = digits;
    if (/^\d{6}$/.test(code) && code !== prevCode && !pwVerified && codeState === "idle") {
      validateCode(code);
    }
  }, [digits, pwVerified, codeState, validateCode]);

  // Focus management
  useEffect(() => {
    if (showPwModal && !pwVerified) {
      setTimeout(() => inputRefs.current[activeIdx]?.focus(), 50);
    }
  }, [activeIdx, showPwModal, pwVerified]);

  const handleDigitChange = (val: string, idx: number) => {
    if (codeState !== "idle") return;
    const digit = val.replace(/\D/g, "").slice(-1);
    if (!digit) {
      const next = [...digits];
      next[idx] = "";
      setDigits(next);
      return;
    }
    const next = [...digits];
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
      if (digits[idx]) {
        const next = [...digits];
        next[idx] = "";
        setDigits(next);
      } else if (idx > 0) {
        const next = [...digits];
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

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwNew.length < 8) {
      setPwMsg({ text: "Пароль должен быть не короче 8 символов.", ok: false });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg({ text: "Пароли не совпадают.", ok: false });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: digits.join(""), newPassword: pwNew }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setPwMsg({ text: data?.message || "Не удалось изменить пароль.", ok: false });
      } else {
        setPwSaved(true);
        setTimeout(() => closeModal(), 1800);
      }
    } catch {
      setPwMsg({ text: "Ошибка сети. Попробуйте позже.", ok: false });
    } finally {
      setPwLoading(false);
    }
  };

  const formatDate = (val: string) => {
    try {
      return new Date(val).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
    } catch { return val; }
  };

  const renderDevice = (row: any) => {
    const device = row?.device || "Desktop";
    const isMobile = device.toLowerCase().includes("mobile");
    const Icon = isMobile ? Smartphone : Monitor;
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <Icon size={16} />
        <span>{isMobile ? "Мобильное устройство" : "Компьютер"}</span>
        <span className="text-black/50">•</span>
        <span>{row?.os || "Unknown"}</span>
      </div>
    );
  };

  const subtitle = useMemo(() => {
    if (!sessions.length) return "Активные устройства появятся после следующего входа.";
    return `Активные устройства: ${sessions.length}`;
  }, [sessions.length]);

  const formatIp = (val?: string) => {
    if (!val) return "—";
    if (val === "::1" || val === "127.0.0.1") return "Локально";
    return val;
  };

  const formatCity = (row: any) => {
    const city = row?.city;
    const country = row?.country;
    if (city || country) return [city, country].filter(Boolean).join(", ");
    return "Город неизвестен";
  };

  const handleRevoke = async (id: number) => {
    if (!canRevoke) return;
    setWorkingId(id);
    try {
      const res = await fetch("/api/user/sessions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setWorkingId(null);
    }
  };

  // Digit cell colors
  const digitCellClass = (idx: number) => {
    if (codeState === "success") return "border-green-500 bg-green-50 text-green-700";
    if (codeState === "error") return "border-red-400 bg-red-50 text-red-600";
    if (digits[idx]) return "border-black bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]";
    if (activeIdx === idx) return "border-black/60 bg-white";
    return "border-black/15 bg-white/60";
  };

  return (
    <div className="p-4 border rounded-2xl shadow-sm bg-white">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Настройки</h2>
          <p className="text-sm text-black/60">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-black/10 bg-black/5">
          <ShieldCheck size={14} />
          <span>Защита аккаунта</span>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Globe size={16} />
          Активные устройства
        </div>
        {!canRevoke && cooldownHoursLeft ? (
          <div className="text-xs text-black/50 mb-3">
            Отключение других устройств станет доступно через {cooldownHoursLeft} ч.
          </div>
        ) : null}
        {loading ? (
          <div className="text-sm text-black/60">Загрузка…</div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-black/60">
            Пока нет записей. Зайдите в аккаунт снова, чтобы устройства появились.
          </div>
        ) : (
          <div className="grid gap-3">
            {sessions.map((row) => (
              <div
                key={row.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
              >
                <div className="space-y-1">
                  {renderDevice(row)}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-black/60">
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5">
                      {formatCity(row)}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5">
                      IP: {formatIp(row.ip)}
                    </span>
                    {row.isCurrent && (
                      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700">
                        Текущее устройство
                      </span>
                    )}
                    {row.isPrimary && (
                      <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-black/70">
                        Основное устройство
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-black/50">
                    {row.lastSeen ? formatDate(row.lastSeen) : "—"}
                  </div>
                  {!row.isCurrent && (
                    <button
                      onClick={() => handleRevoke(row.id)}
                      disabled={!canRevoke || workingId === row.id}
                      className={`text-xs px-3 py-1 rounded-full border ${
                        canRevoke
                          ? "border-black/10 bg-black text-white hover:bg-black/90"
                          : "border-black/10 bg-black/5 text-black/40 cursor-not-allowed"
                      }`}
                    >
                      {workingId === row.id ? "Отключаю…" : "Отключить"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-black/10 pt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Смена пароля</div>
          <button
            onClick={openModal}
            className="rounded-full bg-black text-white px-4 py-2 text-xs font-semibold"
          >
            Сменить пароль
          </button>
        </div>
      </div>

      {/* Password reset modal */}
      {typeof document !== "undefined" && showPwModal
        ? createPortal(
          <AnimatePresence>
            <motion.div
              key="pw-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
              style={{ background: "rgba(0,0,0,0.6)" }}
              onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
            >
              <motion.div
                key="pw-modal"
                initial={{ opacity: 0, y: 32, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 340, damping: 30 }}
                className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                {/* Header accent */}
                <div className="h-1 w-full bg-gradient-to-r from-black via-black/70 to-black/30" />

                <div className="p-7">
                  {/* Close */}
                  <button
                    onClick={closeModal}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full text-black/40 hover:text-black hover:bg-black/5 transition"
                    aria-label="Закрыть"
                  >
                    <X size={16} />
                  </button>

                  {/* Success screen */}
                  <AnimatePresence mode="wait">
                    {pwSaved ? (
                      <motion.div
                        key="saved"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center py-8 gap-4"
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
                        <div className="text-sm text-black/50 text-center">Используйте новый пароль при следующем входе.</div>
                      </motion.div>
                    ) : !pwVerified ? (
                      /* Code entry step */
                      <motion.div key="code-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }}>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-black/30 font-semibold">Stage Store</div>
                        <div className="mt-2 text-2xl font-bold tracking-tight">Подтвердите смену<br />пароля</div>
                        <p className="mt-2 text-sm text-black/50 leading-relaxed">
                          Отправили 6-значный код на вашу почту. Введите его ниже.
                        </p>

                        {/* Digit inputs */}
                        <motion.div
                          key={`shake-${shakeKey}`}
                          animate={codeState === "error" ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          className="mt-7 flex items-center justify-center gap-2.5"
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
                                ref={(el) => { inputRefs.current[i] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={d}
                                onChange={(e) => handleDigitChange(e.target.value, i)}
                                onKeyDown={(e) => handleDigitKey(e, i)}
                                onFocus={() => setActiveIdx(i)}
                                onPaste={handlePaste}
                                disabled={codeState !== "idle"}
                                className={`w-11 h-14 rounded-2xl border-2 text-center text-xl font-bold outline-none transition-all duration-200 caret-transparent select-none ${digitCellClass(i)}`}
                              />
                              {/* Cursor blink when active and empty */}
                              {activeIdx === i && !d && codeState === "idle" && (
                                <motion.div
                                  animate={{ opacity: [1, 0, 1] }}
                                  transition={{ repeat: Infinity, duration: 1 }}
                                  className="absolute bottom-3 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-black rounded-full pointer-events-none"
                                />
                              )}
                              {/* Loading spinner overlay */}
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

                        {/* Status message */}
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
                            {pwMsg && codeState !== "success" && (
                              <motion.div
                                key="err"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="text-sm text-red-500 font-medium"
                              >
                                {pwMsg.text}
                              </motion.div>
                            )}
                            {codeState === "idle" && !pwMsg && (
                              <motion.div
                                key="hint"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs text-black/30"
                              >
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
                      </motion.div>
                    ) : (
                      /* New password step */
                      <motion.div
                        key="pw-step"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                            <Check size={13} className="text-white" strokeWidth={3} />
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.22em] text-green-600 font-semibold">Код подтверждён</div>
                        </div>
                        <div className="text-2xl font-bold tracking-tight">Новый пароль</div>
                        <p className="mt-1 text-sm text-black/50">Придумайте надёжный пароль не короче 8 символов.</p>

                        <form onSubmit={handlePasswordSave} className="mt-6 grid gap-3">
                          {/* Password strength indicator */}
                          {pwNew.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="grid grid-cols-4 gap-1"
                            >
                              {[1, 2, 3, 4].map((level) => {
                                const strength = Math.min(4, Math.floor(
                                  (pwNew.length >= 8 ? 1 : 0) +
                                  (/[A-Z]/.test(pwNew) ? 1 : 0) +
                                  (/\d/.test(pwNew) ? 1 : 0) +
                                  (/[^a-zA-Z0-9]/.test(pwNew) ? 1 : 0)
                                ));
                                const filled = level <= strength;
                                const color = strength <= 1 ? "bg-red-400" : strength <= 2 ? "bg-orange-400" : strength <= 3 ? "bg-yellow-400" : "bg-green-500";
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
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition"
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
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition"
                            >
                              {showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                            {pwConfirm && pwNew === pwConfirm && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute right-10 top-1/2 -translate-y-1/2"
                              >
                                <Check size={14} className="text-green-500" strokeWidth={3} />
                              </motion.div>
                            )}
                          </div>

                          <AnimatePresence>
                            {pwMsg && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`text-xs px-3 py-2 rounded-xl ${
                                  pwMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                                }`}
                              >
                                {pwMsg.text}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <motion.button
                            type="submit"
                            disabled={pwLoading || pwNew.length < 8 || pwNew !== pwConfirm}
                            whileTap={{ scale: 0.97 }}
                            className="mt-1 w-full rounded-2xl bg-black text-white py-3.5 text-sm font-semibold disabled:opacity-40 transition relative overflow-hidden"
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
                            ) : "Сохранить пароль"}
                          </motion.button>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )
        : null}
    </div>
  );
}
