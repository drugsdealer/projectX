"use client";

import React, { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { UserContext } from "@/user/UserContext";
import type { User } from "@/user/UserContext";

export default function VerifyPhonePage() {
  const router = useRouter();
  const userContext = useContext(UserContext);
  const [code, setCode] = useState(Array(6).fill(""));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [savedPhone, setSavedPhone] = useState("ваш номер");
  const [channel, setChannel] = useState<"telegram" | "sms" | null>(null);
  const [busy, setBusy] = useState(false);

  // Код проверяет сервер. Раньше он генерировался прямо здесь, в браузере,
  // и сам себя сверял — такую проверку можно было обойти за десять секунд.
  useEffect(() => {
    const stored = localStorage.getItem("phone");
    if (stored) setSavedPhone(stored);
  }, []);

  const requestCode = async (phone: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) setChannel(data.channel ?? null);
      else setError(data?.message || "Не удалось отправить код.");
    } catch {
      setError("Не удалось отправить код.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (savedPhone && savedPhone !== "ваш номер") requestCode(savedPhone);
    // отправляем один раз при открытии страницы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPhone]);

  const handleVerify = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: savedPhone, code: code.join("").replace(/\s/g, "") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setError(data?.message || "Неверный код.");
        setSuccess(false);
        return;
      }

      setSuccess(true);

      const normalizedPhone = savedPhone.replace(/[^0-9]/g, "").replace(/^8/, "7");

      localStorage.setItem(
        "user",
        JSON.stringify({
          contact: normalizedPhone,
          method: "phone",
          confirmed: true,
        })
      );

      if (userContext && typeof userContext.setUser === "function") {
        userContext.setUser((prevUser: User | null) => ({
          ...(prevUser ?? {}),
          phone: normalizedPhone,
          name: prevUser?.name ?? "Не указано",
          isGuest: false,
          verified: true,
        }));
      }

      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch {
      setError("Не удалось проверить код. Попробуйте ещё раз.");
      setSuccess(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        header {
          display: none !important;
        }
      `}</style>
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center bg-white px-4 py-10">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-extrabold mb-6">Подтверждение номера телефона</h1>

          <div className="w-full h-40 mb-6 rounded-lg flex items-center justify-center">
            <img
              src="/img/телефон.webp"
              alt="Анимация полета email"
              className="h-full object-contain"
            />
          </div>

          <p className="text-base text-gray-700 mb-2">
            {channel === "telegram" ? (
              <>Код отправлен в <span className="font-bold">Telegram</span> на номер{" "}
              <span className="font-bold">{savedPhone}</span>.</>
            ) : channel === "sms" ? (
              <>Код отправлен по СМС на номер <span className="font-bold">{savedPhone}</span>.</>
            ) : busy ? (
              <>Отправляем код на <span className="font-bold">{savedPhone}</span>…</>
            ) : (
              <>На номер <span className="font-bold">{savedPhone}</span> был выслан проверочный код.</>
            )}
          </p>
          <p className="text-sm text-gray-500 mb-6">Пожалуйста, введите его ниже:</p>

          <div className="flex justify-center gap-3 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="relative w-12 h-12">
                <input
                  id={`code-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className="w-full h-full text-center text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-transparent"
                  value={code[i]}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d$/.test(val)) {
                      const newCode = [...code];
                      newCode[i] = val;
                      setCode(newCode);
                      const next = document.querySelector(`#code-${i + 1}`) as HTMLInputElement;
                      if (next) next.focus();
                    } else if (val === "") {
                      const newCode = [...code];
                      newCode[i] = "";
                      setCode(newCode);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace") {
                      e.preventDefault();
                      const newCode = [...code];
                      if (code[i]) {
                        newCode[i] = "";
                        setCode(newCode);
                      } else if (i > 0) {
                        const prev = document.querySelector(`#code-${i - 1}`) as HTMLInputElement;
                        if (prev) prev.focus();
                      }
                    }
                  }}
                />
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
          {success && <p className="text-sm text-green-600 mb-2">Код подтверждён! Перенаправление...</p>}

          <div className="mt-4">
            <button
              onClick={handleVerify}
              className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition"
            >
              Подтвердить
            </button>
            <button
              onClick={() => router.push("/register")}
              className="mt-2 text-sm text-gray-500 hover:text-black underline underline-offset-2"
            >
              Неправильный номер? Изменить
            </button>
          </div>
        </div>
      </div>
    </>
  );
}