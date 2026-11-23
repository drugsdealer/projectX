import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { productPath } from "@/lib/product-url";
import { GIVEAWAY, isGiveawayActive } from "@/lib/promo-giveaway";
import GiveawayClient, { type GiveawayScent } from "./GiveawayClient";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";
const TITLE = "Розыгрыш: шапка MM6 и аромат Maison Margiela Replica";
const DESCRIPTION = `Разыгрываем шапку MM6 Maison Margiela и аромат Replica на выбор. Участие — в Telegram-канале ${GIVEAWAY.channel}, итоги ${GIVEAWAY.resultsDate}.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${GIVEAWAY.path}` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}${GIVEAWAY.path}`,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: `${SITE_URL}/promo/giveaway/og.jpg`, width: 1200, height: 630, alt: "Розыгрыш Stage Store", type: "image/jpeg" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${SITE_URL}/promo/giveaway/og.jpg`] },
  robots: { index: true, follow: true },
};

// Ароматы Replica из каталога — из них победитель второго места выбирает свой.
async function loadScents(): Promise<GiveawayScent[]> {
  const rows = await withDbRetry(
    () =>
      prisma.product.findMany({
        where: {
          deletedAt: null,
          available: true,
          name: { contains: "replica", mode: "insensitive" },
          Category: { slug: "fragrance" },
        },
        orderBy: [{ popularity: "desc" }, { id: "asc" }],
        take: 12,
        select: { id: true, name: true, imageUrl: true, images: true, Brand: { select: { name: true } } },
      }),
    { retries: 2, timeoutMs: 8000, label: "giveaway scents" }
  ).catch(() => []);

  return rows.map((p) => ({
    id: p.id,
    // «Туалетная вода REPLICA Jazz Club 100ml» → «Jazz Club»
    name: p.name.replace(/^.*?replica\s+/i, "").replace(/\s*\d+\s*ml$/i, "").trim() || p.name,
    image: p.imageUrl || p.images?.find(Boolean) || null,
    href: productPath({ id: p.id, name: p.name, brand: p.Brand?.name ?? "Maison Margiela" }),
  }));
}

export default async function GiveawayPage() {
  const scents = await loadScents();
  return <GiveawayClient scents={scents} initialActive={isGiveawayActive()} />;
}
