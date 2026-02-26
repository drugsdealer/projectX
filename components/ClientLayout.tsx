"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/shared/header";
import { SiteFooter } from "@/components/shared/site-footer";
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
  const [isOnline, setIsOnline] = React.useState(true);
  const [netError, setNetError] = React.useState<string | null>(null);

  const hideHeaderFooter =
    pathname.startsWith("/register") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/profile");

  const hideFooter =
    pathname.startsWith("/register") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/user") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/footer");

  // Prefetch key pages and bootstrap data to speed up navigation
  React.useEffect(() => {
    router.prefetch("/cart");
    router.prefetch("/favorites_item");
    router.prefetch("/user");
    fetch("/api/bootstrap", { cache: "no-store" }).catch(() => {});
  }, [router]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let t: any = null;
    const raise = (msg: string) => {
      setNetError(msg);
      if (t) clearTimeout(t);
      t = setTimeout(() => setNetError(null), 6000);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String(e?.reason?.message || e?.reason || "");
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        raise("Проблемы с сетью. Попробуйте обновить страницу.");
      }
    };
    const onError = (e: ErrorEvent) => {
      const msg = String(e?.message || "");
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        raise("Проблемы с сетью. Попробуйте обновить страницу.");
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
      if (t) clearTimeout(t);
    };
  }, []);

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
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 10_000,
        keepPreviousData: true,
      }}
    >
      <div className="min-h-screen flex flex-col">
        {(!isOnline || netError) && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] px-4 sm:px-5 py-2 rounded-full bg-black text-white text-xs sm:text-sm shadow-lg">
            {!isOnline
              ? "Вы офлайн. Некоторые функции могут быть недоступны."
              : netError}
          </div>
        )}
        {!hideHeaderFooter && <Header />}
        <main className="flex-1">{children}</main>
        {!hideFooter && <SiteFooter />}
      </div>
    </SWRConfig>
  );
}
