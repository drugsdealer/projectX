"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/user/UserContext";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (!cancelled && d?.user) {
          router.replace("/user");
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        if (res.status === 403) {
          // не подтвержден — сохраняем email и идем на верификацию
          try { sessionStorage.setItem("email", email.trim().toLowerCase()); } catch {}
          setErr("Подтвердите email перед входом.");
          router.push("/verify-email");
          return;
        }
        setErr(data?.error || "Неверный email или пароль");
        return;
      }

      try { window.dispatchEvent(new Event("auth:changed")); } catch {}
      await refresh();

      router.push("/user");
    } catch {
      setErr("Не удалось выполнить вход. Попробуйте позже.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-[0.28em] text-gray-400">StageStore</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Вход в аккаунт</h1>
            </div>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="hidden sm:inline-flex items-center text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-900 transition"
            >
              На главную
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm text-gray-700">Email</label>
              <input
                type="email"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-gray-700">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none transition"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-800 text-sm"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {err && <p className="text-sm text-red-500">{err}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-black text-white font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition transform disabled:opacity-60"
            >
              {isLoading ? "Входим..." : "Войти"}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm text-gray-700">
            <button
              type="button"
              onClick={() => router.push("/register")}
              className="font-semibold text-gray-900 hover:text-black transition fancy-underline"
            >
              Нет аккаунта? Зарегистрируйтесь
            </button>
            <a className="text-gray-500 hover:text-gray-900 transition" href="/reset-password">
              Забыли пароль?
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xl flex flex-col gap-6">
          <div className="flex items-center gap-3 text-emerald-600">
            <span className="text-xl">⚡</span>
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-700/80">Преимущества</p>
          </div>
          <h2 className="text-2xl font-semibold leading-tight">Быстрый вход, персональные подборки и трекинг заказов</h2>
          <ul className="space-y-4 text-sm text-gray-700">
            <li className="flex items-start gap-3"><span className="text-emerald-600 mt-0.5">•</span>Доступ к премиальным дропам и коллекциям.</li>
            <li className="flex items-start gap-3"><span className="text-emerald-600 mt-0.5">•</span>Синхронизация корзины и избранного между устройствами.</li>
            <li className="flex items-start gap-3"><span className="text-emerald-600 mt-0.5">•</span>Уведомления о скидках и статусе заказов.</li>
          </ul>
          <div className="relative flex-1 min-h-[200px] overflow-hidden rounded-2xl border border-gray-200 gradient-card">
            <div className="absolute inset-0 aura-layer" />
            <div className="absolute inset-0 bg-white/12" />
            <div className="relative h-full w-full grid place-items-center text-center px-6 py-6">
              <p className="text-white text-sm sm:text-base font-medium leading-relaxed drop-shadow">
                «StageStore» — место, где коллекции собираются в одну ленту. Войдите, чтобы продолжить свой список желаний.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Aurora effect styles injection (scoped to this page)
if (typeof document !== "undefined") {
  const id = "aurora-login-style";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      .gradient-card {
        background: linear-gradient(135deg, #0ea5e9 0%, #7c3aed 50%, #22d3ee 100%);
        background-size: 180% 180%;
        animation: gradientFlow 12s ease infinite;
      }
      .aura-layer {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(120% 120% at 20% 20%, rgba(94,234,212,0.6), transparent 65%),
          radial-gradient(115% 115% at 78% 12%, rgba(129,140,248,0.7), transparent 55%),
          radial-gradient(140% 140% at 50% 88%, rgba(56,189,248,0.65), transparent 65%),
          linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06));
        animation: auroraShift 10s ease-in-out infinite;
        filter: blur(12px);
        mix-blend-mode: screen;
        opacity: 0.9;
      }
      @keyframes auroraShift {
        0% { transform: translate3d(0,0,0) scale(1); opacity: 0.95; }
        20% { transform: translate3d(-10%, -6%, 0) scale(1.04); opacity: 1; }
        50% { transform: translate3d(8%, 10%, 0) scale(1.06); opacity: 0.92; }
        80% { transform: translate3d(-6%, 6%, 0) scale(1.03); opacity: 1; }
        100% { transform: translate3d(0,0,0) scale(1); opacity: 0.95; }
      }
      @keyframes gradientFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .fancy-underline {
        position: relative;
        display: inline-flex;
        align-items: center;
        overflow: visible;
      }
      .fancy-underline::after {
        content: "";
        position: absolute;
        left: 0;
        bottom: -2px;
        width: 100%;
        height: 2px;
        background: #000;
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.25s ease;
      }
      .fancy-underline:hover::after {
        transform: scaleX(1);
      }
    `;
    document.head.appendChild(style);
  }
}
