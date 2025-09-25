import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/user/UserContext";

export default function UserInfo() {
  const { user, refresh } = useUser();
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maskEmail = (email?: string) => {
    if (!email || !email.includes("@")) return email || "";
    const [name, domain] = email.split("@");
    const masked = name.length <= 2 ? name[0] + "*" : name[0] + "***" + name.slice(-1);
    return `${masked}@${domain}`;
  };

  if (!user) {
    return (
      <div className="p-4 border rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Информация о пользователе</h2>
        <p>Пользователь не авторизован.</p>
      </div>
    );
  }

  const sendCode = async () => {
    if (!user?.email) {
      setError("У аккаунта не указан email.");
      return;
    }
    setIsSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Не удалось отправить код");
      }
      setCodeSent(true);
      setMessage(`Код отправлен на ${maskEmail(user.email)}.`);
      try { sessionStorage.setItem("email", user.email); } catch {}
      if (data.devCode) {
        setCode(data.devCode);
      }
    } catch (e: any) {
      setError(e.message || "Ошибка при отправке кода");
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    if (!user?.email) {
      setError("У аккаунта не указан email.");
      return;
    }
    setIsVerifying(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Неверный или истёкший код");
      }
      setMessage("Email подтверждён.");
      window.dispatchEvent(new Event("auth:changed"));
      await refresh();
    } catch (e: any) {
      setError(e.message || "Не удалось подтвердить код");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      try { sessionStorage.removeItem("email"); } catch {}
      window.dispatchEvent(new Event("auth:changed"));
      await refresh();
      router.push("/");
    } catch (e) {
      // no-op
    }
  };

  return (
    <div className="p-4 border rounded shadow relative">
      <h2 className="text-xl font-semibold mb-2 flex justify-between items-center">
        Имя профиля: {user.name || "Не указано"}
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded-full border">
            {user.verified ? "Подтверждён" : "Не подтверждён"}
          </span>
          <button
            onClick={() => setShowDetails(true)}
            className="text-sm text-blue-600 underline"
          >
            Подробнее
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 underline"
          >
            Выйти
          </button>
        </div>
      </h2>

      {user.email && <p>Email: {user.email}</p>}
      {user.phone && <p>Телефон: {user.phone}</p>}

      {!user.verified && (
        <div className="mt-3 space-y-2">
          <div className="text-sm text-gray-700">Подтверждение email для безопасности</div>
          <div className="flex items-center gap-2">
            <button
              onClick={sendCode}
              disabled={isSending}
              className="px-3 py-1 bg-black text-white rounded text-sm disabled:opacity-60"
            >
              {isSending ? "Отправляем..." : "Отправить код"}
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Код из письма"
              className="p-2 border rounded w-40"
            />
            <button
              onClick={verifyCode}
              disabled={isVerifying || code.length !== 6}
              className="px-3 py-1 bg-black text-white rounded text-sm disabled:opacity-60"
            >
              {isVerifying ? "Проверяем..." : "Подтвердить"}
            </button>
          </div>
          {codeSent && (
            <p className="text-xs text-gray-600">Код отправлен на {maskEmail(user.email)} (действителен 5 минут).</p>
          )}
          {message && <p className="text-sm text-green-700">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white p-6 rounded shadow max-w-md w-full relative">
            <button
              onClick={() => setShowDetails(false)}
              className="absolute top-2 right-3 text-xl text-gray-500 hover:text-black"
            >
              ×
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">Подробная информация</h3>
            <div className="space-y-2 text-sm text-gray-800">
              <p>ФИО: {user.name || "Не указано"}</p>
              <p>Телефон: {user.phone || "Не указан"}</p>
              <p>Email: {user.email || "Не указан"}</p>
              <p>Адрес: {user.address || "Не указан"}</p>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="mt-4 w-full py-2 bg-black text-white rounded"
            >
              Подтвердить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}