"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ru">
      <body style={{ margin: 0, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", background: "#fff", color: "#111" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Что-то пошло не так</div>
          <p style={{ fontSize: 14, color: "#666", maxWidth: 360, lineHeight: 1.5 }}>
            Мы уже получили уведомление об ошибке. Попробуйте обновить страницу.
          </p>
          <button
            onClick={() => reset()}
            style={{ borderRadius: 999, background: "#000", color: "#fff", border: "none", padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  );
}
