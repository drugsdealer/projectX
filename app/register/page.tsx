"use client";

import React from "react";

export default function RegisterPage() {
  const [inputError, setInputError] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const [inputValue, setInputValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);

  const [passwordValue, setPasswordValue] = React.useState("");
  const [isPasswordFocused, setIsPasswordFocused] = React.useState(false);
  const [confirmPasswordValue, setConfirmPasswordValue] = React.useState("");
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = React.useState(false);

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
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            const input = inputValue;
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

            // Сохраняем данные в localStorage
            if (isEmail) {
              localStorage.setItem("email", input);
            } else if (isPhone) {
              localStorage.setItem("phone", input);
            }

            // Перенаправление в зависимости от типа
            if (isEmail) {
              window.location.href = "/verify-email";
            } else if (isPhone) {
              window.location.href = "/verify-phone";
            }
          }}>
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
              className="w-full bg-black text-white py-2 rounded"
            >
              Зарегистрироваться
            </button>
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
              <a
                href="/login"
                className="text-black font-semibold underline hover:no-underline"
              >
                Вход!
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}