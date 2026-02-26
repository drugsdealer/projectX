"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function CheckoutSuccessPage() {
  const search = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"pending" | "done" | "error">("pending");

  // prevent double submit on rerenders
  const submittedRef = useRef(false);

  // helper: read cookie on client
  function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    // Escape regex special characters in cookie name
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${safe}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  useEffect(() => {
    // guard from double run
    if (submittedRef.current) return;

    const orderIdParam = search.get("orderId");
    const tokenParam = search.get("token");
    // fallback to cookie if token не передан в query
    const tokenFromCookie = getCookie("guest_order_token");

    const orderId = orderIdParam ? Number(orderIdParam) : undefined;
    const token = tokenParam || tokenFromCookie || undefined;

    if (!orderId && !token) {
      console.warn("[checkout/success] neither orderId nor token provided; token cookie:", tokenFromCookie);
      setState("error");
      return;
    }

    submittedRef.current = true;

    (async () => {
      try {
        const payload: any = { };
        if (typeof orderId === "number" && Number.isFinite(orderId)) payload.orderId = orderId;
        if (typeof token === "string" && token) payload.token = token;

        const res = await fetch("/api/order/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("[checkout/success] complete failed:", res.status, text);
          setState("error");
          return;
        }

        try {
          const raw = localStorage.getItem("pendingPurchasedIds");
          const ids = raw ? JSON.parse(raw) : [];
          if (Array.isArray(ids) && ids.length > 0) {
            await fetch("/api/cart", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ ids }),
            });
            window.dispatchEvent(new Event("cart:refresh"));
          }
          localStorage.removeItem("pendingPurchasedIds");
        } catch {}

        setState("done");
        setTimeout(() => router.replace("/user?tab=orders"), 700);
      } catch (err) {
        console.error("[checkout/success] error:", err);
        setState("error");
      }
    })();
  }, [search, router]);

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      {state === "pending" && <p>Завершаем оплату…</p>}
      {state === "done" && <p>Оплата подтверждена! Перенаправляем в «Мои заказы»…</p>}
      {state === "error" && (
        <p>
          Не удалось подтвердить оплату. Открой «Профиль → Мои заказы». Если заказа нет — перезайди и попробуй снова.
        </p>
      )}
    </div>
  );
}
