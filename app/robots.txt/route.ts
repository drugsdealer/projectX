// robots.txt пишем вручную: директиву Clean-param (Яндекс) встроенный robots.ts не поддерживает.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

const DISALLOW = [
  "/api/",
  "/admin/",
  "/liza/",
  "/user/",
  "/profile/",
  "/cart",
  "/checkout",
  "/payment/",
  "/favorites_item",
  "/login",
  "/register",
  "/reset-password",
  "/verify-email",
  "/verify-phone",
  "/MaisonMargiela/",
];

// Параметры, которые не меняют содержимое страницы: метки рекламы и служебные пометки
// переходов. Яндекс склеит такие адреса с основным и не будет тратить на них обход.
const CLEAN_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "yclid", "ysclid", "gclid", "fbclid", "_openstat", "from", "origin", "intro",
];

export const dynamic = "force-static";

export function GET() {
  const disallow = DISALLOW.map((p) => `Disallow: ${p}`).join("\n");
  const body = `User-agent: *
Allow: /
${disallow}

User-agent: Yandex
Allow: /
${disallow}
Clean-param: ${CLEAN_PARAMS.join("&")}

Sitemap: ${SITE_URL}/sitemap.xml
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
