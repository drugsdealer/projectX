import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600; // regenerate sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

  // Main navigation pages — high priority for sitelinks
  const mainSections: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/premium`, lastModified: new Date(), changeFrequency: "daily", priority: 0.74 },
    { url: `${siteUrl}/sale`, lastModified: new Date(), changeFrequency: "daily", priority: 0.73 },
    { url: `${siteUrl}/category/footwear`, lastModified: new Date(), changeFrequency: "daily", priority: 0.72 },
    { url: `${siteUrl}/category/clothes`, lastModified: new Date(), changeFrequency: "daily", priority: 0.72 },
    { url: `${siteUrl}/category/bags`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/category/accessories`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/category/fragrance`, lastModified: new Date(), changeFrequency: "daily", priority: 0.68 },
    { url: `${siteUrl}/category/headwear`, lastModified: new Date(), changeFrequency: "daily", priority: 0.66 },
  ];

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/premium/why`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  // Products
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, updatedAt: true, premium: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
    productPages = products.flatMap((p) => {
      return [{
        url: `${siteUrl}/product/${p.id}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.55,
      }];
    });
  } catch {}

  // Brands
  let brandPages: MetadataRoute.Sitemap = [];
  try {
    const brands = await prisma.brand.findMany({
      where: { deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    brandPages = brands.map((b) => ({
      url: `${siteUrl}/brand/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.46,
    }));
  } catch {}

  // Categories (exclude ones already in mainSections)
  const mainCategorySlugs = new Set(["footwear", "clothes", "bags", "accessories", "fragrance", "headwear"]);
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const categories = await prisma.category.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    categoryPages = categories
      .filter((c) => !mainCategorySlugs.has(c.slug))
      .map((c) => ({
        url: `${siteUrl}/category/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.42,
      }));
  } catch {}

  return [...mainSections, ...staticPages, ...productPages, ...brandPages, ...categoryPages];
}
