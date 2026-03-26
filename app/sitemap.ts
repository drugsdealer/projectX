import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600; // regenerate sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

  // Main navigation pages — high priority for sitelinks
  const mainSections: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/category/footwear`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/category/clothes`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/category/bags`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/category/accessories`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/category/fragrance`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/category/headwear`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/premium`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ];

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/premium/why`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/favorites_item`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.4 },
    { url: `${siteUrl}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/register`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/cart`, changeFrequency: "weekly", priority: 0.3 },
    { url: `${siteUrl}/footer`, changeFrequency: "monthly", priority: 0.2 },
  ];

  // Products
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
    productPages = products.map((p) => ({
      url: `${siteUrl}/product/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
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
      priority: 0.7,
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
        priority: 0.6,
      }));
  } catch {}

  return [...mainSections, ...staticPages, ...productPages, ...brandPages, ...categoryPages];
}
