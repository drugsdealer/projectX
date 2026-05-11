import { slugify } from "./slug";

type ProductUrlInput = {
  id: string | number;
  name?: string | null;
  brand?: string | null;
  brandName?: string | null;
};

const CYRILLIC_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function transliterate(input: string) {
  return input
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join("");
}

export function productSlug(input: Pick<ProductUrlInput, "name" | "brand" | "brandName">) {
  const base = [input.brandName ?? input.brand, input.name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const ascii = slugify(transliterate(base))
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ascii || "item";
}

export function productPath(input: ProductUrlInput) {
  const id = String(input.id).trim();
  return `/product/${id}-${productSlug(input)}`;
}

export function premiumProductPath(input: ProductUrlInput) {
  const id = String(input.id).trim();
  return `/premium/product/${id}-${productSlug(input)}`;
}

export function parseProductPathId(value: string | number | null | undefined) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
