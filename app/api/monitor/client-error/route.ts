import { NextResponse } from "next/server";
import { enforceSameOrigin } from "@/lib/security";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { reportProblem, type AlertArea } from "@/lib/alerts";

export const runtime = "nodejs";

// Ошибки, которые браузер покупателя прислал сам (страница упала, не открылась оплата и т.п.).
const ALLOWED: ReadonlySet<AlertArea> = new Set(["payment", "checkout", "register", "login", "page-crash", "browser"]);

function device(ua: string) {
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : "другое";
  const browser = /YaBrowser/.test(ua)
    ? "Яндекс Браузер"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\//.test(ua)
        ? "Opera"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /FxiOS|Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "другой";
  const inApp = /Telegram|Instagram|FBAN|FBAV|VKClient/.test(ua) ? " (внутри приложения)" : "";
  return `${os} · ${browser}${inApp}`;
}

function clean(v: unknown, max: number) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export async function POST(req: Request) {
  const csrf = enforceSameOrigin(req);
  if (csrf) return csrf;

  const ua = req.headers.get("user-agent") || "";
  if (/bot|crawler|spider|headless|lighthouse/i.test(ua)) return new NextResponse(null, { status: 204 });

  const ip = getClientIp(req);
  const rl = await rateLimit(`client-error:${ip}`, 8, 10 * 60_000);
  if (!rl.ok) return new NextResponse(null, { status: 204 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const area = clean(body?.area, 30) as AlertArea;
  const title = clean(body?.title, 200);
  if (!body || !ALLOWED.has(area) || !title) return new NextResponse(null, { status: 204 });

  const message = clean(body.message, 600);
  // Первая строка стека с нашим файлом помогает понять, где именно упало.
  const where = clean(body.stack, 1200)
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.includes("/_next/") || s.includes("webpack"));

  const details: Record<string, unknown> = { Устройство: device(ua) };
  if (body.details && typeof body.details === "object") {
    for (const [k, v] of Object.entries(body.details as Record<string, unknown>).slice(0, 6)) {
      if (["string", "number", "boolean"].includes(typeof v)) details[clean(k, 40)] = String(v).slice(0, 200);
    }
  }
  if (where) details["Файл"] = where.replace(/^at\s+/, "").slice(0, 200);

  await reportProblem({
    area,
    title,
    error: message || undefined,
    details,
    path: clean(body.path, 200),
    dedupeKey: `client|${area}|${title}|${message.slice(0, 120)}`,
  });

  return new NextResponse(null, { status: 204 });
}
