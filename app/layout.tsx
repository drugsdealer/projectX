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
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.ru";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Stage Store — Брендовая одежда и аксессуары",
    template: "%s | Stage Store",
  },
  description:
    "Интернет-магазин оригинальной брендовой одежды, обуви и аксессуаров. Доставка по Москве и России. Гарантия подлинности.",
  keywords: [
    "брендовая одежда",
    "оригинальная одежда",
    "интернет-магазин одежды",
    "Stage Store",
    "купить брендовую одежду",
    "обувь",
    "аксессуары",
    "доставка по Москве",
  ],
  authors: [{ name: "Stage Store" }],
  creator: "Stage Store",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: SITE_URL,
    siteName: "Stage Store",
    title: "Stage Store — Брендовая одежда и аксессуары",
    description:
      "Интернет-магазин оригинальной брендовой одежды, обуви и аксессуаров. Гарантия подлинности.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stage Store — Брендовая одежда и аксессуары",
    description:
      "Интернет-магазин оригинальной брендовой одежды, обуви и аксессуаров.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

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
    <html lang="ru" suppressHydrationWarning>
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
