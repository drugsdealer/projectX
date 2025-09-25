"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/user/UserContext";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <img src="/img/IMG_0363.PNG" alt="StageStore Logo" className="h-8 w-auto" />
          <h1 className="text-3xl font-bold">Вход в StageStore</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Пароль</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white py-2 rounded disabled:opacity-60"
          >
            {isLoading ? "Входим..." : "Войти"}
          </button>
        </form>

        <div className="text-center text-sm">
          Нет аккаунта?{" "}
          <button
            type="button"
            onClick={() => router.push("/register")}
            className="font-semibold underline"
          >
            Зарегистрироваться
          </button>
        </div>
      </div>
    </div>
  );
}