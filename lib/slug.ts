export function slugify(input: string): string {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return "";
  const normalized = raw.normalize("NFKD");
  const slug = normalized
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug;
}
