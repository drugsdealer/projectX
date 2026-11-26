"use client";

import { useEffect } from "react";
import { reportClientProblem } from "@/lib/report-client";

/**
 * Ловит необработанные ошибки JavaScript в браузере покупателя и сообщает о них в Telegram.
 * Шум отсекаем: расширения браузера, сбои сети, отменённые запросы, обновление сайта
 * (старые файлы после выкладки) и чужие скрипты (Метрика и т.п.) — это не наши поломки.
 */
const IGNORE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Failed to fetch|NetworkError|Load failed|network error/i,
  /AbortError|The operation was aborted|signal is aborted/i,
  /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module/i,
  /Minified React error #4(18|19|21|22|23|25)/, // расхождение HTML — обычно из-за переводчика/расширений
  /NEXT_REDIRECT|NEXT_NOT_FOUND/,
  /play\(\) request was interrupted|NotAllowedError/i, // автозапуск видео запрещён браузером
  /Non-Error promise rejection captured/i,
  /cancelled|отменено/i,
];

function isOurs(source: string) {
  if (!source) return true; // без адреса — скорее всего наш код из бандла
  if (/^(chrome|moz|safari)(-web)?-extension:/.test(source)) return false;
  try {
    return new URL(source, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const message = String(e.message || e.error?.message || "");
      if (!message || IGNORE.some((r) => r.test(message))) return;
      if (!isOurs(e.filename || "")) return;
      const stack = String(e.error?.stack || "");
      if (/extension:\/\//.test(stack)) return;
      reportClientProblem("browser", "Ошибка JavaScript на странице", e.error instanceof Error ? e.error : message);
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const message = r instanceof Error ? r.message : typeof r === "string" ? r : "";
      if (!message || IGNORE.some((re) => re.test(message))) return;
      const stack = r instanceof Error ? String(r.stack || "") : "";
      if (/extension:\/\//.test(stack)) return;
      if (stack && !stack.includes(window.location.origin) && !stack.includes("/_next/")) return;
      reportClientProblem("browser", "Необработанная ошибка в браузере", r instanceof Error ? r : message);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
