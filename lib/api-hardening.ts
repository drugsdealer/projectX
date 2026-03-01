import { NextResponse } from "next/server";
import { enforceSameOrigin } from "@/lib/security";

const NO_STORE = "private, no-store, max-age=0";
const VARY_COOKIE = "Cookie";

export const PRIVATE_NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": NO_STORE,
  Vary: VARY_COOKIE,
});

function ensureVaryCookie(headers: Headers) {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", VARY_COOKIE);
    return;
  }
  const parts = current
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!parts.some((v) => v.toLowerCase() === "cookie")) {
    headers.set("Vary", [...parts, VARY_COOKIE].join(", "));
  }
}

export function buildPrivateHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", NO_STORE);
  ensureVaryCookie(headers);
  return headers;
}

export function applyPrivateHeaders(res: NextResponse): NextResponse {
  if (!res.headers.has("Cache-Control")) {
    res.headers.set("Cache-Control", NO_STORE);
  }
  ensureVaryCookie(res.headers);
  return res;
}

export function privateJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = buildPrivateHeaders(init.headers);
  return NextResponse.json(body, { ...init, headers });
}

export function blockIfCsrf(req: Request): NextResponse | null {
  const blocked = enforceSameOrigin(req);
  if (!blocked) return null;
  return applyPrivateHeaders(blocked);
}

export function requireJsonRequest(req: Request): NextResponse | null {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.toLowerCase().includes("application/json")) return null;
  return privateJson(
    { success: false, message: "Unsupported Media Type" },
    { status: 415 }
  );
}

export function tooManyRequests(retryAfter: number, message = "Too many requests"): NextResponse {
  const headers = buildPrivateHeaders({ "Retry-After": String(Math.max(1, retryAfter || 1)) });
  return NextResponse.json({ success: false, message }, { status: 429, headers });
}

export function methodNotAllowed(allow: string[]): NextResponse {
  const allowHeader = Array.from(new Set(allow)).join(", ");
  return privateJson(
    { success: false, message: "Method Not Allowed" },
    { status: 405, headers: { Allow: allowHeader } }
  );
}
