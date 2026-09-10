import type { Metadata } from "next";
import ConciergeClient from "./ConciergeClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const metadata: Metadata = {
  title: "Консьерж-сервис",
  description:
    "Личный подбор Stage Store: найдём конкретную вещь, редкий размер или архивную позицию и привезём под вас.",
  alternates: { canonical: `${SITE_URL}/concierge` },
  openGraph: {
    title: "Консьерж-сервис — Stage Store",
    description:
      "Ищете конкретную вещь или размера нет в наличии? Найдём и привезём под вас.",
    url: `${SITE_URL}/concierge`,
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function ConciergePage() {
  return <ConciergeClient />;
}
