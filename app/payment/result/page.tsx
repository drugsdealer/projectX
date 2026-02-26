import { Suspense } from "react";
import PaymentResultClient from "./PaymentResultClient";

export const dynamic = "force-dynamic";

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-600">
          Загрузка…
        </div>
      }
    >
      <PaymentResultClient />
    </Suspense>
  );
}
