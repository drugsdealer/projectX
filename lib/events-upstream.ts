type UpstreamQuery = Record<string, string | number | null | undefined>;

export function buildEventsServiceUrl(path: string, query?: UpstreamQuery): URL | null {
  const base = process.env.EVENTS_SERVICE_URL;
  if (!base) {
    return null;
  }

  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export function getEventsServiceApiKey(): string | null {
  return process.env.EVENTS_SERVICE_API_KEY ?? null;
}

type FetchEventsOptions = {
  apiKey: string;
  requestId?: string | null;
  timeoutMs?: number;
  retries?: number;
};

type EventsFetchResult<T = any> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; message: string };

function shouldRetry(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchEventsServiceJson<T = any>(
  url: URL,
  options: FetchEventsOptions
): Promise<EventsFetchResult<T>> {
  const retries = Math.max(0, options.retries ?? 1);
  const timeoutMs = Math.max(500, options.timeoutMs ?? 5500);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Events-Api-Key": options.apiKey,
  };
  if (options.requestId) headers["X-Request-Id"] = options.requestId;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers,
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok) {
        return { ok: true, status: res.status, data: data as T };
      }

      const message = String(data?.message || "Events upstream request failed");
      if (attempt < retries && shouldRetry(res.status)) {
        await delay(180 * (attempt + 1));
        continue;
      }
      return { ok: false, status: res.status || 502, message };
    } catch (e: any) {
      const aborted = e?.name === "AbortError";
      if (attempt < retries) {
        await delay(180 * (attempt + 1));
        continue;
      }
      return {
        ok: false,
        status: aborted ? 504 : 502,
        message: aborted ? "Events service timeout" : "Events analytics service unavailable",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { ok: false, status: 502, message: "Events analytics service unavailable" };
}

export function parseAnalyticsLimit(raw: string | null, fallback = 20): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.round(n)));
}

export function parseIsoRangeDate(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
