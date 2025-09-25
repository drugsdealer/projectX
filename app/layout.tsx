"use client";

import { Nunito } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/shared/header";
import { TitleProvider } from "@/context/TitleContext";
import { CartProvider } from "@/context/CartContext";
import { DiscountProvider } from "@/context/DiscountContext";
import { ToastProvider } from '@/context/ToastContext';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { UserProvider } from "@/user/UserContext";
import ClientLayout from "@/components/ClientLayout";
import RouteTransitions from "@/components/RouteTransitions";

const nunito = Nunito({ 
  subsets: ['cyrillic'],
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body className={nunito.className}>
        <CartProvider>
          <UserProvider>
            <ToastProvider>
              <TitleProvider>
                <DiscountProvider>
                  <ClientLayout>
                    <RouteTransitions>{children}</RouteTransitions>
                  </ClientLayout>
                  <ToastContainer />
                </DiscountProvider>
              </TitleProvider>
            </ToastProvider>
          </UserProvider>
        </CartProvider>
      </body>
    </html>
  );
}