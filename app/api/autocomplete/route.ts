import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeSubcategorySlug } from "@/lib/catalog-taxonomy";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=15, s-maxage=60, stale-while-revalidate=120",
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string) {
  return normalizeText(input)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function levenshtein(a: string, b: string) {
  const s = normalizeText(a);
  const t = normalizeText(b);
  const n = s.length;
  const m = t.length;
  if (!n) return m;
  if (!m) return n;

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[n][m];
}

function stripToken(text: string, token: string) {
  const padded = ` ${text} `;
  return padded.split(` ${token} `).join(" ").replace(/\s+/g, " ").trim();
}

const TYPE_INTENTS: Record<string, { subs: string[]; cats: string[]; words: string[] }> = {
  bag: {
    subs: ["bag", "bags", "travelbag", "travelbags", "backpack", "backpacks", "waistbag", "waistbags", "wallet", "wallets", "cardholder", "cardholders"],
    cats: ["bags", "сумки", "сумки и рюкзаки", "сумки-и-рюкзаки"],
    words: ["сумка", "сумки", "сумочка", "bag", "bags", "keepall", "neverfull", "speedy", "pochette", "alma", "capucines", "onthego", "on the go", "sac"],
  },
  sweater: {
    subs: ["sweater", "sweaters", "cardigan", "cardigans", "sweatshirt", "sweatshirts"],
    cats: ["clothes", "одежда"],
    words: ["свитер", "свитеры", "свитр", "джемпер", "кофта", "knit", "knitwear", "pullover", "sweater"],
  },
  hoodie: {
    subs: ["hoodie", "hoodies", "sweatshirt", "sweatshirts"],
    cats: ["clothes", "одежда"],
    words: ["худи", "толстовка", "кофта", "hoodie", "hoodies"],
  },
  sneakers: {
    subs: ["sneaker", "sneakers"],
    cats: ["footwear", "обувь"],
    words: ["кроссовки", "кеды", "sneakers", "sneaker", "dunk", "jordan", "yeezy"],
  },
  tshirt: {
    subs: ["tshirt", "tshirts", "t-shirt", "tee"],
    cats: ["clothes", "одежда"],
    words: ["футболка", "футболки", "лонгслив", "tshirt", "t-shirt", "tee"],
  },
  jeans: {
    subs: ["jeans", "jean"],
    cats: ["clothes", "одежда"],
    words: ["джинсы", "джинс", "jeans", "denim"],
  },
  belt: {
    subs: ["belt", "belts"],
    cats: ["accessories", "аксессуары"],
    words: ["ремень", "ремни", "ремен", "belt", "belts"],
  },
  glasses: {
    subs: ["glasses", "glass"],
    cats: ["accessories", "аксессуары"],
    words: ["очки", "glasses", "sunglasses"],
  },
  fragrance: {
    subs: ["fragrance", "fragrances"],
    cats: ["fragrance", "fragrances", "парфюм", "парфюмерия"],
    words: ["парфюм", "духи", "аромат", "fragrance", "perfume"],
  },
};

const TYPE_SYNONYMS: Record<string, keyof typeof TYPE_INTENTS> = {
  сумка: "bag",
  сумки: "bag",
  сумочку: "bag",
  сумочка: "bag",
  bag: "bag",
  bags: "bag",
  рюкзак: "bag",
  рюкзаки: "bag",
  кошелек: "bag",
  кошелёк: "bag",
  свитер: "sweater",
  свитр: "sweater",
  свитера: "sweater",
  свитеры: "sweater",
  джемпер: "sweater",
  кофта: "sweater",
  sweater: "sweater",
  knitwear: "sweater",
  худи: "hoodie",
  толстовка: "hoodie",
  hoodie: "hoodie",
  кроссовки: "sneakers",
  кросы: "sneakers",
  кеды: "sneakers",
  sneakers: "sneakers",
  sneaker: "sneakers",
  футболка: "tshirt",
  футболки: "tshirt",
  tshirt: "tshirt",
  "t-shirt": "tshirt",
  джинсы: "jeans",
  джинс: "jeans",
  jeans: "jeans",
  denim: "jeans",
  ремень: "belt",
  ремни: "belt",
  ремня: "belt",
  ремню: "belt",
  belt: "belt",
  belts: "belt",
  очки: "glasses",
  glasses: "glasses",
  sunglasses: "glasses",
  парфюм: "fragrance",
  духи: "fragrance",
  аромат: "fragrance",
  fragrance: "fragrance",
  perfume: "fragrance",
};

function detectType(tokens: string[]) {
  const keys = Object.keys(TYPE_SYNONYMS);
  for (const token of tokens) {
    const exact = TYPE_SYNONYMS[token];
    if (exact) return { key: exact, token, corrected: null as string | null };
  }

  let best: { key: keyof typeof TYPE_INTENTS; token: string; corrected: string; distance: number } | null = null;
  for (const token of tokens) {
    for (const candidate of keys) {
      const distance = levenshtein(token, candidate);
      const maxDistance = token.length <= 4 ? 1 : 2;
      if (distance > maxDistance) continue;
      const key = TYPE_SYNONYMS[candidate];
      if (!best || distance < best.distance) best = { key, token, corrected: candidate, distance };
    }
  }
  return best;
}

async function detectBrand(qNorm: string, tokens: string[]) {
  const brandRows = await prisma.brand.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
    take: 3000,
    orderBy: { createdAt: "desc" },
  });

  for (const brand of brandRows) {
    const nameNorm = normalizeText(brand.name);
    const slugNorm = normalizeText(brand.slug);
    if ((nameNorm && ` ${qNorm} `.includes(` ${nameNorm} `)) || (slugNorm && ` ${qNorm} `.includes(` ${slugNorm} `))) {
      return { ...brand, token: nameNorm, corrected: null as string | null };
    }
  }

  let best: { brand: (typeof brandRows)[number]; token: string; candidate: string; distance: number } | null = null;
  for (const token of tokens) {
    for (const brand of brandRows) {
      const candidates = [normalizeText(brand.name), normalizeText(brand.slug), ...tokenize(brand.name), ...tokenize(brand.slug)].filter(Boolean);
      for (const candidate of candidates) {
        const distance = levenshtein(token, candidate);
        const maxDistance = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
        if (distance > maxDistance) continue;
        if (!best || distance < best.distance || (distance === best.distance && candidate.length > best.candidate.length)) {
          best = { brand, token, candidate, distance };
        }
      }
    }
  }

  return best ? { ...best.brand, token: best.token, corrected: best.brand.name } : null;
}

