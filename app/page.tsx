import { Suspense } from "react";
import HomeClient from "./HomeClient";

// Revalidate homepage every 60 seconds (ISR) instead of force-dynamic
// This lets Google cache and index the page properly
export const revalidate = 60;

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
