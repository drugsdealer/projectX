"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

function formatOrderNumber(val: string | number | null | undefined) {
  if (val == null) return "STG-000000";
  const n = String(val).replace(/\D/g, "");
  const padded = n.padStart(6, "0").slice(-6);
  return `STG-${padded}`;
}

export default function PaymentResultClient() {
  const search = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"success" | "failed" | null>(null);
  const [checking, setChecking] = useState(false);
  const orderId = search.get("orderId") || "";
  const publicNumber = search.get("publicNumber") || "";
  const isSuccess = status === "success";
  const isFail = status === "failed";

  const orderLabel = useMemo(() => {
    if (publicNumber) return publicNumber;
    return formatOrderNumber(orderId || null);
  }, [publicNumber, orderId]);

  useEffect(() => {
    if (!isSuccess) return;
    try {
      const raw = localStorage.getItem("pendingPurchasedIds");
      if (raw) localStorage.removeItem("pendingPurchasedIds");
      localStorage.removeItem("pendingPurchasedScope");
      localStorage.removeItem("checkoutState");
    } catch {}
    try {
      window.dispatchEvent(new Event("cart:refresh"));
    } catch {}
  }, [isSuccess]);

  useEffect(() => {
    const q = search.get("status");
    if (q === "success" || q === "failed") {
      setStatus(q);
      return;
    }
    if (status === null) setStatus(null);
  }, [search, status]);

  useEffect(() => {
    if (status !== null) return;
    if (!orderId && !publicNumber) return;
    let alive = true;
    (async () => {
      try {
        setChecking(true);
        const qs = new URLSearchParams();
        if (orderId) qs.set("orderId", String(orderId));
        const res = await fetch(`/api/order/history?${qs.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        const orders = Array.isArray(data?.orders) ? data.orders : [];
        const match = orders.find((o: any) => {
          if (orderId && String(o.id) === String(orderId)) return true;
          if (publicNumber && String(o.publicNumber) === String(publicNumber)) return true;
          return false;
        });
        if (match && (match.status === "SUCCEEDED" || match.status === "PAID")) {
          setStatus("success");
        } else if (match) {
          setStatus("failed");
        }
      } catch {
        // ignore
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, orderId, publicNumber]);

  useEffect(() => {
    if (!isSuccess && !isFail) return;
    const t = setTimeout(() => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("status");
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [isSuccess, isFail]);

  if (!isSuccess && !isFail) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold mb-3">Результат оплаты</h1>
        <p className="text-gray-600">
          {checking
            ? "Проверяем оплату…"
            : "Статус не найден. Вернитесь в корзину и попробуйте снова."}
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/cart" className="px-4 py-2 rounded-xl bg-black text-white">
            В корзину
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="relative w-full max-w-2xl rounded-3xl border border-black/10 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.12)] p-8 text-center overflow-hidden">
        {isSuccess && (
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: 90 }).map((_, i) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 1.4;
              const duration = 2.3 + Math.random() * 2.2;
              const size = 6 + Math.random() * 6;
              const colors = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7"];
              const color = colors[i % colors.length];
              return (
                <span
                  key={i}
                  className="absolute rounded-sm"
                  style={{
                    left: `${left}%`,
                    width: size,
                    height: size * 2,
                    background: color,
                    opacity: 0.9,
                    animation: `confetti-fall ${duration}s linear ${delay}s forwards`,
                  }}
                />
              );
            })}
          </div>
        )}

        <div className="relative z-10 space-y-3">
          <div className="text-5xl">{isSuccess ? "✨" : "❌"}</div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {isSuccess ? "Оплата прошла успешно" : "Оплата не прошла"}
          </h1>
          <p className="text-gray-600">
            {isSuccess
              ? "Спасибо за покупку! Ваш заказ уже в обработке."
              : "Платёж был отклонён. Вы можете повторить оплату позже."}
          </p>
          {isSuccess && (
            <div className="text-lg font-semibold">
              Номер заказа: <span className="font-extrabold">{orderLabel}</span>
            </div>
          )}
        </div>

        <div className="relative z-10 mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          {isSuccess ? (
            <>
              <button
                onClick={() => router.push("/user?tab=orders")}
                className="px-5 py-2.5 rounded-xl bg-black text-white font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition"
              >
                Перейти к заказам
              </button>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold hover:border-black/40 transition"
              >
                На главную
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/cart"
                className="px-5 py-2.5 rounded-xl bg-black text-white font-semibold shadow-lg shadow-black/20 hover:-translate-y-0.5 transition"
              >
                Вернуться в корзину
              </Link>
              <a
                href="mailto:support@stagestore.ru"
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold hover:border-black/40 transition"
              >
                support@stagestore.ru
              </a>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes confetti-fall {
          from {
            transform: translateY(-10%) rotate(0deg);
          }
          to {
            transform: translateY(120%) rotate(220deg);
          }
        }
      `}</style>
    </div>
  );
}
