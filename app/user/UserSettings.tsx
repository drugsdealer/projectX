import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, Smartphone, Globe, ShieldCheck } from "lucide-react";

export default function UserSettings() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canRevoke, setCanRevoke] = useState(false);
  const [cooldownHoursLeft, setCooldownHoursLeft] = useState<number | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwCode, setPwCode] = useState(Array(6).fill(""));
  const [pwActive, setPwActive] = useState(0);
  const pwInputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwCooldown, setPwCooldown] = useState(0);
  const [pwVerified, setPwVerified] = useState(false);

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
    return () => {
      mounted = false;
    };
  }, []);

  const formatDate = (val: string) => {
    try {
      const d = new Date(val);
      return d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
    } catch {
      return val;
    }
  };

  const renderDevice = (row: any) => {
    const os = row?.os || "Unknown";
    const device = row?.device || "Desktop";
    const isMobile = device.toLowerCase().includes("mobile");
    const Icon = isMobile ? Smartphone : Monitor;
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <Icon size={16} />
        <span>{isMobile ? "Мобильное устройство" : "Компьютер"}</span>
        <span className="text-black/50">•</span>
        <span>{os}</span>
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
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setWorkingId(null);
    }
  };

  const requestPwCode = async () => {
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/password-reset/request", { method: "POST", credentials: "include" });
      if (res.ok) {
        setPwCooldown(60);
        setPwVerified(false);
        setPwCode(Array(6).fill(""));
        setPwActive(0);
      } else {
        const data = await res.json().catch(() => ({}));
        setPwMsg(data?.message || "Не удалось отправить код.");
      }
    } catch {
      setPwMsg("Ошибка сети. Попробуйте позже.");
    }
  };

  useEffect(() => {
    if (!pwCooldown) return;
    const t = setTimeout(() => setPwCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [pwCooldown]);

  useEffect(() => {
    if (!showPwModal) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [showPwModal]);

  const handlePwCodeChange = (val: string, index: number) => {
    if (!val) {
      const next = [...pwCode];
      next[index] = "";
      setPwCode(next);
      setPwActive(index);
      return;
    }
    if (/^\d$/.test(val)) {
      const next = [...pwCode];
      next[index] = val;
      setPwCode(next);
      if (index < 5) {
        setPwActive(index + 1);
        setTimeout(() => pwInputsRef.current[index + 1]?.focus(), 0);
      }
    }
  };

  const handlePwKey = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!pwCode[index] && index > 0) {
        const next = [...pwCode];
        next[index - 1] = "";
        setPwCode(next);
        setPwActive(index - 1);
        e.preventDefault();
      } else {
        const next = [...pwCode];
        next[index] = "";
        setPwCode(next);
      }
    }
  };

  useEffect(() => {
    pwInputsRef.current[pwActive]?.focus();
  }, [pwActive, showPwModal]);

  const handlePwPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length) {
      const next = Array(6).fill("").map((_, i) => text[i] || "");
      setPwCode(next);
      const lastIndex = Math.min(text.length, 6) - 1;
      setPwActive(lastIndex >= 0 ? lastIndex : 0);
      setTimeout(() => pwInputsRef.current[Math.min(5, lastIndex)]?.focus(), 0);
    }
  };

  const validateCode = async (code: string) => {
    setPwMsg(null);
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setPwMsg(data?.message || "Код неверный.");
        setPwCode(Array(6).fill(""));
        setPwActive(0);
        setPwVerified(false);
      } else {
        setPwVerified(true);
        setPwMsg(null);
      }
    } catch {
      setPwMsg("Ошибка сети. Попробуйте позже.");
      setPwVerified(false);
    } finally {
      setPwLoading(false);
    }
  };

  useEffect(() => {
    const code = pwCode.join("");
    if (/^\d{6}$/.test(code) && !pwVerified) {
      validateCode(code);
    }
  }, [pwCode, pwVerified]);

  const handlePasswordConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    const code = pwCode.join("");
    if (!/^\d{6}$/.test(code)) {
      setPwMsg("Код должен состоять из 6 цифр.");
      return;
    }
    if (!pwVerified) {
      setPwMsg("Сначала подтвердите код.");
      return;
    }
    if (pwNew.length < 8) {
      setPwMsg("Новый пароль должен быть не короче 8 символов.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg("Подтверждение пароля не совпадает.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, newPassword: pwNew }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setPwMsg(data?.message || "Не удалось изменить пароль.");
      } else {
        setPwMsg("Пароль изменён.");
        setTimeout(() => {
          setShowPwModal(false);
          setPwCode(Array(6).fill(""));
          setPwNew("");
          setPwConfirm("");
          setPwVerified(false);
        }, 700);
      }
    } catch {
      setPwMsg("Ошибка сети. Попробуйте позже.");
    } finally {
      setPwLoading(false);
    }
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
                    {row.isCurrent ? (
                      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700">
                        Текущее устройство
                      </span>
                    ) : null}
                    {row.isPrimary ? (
                      <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-black/70">
                        Основное устройство
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-black/50">
                    {row.lastSeen ? formatDate(row.lastSeen) : "—"}
                  </div>
                  {!row.isCurrent ? (
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
                  ) : null}
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
            onClick={() => {
              setShowPwModal(true);
              requestPwCode();
            }}
            className="rounded-full bg-black text-white px-4 py-2 text-xs font-semibold"
          >
            Сменить пароль
          </button>
        </div>
      </div>

      {showPwModal && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/55 backdrop-blur-md flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl relative">
            <button
              onClick={() => setShowPwModal(false)}
              className="absolute top-3 right-3 text-black/50 hover:text-black"
              aria-label="Закрыть"
            >
              ✕
            </button>
            <div className="text-sm uppercase tracking-[0.28em] text-black/40">StageStore</div>
            <div className="mt-2 text-2xl font-semibold">Подтвердите смену пароля</div>
            <p className="mt-2 text-sm text-black/60">
              Мы отправили 6‑значный код на почту. Это тестовая версия дизайна, анимации будут как при регистрации.
            </p>

            <form onSubmit={handlePasswordConfirm} className="mt-5 grid gap-4">
              <div className="flex items-center justify-center gap-2">
                {pwCode.map((digit, i) => (
                  <input
                    key={i}
                    value={digit}
                    onChange={(e) => handlePwCodeChange(e.target.value, i)}
                    onKeyDown={(e) => handlePwKey(e, i)}
                    onFocus={() => setPwActive(i)}
                    onPaste={handlePwPaste}
                    ref={(el) => {
                      pwInputsRef.current[i] = el;
                    }}
                    className={`h-12 w-10 rounded-xl border text-center text-lg font-semibold transition-all duration-200 ${
                      digit ? "scale-[1.02] border-black shadow-[0_6px_16px_rgba(0,0,0,0.12)]" : "border-black/10"
                    } ${pwActive === i ? "ring-2 ring-black/20" : ""} ${
                      pwVerified ? "pw-digit-success" : ""
                    }`}
                    style={pwVerified ? { animationDelay: `${i * 70}ms` } : undefined}
                    inputMode="numeric"
                    maxLength={1}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center text-xs text-black/50">
                {pwCooldown > 0 ? `Повторная отправка через ${pwCooldown}с` : (
                  <button type="button" onClick={requestPwCode} className="underline">
                    Отправить код ещё раз
                  </button>
                )}
              </div>
              {pwVerified ? (
                <div className="pw-fields">
                  <div className="pw-success">Код подтвержден ✓</div>
                  <input
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    placeholder="Новый пароль"
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    placeholder="Повторите новый пароль"
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-2 text-sm"
                  />
                </div>
              ) : (
                <div className="text-xs text-black/50 text-center">
                  Введите корректный код, чтобы перейти к смене пароля.
                </div>
              )}
              {pwMsg ? <div className="text-xs text-black/60">{pwMsg}</div> : null}
              <button
                type="submit"
                disabled={pwLoading}
                className="w-full rounded-full bg-black text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {pwLoading ? "Проверяем..." : pwVerified ? "Сохранить пароль" : "Проверить код"}
              </button>
            </form>
            <style jsx>{`
              .pw-digit-success {
                animation: pwSuccess 0.5s ease-out both;
                background: #f0fdf4;
                border-color: #22c55e !important;
              }
              @keyframes pwSuccess {
                0% { transform: translateY(0) scale(1); }
                60% { transform: translateY(-6px) scale(1.05); }
                100% { transform: translateY(0) scale(1); }
              }
              .pw-fields {
                display: grid;
                gap: 10px;
                animation: fieldsSlide 0.5s ease-out both;
              }
              @keyframes fieldsSlide {
                0% { opacity: 0; transform: translateY(12px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              .pw-success {
                text-align: center;
                font-size: 12px;
                color: #16a34a;
                animation: successPop 0.4s ease-out both;
              }
              @keyframes successPop {
                0% { opacity: 0; transform: scale(0.9); }
                100% { opacity: 1; transform: scale(1); }
              }
            `}</style>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
