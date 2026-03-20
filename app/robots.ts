import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.ru";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/user/", "/payment/", "/verify-email"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
