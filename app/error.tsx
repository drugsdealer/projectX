"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black/5 mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-black/40">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="16" r="0.75" fill="currentColor" />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight">Что-то пошло не так</h1>
        <p className="mt-3 text-sm text-black/55 leading-relaxed">
          На нашей стороне произошла ошибка. Мы уже знаем о ней и скоро всё исправим.
        </p>

        {error?.digest && (
          <p className="mt-2 text-xs text-black/30 font-mono">#{error.digest}</p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="w-full sm:w-auto inline-flex items-center justify-center h-11 px-6 rounded-full bg-black text-white text-sm font-semibold hover:opacity-85 transition"
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center h-11 px-6 rounded-full border border-black/15 text-sm font-semibold text-black/70 hover:border-black/40 hover:text-black transition"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
