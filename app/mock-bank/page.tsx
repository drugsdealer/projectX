import { Suspense } from "react";
import MockBankClient from "./MockBankClient";

export const dynamic = "force-dynamic";

export default function MockBankPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-100 text-sm text-gray-600">
          Загрузка…
        </div>
      }
    >
      <MockBankClient />
    </Suspense>
  );
}
