"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/shared/header";
import { SWRConfig } from "swr";

const swrFetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return res.json();
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const hideHeaderFooter =
    pathname.startsWith("/register") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/profile");

  // Prefetch key pages and bootstrap data to speed up navigation
  React.useEffect(() => {
    router.prefetch("/cart");
    router.prefetch("/favorites_item");
    router.prefetch("/user");
    fetch("/api/bootstrap", { cache: "no-store" }).catch(() => {});
  }, [router]);

  // Слежение за сменой пользователя: при смене userId чистим локальные данные (избранное, скидки, корзину)
  React.useEffect(() => {
    let cancelled = false;
    const syncUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const uid = data?.user?.id ?? data?.id ?? null;
        const key = "lastUserId";
        const prev = typeof window !== "undefined" ? localStorage.getItem(key) : null;
        if (uid && String(uid) !== prev) {
          // другой пользователь — чистим локальные кэши
          try {
            localStorage.removeItem("favoriteProducts");
            localStorage.removeItem("favoriteBrands");
            localStorage.removeItem("fav_brands");
            localStorage.removeItem("discount");
            localStorage.removeItem("cart_token");
          } catch {}
        }
        if (uid) {
          localStorage.setItem(key, String(uid));
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        // ignore
      }
    };
    syncUser();
    const onAuthChanged = () => syncUser();
    try {
      window.addEventListener("auth:changed", onAuthChanged);
    } catch {}
    return () => {
      if (!cancelled) cancelled = true;
      try {
        window.removeEventListener("auth:changed", onAuthChanged);
      } catch {}
    };
  }, []);

  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 10_000,
        keepPreviousData: true,
      }}
    >
      {!hideHeaderFooter && <Header />}
      <main className="min-h-screen">{children}</main>
    </SWRConfig>
  );
}
