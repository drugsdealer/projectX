import React from "react";

export default function UserSettings() {
  return (
    <div className="p-4 border rounded shadow">
      <h2 className="text-xl font-semibold mb-2">Настройки</h2>
      <button className="bg-black text-white px-4 py-2 rounded">
        Изменить пароль
      </button>
    </div>
  );
}