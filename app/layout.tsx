import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/shared/header";
import { TitleProvider } from "@/context/TitleContext"; // Импортируем провайдер

const nunito = Nunito({ 
  subsets: ['cyrillic'],
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: "Stage sneakers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={nunito.className}>
        <TitleProvider> {/* Оборачиваем в контекст заголовка */}
          <main className="min-h-screen">
            <link rel="icon" href="/favicon.ico" sizes="any" />
            <Header/>
            {children}
          </main>
        </TitleProvider>
      </body>
    </html>
  );
}
