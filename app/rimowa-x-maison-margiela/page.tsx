import type { Metadata } from "next";
import RimowaMargielaClient from "./RimowaMargielaClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";
const OG_IMAGE =
  "https://ik.imagekit.io/qowmy92ny/RIMOWAXMAISONMARGIELACOLLABORATION_DESK.mp4/ik-thumbnail.jpg?tr=so-17,w-1200,q-80";

export const metadata: Metadata = {
  title: "RIMOWA × Maison Margiela — предзаказ",
  description:
    "Чемодан RIMOWA Classic Cabin и сумка Maison Margiela 5AC XL в ручной белой росписи бьянкетто. Выход 19 ноября 2026, лимитированный тираж — запишитесь на предзаказ в Stage Store.",
  alternates: { canonical: `${SITE_URL}/rimowa-x-maison-margiela` },
  openGraph: {
    title: "RIMOWA × Maison Margiela — Stage Store",
    description:
      "Classic Cabin и 5AC XL в белом бьянкетто. Выход 19 ноября — открыт предзаказ.",
    url: `${SITE_URL}/rimowa-x-maison-margiela`,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 675, alt: "RIMOWA × Maison Margiela" }],
  },
  robots: { index: true, follow: true },
};

export default function RimowaMargielaPage() {
  return <RimowaMargielaClient />;
}
