"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SetupResp = {
  success: boolean;
  alreadySetup?: boolean;
  adminTotpEnabled?: boolean;
  otpauthUrl?: string;
  qr?: string;
  message?: string;
};

export default function Admin2FAPage() {
  const router = useRouter();
  const [setup, setSetup] = useState<SetupResp | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/2fa/setup", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        setError(data?.message || "Не удалось загрузить QR");
      }
      setSetup(data);
      setLoading(false);
    };
    load();
  }, []);

  const verify = async () => {
    setError(null);
    const res = await fetch("/api/admin/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setError(data?.message || "Неверный код");
      return;
    }
    setOk(true);
    setTimeout(() => {
      router.replace("/admin");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 p-6 shadow-sm">
        <h1 className="text-xl font-bold">Подтверждение входа</h1>
        <p className="mt-1 text-sm text-black/60">
          Введите код из Google Authenticator.
        </p>
        <p className="mt-1 text-xs text-black/45">
          Если код не подходит, включите автоматическую синхронизацию времени на телефоне.
        </p>

        {loading && (
          <p className="mt-4 text-sm text-black/50">Загрузка QR…</p>
        )}

        {setup?.qr && (
          <div className="mt-4 flex items-center justify-center">
            <img src={setup.qr} alt="QR" className="h-40 w-40" />
          </div>
        )}

        {setup?.alreadySetup && (
          <p className="mt-3 text-xs text-black/50">
            2FA уже привязан. Используйте код из приложения.
          </p>
        )}

        {setup?.adminTotpEnabled && (
          <p className="mt-3 text-xs text-black/50">
            2FA активен. Для входа используйте код из приложения.
          </p>
        )}

        <div className="mt-4">
          <input
            className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="6‑значный код"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
              setCode(next);
            }}
          />
        </div>
        <button
          onClick={verify}
          className="mt-3 w-full rounded-full bg-black text-white py-2 text-sm font-semibold"
        >
          Подтвердить
        </button>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {ok && <p className="mt-2 text-xs text-emerald-600">Готово, входим…</p>}
      </div>
    </div>
  );
}
