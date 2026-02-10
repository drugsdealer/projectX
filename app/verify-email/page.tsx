"use client";
import React, { useEffect, useRef, useState } from "react";
import { useUser } from "@/user/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refresh } = useUser();
  const [code, setCode] = useState(Array(6).fill(""));
  const [activeIndex, setActiveIndex] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [errorPulse, setErrorPulse] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [email, setEmail] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasVfy, setHasVfy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const readCookie = (name: string) => {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  };

  useEffect(() => {
    setHasVfy(!!readCookie("vfy"));
    const storedEmail = typeof window !== "undefined"
      ? sessionStorage.getItem("email") || localStorage.getItem("email")
      : null;

    if (storedEmail) {
      setEmail(storedEmail.trim().toLowerCase());
    } else if (user?.email) {
      setEmail(user.email.trim().toLowerCase());
    }
    setInitialized(true);
  }, [user]);

  useEffect(() => {
    const reason = searchParams?.get("reason");
    let flag: string | null = null;
    try { flag = sessionStorage.getItem("reg_active"); } catch {}
    if (reason === "active" || flag === "1") {
      setNotice("У вас уже есть активная сессия регистрации. Код уже отправлен — при необходимости используйте кнопку «Отправить повторно».");
      try { sessionStorage.removeItem("reg_active"); } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    if (user?.verified) {
      router.replace("/user");
    }
  }, [user?.verified, router]);

  useEffect(() => {
    if (!initialized) return;
    if (!email) {
      if (!hasVfy) {
        // Если по какой‑то причине нет email и нет активной сессии — отправляем на регистрацию
        try {
          router.replace("/register");
        } catch {
          window.location.href = "/register";
        }
      } else {
        setNotice("Не удалось найти email для подтверждения. Нажмите «Начать заново», чтобы повторить регистрацию.");
      }
    }
  }, [initialized, email, hasVfy, router]);

  useEffect(() => {
    if (
      email &&
      code.every((digit) => digit !== "") &&
      !isVerifying &&
      !success &&
      !isMerging
    ) {
      verifyCode();
    }
  }, [code, email, isVerifying, success, isMerging]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const el = inputsRef.current[activeIndex] ?? null;
    el?.focus();
    el?.select();
  }, [activeIndex]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const val = e.target.value;
    if (error) setError("");
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
    if (error && e.key !== "Tab") setError("");
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
    if (isVerifying || success || isMerging) return;

    if (!email) {
      setError("Нет email для подтверждения");
      return;
    }

    const enteredCode = code.join("");
    if (!/^\d{6}$/.test(enteredCode)) {
      setError("Код должен состоять из 6 цифр");
      return;
    }

    setError("");
    setIsVerifying(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: enteredCode }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        inputsRef.current.forEach((el) => {
          if (el) el.disabled = true;
          el?.blur();
        });

        setSuccess(true);

        setTimeout(() => {
          setIsMerging(true);
        }, 500);

        setTimeout(() => {
          setShowCheckmark(true);
        }, 900);

        try {
          sessionStorage.removeItem("email");
          localStorage.removeItem("email");
        } catch {}
        try { window.dispatchEvent(new Event("auth:changed")); } catch {}
        try { await refresh(); } catch {}
        setTimeout(() => {
          router.replace("/user");
        }, 1200);
      } else {
        setError(data.message || "Неверный код. Попробуйте ещё раз.");
        setErrorPulse((p) => p + 1);
        setCode(Array(6).fill(""));
        setActiveIndex(0);
      }
    } catch {
      setError("Ошибка сети");
      setErrorPulse((p) => p + 1);
    } finally {
      setIsVerifying(false);
    }
  }

  async function resendCode() {
    setError("");
    setSuccess(false);
    setIsMerging(false);
    setShowCheckmark(false);
    if (!email) {
      setError("Нет email для повторной отправки");
      return;
    }
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
        credentials: "include",
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

  function startOver() {
    try {
      document.cookie = "vfy=; Path=/; Max-Age=0; SameSite=Lax";
      sessionStorage.removeItem("email");
      localStorage.removeItem("email");
      sessionStorage.removeItem("reg_active");
    } catch {}
    router.replace("/register");
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    if (error) setError("");
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
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-100 p-5 shadow-lg sm:p-7">
          <div className="flex flex-col items-center text-center gap-4 sm:gap-5">
            <h1 className="text-2xl font-bold sm:text-3xl">Подтверждение почты</h1>
            <img
              src="/img/почта.avif"
              alt="Verify Email"
              className="h-28 w-40 object-contain sm:h-32 sm:w-48"
              draggable={false}
            />
            <p className="text-sm text-slate-600 sm:text-base">Введите 6-значный код, отправленный на вашу почту.</p>
          </div>

          <div className="mt-5 flex justify-center items-center">
            <div className="relative w-full flex justify-center" style={{ height: "60px" }}>
              <div className="relative flex gap-2 sm:gap-3 justify-center items-center" ref={containerRef}>
                {code.map((digit, i) => {
                  const isLeftSide = i < 3;
                  const mergeX = isLeftSide ? 60 : -60;
                  
                  return (
                    <motion.div
                      key={i}
                      className="relative rounded-lg overflow-hidden"
                      animate={isMerging ? {
                        x: mergeX,
                        scale: [1, 0.9, 0.6, 0.3, 0],
                        opacity: [1, 0.9, 0.6, 0.3, 0],
                        rotate: isLeftSide ? [0, 5, -5, 0] : [0, -5, 5, 0],
                        transition: {
                          x: { duration: 1.2, ease: "easeInOut" },
                          scale: { duration: 1.2, ease: "easeInOut" },
                          opacity: { duration: 1.2, ease: "easeInOut" },
                          rotate: { duration: 1.2, ease: "easeInOut" }
                        }
                      } : success ? {
                        y: [0, -16, 8, 0],
                        scale: [1, 1.08, 0.98, 1],
                        transition: {
                          y: {
                            delay: i * 0.08,
                            duration: 0.5,
                            ease: "easeOut",
                            times: [0, 0.3, 0.6, 1]
                          },
                          scale: {
                            delay: i * 0.08,
                            duration: 0.5,
                            ease: "easeOut"
                          }
                        }
                      } : errorPulse > 0 ? {
                        x: [0, -6, 6, -4, 4, 0],
                        transition: {
                          duration: 0.35,
                          ease: "easeInOut"
                        }
                      } : {}}
                    >
                      <input
                        ref={(el) => { inputsRef.current[i] = el; }}
                        type="tel"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(e, i)}
                        onKeyDown={(e) => handleKeyDown(e, i)}
                        onPaste={handlePaste}
                        className={`
                          w-11 h-12 sm:w-12 sm:h-14
                          border rounded-lg
                          text-center text-2xl sm:text-2xl
                          bg-white
                          focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200
                          transition-all duration-150
                          font-light text-transparent caret-black
                          ${error ? "border-red-400 bg-red-50" : digit ? "border-blue-400" : "border-gray-200"}
                          ${success ? "border-green-400 bg-green-50" : ""}
                          ${isMerging ? "pointer-events-none" : ""}
                        `}
                        autoComplete="one-time-code"
                        spellCheck="false"
                        disabled={success}
                      />
                      
                      <AnimatePresence mode="wait">
                        {digit && (
                          <motion.span
                            key={`digit-${i}-${digit}`}
                            className={`
                              absolute inset-0 flex items-center justify-center
                              text-2xl sm:text-2xl pointer-events-none
                              font-light tracking-tight
                              ${success ? "text-green-600" : "text-gray-800"}
                            `}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ 
                              scale: 1, 
                              opacity: 1,
                              transition: {
                                duration: 0.2,
                                ease: "easeOut"
                              }
                            }}
                            exit={{ 
                              scale: 0.5, 
                              opacity: 0,
                              transition: {
                                duration: 0.15,
                                ease: "easeIn"
                              }
                            }}
                          >
                            {digit}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {showCheckmark && (
                  <motion.div
                    className="flex items-center justify-center"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: [0, 1.3, 1],
                      opacity: [0, 1, 1],
                      transition: {
                        duration: 0.6,
                        ease: "easeOut"
                      }
                    }}
                  >
                    <svg 
                      className="w-14 h-14 sm:w-16 sm:h-16"
                      viewBox="0 0 24 24" 
                      fill="none" 
                    >
                      <motion.path
                        d="M20 6L9 17L4 12"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                          duration: 0.5,
                          delay: 0.1,
                          ease: "easeInOut"
                        }}
                      />
                    </svg>
                  </motion.div>
                )}
              </div>
              
              {isMerging && !showCheckmark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div
                    className="flex items-center justify-center"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: [0, 1.5, 2, 0],
                      opacity: [0, 0.7, 0.5, 0],
                      transition: {
                        duration: 1.2,
                        ease: "easeOut"
                      }
                    }}
                  >
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </motion.div>
                </div>
              )}
            </div>
          </div>

          {notice && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs sm:text-sm text-amber-800">
              {notice}
            </div>
          )}

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={resendCode}
              disabled={cooldown > 0 || success}
              className={`
                w-full rounded-xl border border-gray-300 px-4 py-2.5 
                text-sm font-normal text-gray-700 transition sm:text-base
                ${cooldown > 0 || success 
                  ? "cursor-not-allowed opacity-50" 
                  : "hover:bg-gray-50 hover:border-gray-400"
                }
              `}
              type="button"
            >
              {cooldown > 0 ? `Отправить повторно через ${cooldown}s` : "Отправить повторно"}
            </button>
            {!email && hasVfy ? (
              <button
                type="button"
                onClick={startOver}
                className="text-xs sm:text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Начать заново
              </button>
            ) : (
              <p className="text-xs sm:text-sm text-gray-500">
                Изменить email можно после завершения текущей сессии подтверждения.
              </p>
            )}
          </div>

          {error && <p className="mt-4 text-center text-sm font-medium text-red-500">{error}</p>}
          {success && !isMerging && (
            <p className="mt-4 text-center text-sm font-medium text-green-600">
              Почта успешно подтверждена!
            </p>
          )}
        </div>
      </div>
      <style jsx global>{` 
        header { 
          display: none !important; 
        }
        
        input[type="tel"]::-webkit-inner-spin-button,
        input[type="tel"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        input[type="tel"] {
          -moz-appearance: textfield;
          caret-color: transparent !important;
        }
        
        input:focus {
          outline: 2px solid transparent;
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
