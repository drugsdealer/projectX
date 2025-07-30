import React, { useState } from "react";
import { useUser } from "@/user/UserContext";

export default function UserInfo() {
  const { user } = useUser();
  const [showDetails, setShowDetails] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!user) {
    return (
      <div className="p-4 border rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Информация о пользователе</h2>
        <p>Пользователь не авторизован.</p>
      </div>
    );
  }

  const handleRequestCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setShowPasswordPrompt(true);
    setTimeout(() => {
      setShowPasswordPrompt(false);
      setCodeInput("");
    }, 5 * 60 * 1000); // 5 минут
    console.log("Код подтверждения:", code);
  };

  const handleConfirmCode = () => {
    if (codeInput === generatedCode) {
      setCodeVerified(true);
      setShowPassword(true);
    } else {
      alert("Неверный код");
    }
  };

  return (
    <div className="p-4 border rounded shadow relative">
      <h2 className="text-xl font-semibold mb-2 flex justify-between items-center">
        Имя профиля: {user.name || "Не указано"}
        <button
          onClick={() => setShowDetails(true)}
          className="text-sm text-blue-600 underline"
        >
          Подробнее
        </button>
      </h2>

      {user.email && <p>Email: {user.email}</p>}
      {user.phone && <p>Телефон: {user.phone}</p>}
      
      <div className="flex items-center gap-4 mt-2">
        <p>
          Пароль:{" "}
          {showPassword ? user.password : "Скрыт"}
        </p>
        {!showPassword && (
          <button
            onClick={handleRequestCode}
            className="text-sm text-blue-600 underline"
          >
            Посмотреть
          </button>
        )}
      </div>

      {showPasswordPrompt && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-gray-700">Введите код, высланный на {user.email ? "email" : "телефон"}:</p>
          <input
            type="text"
            maxLength={6}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className="p-2 border rounded w-full"
          />
          <button
            onClick={handleConfirmCode}
            className="mt-1 px-3 py-1 bg-black text-white rounded text-sm"
          >
            Подтвердить код
          </button>
        </div>
      )}

      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white p-6 rounded shadow max-w-md w-full relative">
            <button
              onClick={() => setShowDetails(false)}
              className="absolute top-2 right-3 text-xl text-gray-500 hover:text-black"
            >
              ×
            </button>
            <h3 className="text-lg font-bold mb-4 text-center">Подробная информация</h3>
            <div className="space-y-2 text-sm text-gray-800">
              <p>ФИО: {user.name || "Не указано"}</p>
              <p>Телефон: {user.phone || "Не указан"}</p>
              <p>Email: {user.email || "Не указан"}</p>
              <p>Адрес: {user.address || "Не указан"}</p>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="mt-4 w-full py-2 bg-black text-white rounded"
            >
              Подтвердить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}