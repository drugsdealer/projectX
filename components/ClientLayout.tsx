

"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { UserProvider } from "@/user/UserContext";
import { CartProvider } from "@/context/CartContext";
import { TitleProvider } from "@/context/TitleContext";
import { DiscountProvider } from "@/context/DiscountContext";
import { ToastProvider } from "@/context/ToastContext";
import { ToastContainer } from "@/components/ui/ToastContainer";
import {Header} from "@/components/shared/header";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hideHeaderFooter =
    pathname.startsWith("/register") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/profile");

  return (
    <UserProvider>
      <CartProvider>
        <TitleProvider>
          <DiscountProvider>
            <ToastProvider>
              {!hideHeaderFooter && <Header />}
              <main className="min-h-screen">{children}</main>
              <ToastContainer />
            </ToastProvider>
          </DiscountProvider>
        </TitleProvider>
      </CartProvider>
    </UserProvider>
  );
}