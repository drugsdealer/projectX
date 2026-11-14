import { productPath } from "@/lib/product-url";

// IndexNow — мгновенное уведомление Яндекса (и Bing) о новых и изменённых страницах.
// Ключ публичный по протоколу: он же лежит файлом в public/f1431efcbaa2ac8949a1c934ba3c25f6.txt.
const INDEXNOW_KEY = "f1431efcbaa2ac8949a1c934ba3c25f6";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export async function pingIndexNow(paths: string[]) {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return;
  const urlList = [...new Set(paths)].map((p) => (p.startsWith("http") ? p : `${SITE_URL}${p}`));
  if (!urlList.length) return;
  const body = JSON.stringify({
    host: new URL(SITE_URL).host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList,
  });
  await Promise.allSettled(
    ["https://yandex.com/indexnow", "https://api.indexnow.org/indexnow"].map((endpoint) =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
        signal: AbortSignal.timeout(5000),
      })
    )
  );
}

export function pingProductIndexNow(product: { id: number; name: string; brandName?: string | null }) {
  return pingIndexNow([productPath({ id: product.id, name: product.name, brandName: product.brandName })]);
}
