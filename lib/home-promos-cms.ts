import "server-only";

import path from "node:path";
import { promises as fs } from "node:fs";

export type HomeCmsPromo = {
  id: string;
  name: string;
  tag: string;
  title: string;
  subtitle: string;
  backgroundImageUrl: string;
  logoImageUrl?: string;
  accentColor?: string;
  brandQueries: string[];
  productIds: number[];
  maxItems: number;
  position: number;
  enabled: boolean;
  variant: "generic";
};

const CMS_PROMOS_FILE = path.join(process.cwd(), "content", "home-promos", "cms-promos.json");

const isCloudinaryUrl = (raw: unknown) => {
  if (typeof raw !== "string") return false;
  const v = raw.trim();
  if (!v) return false;
  return /^https:\/\/res\.cloudinary\.com\//i.test(v);
};

const toSafeString = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim() : fallback);

const toInt = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const normalizePromo = (raw: any, idx: number): HomeCmsPromo | null => {
  const id = toSafeString(raw?.id) || `promo-${idx + 1}`;
  const name = toSafeString(raw?.name) || id;
  const tag = toSafeString(raw?.tag) || "PROMO";
  const title = toSafeString(raw?.title);
  const subtitle = toSafeString(raw?.subtitle);
  const bg = toSafeString(raw?.backgroundImageUrl);
  const logo = toSafeString(raw?.logoImageUrl);
  const accentColor = toSafeString(raw?.accentColor);
  const maxItems = Math.min(20, Math.max(1, toInt(raw?.maxItems, 8)));
  const position = Math.max(0, toInt(raw?.position, 2));
  const enabled = raw?.enabled !== false;
  const variant = "generic" as const;

  if (!title || !subtitle || !isCloudinaryUrl(bg)) return null;

  const brandQueries = Array.isArray(raw?.brandQueries)
    ? raw.brandQueries.map((v: any) => toSafeString(v).toLowerCase()).filter(Boolean).slice(0, 12)
    : [];

  const productIds = Array.isArray(raw?.productIds)
    ? raw.productIds
        .map((v: any) => Number(v))
        .filter((v: number) => Number.isFinite(v) && v > 0)
        .map((v: number) => Math.round(v))
        .slice(0, 40)
    : [];

  return {
    id,
    name,
    tag,
    title,
    subtitle,
    backgroundImageUrl: bg,
    logoImageUrl: isCloudinaryUrl(logo) ? logo : undefined,
    accentColor: accentColor || undefined,
    brandQueries,
    productIds,
    maxItems,
    position,
    enabled,
    variant,
  };
};

const sortPromos = (promos: HomeCmsPromo[]) =>
  [...promos].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.name.localeCompare(b.name, "ru");
  });

export async function readHomeCmsPromos(): Promise<HomeCmsPromo[]> {
  try {
    const raw = await fs.readFile(CMS_PROMOS_FILE, "utf-8");
    const json = JSON.parse(raw);
    if (!Array.isArray(json)) return [];
    const rows = json
      .map((row, idx) => normalizePromo(row, idx))
      .filter((row): row is HomeCmsPromo => Boolean(row));
    return sortPromos(rows);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      await fs.mkdir(path.dirname(CMS_PROMOS_FILE), { recursive: true });
      await fs.writeFile(CMS_PROMOS_FILE, "[]\n", "utf-8");
      return [];
    }
    throw err;
  }
}

export async function writeHomeCmsPromos(input: unknown): Promise<HomeCmsPromo[]> {
  if (!Array.isArray(input)) {
    throw new Error("Invalid payload: promos must be an array");
  }

  const normalized = input
    .map((row, idx) => normalizePromo(row, idx))
    .filter((row): row is HomeCmsPromo => Boolean(row));

  const dedupedById = new Map<string, HomeCmsPromo>();
  for (const promo of normalized) {
    dedupedById.set(promo.id, promo);
  }

  const out = sortPromos(Array.from(dedupedById.values()));
  await fs.mkdir(path.dirname(CMS_PROMOS_FILE), { recursive: true });
  await fs.writeFile(CMS_PROMOS_FILE, `${JSON.stringify(out, null, 2)}\n`, "utf-8");
  return out;
}

export function isValidCloudinaryUrl(url?: string | null): boolean {
  if (!url) return false;
  return isCloudinaryUrl(url);
}
