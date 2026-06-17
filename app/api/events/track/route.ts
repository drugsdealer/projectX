import { NextResponse } from "next/server";
import { blockIfCsrf, requireJsonRequest } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { emitServerEvents, type ServerTrackEventPayload } from "@/lib/events-server";
import { getUserIdFromRequest } from "@/lib/session";

export const runtime = "nodejs";

const MAX_BATCH = 20;

export async function POST(req: Request) {
  const csrf = blockIfCsrf(req);
  if (csrf) return csrf;
  const json = requireJsonRequest(req);
  if (json) return json;

  const ip = getClientIp(req);
  const rl = await rateLimit(`events-track:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const raw: unknown[] = Array.isArray((body as any).events)
    ? (body as any).events.slice(0, MAX_BATCH)
    : [body];

  // userId всегда берём с сервера (никогда не доверяем клиентскому значению).
  let userId: number | null = null;
  try {
    userId = await getUserIdFromRequest();
  } catch {}

  const payloads: ServerTrackEventPayload[] = raw
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
    .map((e) => ({
      ...(e as ServerTrackEventPayload),
      userId: userId ?? undefined,
    }));

  if (payloads.length === 0) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  // Валидация/нормализация и запись происходят внутри emitServerEvents.
  const ok = await emitServerEvents(payloads);
  // Не считаем ошибкой, если событие отфильтровано — клиенту это знать не нужно.
  return NextResponse.json({ success: ok });
}
