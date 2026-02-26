export type ServerTrackEventPayload = {
  eventId?: string;
  eventType: string;
  userId?: number;
  sessionId: string;
  productId?: number;
  orderId?: number;
  pageUrl?: string;
  source?: string;
  deviceType?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

function buildServiceUrl(path: string): string | null {
  const base = process.env.EVENTS_SERVICE_URL;
  if (!base) return null;
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

export async function emitServerEvents(
  payload: ServerTrackEventPayload | ServerTrackEventPayload[]
) {
  const apiKey = process.env.EVENTS_SERVICE_API_KEY;
  const url = buildServiceUrl(
    Array.isArray(payload) ? "/api/v1/events/batch" : "/api/v1/events"
  );

  if (!apiKey || !url) {
    return false;
  }

  const body = Array.isArray(payload) ? { events: payload } : payload;

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Events-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return upstream.ok;
}
