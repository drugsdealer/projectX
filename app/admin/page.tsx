"use client";

import { useEffect, useState } from "react";

type Stats = {
  usersCount: number;
  ordersCount: number;
  totalRevenue: number;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || "Не удалось загрузить статистику");
        }
        setStats(data.stats);
      } catch (e: any) {
        setError(e?.message || "Ошибка загрузки");
      }
    };
    load();
  }, []);

  return (
    <div>
      <h2 className="text-lg font-semibold">Общая статистика</h2>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="text-xs text-black/60">Пользователи</div>
          <div className="mt-2 text-2xl font-bold">{stats?.usersCount ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="text-xs text-black/60">Заказы</div>
          <div className="mt-2 text-2xl font-bold">{stats?.ordersCount ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="text-xs text-black/60">Выручка (успешные)</div>
          <div className="mt-2 text-2xl font-bold">
            {stats ? `${Number(stats.totalRevenue).toLocaleString("ru-RU")} ₽` : "—"}
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-black/50">
        Выручка считается по заказам со статусом оплаты SUCCEEDED.
      </p>
    </div>
  );
}
