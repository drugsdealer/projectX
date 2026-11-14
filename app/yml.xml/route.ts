import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productPath } from "@/lib/product-url";
import { toProxiedImageUrl } from "@/lib/media";
import { COMPANY } from "@/lib/company";

// Товарный фид в формате YML для Яндекса (Товары, Поиск по товарам, Директ).
// Подключается в Яндекс Вебмастере / Яндекс Бизнесе по адресу https://stagestore.app/yml.xml
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

function x(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Картинки отдаём через свой домен: робот Яндекса надёжно забирает их оттуда.
function picture(url: string): string {
  const proxied = toProxiedImageUrl(url);
  return proxied.startsWith("/") ? `${SITE_URL}${proxied}` : proxied;
}

export async function GET() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } }),
    prisma.product.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        oldPrice: true,
        imageUrl: true,
        images: true,
        available: true,
        categoryId: true,
        Brand: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
  ]);

  const offers = products
    .filter((p) => p.price && Number(p.price) > 0 && p.imageUrl && p.categoryId)
    .map((p) => {
      const name = p.name.replace(/\s+/g, " ").trim();
      const price = Math.round(Number(p.price));
      const old = p.oldPrice && Number(p.oldPrice) > price ? Math.round(Number(p.oldPrice)) : null;
      const pics = [p.imageUrl!, ...(Array.isArray(p.images) ? p.images : [])]
        .filter((u, i, arr) => typeof u === "string" && /^https?:\/\//.test(u) && arr.indexOf(u) === i)
        .slice(0, 10)
        .map((u) => `<picture>${x(picture(u))}</picture>`)
        .join("");
      const description = (p.description || `${name} — оригинал с проверкой подлинности.`).replace(/\s+/g, " ").trim().slice(0, 3000);
      const url = `${SITE_URL}${productPath({ id: p.id, name: p.name, brandName: p.Brand?.name })}`;
      return `
      <offer id="${p.id}" available="${p.available === false ? "false" : "true"}">
        <url>${x(url)}</url>
        <name>${x(name)}</name>
        ${p.Brand?.name ? `<vendor>${x(p.Brand.name)}</vendor>` : ""}
        <price>${price}</price>
        ${old ? `<oldprice>${old}</oldprice>` : ""}
        <currencyId>RUR</currencyId>
        <categoryId>${p.categoryId}</categoryId>
        ${pics}
        <description>${x(description)}</description>
        <delivery>true</delivery>
        <pickup>true</pickup>
        <manufacturer_warranty>true</manufacturer_warranty>
      </offer>`;
    })
    .join("");

  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${date}">
  <shop>
    <name>${x(COMPANY.siteName)}</name>
    <company>${x(COMPANY.legalName)}</company>
    <url>${SITE_URL}</url>
    <email>${x(COMPANY.email)}</email>
    <currencies>
      <currency id="RUR" rate="1"/>
    </currencies>
    <categories>
      ${categories.map((c) => `<category id="${c.id}">${x(c.name)}</category>`).join("\n      ")}
    </categories>
    <offers>${offers}
    </offers>
  </shop>
</yml_catalog>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
