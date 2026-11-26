import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Ловит ошибки серверных запросов (Next 15): в Sentry (если включён) и в Telegram.
export const onRequestError: typeof Sentry.captureRequestError = async (err, request, context) => {
  Sentry.captureRequestError(err, request, context);
  try {
    const digest0 = String((err as any)?.digest ?? "");
    // Служебные сигналы Next.js (редирект, 404, динамический рендер) — не ошибки.
    if (/^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT)/.test(digest0)) return;
    const { reportProblem } = await import("./lib/alerts");
    const digest = (err as any)?.digest;
    await reportProblem({
      area: "server",
      title:
        context.routeType === "route"
          ? "Сервер упал при обработке запроса"
          : "Страница не собралась на сервере — покупатель увидел ошибку",
      error: err,
      details: {
        Раздел: context.routePath,
        Метод: request.method !== "GET" ? request.method : undefined,
        Код: digest,
      },
      path: request.path,
      dedupeKey: `server|${context.routePath}|${err instanceof Error ? err.message.slice(0, 120) : ""}`,
    });
  } catch {}
};
