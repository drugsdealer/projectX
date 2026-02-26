"use client";

import { useEffect, useState } from "react";

type OrderRow = {
  id: number;
  publicNumber: string | null;
  totalAmount: number;
  status: string;
  shippingStatus: string;
  createdAt: string;
  handedAt?: string | null;
  fullName: string;
  email: string;
  phone: string;
  address: string;
};

const SHIPPING_LABELS: Record<string, string> = {
  PROCESSING: "Обработка заказа",
  ABROAD: "Товар за границей",
  IN_RUSSIA: "Товар в России",
  ARRIVED: "Заказ приехал",
};

const SHIPPING_OPTIONS = Object.keys(SHIPPING_LABELS);

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.message || "Ошибка");
      setOrders(data.orders || []);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: number, shippingStatus: string) => {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, shippingStatus }),
    });
    if (res.ok) load();
  };

  const markHanded = async (id: number) => {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "handed" }),
    });
    if (res.ok) load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Заказы</h2>
        <button
          onClick={load}
          className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black hover:text-white transition"
        >
          Обновить
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {loading ? (
        <div className="mt-4 text-sm text-black/60">Загрузка…</div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-black/60">
              <tr>
                <th className="py-2">№</th>
                <th className="py-2">Клиент</th>
                <th className="py-2">Сумма</th>
                <th className="py-2">Оплата</th>
                <th className="py-2">Доставка</th>
                <th className="py-2">Дата</th>
                <th className="py-2">Отдача</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-black/5">
                  <td className="py-2">{o.publicNumber || o.id}</td>
                  <td className="py-2">
                    <div className="font-semibold">{o.fullName}</div>
                    <div className="text-xs text-black/50">{o.email}</div>
                  </td>
                  <td className="py-2">{Number(o.totalAmount).toLocaleString("ru-RU")} ₽</td>
                  <td className="py-2">{o.status}</td>
                  <td className="py-2">
                    <select
                      value={o.shippingStatus}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      className="rounded-lg border border-black/10 px-2 py-1 text-xs"
                    >
                      {SHIPPING_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {SHIPPING_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">{new Date(o.createdAt).toLocaleDateString("ru-RU")}</td>
                  <td className="py-2">
                    {o.handedAt ? (
                      <div className="text-xs text-emerald-700">
                        Отдан {new Date(o.handedAt).toLocaleString("ru-RU")}
                      </div>
                    ) : o.shippingStatus === "ARRIVED" ? (
                      <button
                        onClick={() => markHanded(o.id)}
                        className="rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black hover:text-white transition"
                      >
                        Отдал
                      </button>
                    ) : (
                      <span className="text-xs text-black/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
