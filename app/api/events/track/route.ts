import { NextResponse } from "next/server";
import { buildEventsServiceUrl, getEventsServiceApiKey } from "@/lib/events-upstream";
import { blockIfCsrf } from "@/lib/api-hardening";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Allowlisted event types — everything else is rejected
const ALLOWED_EVENT_TYPES = new Set([
  "PAGE_VIEW",
  "PRODUCT_VIEW",
  "ADD_TO_CART",
  "REMOVE_FROM_CART",
  "PURCHASE",
  "SEARCH",
  "CLICK",
  "FAVORITE",
  "UNFAVORITE",
]);

const MAX_STRING = 500;

function sanitizeEvent(e: unknown): Record<string, unknown> | null {
  if (!e || typeof e !== "object") return null;
  const ev = e as Record<string, unknown>;
  const eventType = typeof ev.eventType === "string" ? ev.eventType.trim() : "";
  if (!ALLOWED_EVENT_TYPES.has(eventType)) return null;

  return {
    eventType,
    productId: typeof ev.productId === "number" ? ev.productId : undefined,
    brandId: typeof ev.brandId === "number" ? ev.brandId : undefined,
    categoryId: typeof ev.categoryId === "number" ? ev.categoryId : undefined,
    query: typeof ev.query === "string" ? ev.query.slice(0, MAX_STRING) : undefined,
    pageUrl: typeof ev.pageUrl === "string" ? ev.pageUrl.slice(0, MAX_STRING) : undefined,
    source: typeof ev.source === "string" ? ev.source.slice(0, 50) : undefined,
  };
}

export async function POST(req: Request) {
  const csrf = blockIfCsrf(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit(`events-track:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false }, { status: 429 });
  }

  const apiKey = getEventsServiceApiKey();
  if (!apiKey) {
    return NextResponse.json({ success: false }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  // Sanitize: only allow known event types with known fields
  let sanitized: Record<string, unknown>[];
  const raw = Array.isArray((body as any).events) ? (body as any).events : [body];
  sanitized = raw.map(sanitizeEvent).filter(Boolean) as Record<string, unknown>[];

  if (sanitized.length === 0) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const isBatch = sanitized.length > 1;
  const upstreamUrl = buildEventsServiceUrl(
    isBatch ? "/api/v1/events/batch" : "/api/v1/events"
  );

  if (!upstreamUrl) {
    return NextResponse.json({ success: false }, { status: 503 });
  }

  try {
    const payload = isBatch ? { events: sanitized } : sanitized[0];
    await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Events-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    // Never return upstream response to client
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 502 });
  }
}
