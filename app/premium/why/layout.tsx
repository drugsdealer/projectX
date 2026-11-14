import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

// Страница — клиентский компонент, поэтому заголовок и canonical задаём здесь,
// иначе она наследует canonical главной и выпадает из индекса как дубль.
export const metadata: Metadata = {
  title: "Почему Stage Premium — редкие вещи и лимитированные коллекции",
  description:
    "Stage Premium: эксклюзивные материалы, лимитированные выпуски и редкие позиции мировых брендов. Оригинал с проверкой подлинности и доставкой по России.",
  alternates: { canonical: `${SITE_URL}/premium/why` },
  openGraph: {
    title: "Почему Stage Premium — Stage Store",
    url: `${SITE_URL}/premium/why`,
    type: "website",
  },
};

export default function PremiumWhyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
