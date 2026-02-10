import { Suspense } from "react";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
          Загрузка…
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
