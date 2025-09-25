"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [inputError, setInputError] = React.useState(false);
  const router = useRouter();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const input = inputValue.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const isPhone = /^\+?[0-9\s\-()]{10,}$/.test(input);

    if (!isEmail && !isPhone) {
      setInputError(true);
      return;
    }
    setInputError(false);

    if (passwordValue.length < 6) {
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
        body: JSON.stringify({ email: input, password: passwordValue }),
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
      const verified = !!d1.user?.verified;

      if (existed && verified) {
        setMsg("Вы уже зарегистрированы. Войдите в аккаунт.");
        router.push("/login");
        return;
      }

      // 2) Отправляем код (для новой регистрации или если не подтверждён)
      const r2 = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: input }),
      });
      const d2 = await r2.json().catch(() => ({} as any));

      if (!r2.ok || !d2?.success) {
        throw new Error(d2?.message || "Не удалось отправить код");
      }

      if (d2.alreadyVerified) {
        router.push("/login");
        return;
      }

      try { sessionStorage.setItem("email", input); } catch {}
      router.push("/verify-email");
    } catch (e: any) {
      setErr(e?.message || "Что-то пошло не так");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Левая часть с привилегиями */}
      <div className="w-1/2 bg-gray-100 flex items-center justify-center p-8 overflow-hidden relative">
        <div
          className="absolute inset-0 overflow-y-scroll scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent scroll-smooth"
          style={{
            scrollBehavior: "smooth",
            scrollSnapType: "none",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "thin",
          }}
        >
          <div className="flex flex-col space-y-0">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-screen w-full flex-shrink-0">
                <img
                  src={`/img/slider${n}.jpg`}
                  alt={`slide-${n}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Правая часть с формой */}
      <div className="w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <img src="/img/IMG_0363.PNG" alt="StageStore Logo" className="h-8 w-auto" />
            <h1 className="text-3xl font-bold">Регистрация в StageStore</h1>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="relative">
              <label
                className={`absolute left-3 text-gray-400 transition-all duration-200 text-sm ${
                  isFocused || inputValue ? "-top-3.5 text-xs bg-white px-1" : "top-2"
                }`}
              >
                Email или телефон
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setInputValue(value);
                  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                  const isPhone = /^\+?[0-9\s\-()]{10,}$/.test(value);
                  console.log("Тип ввода:", isEmail ? "email" : isPhone ? "телефон" : "неизвестно");
                  setInputError(!isEmail && !isPhone && value.trim() !== "");
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-full border rounded px-4 py-2 pt-5"
              />
            </div>
            {inputError && (
              <p className="text-red-500 text-sm">Пожалуйста, введите корректный email или номер телефона</p>
            )}
            <div className="relative">
              <label
                className={`absolute left-3 text-gray-400 transition-all duration-200 text-sm ${
                  isPasswordFocused || passwordValue ? "-top-3.5 text-xs bg-white px-1" : "top-2"
                }`}
              >
                Пароль
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                className="w-full border rounded px-4 py-2 pr-10 pt-5"
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-xl"
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? "👀" : "🙈"}
              </span>
            </div>
            {passwordError && (
              <p className="text-red-500 text-sm">Пароль должен быть не менее 6 символов</p>
            )}
            <div className="relative">
              <label
                className={`absolute left-3 text-gray-400 transition-all duration-200 text-sm ${
                  isConfirmPasswordFocused || confirmPasswordValue ? "-top-3.5 text-xs bg-white px-1" : "top-2"
                }`}
              >
                Повторите пароль
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPasswordValue}
                onChange={(e) => setConfirmPasswordValue(e.target.value)}
                onFocus={() => setIsConfirmPasswordFocused(true)}
                onBlur={() => setIsConfirmPasswordFocused(false)}
                className="w-full border rounded px-4 py-2 pt-5"
              />
            </div>
            {confirmPasswordError && (
              <p className="text-red-500 text-sm">Пароли не совпадают</p>
            )}
            <button
              type="submit"
              className="w-full bg-black text-white py-2 rounded disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Отправляем..." : "Зарегистрироваться"}
            </button>
            {err && <p className="text-red-600 text-sm">{err}</p>}
            {msg && <p className="text-green-700 text-sm">{msg}</p>}
          </form>

          <div className="mt-6 text-center">
            <p className="mb-2">Или войдите через соцсети</p>
            <div className="flex justify-center gap-4">
              <img src="/img/гугл.png" alt="Google" className="w-12 h-12 cursor-pointer hover:scale-110 transition-transform" />
              <img src="/img/яндекс.png" alt="Yandex" className="w-12 h-12 cursor-pointer hover:scale-110 transition-transform" />
              <img src="/img/vk.png" alt="VK" className="w-12 h-12 cursor-pointer hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm">
              Уже зарегистрированы?{" "}
              <button
                type="button"
                className="text-black font-semibold underline hover:no-underline"
                onClick={() => router.push("/login")}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                Вход!
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}