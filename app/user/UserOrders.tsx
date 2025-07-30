import React from "react";

export default function UserOrders() {
  return (
    <div className="p-4 border rounded shadow">
      <h2 className="text-xl font-semibold mb-2">Мои заказы</h2>
      <ul className="list-disc list-inside space-y-1">
        <li>Заказ #123456 — Доставлен</li>
        <li>Заказ #654321 — В пути</li>
      </ul>
    </div>
  );
}