type ProductLike = {
  name?: string | null;
  description?: string | null;
  subcategory?: string | null;
  categorySlug?: string | null;
  categoryDbSlug?: string | null;
  category?: { slug?: string | null } | null;
  Category?: { slug?: string | null } | null;
  sizeType?: string | null;
};

export const DB_CATEGORY_TO_UI: Record<string, string> = {
  "обувь": "footwear",
  "одежда": "clothes",
  "головные-уборы": "headwear",
  "аксессуары": "accessories",
  "сумки-и-рюкзаки": "bags",
  "парфюмерия": "fragrance",
  "premium": "premium",
};

export const UI_CATEGORY_TO_DB: Record<string, string> = Object.entries(DB_CATEGORY_TO_UI).reduce(
  (acc, [db, ui]) => {
    acc[ui] = db;
    return acc;
  },
  {} as Record<string, string>
);

const CATEGORY_ALIASES: Record<string, string> = {
  shoe: "footwear",
  shoes: "footwear",
  footwear: "footwear",
  clothing: "clothes",
  clothes: "clothes",
  apparel: "clothes",
  bag: "bags",
  bags: "bags",
  backpack: "bags",
  backpacks: "bags",
  accessory: "accessories",
  accessories: "accessories",
  jewelry: "accessories",
  jewellery: "accessories",
  perfume: "fragrance",
  perfumery: "fragrance",
  fragrance: "fragrance",
  fragrances: "fragrance",
  headwear: "headwear",
  hats: "headwear",
};

export const SUBCATEGORY_PARENT: Record<string, string> = {
  sneakers: "footwear",
  boots: "footwear",
  loafers: "footwear",
  sandals: "footwear",
  tshirts: "clothes",
  hoodies: "clothes",
  sweatshirts: "clothes",
  sweaters: "clothes",
  cardigans: "clothes",
  shirts: "clothes",
  polo: "clothes",
  jackets: "clothes",
  coats: "clothes",
  parkas: "clothes",
  vests: "clothes",
  jeans: "clothes",
  pants: "clothes",
  trousers: "clothes",
  shorts: "clothes",
  tracksuits: "clothes",
  dresses: "clothes",
  skirts: "clothes",
  suits: "clothes",
  tops: "clothes",
  bags: "bags",
  backpacks: "bags",
  totes: "bags",
  waistbags: "bags",
  travelbags: "bags",
  cardholders: "bags",
  wallets: "bags",
  belts: "accessories",
  glasses: "accessories",
  watches: "accessories",
  rings: "accessories",
  earrings: "accessories",
  bracelets: "accessories",
  necklaces: "accessories",
  keychains: "accessories",
  scarves: "accessories",
  gloves: "accessories",
  socks: "accessories",
  jewelry: "accessories",
  caps: "headwear",
  beanies: "headwear",
  hats: "headwear",
  fragrances: "fragrance",
};

const SUBCATEGORY_ALIASES: Record<string, string> = {
  sneaker: "sneakers",
  sneakers: "sneakers",
  boot: "boots",
  boots: "boots",
  loafer: "loafers",
  loafers: "loafers",
  sandal: "sandals",
  sandals: "sandals",
  tshirt: "tshirts",
  tshirts: "tshirts",
  "t-shirt": "tshirts",
  tee: "tshirts",
  hoodie: "hoodies",
  hoodies: "hoodies",
  sweater: "sweaters",
  sweaters: "sweaters",
  sweatshirt: "sweatshirts",
  sweatshirts: "sweatshirts",
  cardigan: "cardigans",
  cardigans: "cardigans",
  shirt: "shirts",
  shirts: "shirts",
  jacket: "jackets",
  jackets: "jackets",
  coat: "coats",
  coats: "coats",
  parka: "parkas",
  parkas: "parkas",
  vest: "vests",
  vests: "vests",
  jean: "jeans",
  jeans: "jeans",
  pant: "pants",
  pants: "pants",
  trouser: "trousers",
  trousers: "trousers",
  short: "shorts",
  shorts: "shorts",
  tracksuit: "tracksuits",
  tracksuits: "tracksuits",
  dress: "dresses",
  dresses: "dresses",
  skirt: "skirts",
  skirts: "skirts",
  suit: "suits",
  suits: "suits",
  top: "tops",
  tops: "tops",
  bag: "bags",
  bags: "bags",
  backpack: "backpacks",
  backpacks: "backpacks",
  tote: "totes",
  totes: "totes",
  waistbag: "waistbags",
  waistbags: "waistbags",
  travelbag: "travelbags",
  travelbags: "travelbags",
  cardholder: "cardholders",
  cardholders: "cardholders",
  wallet: "wallets",
  wallets: "wallets",
  belt: "belts",
  belts: "belts",
  glass: "glasses",
  glasses: "glasses",
  watch: "watches",
  watches: "watches",
  ring: "rings",
  rings: "rings",
  earring: "earrings",
  earrings: "earrings",
  bracelet: "bracelets",
  bracelets: "bracelets",
  necklace: "necklaces",
  necklaces: "necklaces",
  keychain: "keychains",
  keychains: "keychains",
  scarf: "scarves",
  scarves: "scarves",
  glove: "gloves",
  gloves: "gloves",
  sock: "socks",
  socks: "socks",
  cap: "caps",
  caps: "caps",
  beanie: "beanies",
  beanies: "beanies",
  hat: "hats",
  hats: "hats",
  perfume: "fragrances",
  perfumery: "fragrances",
  fragrance: "fragrances",
  fragrances: "fragrances",
};

