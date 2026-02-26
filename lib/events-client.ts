export type ShopEventType =
  | "PRODUCT_VIEW"
  | "ADD_TO_CART"
  | "REMOVE_FROM_CART"
  | "START_CHECKOUT"
  | "PURCHASE"
  | "SEARCH"
  | "FAVORITE_ADD"
  | "BRAND_CLICK";

export type TrackEventPayload = {
  eventId?: string;
  eventType: ShopEventType;
  userId?: number;
  sessionId?: string;
  productId?: number;
  orderId?: number;
  pageUrl?: string;
  source?: string;
  deviceType?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

const SESSION_STORAGE_KEY = "projectx_events_session_id";

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateEventsSessionId() {
  if (typeof window === "undefined") return "server-session";

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const generated = createSessionId();
  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

export async function trackShopEvent(payload: TrackEventPayload) {
  const sessionId = payload.sessionId ?? getOrCreateEventsSessionId();
  return fetch("/api/events/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      sessionId,
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
      pageUrl: payload.pageUrl ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
      source: payload.source ?? "web",
      deviceType: payload.deviceType ?? (typeof window !== "undefined" ? "browser" : "server"),
    }),
    keepalive: true,
  });
}
