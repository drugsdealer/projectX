import { Nunito } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
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
import YandexMetrika from "@/components/YandexMetrika";
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Stage Store — брендовая одежда, обувь, Premium и Sale",
    template: "%s | Stage Store",
  },
  description:
    "Интернет-магазин оригинальной брендовой одежды, обуви, сумок, аксессуаров и парфюма. Premium коллекция, Sale, доставка по России.",
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
  icons: {
    icon: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008466/IMG_0363_iaalz9.png",
    apple: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008466/IMG_0363_iaalz9.png",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: SITE_URL,
    siteName: "Stage Store",
    title: "Stage Store — брендовая одежда, обувь, Premium и Sale",
    description:
      "Оригинальная брендовая одежда, обувь и аксессуары. Premium коллекция, Sale и доставка по России.",
    images: [
      {
        url: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008429/IMG_0364_xcrp0m.jpg",
        width: 1200,
        height: 630,
        alt: "Stage Store — Брендовая одежда и аксессуары",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stage Store — брендовая одежда, обувь, Premium и Sale",
    description:
      "Оригинальная брендовая одежда, обувь, аксессуары, Premium коллекция и Sale.",
    images: ["https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008429/IMG_0364_xcrp0m.jpg"],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": ["Organization", "Store"],
                  "@id": `${SITE_URL}/#organization`,
                  name: "Stage Store",
                  url: SITE_URL,
                  logo: {
                    "@type": "ImageObject",
                    "@id": `${SITE_URL}/#logo`,
                    url: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008466/IMG_0363_iaalz9.png",
                    width: 512,
                    height: 512,
                    caption: "Stage Store",
                  },
                  image: {
                    "@type": "ImageObject",
                    url: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1774008429/IMG_0364_xcrp0m.jpg",
                    width: 1200,
                    height: 630,
                  },
                  description:
                    "Интернет-магазин оригинальной брендовой одежды, обуви, аксессуаров и парфюмерии. Кроссовки, куртки, сумки, аксессуары от мировых брендов. Доставка по Москве и России. Гарантия подлинности.",
                  areaServed: {
                    "@type": "Country",
                    name: "Russia",
                  },
                  priceRange: "₽₽-₽₽₽",
                  currenciesAccepted: "RUB",
                  paymentAccepted: "Банковская карта, SBP",
                  sameAs: [
                    "https://t.me/stagestore",
                  ],
                  contactPoint: {
                    "@type": "ContactPoint",
                    contactType: "customer support",
                    url: `${SITE_URL}/footer`,
                    availableLanguage: [{ "@type": "Language", name: "Russian" }],
                  },
                  hasOfferCatalog: {
                    "@type": "OfferCatalog",
                    name: "Каталог Stage Store",
                    itemListElement: [
                      { "@type": "OfferCatalog", name: "Обувь", url: `${SITE_URL}/category/footwear` },
                      { "@type": "OfferCatalog", name: "Одежда", url: `${SITE_URL}/category/clothes` },
                      { "@type": "OfferCatalog", name: "Сумки", url: `${SITE_URL}/category/bags` },
                      { "@type": "OfferCatalog", name: "Аксессуары", url: `${SITE_URL}/category/accessories` },
                      { "@type": "OfferCatalog", name: "Парфюмерия", url: `${SITE_URL}/category/fragrance` },
                      { "@type": "OfferCatalog", name: "Головные уборы", url: `${SITE_URL}/category/headwear` },
                      { "@type": "OfferCatalog", name: "Premium коллекция", url: `${SITE_URL}/premium` },
                    ],
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: "Stage Store",
                  alternateName: "Stage Store — брендовая одежда, обувь, Premium и Sale",
                  publisher: { "@id": `${SITE_URL}/#organization` },
                  inLanguage: "ru-RU",
                },
                {
                  "@type": "SiteNavigationElement",
                  "@id": `${SITE_URL}/#navigation`,
                  name: "Основная навигация Stage Store",
                  url: SITE_URL,
                  hasPart: [
                    {
                      "@type": "SiteNavigationElement",
                      "@id": `${SITE_URL}/premium#nav`,
                      position: 1,
                      name: "Premium",
                      description: "Премиальная коллекция и редкие позиции",
                      url: `${SITE_URL}/premium`,
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "@id": `${SITE_URL}/sale#nav`,
                      position: 2,
                      name: "Sale",
                      description: "Скидки на брендовую одежду, обувь и аксессуары",
                      url: `${SITE_URL}/sale`,
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "@id": `${SITE_URL}/category/footwear#nav`,
                      position: 3,
                      name: "Обувь",
                      description: "Кроссовки, ботинки, лоферы и другая обувь",
                      url: `${SITE_URL}/category/footwear`,
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "@id": `${SITE_URL}/category/clothes#nav`,
                      position: 4,
                      name: "Одежда",
                      description: "Худи, футболки, куртки, брюки и другая одежда",
                      url: `${SITE_URL}/category/clothes`,
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "@id": `${SITE_URL}/category/bags#nav`,
                      position: 5,
                      name: "Сумки",
                      description: "Сумки, рюкзаки, поясные сумки",
                      url: `${SITE_URL}/category/bags`,
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "@id": `${SITE_URL}/category/accessories#nav`,
                      position: 6,
                      name: "Аксессуары",
                      description: "Очки, ремни, украшения и аксессуары",
                      url: `${SITE_URL}/category/accessories`,
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "@id": `${SITE_URL}/category/fragrance#nav`,
                      position: 7,
                      name: "Парфюмерия",
                      description: "Духи и парфюм от мировых брендов",
                      url: `${SITE_URL}/category/fragrance`,
                    },
                    {
                      "@type": "SiteNavigationElement",
                      "@id": `${SITE_URL}/category/headwear#nav`,
                      position: 8,
                      name: "Головные уборы",
                      description: "Кепки, шапки, панамы",
                      url: `${SITE_URL}/category/headwear`,
                    },
                  ],
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${nunito.className} min-h-screen bg-white text-black`}
      >
        <Suspense fallback={null}>
          <YandexMetrika />
        </Suspense>
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