const INFER_RULES: Array<{ slug: string; parent: string; rx: RegExp }> = [
  { slug: "sneakers", parent: "footwear", rx: /(кроссов|sneak|yeezy|dunk|air\s*force|jordan)/i },
  { slug: "boots", parent: "footwear", rx: /(ботинк|сапог|челси|chelsea|boot)/i },
  { slug: "loafers", parent: "footwear", rx: /(лофер|loafer|мокасин)/i },
  { slug: "sandals", parent: "footwear", rx: /(сандал|сланц|шлеп|sandal)/i },
  { slug: "tshirts", parent: "clothes", rx: /(футболк|t[\s-]?shirt|tee\b)/i },
  { slug: "hoodies", parent: "clothes", rx: /(худи|hoodie|толстовк)/i },
  { slug: "sweatshirts", parent: "clothes", rx: /(свитшот|sweatshirt)/i },
  { slug: "sweaters", parent: "clothes", rx: /(свитер|свитр|sweater|джемпер|jumper|пуловер|pullover)/i },
  { slug: "cardigans", parent: "clothes", rx: /(кардиган|cardigan)/i },
  { slug: "shirts", parent: "clothes", rx: /(рубашк|рубах|shirt(?!.*t-shirt))/i },
  { slug: "polo", parent: "clothes", rx: /(поло\b|polo\b)/i },
  { slug: "jackets", parent: "clothes", rx: /(куртк|бомбер|bomber|ветровк|jacket)/i },
  { slug: "coats", parent: "clothes", rx: /(пальто|coat|тренч|trench)/i },
  { slug: "parkas", parent: "clothes", rx: /(парка|parka|пухов|down\s*jacket)/i },
  { slug: "vests", parent: "clothes", rx: /(жилет|vest|безрукавк)/i },
  { slug: "jeans", parent: "clothes", rx: /(джинс|jeans|denim)/i },
  { slug: "pants", parent: "clothes", rx: /(брюк|штан|pants|trousers|чинос|chinos|джоггер|jogger|карго|cargo)/i },
  { slug: "shorts", parent: "clothes", rx: /(шорт|shorts)/i },
  { slug: "tracksuits", parent: "clothes", rx: /(спортивн.*костюм|tracksuit)/i },
  { slug: "dresses", parent: "clothes", rx: /(платье|dress)/i },
  { slug: "skirts", parent: "clothes", rx: /(юбк|skirt)/i },
  { slug: "suits", parent: "clothes", rx: /(костюм(?!.*спорт)|suit(?!.*track))/i },
  { slug: "backpacks", parent: "bags", rx: /(рюкзак|backpack)/i },
  { slug: "waistbags", parent: "bags", rx: /(поясн.*сумк|waist\s*bag|belt\s*bag|бананк)/i },
  { slug: "travelbags", parent: "bags", rx: /(дорожн.*сумк|keepall|travel\s*bag)/i },
  { slug: "totes", parent: "bags", rx: /(тоут|tote|шопер|shopper)/i },
  { slug: "bags", parent: "bags", rx: /(сумк|сумоч|bag(?!.*back)|клатч|clutch)/i },
  { slug: "cardholders", parent: "bags", rx: /(кардхолдер|card\s*holder|визитниц)/i },
  { slug: "wallets", parent: "bags", rx: /(кошел[её]к|бумажник|wallet)/i },
  { slug: "belts", parent: "accessories", rx: /(ремен|ремн|belt)/i },
  { slug: "glasses", parent: "accessories", rx: /(очк|glasses|sunglasses|солнцезащитн)/i },
  { slug: "watches", parent: "accessories", rx: /(час[ыов]|watch)/i },
  { slug: "rings", parent: "accessories", rx: /(кольц|ring)/i },
  { slug: "earrings", parent: "accessories", rx: /(серьг|серег|earring)/i },
  { slug: "bracelets", parent: "accessories", rx: /(браслет|bracelet)/i },
  { slug: "necklaces", parent: "accessories", rx: /(колье|цепоч|necklace|chain|подвеск|pendant)/i },
  { slug: "keychains", parent: "accessories", rx: /(брелок|брелк|keychain)/i },
  { slug: "scarves", parent: "accessories", rx: /(шарф|scarf|scarves|палантин)/i },
  { slug: "gloves", parent: "accessories", rx: /(перчатк|glove)/i },
  { slug: "socks", parent: "accessories", rx: /(носк|sock)/i },
  { slug: "caps", parent: "headwear", rx: /(кепк|бейсболк|cap\b)/i },
  { slug: "beanies", parent: "headwear", rx: /(шапк|beanie)/i },
  { slug: "hats", parent: "headwear", rx: /(панам|шляп|hat\b|bucket)/i },
  { slug: "fragrances", parent: "fragrance", rx: /(парфюм|духи|туалетн.*вод|eau\s*de|edp|edt|perfume|fragrance|аромат)/i },
];

