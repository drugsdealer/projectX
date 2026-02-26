const FALLBACK_ADMIN = "nyakotaro6@gmail.com";

export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS || FALLBACK_ADMIN;
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
