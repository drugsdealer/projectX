import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      Brand: { select: { name: true } },
      Category: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  const items = products
    .filter((p) => p.price && Number(p.price) > 0 && p.imageUrl)
    .map((p) => {
      const title = p.Brand?.name
        ? escapeXml(`${p.name} ${p.Brand.name}`)
        : escapeXml(p.name);
      const description = p.description
        ? escapeXml(p.description.slice(0, 5000))
        : escapeXml(`${p.name} — оригинал с гарантией подлинности. Купить в Stage Store.`);
      const price = Number(p.price).toFixed(2);
      const category = p.Category?.name ? escapeXml(p.Category.name) : "Одежда и аксессуары";
      const brand = p.Brand?.name ? escapeXml(p.Brand.name) : "Stage Store";
      const link = `${SITE_URL}/product/${p.id}`;
      const image = escapeXml(p.imageUrl!);

      return `
    <item>
      <g:id>${p.id}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${link}</g:link>
      <g:image_link>${image}</g:image_link>
      <g:price>${price} RUB</g:price>
      <g:availability>in_stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${brand}</g:brand>
      <g:google_product_category>Apparel &amp; Accessories</g:google_product_category>
      <g:product_type>${category}</g:product_type>
      <g:shipping>
        <g:country>RU</g:country>
        <g:price>0 RUB</g:price>
      </g:shipping>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Stage Store — Брендовая одежда и аксессуары</title>
    <link>${SITE_URL}</link>
    <description>Оригинальная брендовая одежда, обувь и аксессуары с гарантией подлинности</description>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
