// lib/report-client.ts — сообщить об ошибке из браузера (уходит в Telegram через /api/monitor/client-error).
"use client";

export type ClientArea = "payment" | "checkout" | "register" | "login" | "page-crash" | "browser";

const sent = new Set<string>();

export function reportClientProblem(area: ClientArea, title: string, error?: unknown, details?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : error != null ? String(error) : "";
    const key = `${area}|${title}|${message.slice(0, 120)}`;
    if (sent.has(key) || sent.size > 20) return; // одна и та же ошибка — один раз за визит
    sent.add(key);

    const stack = error instanceof Error ? String(error.stack || "").slice(0, 1200) : "";
    void fetch("/api/monitor/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        area,
        title: title.slice(0, 200),
        message: message.slice(0, 600),
        stack,
        details,
        path: window.location.pathname + window.location.search,
      }),
    }).catch(() => {});
  } catch {}
}
