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
import MotionBudgetProvider from "@/components/MotionBudgetProvider";

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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
      </head>
      <body
        className={`${nunito.className} min-h-screen bg-white text-black`}
      >
        {/* Общий контейнер, который учитывает safe-area сверху/снизу
            (чтобы “чёлка” / фронтальная камера не съедала контент) */}
        <div className="safe-top safe-bottom bg-white min-h-screen">
          <DiscountProvider>
            <CartProvider>
              <UserProvider>
                <ToastProvider>
                  <TitleProvider>
                    <MotionBudgetProvider>
                      <ClientLayout>
                        <RouteTransitions>{children}</RouteTransitions>
                      </ClientLayout>
                      <ToastContainer />
                    </MotionBudgetProvider>
                  </TitleProvider>
                </ToastProvider>
              </UserProvider>
            </CartProvider>
          </DiscountProvider>
        </div>
      </body>
    </html>
  );
}
