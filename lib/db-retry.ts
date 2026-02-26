// lib/db-retry.ts
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = String(e?.message || '');
      // 57P01 admin_shutdown, плюс общие сетевые/пулинговые
      if (
        i === retries ||
        !/57P01|P1001|P1008|terminating connection|connection|timeout/i.test(msg)
      ) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  // сюда не дойдём
  throw new Error('DB retry exhausted');
}