"use client";
import React, { useEffect, useRef, useState } from "react";
import { useUser } from "@/user/UserContext";

export default function VerifyClient() {
  const { user } = useUser();
  const [code, setCode] = useState(Array(6).fill(""));
  const [activeIndex, setActiveIndex] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [merged, setMerged] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("email") || localStorage.getItem("email");
    if (storedEmail) {
      setEmail(storedEmail);
    } else if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  // Auto send code on full input
  useEffect(() => {
    if (email && code.every((digit) => digit !== "")) {
      verifyCode();
    }
  }, [code, email]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Focus input on activeIndex change
  useEffect(() => {
    const el = inputsRef.current[activeIndex] ?? null;
    el?.focus();
    el?.select();
  }, [activeIndex]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const val = e.target.value;
    if (!val) {
      updateCodeAtIndex(index, "");
      setActiveIndex(index);
      return;
    }
    if (/^\d$/.test(val)) {
      updateCodeAtIndex(index, val);
      if (index < 5) {
        setActiveIndex(index + 1);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace") {
      if (code[index] === "") {
        if (index > 0) {
          updateCodeAtIndex(index - 1, "");
          setActiveIndex(index - 1);
          e.preventDefault();
        }
      } else {
        updateCodeAtIndex(index, "");
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      setActiveIndex(index - 1);
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < 5) {
      setActiveIndex(index + 1);
      e.preventDefault();
    }
  }

  function updateCodeAtIndex(index: number, val: string) {
    setCode((prev) => {
      const newCode = [...prev];
      newCode[index] = val;
      return newCode;
    });
  }

  async function verifyCode() {
    if (!email) {
      setError("Нет email для подтверждения");
      return;
    }
    setError("");
    setSuccess(false);
    const enteredCode = code.join("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail, code: enteredCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        inputsRef.current.forEach((el) => el?.blur());
        try { (document.activeElement as HTMLElement | null)?.blur?.(); } catch {}

        setTimeout(() => {
          setSuccess(true);
        }, 100);

        setTimeout(() => setMerged(true), 800);

        setTimeout(() => {
          window.location.href = "/user";
        }, 1700);
      } else {
        setError(data.message || "Неверный код. Попробуйте ещё раз.");
        setCode(Array(6).fill(""));
        setActiveIndex(0);
      }
    } catch {
      setError("Ошибка сети");
    }
  }

  async function resendCode() {
    setError("");
    setSuccess(false);
    if (!email) {
      setError("Нет email для повторной отправки");
      return;
    }
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCooldown(60);
      } else {
        setError(data.message || "Ошибка отправки");
      }
    } catch {
      setError("Ошибка сети");
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").trim();
    if (/^\d{1,6}$/.test(paste)) {
      const pasteArray = paste.split("");
      setCode((prev) => {
        const newCode = [...prev];
        for (let i = 0; i < 6; i++) {
          newCode[i] = pasteArray[i] || "";
        }
        return newCode;
      });
      const nextIndex = paste.length < 6 ? paste.length : 5;
      setActiveIndex(nextIndex);
    }
  }

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
        <h1 className="text-4xl font-bold mb-6 text-center">Подтверждение почты</h1>
        <img
          src="/img/почта.avif"
          alt="Verify Email"
          className="mb-7 w-64 h-44 object-contain"
          draggable={false}
        />
        <div className="relative inline-flex gap-4 mb-6">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(e, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
              className={`w-14 h-20 border rounded-md text-center text-2xl font-semibold outline-none transition-shadow duration-200
                ${success ? "success-bounce" : ""} ${merged ? "merge-out" : ""}
                ${digit !== "" ? "animate-pop-in" : ""}
                ${success ? "border-green-600" : "border-gray-300"}
                focus:border-blue-500 focus:shadow-[0_0_8px_rgba(59,130,246,0.5)]`}
              style={{ ['--d' as any]: `${i * 100}ms`, ['--shift' as any]: `${(2.5 - i) * 12}px` }}
              autoComplete="one-time-code"
              spellCheck="false"
            />
          ))}
        </div>
        <button
          onClick={resendCode}
          disabled={cooldown > 0}
          className={`mb-4 px-6 py-2 rounded text-black font-semibold transition-colors duration-200 border border-black
            ${cooldown > 0 ? "opacity-60 cursor-not-allowed" : "hover:bg-black hover:text-white"}`}
          type="button"
        >
          {cooldown > 0 ? `Отправить повторно через ${cooldown}s` : "Отправить повторно"}
        </button>
        <a href="/register" className="text-sm text-black underline-animation">
          Неверный email? Изменить
        </a>
        {error && <p className="mt-4 text-red-600 font-medium">{error}</p>}
        {success && <p className="mt-4 text-green-600 font-medium">Почта успешно подтверждена!</p>}
      </div>
      <style jsx>{`
        @keyframes pop-in {
          0% {
            transform: scale(0.8);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-pop-in {
          animation: pop-in 0.3s ease forwards;
        }
        .underline-animation {
          position: relative;
          text-decoration: none;
          cursor: pointer;
        }
        .underline-animation::after {
          content: "";
          position: absolute;
          width: 100%;
          transform: scaleX(0);
          height: 1px;
          bottom: 0;
          left: 0;
          background-color: black;
          transform-origin: bottom right;
          transition: transform 0.25s ease-out;
        }
        .underline-animation:hover::after {
          transform: scaleX(1);
          transform-origin: bottom left;
        }
        @keyframes bounceIn {
          0% { transform: translateY(0); }
          30% { transform: translateY(-14px); }
          60% { transform: translateY(4px); }
          100% { transform: translateY(0); }
        }
        .success-bounce {
          animation: bounceIn 650ms ease-out both;
          animation-delay: var(--d, 0ms);
        }

        /* Each cell moves toward center and fades, giving a merge illusion */
        @keyframes mergeOut {
          0%   { transform: translateX(0) scale(1); opacity: 1; }
          100% { transform: translateX(var(--shift, 0)) scaleX(0.2) scaleY(0.9); opacity: 0; }
        }
        .merge-out { animation: mergeOut 520ms ease-in both; animation-delay: var(--d, 0ms); }
      `}</style>
      <style jsx global>{`
        header {
          display: none !important;
        }
      `}</style>
    </>
  );
}