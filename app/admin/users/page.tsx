"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: number;
  email: string;
  fullName: string;
  role: string;
  verified: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.message || "Ошибка");
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const removeUser = async (id: number) => {
    if (!confirm("Удалить пользователя?")) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const impersonate = async (id: number) => {
    if (!confirm("Войти в аккаунт пользователя?")) return;
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    if (res.ok) {
      window.location.href = "/user";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Пользователи</h2>
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
                <th className="py-2">ID</th>
                <th className="py-2">Email</th>
                <th className="py-2">Имя</th>
                <th className="py-2">Роль</th>
                <th className="py-2">Создан</th>
                <th className="py-2">Статус</th>
                <th className="py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-black/5">
                  <td className="py-2">{u.id}</td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">{u.fullName || "—"}</td>
                  <td className="py-2">{u.role}</td>
                  <td className="py-2">{new Date(u.createdAt).toLocaleDateString("ru-RU")}</td>
                  <td className="py-2">
                    {u.deletedAt ? "Удалён" : u.verified ? "Подтверждён" : "Не подтверждён"}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="mr-2 rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black hover:text-white transition"
                      onClick={() => impersonate(u.id)}
                    >
                      Войти
                    </button>
                    <button
                      className="rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black hover:text-white transition"
                      onClick={() => removeUser(u.id)}
                      disabled={u.deletedAt !== null}
                    >
                      Удалить
                    </button>
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
