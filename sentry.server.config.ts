import * as Sentry from "@sentry/nextjs";

// Инициализируем Sentry только если задан DSN — иначе полностью выключено (no-op).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
  });
}
