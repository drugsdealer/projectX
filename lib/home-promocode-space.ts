import "server-only";

import path from "node:path";
import { promises as fs } from "node:fs";

export type HomePromoCampaign = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  href: string;
  tone: "sale" | "drop" | "base";
};

export type HomePromocodeSpace = {
  eyebrow: string;
  title: string;
  subtitle: string;
  telegramUrl: string;
  telegramText: string;
  campaigns: HomePromoCampaign[];
};

const FILE_PATH = path.join(process.cwd(), "content", "home-promos", "promocode-space.json");

const DEFAULT_SPACE: HomePromocodeSpace = {
  eyebrow: "Промокоды",
  title: "Билеты на скидку",
  subtitle: "Здесь только общедоступные промокоды без лимита использований.",
  telegramUrl: "https://t.me/stagestore",
  telegramText: "В нашем Telegram ещё больше промокодов и быстрые анонсы акций.",
  campaigns: [],
};

const toStr = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim() : fallback);

function normalizeCampaign(row: any, index: number): HomePromoCampaign | null {
  const id = toStr(row?.id) || `campaign-${index + 1}`;
  const title = toStr(row?.title);
  const subtitle = toStr(row?.subtitle);
  const href = toStr(row?.href, "/search");
  const badge = toStr(row?.badge, "Акция").slice(0, 20);
  const toneRaw = toStr(row?.tone, "base").toLowerCase();
  const tone = toneRaw === "sale" || toneRaw === "drop" ? toneRaw : "base";

  if (!title || !subtitle) return null;

  return {
    id,
    badge,
    title,
    subtitle,
    href: href.startsWith("/") || href.startsWith("http") ? href : "/search",
    tone,
  };
}

function normalizeSpace(raw: any): HomePromocodeSpace {
  const campaigns = Array.isArray(raw?.campaigns)
    ? raw.campaigns
        .map((row: any, idx: number) => normalizeCampaign(row, idx))
        .filter((row): row is HomePromoCampaign => Boolean(row))
        .slice(0, 8)
    : [];

  return {
    eyebrow: toStr(raw?.eyebrow, DEFAULT_SPACE.eyebrow),
    title: toStr(raw?.title, DEFAULT_SPACE.title),
    subtitle: toStr(raw?.subtitle, DEFAULT_SPACE.subtitle),
    telegramUrl: toStr(raw?.telegramUrl, DEFAULT_SPACE.telegramUrl),
    telegramText: toStr(raw?.telegramText, DEFAULT_SPACE.telegramText),
    campaigns,
  };
}

export async function readHomePromocodeSpace(): Promise<HomePromocodeSpace> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf-8");
    const json = JSON.parse(raw);
    return normalizeSpace(json || {});
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
      await fs.writeFile(FILE_PATH, `${JSON.stringify(DEFAULT_SPACE, null, 2)}\n`, "utf-8");
      return DEFAULT_SPACE;
    }
    console.error("[home-promocode-space] read failed", err);
    return DEFAULT_SPACE;
  }
}