function productScore(p: any, params: { brandId?: number; typeKey?: keyof typeof TYPE_INTENTS; terms: string[] }) {
  const name = normalizeText(p.name);
  const description = normalizeText(p.description);
  const brandName = normalizeText(p.Brand?.name);
  const sub = normalizeSubcategorySlug(p.subcategory) ?? normalizeText(p.subcategory);
  const catName = normalizeText(p.Category?.name);
  const catSlug = normalizeText(p.Category?.slug);
  const intent = params.typeKey ? TYPE_INTENTS[params.typeKey] : null;
  let score = 0;

  if (params.brandId && p.Brand?.id === params.brandId) score += 90;
  if (intent) {
    if (intent.subs.map((x) => normalizeSubcategorySlug(x) ?? normalizeText(x)).includes(sub)) score += 70;
    if (intent.words.some((word) => name.includes(normalizeText(word)))) score += 45;
  }
  for (const term of params.terms) {
    if (name.includes(term)) score += name.startsWith(term) ? 30 : 18;
    if (brandName.includes(term)) score += 20;
    if (sub.includes(term) || catName.includes(term) || catSlug.includes(term)) score += 12;
    if (description.includes(term)) score += 4;
  }
  if (p.imageUrl || (Array.isArray(p.images) && p.images.length)) score += 4;
  return score;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`autocomplete:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ products: [], brands: [], suggestions: [] }, { status: 429 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (q.length < 2) {
    return NextResponse.json({ products: [], brands: [], suggestions: [] });
  }

  const qNorm = normalizeText(q);
  const tokens = tokenize(q);
  const [brand, type] = await Promise.all([detectBrand(qNorm, tokens), Promise.resolve(detectType(tokens))]);

  let residual = qNorm;
  if (brand?.token) residual = stripToken(residual, brand.token);
  if (type?.token) residual = stripToken(residual, type.token);
  const terms = tokenize(residual);
  const intent = type?.key ? TYPE_INTENTS[type.key] : null;

  const andFilters: Prisma.ProductWhereInput[] = [];
  if (brand?.id) andFilters.push({ brandId: brand.id });
  if (intent) {
    const intentSubs = Array.from(new Set(intent.subs.map((sub) => normalizeSubcategorySlug(sub) ?? sub)));
    andFilters.push({
      OR: [
        ...intentSubs.flatMap((sub) => [
          { subcategory: { equals: sub, mode: Prisma.QueryMode.insensitive } },
          ...intent.subs.map((rawSub) => ({ subcategory: { equals: rawSub, mode: Prisma.QueryMode.insensitive } })),
        ]),
        ...intent.words.map((word) => ({ name: { contains: word, mode: Prisma.QueryMode.insensitive } })),
      ],
    });
  }

  const searchableTerms = terms.length ? terms : !brand && !intent ? tokens : [];
  if (searchableTerms.length) {
    andFilters.push({
      OR: searchableTerms.flatMap((term) => [
        { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { subcategory: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { Brand: { is: { name: { contains: term, mode: Prisma.QueryMode.insensitive } } } },
      ]),
    });
  }

  const where: Prisma.ProductWhereInput = { deletedAt: null };
  if (andFilters.length) where.AND = andFilters;

  const [rawProducts, brands] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        name: true,
        price: true,
        description: true,
        imageUrl: true,
        images: true,
        subcategory: true,
        createdAt: true,
        Brand: { select: { id: true, name: true, slug: true } },
        Category: { select: { name: true, slug: true } },
      },
    }),
    prisma.brand.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: qNorm.replace(/\s+/g, "-"), mode: "insensitive" } },
          ...(brand?.id ? [{ id: brand.id }] : []),
        ],
      },
      take: 3,
      select: { name: true, slug: true },
    }),
  ]);

  const products = rawProducts
    .map((p: any) => ({ product: p, score: productScore(p, { brandId: brand?.id, typeKey: type?.key, terms }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ product: p }) => ({
      id: String(p.id),
      name: p.name as string,
      price: (p.price as number | null) ?? null,
      brandName: (p.Brand?.name as string | null) ?? null,
      imageUrl:
        typeof p.imageUrl === "string" && p.imageUrl
          ? p.imageUrl
          : Array.isArray(p.images) && p.images.length > 0
          ? (p.images[0] as string)
          : null,
    }));

  const suggestions = [
    brand?.corrected || type?.corrected
      ? {
          label: `Искать: ${[type?.corrected ?? type?.token, brand?.corrected ?? brand?.name, residual].filter(Boolean).join(" ")}`,
          query: [type?.corrected ?? type?.token, brand?.corrected ?? brand?.name, residual].filter(Boolean).join(" "),
        }
      : null,
    products.length === 0 ? { label: `Все результаты для «${q}»`, query: q } : null,
  ].filter(Boolean);

  return NextResponse.json({ products, brands, suggestions }, { headers: CACHE_HEADERS });
}
