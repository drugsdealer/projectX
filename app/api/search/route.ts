import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { slugify } from '@/lib/slug';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
};

function normalizeText(s: string) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function normalizeMatchText(s: string) {
  return normalizeText(s)
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPhrase(text: string, phrase: string) {
  if (!text || !phrase) return text;
  const padded = ` ${text} `;
  const target = ` ${phrase} `;
  if (!padded.includes(target)) return text;
  return padded.split(target).join(' ').replace(/\s+/g, ' ').trim();
}

function findBestPhraseMatch(text: string, phrases: string[]) {
  if (!text) return null;
  const padded = ` ${text} `;
  let best: { raw: string; norm: string } | null = null;
  for (const raw of phrases) {
    const norm = normalizeMatchText(raw);
    if (!norm) continue;
    if (!padded.includes(` ${norm} `)) continue;
    if (!best || norm.length > best.norm.length) best = { raw, norm };
  }
  return best;
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

function bestSuggestion(q: string, candidates: string[]) {
  const qq = normalizeText(q);
  if (!qq || candidates.length === 0) return null;

  let best: { v: string; d: number } | null = null;
  for (const c of candidates) {
    const cc = normalizeText(c);
    if (!cc) continue;
    const d = levenshtein(qq, cc);
    if (!best || d < best.d) best = { v: c, d };
    if (best && best.d === 0) break;
  }

  if (!best) return null;
  if (best.d <= 2) return best.v;
  if (qq.length >= 6 && best.d <= 3) return best.v;
  return null;
}

// RU/EN synonyms -> your DB subcategory slugs
const SUBCATEGORY_SYNONYMS: Record<string, string> = {
  // footwear
  'кроссовки': 'sneakers',
  'кеды': 'sneakers',
  sneakers: 'sneakers',
  sneaker: 'sneakers',
  'ботинки': 'boots',
  boots: 'boots',
  boot: 'boots',
  'лоферы': 'loafers',
  loafers: 'loafers',
  'сандалии': 'sandals',
  sandals: 'sandals',
  sandal: 'sandals',

  // clothing
  'худи': 'hoodie',
  hoodie: 'hoodie',
  hoodies: 'hoodie',
  'свитер': 'sweater',
  'свитеры': 'sweater',
  'свитера': 'sweater',
  sweater: 'sweater',
  sweaters: 'sweater',
  'свитшот': 'sweatshirt',
  'свитшоты': 'sweatshirt',
  sweatshirt: 'sweatshirt',
  sweatshirts: 'sweatshirt',
  'джемпер': 'sweater',
  'джемперы': 'sweater',
  'лонгслив': 'tshirt',
  'лонгсливы': 'tshirt',
  'футболка': 'tshirt',
  'футболки': 'tshirt',
  tshirt: 'tshirt',
  't-shirt': 'tshirt',
  tee: 'tshirt',
  tees: 'tshirt',
  'штаны': 'pants',
  pants: 'pants',
  'брюки': 'trousers',
  trouser: 'trousers',
  trousers: 'trousers',
  'джинсы': 'jeans',
  jeans: 'jeans',
  'куртка': 'jacket',
  'куртки': 'jacket',
  jacket: 'jacket',
  jackets: 'jacket',
  'пальто': 'coat',
  coat: 'coat',
  coats: 'coat',
  'платье': 'dress',
  'платья': 'dress',
  dress: 'dress',
  dresses: 'dress',
  'юбка': 'skirt',
  'юбки': 'skirt',
  skirt: 'skirt',
  skirts: 'skirt',
  'шорты': 'shorts',
  shorts: 'shorts',

  // bags
  'сумка': 'bag',
  'сумки': 'bags',
  bag: 'bag',
  bags: 'bags',
  'рюкзак': 'backpack',
  'рюкзаки': 'backpack',
  backpack: 'backpack',
  'дорожная сумка': 'travelbag',
  travelbag: 'travelbag',
  travelbags: 'travelbag',

  // perfume
  'парфюм': 'fragrance',
  'духи': 'fragrance',
  perfume: 'fragrance',
  fragrance: 'fragrance',

  // misc
  'аксессуары': 'accessories',
  'очки': 'glasses',
  'ремень': 'belt',
  'ремни': 'belts',
  'украшения': 'jewelry',
  'кольцо': 'ring',
  'кольца': 'ring',
  ring: 'ring',
  rings: 'ring',
  'серьги': 'earring',
  earring: 'earring',
  earrings: 'earring',
  'браслет': 'bracelet',
  bracelet: 'bracelet',
  'цепочка': 'necklace',
  necklace: 'necklace',

  // --- english typos / aliases ---
  snickers: 'sneakers',
  sneekers: 'sneakers',
  sneackers: 'sneakers',
  sneakerz: 'sneakers',

  bootz: 'boots',
  botts: 'boots',

  hoddie: 'hoodie',
  hoodiee: 'hoodie',
  hoodys: 'hoodie',

  t_shirt: 'tshirt',
  tshrt: 'tshirt',

  pant: 'pants',
  pantss: 'pants',

  bagg: 'bag',
  bgs: 'bags',

  backpak: 'backpack',
  backpck: 'backpack',

  parfume: 'fragrance',
  fragance: 'fragrance',
};

// Generic words that map to MULTIPLE subcategories (e.g. "кофта" = hoodie + sweater + sweatshirt + cardigan)
const GROUP_SYNONYMS: Record<string, string[]> = {
  'кофта': ['hoodie', 'sweater', 'sweatshirt', 'cardigan'],
  'кофты': ['hoodie', 'sweater', 'sweatshirt', 'cardigan'],
  'кофточка': ['hoodie', 'sweater', 'sweatshirt', 'cardigan'],
  'верх': ['hoodie', 'sweater', 'sweatshirt', 'cardigan', 'tshirt', 'jacket'],
  'верхняя одежда': ['jacket', 'coat', 'parka'],
  'обувь': ['sneakers', 'boots', 'loafers', 'sandals'],
  'головной убор': ['cap', 'beanie', 'hat'],
  'головные уборы': ['cap', 'beanie', 'hat'],
  'трикотаж': ['sweater', 'cardigan', 'sweatshirt'],
};

const CATEGORY_SYNONYMS: Record<string, string> = {
  обувь: 'обувь',
  одежда: 'одежда',
  сумки: 'сумки',
  аксессуары: 'аксессуары',
  парфюм: 'парфюм',
  парфюмерия: 'парфюмерия',
  'головные уборы': 'головные уборы',
};

// GET /api/search?q=...&take=36
// GET /api/search?category=...&take=36
// Returns: { items: Array<{id,name,price,brandName,imageUrl,images}>, suggestion?: string|null, brand?: {name,slug,logoUrl,count} }
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`search:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ products: [], brands: [], categories: [] }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const qRaw = searchParams.get('q') ?? '';
    const q = qRaw.trim().replace(/\s+/g, ' ');
    const qNorm = normalizeText(q);
    const qMatch = normalizeMatchText(qRaw);
    const categoryRaw = searchParams.get('category') ?? '';
    const category = categoryRaw.trim();

    // --- fuzzy text for brands / names (peezy -> yeezy, etc.) ---
    let fuzzyText: string | null = null;
    let brandCandidates: string[] | null = null;

    const loadBrandCandidates = async () => {
      if (brandCandidates) return brandCandidates;
      const brandRows = await prisma.brand.findMany({
        where: { deletedAt: null },
        select: { name: true },
        take: 3000,
        orderBy: { createdAt: 'desc' },
      });
      brandCandidates = Array.from(
        new Set(brandRows.map((r: any) => String(r?.name ?? '').trim()).filter(Boolean))
      );
      return brandCandidates;
    };

    // collect candidates lazily only when needed
    const maybeBuildFuzzy = async () => {
      if (fuzzyText || qNorm.length < 3) return;

      const brandList = await loadBrandCandidates();

      const nameRows = await prisma.product.findMany({
        where: { deletedAt: null },
        select: { name: true },
        take: 2000,
        orderBy: { createdAt: 'desc' },
      });

      const nameCandidates = Array.from(
        new Set(nameRows.map((r: any) => String(r?.name ?? '').trim()).filter(Boolean))
      );

      const best = bestSuggestion(qRaw, [...brandList, ...nameCandidates]);
      if (best && normalizeText(best) !== qNorm) {
        fuzzyText = best;
      }
    };

    // Check group synonyms first ("кофта" -> [hoodie, sweater, sweatshirt, cardigan])
    const groupMatch = GROUP_SYNONYMS[qNorm] ?? GROUP_SYNONYMS[qMatch] ?? null;
    // Also check if any group synonym appears as a phrase in the query ("кофта balenciaga" -> кофта)
    const groupPhraseMatch = !groupMatch && qMatch
      ? findBestPhraseMatch(qMatch, Object.keys(GROUP_SYNONYMS))
      : null;
    const groupSubs: string[] | null = groupMatch
      ?? (groupPhraseMatch ? GROUP_SYNONYMS[groupPhraseMatch.raw] ?? GROUP_SYNONYMS[groupPhraseMatch.norm] ?? null : null);

    // exact synonym match ("кроссовки" -> sneakers)
    const subFromSynExact = !groupSubs ? (SUBCATEGORY_SYNONYMS[qNorm] ?? SUBCATEGORY_SYNONYMS[qMatch]) : undefined;

    // fuzzy synonym match for typos
    const synKeys = Object.keys(SUBCATEGORY_SYNONYMS);
    const canonicalSubs = Array.from(new Set(Object.values(SUBCATEGORY_SYNONYMS)));

    const bestSynKey = !subFromSynExact && !groupSubs ? bestSuggestion(qRaw, [...synKeys, ...canonicalSubs]) : null;

    const subFromSynFuzzy = bestSynKey ? SUBCATEGORY_SYNONYMS[normalizeText(bestSynKey)] ?? bestSynKey : undefined;

    const subMatch = !groupSubs && qMatch ? findBestPhraseMatch(qMatch, synKeys) : null;
    const catMatch = !subMatch && !groupSubs && qMatch ? findBestPhraseMatch(qMatch, Object.keys(CATEGORY_SYNONYMS)) : null;

    const subFromMatch = subMatch ? SUBCATEGORY_SYNONYMS[subMatch.raw] ?? SUBCATEGORY_SYNONYMS[subMatch.norm] : null;
    const subForFilter = subFromMatch ?? subFromSynExact ?? null;
    const subFromSyn = subFromMatch ?? subFromSynExact ?? subFromSynFuzzy;

    const synonymSuggestion =
      !subFromSynExact && bestSynKey && normalizeText(bestSynKey) !== qNorm ? bestSynKey : null;

    const takeParam = Number(searchParams.get('take') ?? '36');
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 60) : 36;

    const facetsMode = (searchParams.get('facets') ?? '') === '1';

    // Facets (active categories/subcategories/brands) for UI
    // GET /api/search?facets=1
    if (facetsMode) {
      // Inference rules: match product name/description to determine subcategory
      const INFER_RULES: Array<{ slug: string; rx: RegExp }> = [
        // Обувь
        { slug: 'sneakers',    rx: /(кроссов|sneak|yeezy|dunk|air\s*force|jordan)/i },
        { slug: 'boots',       rx: /(ботинк|сапог|челси|chelsea|boot)/i },
        { slug: 'loafers',     rx: /(лофер|loafer|мокасин)/i },
        { slug: 'sandals',     rx: /(сандал|сланц|шлеп|sandal)/i },
        // Одежда
        { slug: 'tshirts',     rx: /(футболк|t[\s-]?shirt|tee\b)/i },
        { slug: 'hoodies',     rx: /(худи|hood|толстовк)/i },
        { slug: 'sweatshirts', rx: /(свитшот|sweatshirt)/i },
        { slug: 'sweaters',    rx: /(свитер|свитр|sweater|джемпер|jumper|пуловер|pullover)/i },
        { slug: 'cardigans',   rx: /(кардиган|cardigan)/i },
        { slug: 'shirts',      rx: /(рубашк|рубах|shirt(?!.*t-shirt))/i },
        { slug: 'polo',        rx: /(поло\b|polo\b)/i },
        { slug: 'jackets',     rx: /(куртк|бомбер|bomber|ветровк|jacket)/i },
        { slug: 'coats',       rx: /(пальто|coat|тренч|trench)/i },
        { slug: 'parkas',      rx: /(парка|parka|пухов|down\s*jacket)/i },
        { slug: 'vests',       rx: /(жилет|vest|безрукавк)/i },
        { slug: 'jeans',       rx: /(джинс|jeans|denim)/i },
        { slug: 'pants',       rx: /(брюк|штан|pants|trousers|чинос|chinos|джоггер|jogger|карго|cargo)/i },
        { slug: 'shorts',      rx: /(шорт|shorts)/i },
        { slug: 'tracksuits',  rx: /(спортивн.*костюм|tracksuit)/i },
        { slug: 'dresses',     rx: /(платье|dress)/i },
        { slug: 'skirts',      rx: /(юбк|skirt)/i },
        { slug: 'suits',       rx: /(костюм(?!.*спорт)|suit(?!.*track))/i },
        // Сумки
        { slug: 'bags',        rx: /(сумк|сумоч|bag(?!.*back)|тоут|tote|клатч|clutch|шопер|shopper)/i },
        { slug: 'backpacks',   rx: /(рюкзак|backpack)/i },
        { slug: 'waistbags',   rx: /(поясн.*сумк|waist\s*bag|belt\s*bag|бананк)/i },
        { slug: 'cardholders', rx: /(кардхолдер|card\s*holder|визитниц)/i },
        { slug: 'wallets',     rx: /(кошел[её]к|бумажник|wallet)/i },
        // Аксессуары
        { slug: 'belts',       rx: /(ремен|ремн|belt)/i },
        { slug: 'glasses',     rx: /(очк|glasses|sunglasses|солнцезащитн)/i },
        { slug: 'watches',     rx: /(час[ыов]|watch)/i },
        { slug: 'rings',       rx: /(кольц|ring)/i },
        { slug: 'earrings',    rx: /(серьг|серёг|earring)/i },
        { slug: 'bracelets',   rx: /(браслет|bracelet)/i },
        { slug: 'necklaces',   rx: /(колье|цеп[оч]|necklace|chain|подвеск|pendant)/i },
        { slug: 'keychains',   rx: /(брелок|брелк|keychain)/i },
        { slug: 'scarves',     rx: /(шарф|scarf|scarves|палантин)/i },
        { slug: 'gloves',      rx: /(перчатк|glove)/i },
        { slug: 'socks',       rx: /(носк|sock)/i },
        // Головные уборы
        { slug: 'caps',        rx: /(кепк|бейсболк|cap\b)/i },
        { slug: 'beanies',     rx: /(шапк|beanie)/i },
        { slug: 'hats',        rx: /(панам|шляп|hat\b|bucket)/i },
        // Парфюм
        { slug: 'fragrances',  rx: /(парфюм|духи|туалетн.*вод|eau\s*de|edp|edt|perfume|fragrance|аромат)/i },
      ];

      const inferSub = (name: string, description: string | null): string | null => {
        const text = [name, description].filter(Boolean).join(' ');
        for (const rule of INFER_RULES) {
          if (rule.rx.test(text)) return rule.slug;
        }
        return null;
      };

      // Load all products with name + existing subcategory to infer missing ones
      const allProducts = await prisma.product.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, description: true, subcategory: true },
      });

      const subCountMap = new Map<string, number>();
      for (const p of allProducts) {
        const sub = (p.subcategory?.trim().toLowerCase()) || inferSub(p.name, p.description) || null;
        if (!sub) continue;
        subCountMap.set(sub, (subCountMap.get(sub) ?? 0) + 1);
      }

      const subcategories = Array.from(subCountMap.entries())
        .map(([name, count]) => ({ name, count }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 200);

      const brandRows = await prisma.product.findMany({
        where: { deletedAt: null, Brand: { deletedAt: null } },
        select: {
          Brand: { select: { name: true } },
        },
        take: 2000,
        orderBy: { createdAt: 'desc' },
      });

      const brandMap = new Map<string, number>();
      for (const r of brandRows as any[]) {
        const name = String(r?.Brand?.name ?? '').trim();
        if (!name) continue;
        brandMap.set(name, (brandMap.get(name) ?? 0) + 1);
      }
      const brands = Array.from(brandMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 100);

      const categoryGroups = await prisma.product.groupBy({
        by: ['categoryId'],
        where: { deletedAt: null },
        _count: { _all: true },
      });

      const categoryIds = categoryGroups.map((g) => g.categoryId);
      const categoryRows = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, slug: true },
      });
      const categoryMap = new Map<number, { name: string; slug: string }>();
      for (const row of categoryRows as any[]) {
        const name = String(row?.name ?? '').trim();
        const slug = String(row?.slug ?? '').trim();
        if (!row?.id || (!name && !slug)) continue;
        categoryMap.set(row.id, { name, slug });
      }

      const categories = categoryGroups
        .map((g) => {
          const cat = categoryMap.get(g.categoryId);
          if (!cat) return null;
          return {
            name: cat.name,
            slug: cat.slug,
            count: Number(g._count?._all ?? 0),
          };
        })
        .filter((x): x is { name: string; slug: string; count: number } => !!x && x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

      return NextResponse.json(
        { subcategories, brands, categories },
        { status: 200, headers: PUBLIC_CACHE_HEADERS }
      );
    }

    if (!q && !category) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    await maybeBuildFuzzy();

    let detectedBrand: { name: string; norm: string } | null = null;
    if (qMatch && qMatch.length >= 2) {
      const candidates = await loadBrandCandidates();
      const best = findBestPhraseMatch(qMatch, candidates);
      if (best) {
        const original = candidates.find((b) => normalizeMatchText(b) === best.norm) ?? best.raw;
        detectedBrand = { name: original, norm: best.norm };
      }
    }

    let smartText = qMatch;
    if (detectedBrand) smartText = stripPhrase(smartText, detectedBrand.norm);
    if (groupPhraseMatch) smartText = stripPhrase(smartText, normalizeMatchText(groupPhraseMatch.raw));
    if (subMatch) smartText = stripPhrase(smartText, normalizeMatchText(subMatch.raw));
    if (catMatch) smartText = stripPhrase(smartText, normalizeMatchText(catMatch.raw));
    const smartQuery = smartText.trim();

    const orFilters: Prisma.ProductWhereInput[] = [];
    const hasSmartFilters = !!(detectedBrand || subForFilter || catMatch || groupSubs);
    const textForSearch = smartQuery || (hasSmartFilters ? '' : q);
    if (textForSearch) {
      orFilters.push({ name: { contains: textForSearch, mode: Prisma.QueryMode.insensitive } });
      if (fuzzyText) orFilters.push({ name: { contains: fuzzyText, mode: Prisma.QueryMode.insensitive } });
      orFilters.push({ description: { contains: textForSearch, mode: Prisma.QueryMode.insensitive } });
      orFilters.push({ subcategory: { contains: textForSearch, mode: Prisma.QueryMode.insensitive } });
      if (subFromSyn) {
        orFilters.push({ subcategory: { equals: subFromSyn, mode: Prisma.QueryMode.insensitive } });
      }
      orFilters.push({ Brand: { is: { name: { startsWith: textForSearch, mode: Prisma.QueryMode.insensitive } } } });
      if (fuzzyText) {
        orFilters.push({ Brand: { is: { name: { startsWith: fuzzyText, mode: Prisma.QueryMode.insensitive } } } });
      }
    }

    const andFilters: Prisma.ProductWhereInput[] = [];
    if (category) {
      andFilters.push({
        OR: [
          { Category: { is: { name: { equals: category, mode: Prisma.QueryMode.insensitive } } } },
          { Category: { is: { slug: { equals: category, mode: Prisma.QueryMode.insensitive } } } },
        ],
      });
    }
    if (catMatch && !category && !subMatch && !groupSubs) {
      const categoryValue = CATEGORY_SYNONYMS[catMatch.raw] ?? CATEGORY_SYNONYMS[catMatch.norm];
      if (categoryValue) {
        andFilters.push({
          OR: [
            { Category: { is: { name: { equals: categoryValue, mode: Prisma.QueryMode.insensitive } } } },
            { Category: { is: { slug: { equals: categoryValue, mode: Prisma.QueryMode.insensitive } } } },
          ],
        });
      }
    }
    if (detectedBrand?.name) {
      andFilters.push({
        Brand: { is: { name: { equals: detectedBrand.name, mode: Prisma.QueryMode.insensitive } } },
      });
    }
    // Group synonyms: "кофта" -> match any of [hoodie, sweater, sweatshirt, cardigan]
    // Also match by product name, because subcategory in DB might differ from English slug.
    // E.g. product "Свитер Acne Studios" may have subcategory=null but "свитер" is in its name.
    if (groupSubs && groupSubs.length > 0) {
      const groupKey = groupPhraseMatch?.raw ?? Object.keys(GROUP_SYNONYMS).find(k => GROUP_SYNONYMS[k] === groupSubs) ?? '';
      const nameVariants: Prisma.ProductWhereInput[] = groupSubs.map((sub) => ({
        subcategory: { equals: sub, mode: Prisma.QueryMode.insensitive },
      }));
      // Also search by the original Russian word in product name (e.g. "кофта" in name)
      if (groupKey) {
        nameVariants.push({ name: { contains: groupKey, mode: Prisma.QueryMode.insensitive } });
      }
      // Add all individual subcategory names as name searches too (e.g. "свитер", "худи" in name)
      const reverseMap: Record<string, string[]> = {};
      for (const [ru, en] of Object.entries(SUBCATEGORY_SYNONYMS)) {
        if (groupSubs.includes(en)) {
          if (!reverseMap[en]) reverseMap[en] = [];
          // Only add Russian words (contain cyrillic)
          if (/[а-яё]/i.test(ru)) reverseMap[en].push(ru);
        }
      }
      for (const ruWords of Object.values(reverseMap)) {
        for (const w of ruWords) {
          nameVariants.push({ name: { contains: w, mode: Prisma.QueryMode.insensitive } });
        }
      }
      andFilters.push({ OR: nameVariants });
    } else if (subForFilter) {
      // Single subcategory: also search by name as fallback
      const subRuWords: string[] = [];
      for (const [ru, en] of Object.entries(SUBCATEGORY_SYNONYMS)) {
        if (en === subForFilter && /[а-яё]/i.test(ru)) subRuWords.push(ru);
      }
      const subOrFilters: Prisma.ProductWhereInput[] = [
        { subcategory: { equals: subForFilter, mode: Prisma.QueryMode.insensitive } },
        ...subRuWords.map((w) => ({ name: { contains: w, mode: Prisma.QueryMode.insensitive } })),
      ];
      andFilters.push({ OR: subOrFilters });
    }

    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (orFilters.length) where.OR = orFilters;
    if (andFilters.length) where.AND = andFilters;

    // Brand card (even if results are empty)
    let brandCard: { name: string; slug: string; logoUrl: string | null; count: number } | null = null;
    if (qNorm.length >= 2) {
      const slugGuess = slugify(q);
      const orBrand: Prisma.BrandWhereInput[] = [];
      if (detectedBrand?.name) {
        orBrand.push({ name: { equals: detectedBrand.name, mode: Prisma.QueryMode.insensitive } });
      }
      if (q) {
        orBrand.push({ name: { contains: q, mode: Prisma.QueryMode.insensitive } });
      }
      if (slugGuess) {
        orBrand.push({ slug: { equals: slugGuess, mode: Prisma.QueryMode.insensitive } });
        orBrand.push({ slug: { contains: slugGuess, mode: Prisma.QueryMode.insensitive } });
      }
      if (orBrand.length) {
        const brandRow = await prisma.brand.findFirst({
          where: { OR: orBrand },
          select: { id: true, name: true, slug: true, logoUrl: true },
        });
        if (brandRow?.id) {
          const count = await prisma.product.count({
            where: { deletedAt: null, brandId: brandRow.id },
          });
          brandCard = {
            name: brandRow.name,
            slug: brandRow.slug,
            logoUrl: brandRow.logoUrl ?? null,
            count,
          };
        }
      }
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        Brand: true,
      },
    });

    const items = products.map((p: any) => {
      const arrayFirst = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
      const img = typeof p.imageUrl === 'string' && p.imageUrl.length > 0 ? p.imageUrl : arrayFirst;

      return {
        id: String(p.id),
        name: p.name,
        price: p.price ?? null,
        brandName: p.Brand?.name ?? null,
        brandSlug: p.Brand?.slug ?? null,
        brandLogo: p.Brand?.logoUrl ?? null,
        imageUrl: img,
        images: Array.isArray(p.images) ? p.images : [],
      };
    });

    let suggestion: string | null = fuzzyText ?? synonymSuggestion;

    if (!suggestion && items.length === 0 && qNorm && !subFromSyn) {
      const subcategoryGroups = await prisma.product.groupBy({
        by: ['subcategory'],
        where: { subcategory: { not: null }, deletedAt: null },
        _count: { _all: true },
      });

      const subCandidates = subcategoryGroups
        .map((g: any) => String(g.subcategory ?? '').trim())
        .filter((x) => x.length > 0);

      const brandRows2 = await prisma.product.findMany({
        where: { deletedAt: null, Brand: { deletedAt: null } },
        select: { Brand: { select: { name: true } } },
        take: 1500,
        orderBy: { createdAt: 'desc' },
      });

      const brandCandidates = (brandRows2 as any[])
        .map((r) => String(r?.Brand?.name ?? '').trim())
        .filter((x) => x.length > 0);

      const ruSynKeys = Object.keys(SUBCATEGORY_SYNONYMS);
      const best = bestSuggestion(qRaw, [...ruSynKeys, ...subCandidates, ...brandCandidates]);
      suggestion = best && normalizeText(best) !== qNorm ? best : null;
    }

    return NextResponse.json({ items, suggestion, brand: brandCard }, { status: 200, headers: PUBLIC_CACHE_HEADERS });
  } catch (err) {
    console.error('GET /api/search failed');
    return NextResponse.json({ items: [], error: 'Search failed' }, { status: 500 });
  }
}
