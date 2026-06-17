import { prisma } from "@/lib/prisma";

export type ServerTrackEventPayload = {
  eventId?: string;
  eventType: string;
  userId?: number;
  sessionId?: string;
  productId?: number;
  brandId?: number;
  categoryId?: number;
  orderId?: number;
  query?: string;
  pageUrl?: string;
  source?: string;
  deviceType?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

// Шаги воронки конверсии в порядке прохождения.
export const FUNNEL_ORDER = [
  "PRODUCT_VIEW",
  "ADD_TO_CART",
  "START_CHECKOUT",
  "PURCHASE",
] as const;

// Канонические типы событий, которые мы храним и агрегируем.
const CANONICAL_EVENT_TYPES = new Set<string>([
  "PRODUCT_VIEW",
  "ADD_TO_CART",
  "REMOVE_FROM_CART",
  "START_CHECKOUT",
  "PURCHASE",
  "SEARCH",
  "FAVORITE_ADD",
  "BRAND_CLICK",
  "PROMO_CLICK",
  "PAGE_VIEW",
]);

// Совместимость со старыми/альтернативными именами с фронта.
const EVENT_TYPE_ALIASES: Record<string, string> = {
  VIEW: "PRODUCT_VIEW",
  PRODUCTVIEW: "PRODUCT_VIEW",
  CART_ADD: "ADD_TO_CART",
  ADDTOCART: "ADD_TO_CART",
  CART_REMOVE: "REMOVE_FROM_CART",
  CHECKOUT: "START_CHECKOUT",
  CHECKOUT_START: "START_CHECKOUT",
  FAVORITE: "FAVORITE_ADD",
  WISHLIST_ADD: "FAVORITE_ADD",
  CLICK: "PROMO_CLICK",
  PROMO: "PROMO_CLICK",
  BRAND: "BRAND_CLICK",
};

export function normalizeEventType(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toUpperCase();
  if (!t) return null;
  if (CANONICAL_EVENT_TYPES.has(t)) return t;
  if (EVENT_TYPE_ALIASES[t]) return EVENT_TYPE_ALIASES[t];
  return null;
}

function posInt(value: unknown): number | null {
  const n =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

type ShopEventRow = {
  eventType: string;
  userId: number | null;
  sessionId: string | null;
  productId: number | null;
  brandId: number | null;
  categoryId: number | null;
  orderId: number | null;
  query: string | null;
  pageUrl: string | null;
  source: string | null;
  deviceType: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

/**
 * Превращает payload (с фронта или сервера) в строку для таблицы ShopEvent.
 * Достаёт productId/brandId/categoryId/query как из верхнего уровня, так и из metadata —
 * фронт исторически кладёт их именно в metadata.
 */
export function buildEventRow(p: ServerTrackEventPayload): ShopEventRow | null {
  const eventType = normalizeEventType(p.eventType);
  if (!eventType) return null;

  const meta =
    p.metadata && typeof p.metadata === "object" ? (p.metadata as Record<string, unknown>) : null;

  const productId = posInt(p.productId) ?? posInt(meta?.productId);
  const brandId = posInt(p.brandId) ?? posInt(meta?.brandId);
  const categoryId = posInt(p.categoryId) ?? posInt(meta?.categoryId);
  const orderId = posInt(p.orderId) ?? posInt(meta?.orderId);
  const query = str(p.query, 200) ?? str(meta?.query, 200);

  let createdAt: Date | undefined;
  if (p.occurredAt) {
    const ts = Date.parse(p.occurredAt);
    if (!Number.isNaN(ts)) createdAt = new Date(ts);
  }

  return {
    eventType,
    userId: posInt(p.userId),
    sessionId: str(p.sessionId, 80),
    productId,
    brandId,
    categoryId,
    orderId,
    query,
    pageUrl: str(p.pageUrl, 300),
    source: str(p.source, 50),
    deviceType: str(p.deviceType, 40),
    ...(meta ? { metadata: meta } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
}

/**
 * Записывает одно или несколько событий в БД. Никогда не бросает —
 * аналитика не должна ломать основной флоу (корзина / оплата).
 */
export async function emitServerEvents(
  payload: ServerTrackEventPayload | ServerTrackEventPayload[]
): Promise<boolean> {
  const list = Array.isArray(payload) ? payload : [payload];
  const rows = list
    .map(buildEventRow)
    .filter((r): r is ShopEventRow => r !== null);

  if (rows.length === 0) return false;

  try {
    await prisma.shopEvent.createMany({ data: rows as any });
    return true;
  } catch {
    console.error("[events-server] failed to persist events");
    return false;
  }
}