function clean(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\s]+/g, "-");
}

export function normalizeCategorySlug(value?: string | null) {
  const key = clean(value);
  if (!key) return null;
  return DB_CATEGORY_TO_UI[key] ?? CATEGORY_ALIASES[key] ?? key;
}

export function mapUiCategoryToDb(value?: string | null) {
  const category = normalizeCategorySlug(value);
  if (!category) return null;
  return UI_CATEGORY_TO_DB[category] ?? value ?? null;
}

export function normalizeSubcategorySlug(value?: string | null) {
  const key = clean(value);
  if (!key) return null;
  return SUBCATEGORY_ALIASES[key] ?? key;
}

export function getSubcategoryAliases(value?: string | null) {
  const canonical = normalizeSubcategorySlug(value);
  if (!canonical) return [];
  const aliases = new Set<string>([canonical]);
  for (const [alias, target] of Object.entries(SUBCATEGORY_ALIASES)) {
    if (target === canonical) aliases.add(alias);
  }
  return Array.from(aliases);
}

export function getSubcategoryParent(value?: string | null) {
  const canonical = normalizeSubcategorySlug(value);
  return canonical ? SUBCATEGORY_PARENT[canonical] ?? null : null;
}

export function subcategoryBelongsToCategory(subcategory?: string | null, category?: string | null) {
  const subParent = getSubcategoryParent(subcategory);
  const normalizedCategory = normalizeCategorySlug(category);
  if (!subParent || !normalizedCategory) return false;
  return subParent === normalizedCategory;
}

export function getParentSubcategories(category?: string | null) {
  const normalizedCategory = normalizeCategorySlug(category);
  if (!normalizedCategory) return [];
  return Object.entries(SUBCATEGORY_PARENT)
    .filter(([, parent]) => parent === normalizedCategory)
    .map(([sub]) => sub);
}

export function inferSubcategoryFromName(name?: string | null, category?: string | null) {
  const text = String(name ?? "").trim();
  if (!text) return null;
  const normalizedCategory = normalizeCategorySlug(category);
  for (const rule of INFER_RULES) {
    if (normalizedCategory && rule.parent !== normalizedCategory) continue;
    if (rule.rx.test(text)) return rule.slug;
  }
  return null;
}

export function resolveProductTaxonomy(product: ProductLike) {
  const dbCategory = normalizeCategorySlug(
    product?.Category?.slug ?? product?.category?.slug ?? product?.categoryDbSlug ?? product?.categorySlug ?? null
  );
  const storedSub = normalizeSubcategorySlug(product?.subcategory ?? null);
  const storedSubValid = Boolean(storedSub && (!dbCategory || subcategoryBelongsToCategory(storedSub, dbCategory)));

  const inferredSub = !storedSubValid ? inferSubcategoryFromName(product?.name, dbCategory) : null;
  const subcategory = storedSubValid ? storedSub : inferredSub;
  const subParent = getSubcategoryParent(subcategory);

  let category = dbCategory || subParent || null;
  const sizeType = String(product?.sizeType ?? "").toUpperCase();
  if (!category && (sizeType === "SHOE" || sizeType === "SHOES" || sizeType === "FOOTWEAR")) {
    category = "footwear";
  }

  return { categorySlug: category, subcategorySlug: subcategory };
}
