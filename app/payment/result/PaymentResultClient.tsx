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
  const [status, setStatus] = useState<"success" | "failed" | "processing" | null>(null);
  const [checking, setChecking] = useState(false);
  const orderId = search.get("orderId") || "";
  const publicNumber = search.get("publicNumber") || "";
  const isSuccess = status === "success";
  const isFail = status === "failed";
  const isProcessing = status === "processing";

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
      sessionStorage.removeItem("checkoutState");
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
    // Банк вернул покупателя по адресу отказа — это явный отказ, ждать нечего.
    if (search.get("failed") === "1") {
      setStatus("failed");
      return;
    }
    if (status === null) setStatus(null);
  }, [search, status]);

  useEffect(() => {
    if (status !== null) return;
    if (!orderId && !publicNumber) return;
    let alive = true;

    // Подтверждение от банка приходит отдельным запросом и обрабатывается
    // с задержкой в секунду-другую. Одной проверки мало: успевали спросить
    // раньше, чем заказ помечался оплаченным, и показывали ложный отказ.
    const ATTEMPTS = 30;
    const DELAY_MS = 2000;

    const check = async (): Promise<"success" | "pending" | "unknown"> => {
      const qs = new URLSearchParams();
      if (orderId) qs.set("orderId", String(orderId));
      const res = await fetch(`/api/order/history?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      const orders = Array.isArray(data?.orders) ? data.orders : [];
      const match = orders.find((o: any) => {
        if (orderId && String(o.id) === String(orderId)) return true;
        if (publicNumber && String(o.publicNumber) === String(publicNumber)) return true;
        return false;
      });
      if (!match) return "unknown";
      return match.status === "SUCCEEDED" || match.status === "PAID" ? "success" : "pending";
    };

    (async () => {
      setChecking(true);
      try {
        for (let i = 0; i < ATTEMPTS; i++) {
          if (!alive) return;
          let r: "success" | "pending" | "unknown" = "unknown";
          try {
            r = await check();
          } catch {
            // сеть могла моргнуть — просто пробуем ещё раз
          }
          if (!alive) return;
          if (r === "success") {
            setStatus("success");
            return;
          }
          if (i < ATTEMPTS - 1) {
            await new Promise((res) => setTimeout(res, DELAY_MS));
          }
        }
        // Банк не сказал, что отказ, — значит платёж ещё в обработке.
        // Объявлять отказ здесь нельзя: деньги могли уйти.
        if (alive) setStatus("processing");
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

  if (isProcessing) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg rounded-3xl border border-black/10 bg-white p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
          <div className="text-4xl">⏳</div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.03em]">Платёж обрабатывается</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Банк ещё не прислал окончательный ответ. Если деньги списались, заказ
            отметится оплаченным автоматически, а чек придёт на почту.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Повторно платить не нужно.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => router.push("/user?tab=orders")}
              className="rounded-xl bg-black px-5 py-2.5 font-semibold text-white"
            >
              Мои заказы
            </button>
            <Link href="/" className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold">
              На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isSuccess && !isFail) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg rounded-3xl border border-black/10 bg-white p-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-black/15 border-t-black" />
          <h1 className="mt-6 text-xl font-extrabold tracking-[-0.03em]">Проверяем оплату</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Ждём подтверждение от банка. Обычно это занимает несколько секунд —
            пожалуйста, не закрывайте страницу.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="relative w-full max-w-2xl rounded-3xl border border-black/10 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.12)] p-8 text-center overflow-hidden">
        {isSuccess && (
          <div className="pointer-events-none fixed inset-0 z-50">
            {Array.from({ length: 90 }).map((_, i) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 1.2;
              const duration = 1.0 + Math.random() * 1.2;
              const size = 6 + Math.random() * 6;
              const drift = (Math.random() - 0.5) * 120;
              const colors = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7", "#ec4899", "#06b6d4"];
              const color = colors[i % colors.length];
              return (
                <span
                  key={i}
                  className="absolute rounded-sm"
                  style={{
                    left: `${left}%`,
                    top: -20,
                    width: size,
                    height: size * 2,
                    background: color,
                    opacity: 0.9,
                    animation: `confetti-fall ${duration}s cubic-bezier(0.25, 0, 0.7, 1) ${delay}s forwards`,
                    ["--drift" as string]: `${drift}px`,
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
                href="mailto:storestage@yandex.ru"
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold hover:border-black/40 transition"
              >
                storestage@yandex.ru
              </a>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes confetti-fall {
          from {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 1;
          }
          to {
            transform: translateY(100vh) translateX(var(--drift, 0px)) rotate(720deg);
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  );
}
