import type { Metadata } from "next";
import { Suspense } from "react";
import PayClient from "./PayClient";

export const metadata: Metadata = {
  title: "Оплата заказа",
  robots: { index: false, follow: false },
};

export default function PayPage() {
  return (
    <Suspense fallback={null}>
      <PayClient />
    </Suspense>
  );
}
