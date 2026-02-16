import { Suspense } from "react";
import UserClient from "./UserClient";

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
      <UserClient />
    </Suspense>
  );
}
