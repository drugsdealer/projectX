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

  const [correctCode, setCorrectCode] = useState("");

  const [savedPhone, setSavedPhone] = useState("ваш номер");

  useEffect(() => {
    const stored = localStorage.getItem("phone");
    if (stored) setSavedPhone(stored);

    const generated = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
    setCorrectCode(generated);
  }, []);

  const handleVerify = () => {
    if (code.join("").replace(/\s/g, "") === correctCode) {
      setSuccess(true);
      setError("");

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
        router.push("/"); // редирект на главную или профиль
      }, 2000);
    } else {
      setError("Неверный код. Попробуйте снова.");
      setSuccess(false);
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
            На номер <span className="font-bold">{savedPhone}</span> был выслан проверочный код.
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