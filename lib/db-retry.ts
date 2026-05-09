// lib/db-retry.ts
type DbRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  label?: string;
};

export function isTransientDbError(error: unknown): boolean {
  const msg = String((error as any)?.message || "");
  const code = String((error as any)?.code || "");

  return /57P01|57P02|57P03|08000|08003|08006|P1001|P1002|P1008|P1017/i.test(code)
    || /server has closed the connection|terminating connection|connection.*closed|connection.*terminated|connection.*reset|connection.*timeout|can't reach database|pool timeout|timed out|timeout|econnreset|etimedout/i.test(msg);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label?: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const suffix = label ? ` for ${label}` : "";
      reject(new Error(`DB query timeout${suffix} after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  optionsOrRetries: DbRetryOptions | number = {}
) {
  const options: DbRetryOptions =
    typeof optionsOrRetries === "number" ? { retries: optionsOrRetries } : optionsOrRetries;
  const retries = Math.max(0, options.retries ?? 2);
  const baseDelayMs = Math.max(50, options.baseDelayMs ?? 250);

  for (let i = 0; i <= retries; i++) {
    try {
      return await withTimeout(fn(), options.timeoutMs ?? 0, options.label);
    } catch (e) {
      if (i === retries || !isTransientDbError(e)) {
        throw e;
      }

      // Small jitter prevents many ISR/SSG pages from reconnecting at the same moment.
      const jitter = Math.floor(Math.random() * 80);
      await sleep(baseDelayMs * (i + 1) + jitter);
    }
  }

  throw new Error('DB retry exhausted');
}
