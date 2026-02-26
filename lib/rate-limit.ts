type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();
const MAX_ENTRIES = 10_000;

function cleanup(now: number) {
  if (store.size < MAX_ENTRIES) return;
  store.forEach((v, k) => {
    if (v.resetAt <= now) store.delete(k);
  });
}

type RateResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
};

let upstashReady: boolean | null = null;
let upstashRedis: any = null;
const limiterCache = new Map<string, any>();

async function getUpstash() {
  if (upstashReady === false) return null;
  if (upstashRedis) return upstashRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    upstashReady = false;
    return null;
  }
  try {
    const { Redis } = await import("@upstash/redis");
    upstashRedis = new Redis({ url, token });
    upstashReady = true;
    return upstashRedis;
  } catch {
    upstashReady = false;
    return null;
  }
}

export function getClientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  const redis = await getUpstash();
  if (redis) {
    const cacheKey = `${limit}:${windowMs}`;
    let rl = limiterCache.get(cacheKey);
    if (!rl) {
      const { Ratelimit } = await import("@upstash/ratelimit");
      rl = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.round(windowMs / 1000))} s`),
      });
      limiterCache.set(cacheKey, rl);
    }
    const result = await rl.limit(key);
    const resetAt = typeof result.reset === "number" ? result.reset : Date.now() + windowMs;
    const retryAfter = result.success ? 0 : Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    return {
      ok: result.success,
      remaining: result.remaining ?? Math.max(0, limit - (result?.limit ?? limit)),
      resetAt,
      retryAfter,
    };
  }

  const now = Date.now();
  cleanup(now);

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, retryAfter: 0 };
  }

  entry.count += 1;
  const ok = entry.count <= limit;
  const retryAfter = ok ? 0 : Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    ok,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
    retryAfter,
  };
}
