"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// ---- helpers ---------------------------------------------------------------
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\/+^\-])/g, "\\$1") + "=([^;]*)"
    )
  );
  return m ? decodeURIComponent(m[1]) : null;
}

function writeClientCookie(name: string, value: string, maxAgeSec = 1800) {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; samesite=lax`;
}

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanToken(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

const COOKIE_KEYS_ID = [
  "pending_order_id",
  "order_id",
  "last_order_id",
  "orderId",
  "oid",
];
const COOKIE_KEYS_TOKEN = ["order_token", "orderToken", "otk"];

export default function MockBankClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [rawId, setRawId] = useState<string | null>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);

  // Extract orderId/token reliably: URL -> sessionStorage -> cookies
  useEffect(() => {
    const fromUrlId = search.get("orderId") || search.get("oid") || search.get("x-order-id");
    const fromUrlToken = search.get("token") || search.get("otk") || search.get("x-order-token");

    if (fromUrlId) {
      setRawId(fromUrlId);
      try {
        sessionStorage.setItem("pending_order_id", String(fromUrlId));
        sessionStorage.setItem("last_order_id", String(fromUrlId));
      } catch {}
      // write into all known cookie names so server-side pickers surely see it
      for (const key of COOKIE_KEYS_ID) writeClientCookie(key, String(fromUrlId));
    }

    if (fromUrlToken) {
      setRawToken(fromUrlToken);
      try {
        sessionStorage.setItem("order_token", String(fromUrlToken));
      } catch {}
      for (const key of COOKIE_KEYS_TOKEN) writeClientCookie(key, String(fromUrlToken));
    }

    if (!fromUrlId) {
      // try sessionStorage fallback
      try {
        const s =
          sessionStorage.getItem("pending_order_id") ||
          sessionStorage.getItem("last_order_id") ||
          sessionStorage.getItem("orderId") ||
          null;
        if (s) setRawId(s);
      } catch {}
      // try cookies fallback
      if (!fromUrlId) {
        for (const key of COOKIE_KEYS_ID) {
          const val = readCookie(key);
          if (val) {
            setRawId(val);
            break;
          }
        }
      }
    }

    if (!fromUrlToken) {
      // try sessionStorage
      try {
        const st = sessionStorage.getItem("order_token") || sessionStorage.getItem("orderToken");
        if (st) setRawToken(st);
      } catch {}
      // try cookies
      if (!fromUrlToken) {
        for (const key of COOKIE_KEYS_TOKEN) {
          const val = readCookie(key);
          if (val) {
            setRawToken(val);
            break;
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const finalOrderId = useMemo(() => toInt(rawId), [rawId]);
  const finalToken = useMemo(() => cleanToken(rawToken), [rawToken]);

  const handlePay = async () => {
    setLoading(true);
    try {
      if (!finalOrderId && !finalToken) {
        alert("Не удалось определить заказ. Вернитесь в корзину и начните оформление заново.");
        setLoading(false);
        return;
      }

      // Duplicate into client cookies so server also sees them if it relies on cookies
      if (finalOrderId) for (const key of COOKIE_KEYS_ID) writeClientCookie(key, String(finalOrderId));
      if (finalToken) for (const key of COOKIE_KEYS_TOKEN) writeClientCookie(key, finalToken);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (finalOrderId) headers["x-order-id"] = String(finalOrderId);
      if (finalToken) headers["x-order-token"] = finalToken;

      const body: any = {};
      if (finalOrderId) body.orderId = finalOrderId;
      if (finalToken) body.token = finalToken;

      const qs = new URLSearchParams();
      if (finalOrderId) qs.set("orderId", String(finalOrderId));
      if (finalToken) qs.set("token", finalToken);
      const endpoint = "/api/confirm-payment" + (qs.toString() ? `?${qs.toString()}` : "");

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false, message: text };
      }

      console.log("[mock-bank] confirm-payment:", {
        status: res.status,
        ok: res.ok,
        orderId: finalOrderId,
        token: !!finalToken,
        data,
      });

      const confirmedOrderId =
        (data && (data.orderId || data.id)) ||
        finalOrderId;
      const publicNumber = data?.publicNumber || null;

      if (res.ok && data && data.success) {
        const qs = new URLSearchParams();
        qs.set("status", "success");
        if (confirmedOrderId) qs.set("orderId", String(confirmedOrderId));
        if (publicNumber) qs.set("publicNumber", String(publicNumber));
        router.replace(`/payment/result?${qs.toString()}`);
      } else {
        const qs = new URLSearchParams();
        qs.set("status", "failed");
        if (confirmedOrderId) qs.set("orderId", String(confirmedOrderId));
        router.replace(`/payment/result?${qs.toString()}`);
      }
    } catch (e) {
      console.warn("[mock-bank] network error", e);
      router.replace("/payment/result?status=failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-2">Демо страница оплаты</h1>
      <p className="mb-6 text-gray-700">
        Заказ № {finalOrderId ?? "—"}. Это симуляция банка. Нажмите кнопку, чтобы «оплатить».
      </p>
      <button
        onClick={handlePay}
        disabled={loading}
        className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition"
      >
        {loading ? "Оплата..." : "Оплатить"}
      </button>

      {/* Небольшая отладочная панель */}
      <div className="mt-6 text-xs text-gray-500">
        <div>rawId: {String(rawId)}</div>
        <div>rawToken: {rawToken ? "yes" : "no"}</div>
        <div>finalOrderId: {String(finalOrderId)}</div>
        <div className="opacity-70 mt-1">
          cookies: {COOKIE_KEYS_ID.map(k => `${k}=` + (typeof document !== 'undefined' ? (readCookie(k) ?? '-') : '-')).join(' | ')}
        </div>
      </div>
    </div>
  );
}
