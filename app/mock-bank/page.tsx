"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MockBankPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    const res = await fetch("/api/confirm-payment", {
      method: "POST"
    });

    const data = await res.json();
    setLoading(false);
    if (data.success) {
      router.push("/cart?status=success");
    } else {
      router.push("/cart?status=failed");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-4">Демо страница оплаты</h1>
      <p className="mb-6 text-gray-700">Это симуляция банка. Нажмите кнопку, чтобы "оплатить".</p>
      <button
        onClick={handlePay}
        disabled={loading}
        className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition"
      >
        {loading ? "Оплата..." : "Оплатить"}
      </button>
    </div>
  );
}