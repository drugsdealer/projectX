"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const readCookie = (name: string) => {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  };

  const benefits = [
    { id: 1, title: "Ранний доступ к дропам", img: "/img/slider1.jpg" },
    { id: 2, title: "Персональные подборки", img: "/img/slider2.jpg" },
    { id: 3, title: "Отслеживание заказов", img: "/img/slider3.jpg" },
  ];
  const [inputError, setInputError] = React.useState(false);
  const router = useRouter();

  // На странице регистрации больше не делаем автоматический редирект,
  // даже если бекенд считает, что сессия есть. Это убирает зацикливание
  // /register → /user → /login при "битых" или протухших сессиях.
  const [showPassword, setShowPassword] = React.useState(false);

  const [inputValue, setInputValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);

  const [passwordValue, setPasswordValue] = React.useState("");
  const [isPasswordFocused, setIsPasswordFocused] = React.useState(false);
  const [confirmPasswordValue, setConfirmPasswordValue] = React.useState("");
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [activeSession, setActiveSession] = React.useState(false);
  const [activeEmail, setActiveEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    const vfy = readCookie("vfy");
    if (!vfy) return;
    let storedEmail: string | null = null;
    try {
      storedEmail = sessionStorage.getItem("email") || localStorage.getItem("email");
    } catch {}
    if (storedEmail) {
      setActiveSession(true);
      setActiveEmail(storedEmail);
      try { sessionStorage.setItem("reg_active", "1"); } catch {}
      // Возвращаем на подтверждение, не давая отправить запрос заново
      router.replace("/verify-email?reason=active");
    }
  }, [router]);

  const isStrongPassword = (v: string) => {
    if (v.length < 8) return false;
    const hasLetter = /[A-Za-zА-Яа-я]/.test(v);
    const hasDigit = /\d/.test(v);
    return hasLetter && hasDigit;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) {
      // Уже идёт запрос — не даём отправить повторно
      return;
    }
    if (activeSession) {
      // Активная сессия подтверждения — не отправляем повторно
      return;
    }

    setErr(null);
    setMsg(null);

    const input = inputValue.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const isPhone = /^\+?[0-9\s\-()]{10,}$/.test(input);
    const normalizedEmail = isEmail ? input.toLowerCase() : "";

    if (!isEmail && !isPhone) {
      setInputError(true);
      return;
    }
    setInputError(false);

    if (!isStrongPassword(passwordValue)) {
      setPasswordError(true);
      return;
    } else {
      setPasswordError(false);
    }

    if (passwordValue !== confirmPasswordValue) {
      setConfirmPasswordError(true);
      return;
    } else {
      setConfirmPasswordError(false);
    }

    // Телефонный флоу оставляем как был
    if (!isEmail && isPhone) {
      router.push("/verify-phone");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Создаём/обновляем пользователя на сервере
      const r1 = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: passwordValue }),
        credentials: "include",
      });
      const d1 = await r1.json().catch(() => ({} as any));

      if (!r1.ok || !d1?.success) {
        if (d1?.alreadyRegistered) {
          router.push("/login");
          return;
        }
        throw new Error(d1?.message || "Ошибка регистрации");
      }

      const existed = !!d1.existed;
      const verifiedTs = d1.user?.verified ? new Date(d1.user.verified).getTime() : 0;
      const isVerified = Number.isFinite(verifiedTs) && verifiedTs > 0;
      const needsVerification = !!d1.needsVerification || !isVerified;

      if (existed && isVerified) {
        setMsg("Вы уже зарегистрированы. Войдите в аккаунт.");
        router.push("/login");
        return;
      }

      // 2) Отправляем код (для новой регистрации или если не подтверждён)
      const r2 = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
        credentials: "include",
      });
      const d2 = await r2.json().catch(() => ({} as any));

      if (!r2.ok || !d2?.success) {
        throw new Error(d2?.message || "Не удалось отправить код");
      }

      // если вдруг вернулся уже подтверждённый
      if (!needsVerification || d2.alreadyVerified) {
        router.push("/login");
        return;
      }

      try {
        sessionStorage.setItem("email", normalizedEmail);
        localStorage.setItem("email", normalizedEmail);
        sessionStorage.setItem("reg_active", "1");
      } catch {}
      router.push("/verify-email");
    } catch (e: any) {
      setErr(e?.message || "Что-то пошло не так");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    !!inputValue.trim() &&
    !!passwordValue &&
    !!confirmPasswordValue &&
    !inputError &&
    !passwordError &&
    !confirmPasswordError;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      <div className="flex min-h-screen w-full flex-col gap-6 px-3 py-6 sm:gap-8 sm:px-4 sm:py-10 lg:flex-row lg:items-stretch lg:gap-0 lg:px-0 lg:py-0">
        {/* Левая часть с привилегиями — свободный скролл на десктопе */}
        <div className="relative hidden h-screen w-1/2 overflow-hidden bg-gray-100 lg:block lg:rounded-none lg:shadow-none">
          <div className="flex h-full w-full overflow-x-auto">
            {benefits.map((b, idx) => (
              <div
                key={b.id}
                className="relative h-full min-w-full flex-shrink-0 overflow-hidden lg:min-w-full lg:flex-shrink-0"
                style={{ scrollSnapAlign: "none" }}
              >
                <img src={b.img} alt={b.title} className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/30" />
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-white/85 p-4 shadow-lg backdrop-blur">
                  <p className="text-lg font-semibold text-slate-900">{b.title}</p>
                  <p className="text-sm text-slate-600">Эксклюзивные привилегии для владельцев аккаунта.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Правая часть с формой */}
        <div className="w-full lg:w-1/2">
          {/* Мобильный слайдер преимуществ */}
          <div className="mb-5 block lg:hidden">
            <p className="mb-3 text-base font-semibold text-slate-800">Почему стоит создать аккаунт</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {benefits.map((b, idx) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.35, delay: idx * 0.05 }}
                  className="min-w-[200px] flex-shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow"
                >
                  <img src={b.img} alt={b.title} className="h-28 w-full object-cover" />
                  <p className="px-3 py-2 text-sm font-medium text-slate-800">{b.title}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-xl backdrop-blur transition duration-300 sm:p-6 lg:h-screen lg:max-w-none lg:rounded-none lg:border-0 lg:px-16 lg:py-16 lg:shadow-none"
          >
            {activeSession && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Уже есть активная сессия регистрации{activeEmail ? ` для ${activeEmail}` : ""}. Перенаправляем на подтверждение.
              </div>
            )}
            <div className="flex items-center gap-3 pb-5 sm:pb-6">
              <img src="/img/IMG_0363.PNG" alt="StageStore Logo" className="hidden h-10 w-auto lg:block" />
              <div>
                <h1 className="text-xl font-bold leading-tight sm:text-2xl lg:text-3xl">Регистрация в StageStore</h1>
                <p className="text-xs text-slate-500 sm:text-sm lg:text-base">
                  Доступ к премиум-дропам, отслеживание заказов и персональные рекомендации.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="ml-auto hidden sm:inline-flex items-center text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-900 transition"
              >
                На главную
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="sm:hidden mb-4 inline-flex items-center text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-900 transition"
            >
              На главную
            </button>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="relative">
                <label
                  className={`absolute left-3 text-gray-400 transition-all duration-200 text-sm ${
                    isFocused || inputValue ? "-top-4 text-xs" : "top-2"
                  }`}
                >
                  Email или телефон
                </label>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  required
                  value={inputValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInputValue(value);
                    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                    const isPhone = /^\+?[0-9\s\-()]{10,}$/.test(value);
                    setInputError(!isEmail && !isPhone && value.trim() !== "");
                  }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 pt-5 text-sm sm:text-base shadow-inner transition duration-200 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              {inputError && (
                <p className="text-sm text-red-500">Пожалуйста, введите корректный email или номер телефона</p>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="relative">
                  <label
                    className={`absolute left-3 text-gray-400 transition-all duration-200 text-sm ${
                      isPasswordFocused || passwordValue ? "-top-4 text-xs" : "top-2"
                    }`}
                  >
                    Пароль
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={passwordValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPasswordValue(v);
                      setPasswordError(v.length > 0 && !isStrongPassword(v));
                      if (confirmPasswordValue) {
                        setConfirmPasswordError(confirmPasswordValue !== v);
                      }
                    }}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 pr-12 pt-5 text-sm sm:text-base shadow-inner transition duration-200 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-[120%] text-base text-slate-500"
                    title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                  <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                    Минимум 8 символов, хотя бы одна буква и одна цифра.
                  </p>
                </div>

                <div className="relative">
                  <label
                    className={`absolute left-3 text-gray-400 transition-all duration-200 text-sm ${
                      isConfirmPasswordFocused || confirmPasswordValue ? "-top-4 text-xs" : "top-2"
                    }`}
                  >
                    Повторите пароль
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPasswordValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setConfirmPasswordValue(v);
                      setConfirmPasswordError(v.length > 0 && v !== passwordValue);
                    }}
                    onFocus={() => setIsConfirmPasswordFocused(true)}
                    onBlur={() => setIsConfirmPasswordFocused(false)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 pt-5 text-sm sm:text-base shadow-inner transition duration-200 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
              </div>

              {passwordError && (
                <p className="text-sm text-red-500">
                  Пароль должен быть не короче 8 символов и содержать букву и цифру
                </p>
              )}
              {confirmPasswordError && <p className="text-sm text-red-500">Пароли не совпадают</p>}

              <button
                type="submit"
                className="w-full rounded-xl bg-black py-2.5 text-center text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSubmit}
              >
                {submitting ? "Отправляем..." : "Зарегистрироваться"}
              </button>
              {err && <p className="text-sm text-red-600">{err}</p>}
              {msg && <p className="text-sm text-green-700">{msg}</p>}
            </form>

            <div className="mt-5 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600 sm:px-4">
              <p className="font-semibold text-slate-800 text-sm sm:text-base">Совет по безопасности</p>
              <p className="mt-1 text-xs sm:text-sm">
                Используйте уникальный пароль для StageStore. Мы не храним его в открытом виде и всегда шлём код
                подтверждения при регистрации.
              </p>
            </div>

            <div className="mt-6 text-center">
              <p className="mb-2">Или войдите через соцсети</p>
              <div className="flex justify-center gap-4">
                <img
                  src="/img/гугл.png"
                  alt="Google"
                  className="h-14 w-14 cursor-pointer hover:scale-105 transition"
                />
                <img
                  src="/img/яндекс.png"
                  alt="Yandex"
                  className="h-14 w-14 cursor-pointer hover:scale-105 transition"
                />
                <img
                  src="/img/vk.png"
                  alt="VK"
                  className="h-14 w-14 cursor-pointer hover:scale-105 transition"
                />
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm">
                Уже зарегистрированы?{" "}
                <button
                  type="button"
                  className="font-semibold text-black underline underline-offset-4 hover:no-underline"
                  onClick={() => router.push("/login")}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                >
                  Войти
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
