import { Suspense } from "react";
import PremiumClient from "./PremiumClient";

export const dynamic = "force-dynamic";

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
          Загрузка…
        </div>
      }
    >
      <PremiumClient />
    </Suspense>
  );
}
