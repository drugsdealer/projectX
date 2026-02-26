import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
          Загрузка…
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
