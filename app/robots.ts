import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/liza/",
          "/user/",
          "/payment/",
          "/checkout/",
          "/verify-email",
          "/verify-phone",
          "/mock-bank",
          "/profile/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
