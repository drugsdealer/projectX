"use client";

import useSWR, { SWRConfiguration } from "swr";

const jsonFetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed ${res.status}: ${text}`);
  }
  return res.json();
};

// Универсальный хук под любой GET
export function useApi<T = any>(key: string | null, config?: SWRConfiguration<T>) {
  const swr = useSWR<T>(key, key ? jsonFetcher : null, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 10_000,
    ...config,
  });

  return swr;
}