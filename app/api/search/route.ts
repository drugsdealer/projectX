import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { slugify } from '@/lib/slug';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { normalizeSubcategorySlug, resolveProductTaxonomy } from '@/lib/catalog-taxonomy';

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

function tokenizeSearch(input: string) {
  return normalizeMatchText(input)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function bestTokenSuggestion(tokens: string[], candidates: string[]) {
  let best: { token: string; candidate: string; distance: number } | null = null;
  for (const token of tokens) {
    for (const candidate of candidates) {
      const norm = normalizeMatchText(candidate);
      if (!norm) continue;
      const distance = levenshtein(token, norm);
      const maxDistance = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
      if (distance > maxDistance) continue;
      if (!best || distance < best.distance || (distance === best.distance && norm.length > normalizeMatchText(best.candidate).length)) {
        best = { token, candidate, distance };
      }
    }
  }
  return best;
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

const SUBCATEGORY_ALIASES: Record<string, string[]> = {
  sneaker: ['sneaker', 'sneakers'],
  sneakers: ['sneakers', 'sneaker'],
  boot: ['boot', 'boots'],
  boots: ['boots', 'boot'],
  loafer: ['loafer', 'loafers'],
  loafers: ['loafers', 'loafer'],
  sandal: ['sandal', 'sandals'],
  sandals: ['sandals', 'sandal'],
  hoodie: ['hoodie', 'hoodies'],
  hoodies: ['hoodies', 'hoodie'],
  sweater: ['sweater', 'sweaters'],
  sweaters: ['sweaters', 'sweater'],
  sweatshirt: ['sweatshirt', 'sweatshirts'],
  sweatshirts: ['sweatshirts', 'sweatshirt'],
  cardigan: ['cardigan', 'cardigans'],
  cardigans: ['cardigans', 'cardigan'],
  tshirt: ['tshirt', 'tshirts', 't-shirt', 'tee'],
  tshirts: ['tshirts', 'tshirt', 't-shirt', 'tee'],
  trouser: ['trouser', 'trousers', 'pants'],
  trousers: ['trousers', 'trouser', 'pants'],
  pant: ['pant', 'pants', 'trousers'],
  pants: ['pants', 'pant', 'trousers'],
  jean: ['jean', 'jeans'],
  jeans: ['jeans', 'jean'],
  jacket: ['jacket', 'jackets'],
  jackets: ['jackets', 'jacket'],
  coat: ['coat', 'coats'],
  coats: ['coats', 'coat'],
  dress: ['dress', 'dresses'],
  dresses: ['dresses', 'dress'],
  skirt: ['skirt', 'skirts'],
  skirts: ['skirts', 'skirt'],
  bag: ['bag', 'bags'],
  bags: ['bags', 'bag'],
  backpack: ['backpack', 'backpacks'],
  backpacks: ['backpacks', 'backpack'],
  fragrance: ['fragrance', 'fragrances'],
  fragrances: ['fragrances', 'fragrance'],
  cap: ['cap', 'caps'],
  caps: ['caps', 'cap'],
  beanie: ['beanie', 'beanies'],
  beanies: ['beanies', 'beanie'],
  hat: ['hat', 'hats'],
  hats: ['hats', 'hat'],
  ring: ['ring', 'rings'],
  rings: ['rings', 'ring'],
  earring: ['earring', 'earrings'],
  earrings: ['earrings', 'earring'],
  belt: ['belt', 'belts'],
  belts: ['belts', 'belt'],
};

function subcategoryAliases(slug?: string | null) {
  if (!slug) return [];
  const base = normalizeMatchText(slug);
  return Array.from(new Set([base, ...(SUBCATEGORY_ALIASES[base] ?? [])].filter(Boolean)));
}

function subcategoryRuWords(slugs: string[]) {
  const aliases = new Set(slugs.flatMap((slug) => subcategoryAliases(slug)));
  const words: string[] = [];
  for (const [word, slug] of Object.entries(SUBCATEGORY_SYNONYMS)) {
    if (!/[а-яё]/i.test(word)) continue;
    if (aliases.has(slug) || subcategoryAliases(slug).some((alias) => aliases.has(alias))) {
      words.push(word);
    }
  }
  return Array.from(new Set(words));
}

const TYPE_CATEGORY_ALIASES: Record<string, string[]> = {
  sneaker: ['footwear', 'обувь'],
  sneakers: ['footwear', 'обувь'],
  boot: ['footwear', 'обувь'],
  boots: ['footwear', 'обувь'],
  loafer: ['footwear', 'обувь'],
  loafers: ['footwear', 'обувь'],
  sandal: ['footwear', 'обувь'],
  sandals: ['footwear', 'обувь'],
  hoodie: ['clothes', 'одежда'],
  hoodies: ['clothes', 'одежда'],
  sweater: ['clothes', 'одежда'],
  sweaters: ['clothes', 'одежда'],
  sweatshirt: ['clothes', 'одежда'],
  sweatshirts: ['clothes', 'одежда'],
  cardigan: ['clothes', 'одежда'],
  cardigans: ['clothes', 'одежда'],
  tshirt: ['clothes', 'одежда'],
  tshirts: ['clothes', 'одежда'],
  jacket: ['clothes', 'одежда'],
  jackets: ['clothes', 'одежда'],
  coat: ['clothes', 'одежда'],
  coats: ['clothes', 'одежда'],
  pant: ['clothes', 'одежда'],
  pants: ['clothes', 'одежда'],
  jeans: ['clothes', 'одежда'],
  bag: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  bags: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  travelbag: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  backpack: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  backpacks: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  waistbag: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  waistbags: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  wallet: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  wallets: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  cardholder: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  cardholders: ['bags', 'сумки', 'сумки-и-рюкзаки'],
  fragrance: ['fragrance', 'fragrances', 'парфюм', 'парфюмерия'],
  fragrances: ['fragrance', 'fragrances', 'парфюм', 'парфюмерия'],
};

const TYPE_RELATED_SUBS: Record<string, string[]> = {
  bag: ['bag', 'bags', 'travelbag', 'travelbags', 'backpack', 'backpacks', 'waistbag', 'waistbags', 'wallet', 'wallets', 'cardholder', 'cardholders'],
  bags: ['bag', 'bags', 'travelbag', 'travelbags', 'backpack', 'backpacks', 'waistbag', 'waistbags', 'wallet', 'wallets', 'cardholder', 'cardholders'],
};

const TYPE_NAME_ALIASES: Record<string, string[]> = {
  bag: ['bag', 'bags', 'сумка', 'сумки', 'сумочка', 'keepall', 'neverfull', 'speedy', 'pochette', 'alma', 'capucines', 'on-the-go', 'onthego', 'sac'],
  bags: ['bag', 'bags', 'сумка', 'сумки', 'сумочка', 'keepall', 'neverfull', 'speedy', 'pochette', 'alma', 'capucines', 'on-the-go', 'onthego', 'sac'],
  sweater: ['sweater', 'sweaters', 'свитер', 'свитеры', 'джемпер', 'knit', 'knitwear', 'pullover'],
  sweaters: ['sweater', 'sweaters', 'свитер', 'свитеры', 'джемпер', 'knit', 'knitwear', 'pullover'],
  hoodie: ['hoodie', 'hoodies', 'худи', 'толстовка'],
  hoodies: ['hoodie', 'hoodies', 'худи', 'толстовка'],
  tshirt: ['tshirt', 't-shirt', 'tee', 'футболка', 'футболки'],
  tshirts: ['tshirt', 't-shirt', 'tee', 'футболка', 'футболки'],
};

function expandSubcategories(slugs: string[]) {
  const expanded = new Set<string>();
  for (const slug of slugs) {
    for (const alias of subcategoryAliases(slug)) expanded.add(alias);
    for (const related of TYPE_RELATED_SUBS[normalizeMatchText(slug)] ?? []) {
      for (const alias of subcategoryAliases(related)) expanded.add(alias);
    }
  }
  return Array.from(expanded);
}

function typeCategoryAliases(slugs: string[]) {
  const out = new Set<string>();
  for (const slug of slugs) {
    for (const alias of subcategoryAliases(slug)) {
      for (const cat of TYPE_CATEGORY_ALIASES[alias] ?? []) out.add(normalizeMatchText(cat));
    }
  }
  return Array.from(out);
}

function typeNameAliases(slugs: string[]) {
  const out = new Set<string>();
  for (const slug of slugs) {
    for (const alias of subcategoryAliases(slug)) {
      for (const name of TYPE_NAME_ALIASES[alias] ?? []) out.add(normalizeMatchText(name));
    }
  }
  for (const word of subcategoryRuWords(slugs)) out.add(normalizeMatchText(word));
  return Array.from(out);
}

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
    const qTokens = tokenizeSearch(qRaw);
    const categoryRaw = searchParams.get('category') ?? '';
    const category = categoryRaw.trim();
    const genderParam = (searchParams.get('gender') ?? '').trim().toLowerCase();

    // --- fuzzy text for brands / names (peezy -> yeezy, etc.) ---
    let fuzzyText: string | null = null;
    let brandRowsCache: Array<{ id: number; name: string; slug: string; logoUrl: string | null }> | null = null;
    let brandCandidates: string[] | null = null;

    const loadBrandRows = async () => {
      if (brandRowsCache) return brandRowsCache;
      brandRowsCache = await prisma.brand.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true, logoUrl: true },
        take: 3000,
        orderBy: { createdAt: 'desc' },
      });
      return brandRowsCache;
    };

    const loadBrandCandidates = async () => {
      if (brandCandidates) return brandCandidates;
      const brandRows = await loadBrandRows();
      brandCandidates = Array.from(
        new Set(
          brandRows
            .flatMap((r: any) => {
              const name = String(r?.name ?? '').trim();
              const slug = String(r?.slug ?? '').trim();
              return [name, slug, ...tokenizeSearch(name), ...tokenizeSearch(slug)];
            })
            .filter(Boolean)
        )
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

    const groupKeys = Object.keys(GROUP_SYNONYMS);
    const synKeys = Object.keys(SUBCATEGORY_SYNONYMS);

    // Check group synonyms first ("кофта" -> [hoodie, sweater, sweatshirt, cardigan])
    const groupMatch = GROUP_SYNONYMS[qNorm] ?? GROUP_SYNONYMS[qMatch] ?? null;
    // Also check if any group synonym appears as a phrase in the query ("кофта balenciaga" -> кофта)
    const groupPhraseMatch = !groupMatch && qMatch
      ? findBestPhraseMatch(qMatch, groupKeys)
      : null;
    const groupTokenSuggestion = !groupMatch && !groupPhraseMatch
      ? bestTokenSuggestion(qTokens, groupKeys)
      : null;
    const groupSubs: string[] | null = groupMatch
      ?? (groupPhraseMatch ? GROUP_SYNONYMS[groupPhraseMatch.raw] ?? GROUP_SYNONYMS[groupPhraseMatch.norm] ?? null : null)
      ?? (groupTokenSuggestion ? GROUP_SYNONYMS[groupTokenSuggestion.candidate] ?? null : null);

    // exact synonym match ("кроссовки" -> sneakers)
    const subFromSynExact = !groupSubs ? (SUBCATEGORY_SYNONYMS[qNorm] ?? SUBCATEGORY_SYNONYMS[qMatch]) : undefined;

    // fuzzy synonym match for typos
    const canonicalSubs = Array.from(new Set(Object.values(SUBCATEGORY_SYNONYMS)));

    const bestSynKey =
      !subFromSynExact && !groupSubs
        ? (bestSuggestion(qRaw, [...synKeys, ...canonicalSubs]) ?? bestTokenSuggestion(qTokens, [...synKeys, ...canonicalSubs])?.candidate ?? null)
        : null;

    const subFromSynFuzzy = bestSynKey ? SUBCATEGORY_SYNONYMS[normalizeText(bestSynKey)] ?? bestSynKey : undefined;

    const subMatch = !groupSubs && qMatch ? findBestPhraseMatch(qMatch, synKeys) : null;
    const catMatch = !subMatch && !groupSubs && qMatch ? findBestPhraseMatch(qMatch, Object.keys(CATEGORY_SYNONYMS)) : null;

    const subFromMatch = subMatch ? SUBCATEGORY_SYNONYMS[subMatch.raw] ?? SUBCATEGORY_SYNONYMS[subMatch.norm] : null;
    const subForFilter = subFromMatch ?? subFromSynExact ?? subFromSynFuzzy ?? null;
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

      // Build gender filter for facets
      const facetsWhere: any = { deletedAt: null };
      if (genderParam) {
        facetsWhere.OR = [
          { gender: { equals: genderParam, mode: 'insensitive' } },
          { gender: { equals: 'unisex', mode: 'insensitive' } },
          { gender: null },
        ];
      }

      // Load all products with name + existing subcategory to infer missing ones
      const allProducts = await prisma.product.findMany({
        where: facetsWhere,
        select: {
          id: true,
          name: true,
          description: true,
          subcategory: true,
          sizeType: true,
          Category: { select: { slug: true } },
        },
      });

      const subCountMap = new Map<string, number>();
      for (const p of allProducts) {
        const sub = resolveProductTaxonomy(p).subcategorySlug;
        if (!sub) continue;
        subCountMap.set(sub, (subCountMap.get(sub) ?? 0) + 1);
      }

      const subcategories = Array.from(subCountMap.entries())
        .map(([name, count]) => ({ name, count }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 200);

      const brandRows = await prisma.product.findMany({
        where: { ...facetsWhere, Brand: { deletedAt: null } },
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
        where: facetsWhere,
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

      const facetHeaders = genderParam
        ? { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' }
        : PUBLIC_CACHE_HEADERS;

      return NextResponse.json(
        { subcategories, brands, categories },
        { status: 200, headers: facetHeaders }
      );
    }

    if (!q && !category && !genderParam) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    await maybeBuildFuzzy();

    let detectedBrand: { id: number; name: string; slug: string; logoUrl: string | null; norm: string; matchedToken?: string } | null = null;
    if (qMatch && qMatch.length >= 2) {
      const brandRows = await loadBrandRows();
      const brandNames = brandRows.map((b) => b.name);
      const brandSlugs = brandRows.map((b) => b.slug);
      const candidates = await loadBrandCandidates();
      const best = findBestPhraseMatch(qMatch, candidates);
      if (best) {
        const row =
          brandRows.find((b) => normalizeMatchText(b.name) === best.norm || normalizeMatchText(b.slug) === best.norm) ??
          brandRows.find((b) => normalizeMatchText(b.name).includes(best.norm) || normalizeMatchText(b.slug).includes(best.norm));
        if (row) detectedBrand = { ...row, norm: best.norm };
      }
      if (!detectedBrand) {
        const bestBrandToken = bestTokenSuggestion(qTokens, [...brandNames, ...brandSlugs]);
        if (bestBrandToken) {
          const bestNorm = normalizeMatchText(bestBrandToken.candidate);
          const row =
            brandRows.find((b) => normalizeMatchText(b.name) === bestNorm || normalizeMatchText(b.slug) === bestNorm) ??
            brandRows.find((b) => normalizeMatchText(b.name).split(' ').includes(bestNorm) || normalizeMatchText(b.slug).split('-').includes(bestNorm));
          if (row) detectedBrand = { ...row, norm: bestNorm, matchedToken: bestBrandToken.token };
        }
      }
    }

    let smartText = qMatch;
    if (detectedBrand) {
      smartText = stripPhrase(smartText, detectedBrand.norm);
      if (detectedBrand.matchedToken) smartText = stripPhrase(smartText, detectedBrand.matchedToken);
    }
    if (groupPhraseMatch) smartText = stripPhrase(smartText, normalizeMatchText(groupPhraseMatch.raw));
    if (groupTokenSuggestion) smartText = stripPhrase(smartText, groupTokenSuggestion.token);
    if (subMatch) smartText = stripPhrase(smartText, normalizeMatchText(subMatch.raw));
    if (bestSynKey) {
      const bestSynToken = bestTokenSuggestion(qTokens, [bestSynKey]);
      if (bestSynToken) smartText = stripPhrase(smartText, bestSynToken.token);
      smartText = stripPhrase(smartText, normalizeMatchText(bestSynKey));
    }
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
        for (const alias of subcategoryAliases(subFromSyn)) {
          orFilters.push({ subcategory: { equals: alias, mode: Prisma.QueryMode.insensitive } });
        }
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
      const groupKey =
        groupPhraseMatch?.raw ??
        groupTokenSuggestion?.candidate ??
        Object.keys(GROUP_SYNONYMS).find(k => GROUP_SYNONYMS[k] === groupSubs) ??
        '';
      const groupAliases = expandSubcategories(groupSubs);
      const groupNameAliases = typeNameAliases(groupSubs);
      const nameVariants: Prisma.ProductWhereInput[] = groupAliases.map((sub) => ({
        subcategory: { equals: sub, mode: Prisma.QueryMode.insensitive },
      }));
      // Also search by the original Russian word in product name (e.g. "кофта" in name)
      if (groupKey) {
        nameVariants.push({ name: { contains: groupKey, mode: Prisma.QueryMode.insensitive } });
      }
      // Add all individual subcategory names as name searches too (e.g. "свитер", "худи" in name)
      for (const w of subcategoryRuWords(groupSubs)) {
        nameVariants.push({ name: { contains: w, mode: Prisma.QueryMode.insensitive } });
      }
      for (const w of groupNameAliases) {
        nameVariants.push({ name: { contains: w, mode: Prisma.QueryMode.insensitive } });
      }
      andFilters.push({ OR: nameVariants });
    } else if (subForFilter) {
      // Single subcategory: also search by name as fallback
      const aliases = expandSubcategories([subForFilter]);
      const typeWords = typeNameAliases([subForFilter]);
      const subOrFilters: Prisma.ProductWhereInput[] = [
        ...aliases.map((alias) => ({ subcategory: { equals: alias, mode: Prisma.QueryMode.insensitive } })),
        ...typeWords.map((w) => ({ name: { contains: w, mode: Prisma.QueryMode.insensitive } })),
      ];
      andFilters.push({ OR: subOrFilters });
    }

    if (genderParam) {
      andFilters.push({
        OR: [
          { gender: { equals: genderParam, mode: Prisma.QueryMode.insensitive } },
          { gender: { equals: 'unisex', mode: Prisma.QueryMode.insensitive } },
        ],
      });
    }

    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (orFilters.length) where.OR = orFilters;
    if (andFilters.length) where.AND = andFilters;

    // Brand card (even if results are empty)
    let brandCard: { name: string; slug: string; logoUrl: string | null; count: number } | null = null;
    if (detectedBrand?.id) {
      const count = await prisma.product.count({
        where: { deletedAt: null, brandId: detectedBrand.id },
      });
      brandCard = {
        name: detectedBrand.name,
        slug: detectedBrand.slug,
        logoUrl: detectedBrand.logoUrl ?? null,
        count,
      };
    } else if (qNorm.length >= 2) {
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
      take: Math.min(200, Math.max(take * 4, take)),
      select: {
        id: true,
        name: true,
        price: true,
        oldPrice: true,
        imageUrl: true,
        images: true,
        description: true,
        available: true,
        premium: true,
        badge: true,
        gender: true,
        subcategory: true,
        categoryId: true,
        brandId: true,
        createdAt: true,
        Brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
        Category: { select: { name: true, slug: true } },
      },
    });

    const queryTerms = smartQuery
      ? tokenizeSearch(smartQuery)
      : qTokens.filter((token) => token !== detectedBrand?.matchedToken && token !== detectedBrand?.norm);
    const wantedBaseSubs = groupSubs?.length ? groupSubs : subForFilter ? [subForFilter] : [];
    const wantedSubs = wantedBaseSubs.length
      ? expandSubcategories(wantedBaseSubs)
      : [];
    const wantedNameAliases = wantedBaseSubs.length
      ? typeNameAliases(wantedBaseSubs)
      : [];
    const wantedRuWords = groupSubs?.length
      ? subcategoryRuWords(groupSubs)
      : subForFilter
      ? subcategoryRuWords([subForFilter])
      : [];

    const scoreProduct = (p: any) => {
      const name = normalizeMatchText(p.name || '');
      const description = normalizeMatchText(p.description || '');
      const subcategory = normalizeSubcategorySlug(p.subcategory) ?? normalizeMatchText(p.subcategory || '');
      const brandName = normalizeMatchText(p.Brand?.name || '');
      const brandSlug = normalizeMatchText(p.Brand?.slug || '');
      const categoryName = normalizeMatchText(p.Category?.name || '');
      const categorySlug = normalizeMatchText(p.Category?.slug || '');
      let score = 0;

      if (detectedBrand) {
        if (brandName === normalizeMatchText(detectedBrand.name) || brandSlug === normalizeMatchText(detectedBrand.slug)) score += 80;
        else if (brandName.includes(detectedBrand.norm) || brandSlug.includes(detectedBrand.norm)) score += 45;
      }

      if (wantedSubs.length) {
        if (wantedSubs.includes(subcategory)) score += 70;
        if (wantedRuWords.some((word) => name.includes(normalizeMatchText(word)))) score += 55;
        if (wantedNameAliases.some((word) => name.includes(word))) score += 45;
      }

      for (const term of queryTerms) {
        if (!term) continue;
        if (name === term) score += 55;
        else if (name.startsWith(term)) score += 35;
        else if (name.includes(term)) score += 22;
        if (brandName.includes(term) || brandSlug.includes(term)) score += 18;
        if (subcategory.includes(term)) score += 12;
        if (categoryName.includes(term) || categorySlug.includes(term)) score += 10;
        if (description.includes(term)) score += 4;
      }

      if (p.imageUrl || (Array.isArray(p.images) && p.images.length)) score += 5;
      if (p.available !== false) score += 3;
      if (p.oldPrice || String(p.badge || '').toLowerCase() === 'sale') score += 1;

      return score;
    };

    const rankedProducts = [...products]
      .map((p: any) => ({ product: p, score: scoreProduct(p) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.product.createdAt ?? 0).getTime() - new Date(a.product.createdAt ?? 0).getTime();
      })
      .slice(0, take)
      .map((row) => row.product);

    const items = rankedProducts.map((p: any) => {
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

    const correctedParts = [
      groupTokenSuggestion?.candidate && groupTokenSuggestion.candidate !== groupTokenSuggestion.token ? groupTokenSuggestion.candidate : null,
      bestSynKey && !subMatch && normalizeText(bestSynKey) !== qNorm ? bestSynKey : null,
      detectedBrand?.matchedToken && normalizeMatchText(detectedBrand.name) !== detectedBrand.matchedToken ? detectedBrand.name : null,
    ].filter(Boolean) as string[];
    let suggestion: string | null = fuzzyText ?? synonymSuggestion ?? (correctedParts.length ? correctedParts.join(' ') : null);

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
