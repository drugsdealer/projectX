import { hashSync } from "bcryptjs";
import { prisma } from "./prisma-client";
import { sizecl, sizes } from "./constant";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// Helper: attach multiple images to a product (store them in Product.images array)
async function addImages(product: any, urls: string[]) {
  if (!urls?.length) return;

  // Убираем пустые и дубликаты, чтобы в галерее не было мусора
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

  await prisma.product.update({
    where: { id: product.id },
    data: {
      // imageUrl мы задаём при создании товара, здесь заполняем только массив images
      images: uniqueUrls,
      updatedAt: new Date(),
    },
  });
}

async function up() {
  await prisma.user.createMany({
    data: [
      {
        fullName: "User Test",
        email: "user@test.ru",
        password: hashSync("111111", 10),
        verified: new Date(),
        role: "USER",
        updatedAt: new Date(),
      },
      {
        fullName: "Admin Admin",
        email: "admin@test.ru",
        password: hashSync("111111", 10),
        verified: new Date(),
        role: "ADMIN",
        updatedAt: new Date(),
      },
    ],
  });

  // --- seed promo codes ---
  const welcomePromo = await (prisma as any).promoCode.upsert({
    where: { code: 'WELCOME10' },
    update: { updatedAt: new Date() },
    create: {
      code: 'WELCOME10',
      description: 'Скидка 10% для новых клиентов',
      discountType: 'PERCENT',
      percentOff: 10,
      minSubtotal: 5000,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  const premiumPromo = await (prisma as any).promoCode.upsert({
    where: { code: 'PREMIUM1500' },
    update: { updatedAt: new Date() },
    create: {
      code: 'PREMIUM1500',
      description: '−1500 ₽ на премиум-товары',
      discountType: 'AMOUNT',
      amountOff: 1500,
      minSubtotal: 10000,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  // --- Промокод с ограничением по времени ---
  const blackFridayPromo = await (prisma as any).promoCode.upsert({
    where: { code: 'BLACKFRIDAY2025' },
    update: { updatedAt: new Date() },
    create: {
      code: 'BLACKFRIDAY2025',
      description: 'Скидка 25% по случаю Черной Пятницы',
      discountType: 'PERCENT',
      percentOff: 25,
      minSubtotal: 1000,
      startsAt: new Date('2025-11-04T00:00:00Z'),
      endsAt: new Date('2025-11-30T23:59:59Z'),
      isActive: true,
      updatedAt: new Date(),
    },
  });

  // (опционально) одно тестовое погашение для пользователя #1, чтобы список «Использованные» не был пустым
  await (prisma as any).promoRedemption.create({
    data: {
      userId: 1,
      promoCodeId: welcomePromo.id,
    },
  });

  // === БАЗОВЫЕ КАТЕГОРИИ (upsert по slug) ===
  const baseCats = [
    { slug: 'clothes',    name: 'Одежда' },
    { slug: 'footwear',   name: 'Обувь' },
    { slug: 'accessories',name: 'Аксессуары' },
    { slug: 'fragrance',  name: 'Парфюмерия' },
    { slug: 'headwear',   name: 'Головные уборы' },
    { slug: 'bags',       name: 'Сумки' },
  ];

  for (const c of baseCats) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, updatedAt: new Date() },
      create: { slug: c.slug, name: c.name, updatedAt: new Date() },
    });
  }
  // Resolve only the known base categories by slug, to avoid duplicates/empty slugs
  const cats = await prisma.category.findMany({
    where: { slug: { in: baseCats.map((c) => c.slug) } },
    select: { slug: true, id: true },
  });
  const bySlug: Record<string, number> = Object.fromEntries(
    cats.map((c) => [c.slug.toLowerCase(), c.id])
  );
  const cat = {
    clothes: bySlug["clothes"],
    footwear: bySlug["footwear"],
    accessories: bySlug["accessories"],
    fragrance: bySlug["fragrance"],
    headwear: bySlug["headwear"],
    bags: bySlug["bags"],
  };
  await prisma.sizeCl.createMany({ data: sizecl.map((s:any)=>({ ...s, updatedAt: new Date() })), skipDuplicates: true });
  await prisma.size.createMany({ data: sizes.map((s:any)=>({ ...s, updatedAt: new Date() })), skipDuplicates: true });

  // Новые бренды
  await prisma.brand.createMany({
    data: [
      {
        name: "Nike",
        slug: "nike",
        logoUrl: "/img/brands/nike.png",
        description: "Американский бренд спортивной обуви и одежды",
        aboutLong: "Nike — один из самых узнаваемых брендов в мире, специализирующийся на спортивной экипировке и коллаборациях с известными спортсменами и артистами.",
        tags: ["Премиум", "Хит"],
        isFeatured: true,
        updatedAt: new Date(),
      },
      {
        name: "Adidas",
        slug: "adidas",
        logoUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/Adidas_Logo_Alternative_2_2_l0avvn.webp",
        description: "Немецкий бренд спортивной одежды",
        aboutLong: "Adidas — международный гигант в мире спорта и уличной моды, известный своими инновациями и знаковыми силуэтами.",
        tags: ["Премиум"],
        isFeatured: true,
        updatedAt: new Date(),
      },
      {
        name: "Puma",
        slug: "puma",
        logoUrl: "/img/brands/puma.png",
        description: "Известный немецкий бренд спортивной одежды и обуви",
        aboutLong: "Puma — один из ведущих мировых брендов спортивной одежды, обуви и аксессуаров.",
        tags: [],
        isFeatured: false,
        updatedAt: new Date(),
      },
      {
        name: "Reebok",
        slug: "reebok",
        logoUrl: "/img/brands/reebok.png",
        description: "Бренд спортивной одежды и обуви",
        aboutLong: "Reebok — глобальный бренд с богатой историей в производстве спортивной экипировки.",
        tags: [],
        isFeatured: false,
        updatedAt: new Date(),
      },
      {
        name: "New Balance",
        slug: "new-balance",
        logoUrl: "/img/brands/newbalance.png",
        description: "Американский производитель спортивной обуви",
        aboutLong: "New Balance славится своим качеством и удобством спортивной обуви.",
        tags: [],
        isFeatured: false,
        updatedAt: new Date(),
      },
      {
        name: "Chrome Hearts",
        slug: "chrome-hearts",
        logoUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765797878/Chrome-Hearts-Logo_ddgcmz.png",
        description: "Американский бренд ювелирных изделий и аксессуаров",
        aboutLong: "Chrome Hearts — культовый бренд, известный своими уникальными аксессуарами и ювелирными изделиями.",
        tags: [],
        isFeatured: false,
        updatedAt: new Date(),
      },
      {
        name: "Stone Island",
        slug: "stone-island",
        logoUrl: "/img/brands/stoneisland.png",
        description: "Итальянский бренд одежды",
        aboutLong: "Stone Island — известен инновационным подходом к материалам и технологиям в производстве одежды.",
        tags: [],
        isFeatured: false,
        updatedAt: new Date(),
      },
      {
        name: "Converse",
        slug: "converse",
        logoUrl: "/img/brands/converse.png",
        description: "Американский бренд обуви",
        aboutLong: "Converse — легендарный производитель кед и спортивной обуви.",
        tags: [],
        isFeatured: false,
        updatedAt: new Date(),
      },
      {
        name: "Louis Vuitton",
        slug: "louis-vuitton",
        logoUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761174359/LV_khvkyh.svg",
        description: "Французский дом высокой моды",
        aboutLong: "Louis Vuitton — символ роскоши, стиля и элегантности. Дом моды, основанный в 1854 году, предлагает эксклюзивные аксессуары и одежду.",
        tags: ["Премиум", "Эксклюзив"],
        isFeatured: true,
        isPremium: true,
        updatedAt: new Date(),
      },
      {
        name: "Supreme",
        slug: "supreme",
        logoUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176286/idiZv-aD8G_logos_qrn7qg.png",
        description: "Культовый бренд уличной моды из Нью-Йорка",
        aboutLong: "Supreme — король уличной культуры, известный своими лимитированными релизами и коллаборациями с Nike, Louis Vuitton и другими.",
        tags: ["Хит"],
        isFeatured: true,
        updatedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.brand.updateMany({
    where: { slug: "louis-vuitton" },
    data: {
      slug: "louis-vuitton",
      isFeatured: true,
      isPremium: true,
      logoUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761174359/LV_khvkyh.svg",
      description: "Французский дом высокой моды",
      aboutLong: "Louis Vuitton — символ роскоши, стиля и элегантности. Дом моды, основанный в 1854 году, предлагает эксклюзивные аксессуары и одежду.",
      tags: ["Премиум", "Эксклюзив"],
    },
  });

  // Backfill slug for any existing brands where it's empty
  const brandsWithoutSlug = await prisma.brand.findMany({
    where: { slug: '' },
  });
  if (brandsWithoutSlug.length) {
    await Promise.all(
      brandsWithoutSlug.map((b) =>
        prisma.brand.update({
          where: { id: b.id },
          data: { slug: slugify(b.name) },
        })
      )
    );
  }

  // Цвета
  await prisma.color.createMany({
    data: [
      { name: "Black", updatedAt: new Date() },
      { name: "White", updatedAt: new Date() },
      { name: "Red", updatedAt: new Date() },
      { name: "Blue", updatedAt: new Date() },
      { name: "Gray", updatedAt: new Date() },
      { name: "Green", updatedAt: new Date() },
      { name: "Brown", updatedAt: new Date() },
    ],
    skipDuplicates: true,
  });

  // Получаем brandId и colorId для использования ниже
  const nike = await prisma.brand.findFirst({ where: { name: "Nike" } });
  const adidas = await prisma.brand.findFirst({ where: { name: "Adidas" } });
  const puma = await prisma.brand.findFirst({ where: { name: "Puma" } });
  const reebok = await prisma.brand.findFirst({ where: { name: "Reebok" } });
  const newBalance = await prisma.brand.findFirst({ where: { name: "New Balance" } });
  const louisVuitton = await prisma.brand.findFirst({ where: { slug: "louis-vuitton" } });
  const ChromeHearts = await prisma.brand.findFirst({ where: { name: "Chrome Hearts" } });
  const Supreme = await prisma.brand.findFirst({ where: { name: "Supreme" } });
  const StoneIsland = await prisma.brand.findFirst({ where: { name: "Stone Island" } });
  const Converse = await prisma.brand.findFirst({ where: { name: "Converse" } });

  const black = await prisma.color.findFirst({ where: { name: "Black" } });
  const white = await prisma.color.findFirst({ where: { name: "White" } });
  const red = await prisma.color.findFirst({ where: { name: "Red" } });
  const blue = await prisma.color.findFirst({ where: { name: "Blue" } });
  const gray = await prisma.color.findFirst({ where: { name: "Gray" } });
  const green = await prisma.color.findFirst({ where: { name: "Green" } });
  const brown = await prisma.color.findFirst({ where: { name: "Brown" } });

  // Продукты с корректными брендами
  const product1 = await prisma.product.create({
    data: {
      name: "Jordan 1 Travis Scott",
      description: "Легендарные кроссовки Travis Scott с перевёрнутым Swoosh, премиальная кожа и узнаваемая расцветка.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1727089487/travis_ytdydd.jpg",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      dewuSpuId: "1000438",
      brandId: nike?.id,      // Jordan — бренд Nike
      colorId: black?.id,
      price: 49000,
      oldPrice: 52000,
      badge: "EXCLUSIVE",
      premium: true,
      popularity: 500,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 3,
    },
  });
  await addImages(product1, [
    "https://res.cloudinary.com/dc57mpiao/image/upload/v1727089487/travis_ytdydd.jpg",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761081450/travis_side.jpg",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761081450/travis_back.jpg",
  ]);

  const product2 = await prisma.product.create({
    data: {
      name: "Yeezy Boost 500",
      description: "Объёмные кроссовки с амортизирующей подошвой adiPRENE и замшевыми вставками — комфорт на каждый день.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1727089427/500_i35k6u.jpg",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      dewuSpuId: "9551018",
      brandId: adidas?.id,    // Yeezy — Adidas
      colorId: white?.id,
      price: 15000,
      oldPrice: 18000,
      badge: "SALE",
      premium: false,
      popularity: 320,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 5,
    },
  });
  await addImages(product2, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763205498/yeezy-500-granite-4-1000x1000_aujc9z.jpg",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763416755/yeezy-500-granite-3-300x300_h9bmqn.png",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761081450/yeezy_back.jpg",
  ]);

  const product3 = await prisma.product.create({
    data: {
      name: "Off-White x Nike Dunk",
      description: "Коллаборационные Dunk с характерными элементами Off‑White: внешние шнурки и бирка, лёгкий верх из кожи.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1727089460/dunk3_u6y9lh.jpg",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      dewuSpuId: "1058786",
      brandId: nike?.id,     // Dunk — Nike, в коллаборации с Off-White
      colorId: red?.id,
      price: 7990,
      oldPrice: 9990,
      badge: "HIT",
      premium: false,
      popularity: 450,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 2,
    },
  });
  await addImages(product3, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1763755093/kakashki_mfwuro.webp",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761081450/dunk_side.jpg",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761081450/dunk_top.jpg",
  ]);
  const product4 = await prisma.product.create({
    data: {
      name: "Толстовка False Perception",
      description: "Тёплая худи с принтом False Perception, мягкий флис и свободная посадка.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1743805481/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-04-04_%D0%B2_15.58.33_owr932.png",
      available: true,
      gender: "unisex",
      categoryId: cat.clothes,
      sizeType: "CLOTH",
      dewuSpuId: "1058449",
      brandId: puma?.id,     // заменил бренд на Puma
      colorId: black?.id,
      price: 4999.99,
      oldPrice: 6999.99,
      badge: "NEW",
      premium: false,
      popularity: 210,
      subcategory: "hoodie",
      updatedAt: new Date(),
      stock: 4,
    },
  });
  await addImages(product4, [product4.imageUrl]);


  const product5 = await prisma.product.create({
    data: {
      name: "Толстовка Travis Scott MasterMind",
      description: "Худи с графикой MasterMind, плотный хлопок и комфортная посадка на каждый день.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1727089470/mind_aqx327.png",
      available: true,
      gender: "unisex",
      categoryId: cat.clothes,
      sizeType: "CLOTH",
      dewuSpuId: "1058449",
      brandId: adidas?.id,     
      colorId: white?.id,
      price: 7900,
      oldPrice: 8900,
      badge: "SALE",
      premium: false,
      popularity: 180,
      subcategory: "hoodie",
      updatedAt: new Date(),
      stock: 6,
    },
  });
  await addImages(product5, [product5.imageUrl]);

  const product6 = await prisma.product.create({
    data: {
      name: "LV x Takashi Murakami pop-up",
      description: "Кардхолдер Louis Vuitton в коллаборации с Takashi Murakami: фирменная монограмма и яркий арт‑принт.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1748100553/LV-x-TM-SUperflat-Panda-Cardholder_oat4tx.jpg",
      available: true,
      categoryId: cat.accessories,
      sizeType: "NONE",
      brandId: louisVuitton?.id, // бренд Louis Vuitton
      colorId: black?.id,
      price: 69000,
      oldPrice: 75000,
      badge: "EXCLUSIVE",
      premium: true,
      popularity: 150,
      subcategory: "cardholder",
      updatedAt: new Date(),
      stock: 1,
    },
  });
  await addImages(product6, [product6.imageUrl]);

  const product7 = await prisma.product.create({
    data: {
      name: "Yeezy Boost 500",
      description: "Кроссовки Yeezy 500 с ретро‑силуэтом и поддерживающей подошвой, универсальная серая расцветка.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1754860960/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-08-10_%D0%B2_15.29.55_dlwerd.png",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      brandId: adidas?.id,
      colorId: gray?.id,
      price: 18900,
      oldPrice: 21900,
      badge: "SALE",
      premium: false,
      popularity: 260,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 5,
    },
  });
  await addImages(product7, [product7.imageUrl]);

  const product8 = await prisma.product.create({
    data: {
      name: "Jordan 1 Travis Scott",
      description: "Эмблематические Air Jordan 1 с перевёрнутым Swoosh и контрастной отделкой — для коллекции и повседневности.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1754864149/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-08-10_%D0%B2_16.27.28_c14deg.png",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      brandId: nike?.id,
      colorId: black?.id,
      price: 79000,
      oldPrice: 89000,
      badge: "EXCLUSIVE",
      premium: true,
      popularity: 400,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 2,
    },
  });
  await addImages(product8, [
    "https://res.cloudinary.com/dc57mpiao/image/upload/v1754864149/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-08-10_%D0%B2_16.27.28_c14deg.png",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761081450/jordan_side.jpg",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761081450/jordan_outsole.jpg",
  ]);

  const product9 = await prisma.product.create({
    data: {
      name: "Yeezy Boost 350",
      description: "Лёгкие кроссовки с вязаным верхом Primeknit и упругой подошвой Boost для целого дня.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1727088798/3_qfjzul.jpg",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      brandId: adidas?.id, 
      colorId: white?.id,
      price: 18700,
      oldPrice: 20900,
      badge: "SALE",
      premium: false,
      popularity: 340,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 6,
    },
  });
  await addImages(product9, [product9.imageUrl]);

  const product10 = await prisma.product.create({
    data: {
      name: "Yeezy x Gosha Vultures",
      description: "Худи Vultures в коллаборации, мягкий флис и оверсайз‑посадка.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1754864305/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-08-10_%D0%B2_16.30.57_x2deid.png",
      available: true,
      gender: "unisex",
      categoryId: cat.clothes,
      sizeType: "CLOTH",
      brandId: adidas?.id, 
      colorId: white?.id,
      price: 4999.99,
      oldPrice: 5999.99,
      badge: "NEW",
      premium: false,
      popularity: 120,
      subcategory: "hoodie",
      updatedAt: new Date(),
      stock: 3,
    },
  });
  await addImages(product10, [product10.imageUrl]);

  const product11 = await prisma.product.create({
    data: {
      name: "Рюкзак Carhartt",
      description: "Практичный рюкзак Carhartt с вместительным основным отделением и передним карманом на молнии. Внешняя часть выполнена из плотного водоотталкивающего полиэстера, внутри — текстильная подкладка с отделением под ноутбук. Отлично подходит для учёбы, города и поездок.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1754860960/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-08-10_%D0%B2_15.27.37_fcp6jl.png",
      available: true,
      categoryId: cat.bags,
      sizeType: "NONE",
      brandId: Converse?.id, 
      colorId: black?.id,
      price: 8600,
      widthCm: 30,
      heightCm: 45,
      depthCm: 15,
      oldPrice: 9600,
      badge: "HIT",
      premium: false,
      popularity: 110,
      subcategory: "backpack",
      updatedAt: new Date(),
      stock: 7,
    },
  });
  await addImages(product11, [product11.imageUrl]);
  
  const product12 = await prisma.product.create({
    data: {
      name: "Louis Vuitton x Takashi Murakami",
      description: "Премиальная сумка Louis Vuitton из фирменного монограммного канваса с натуральными кожаными ручками и отделкой. Внешняя часть выполнена из износостойкого канваса, внутренняя — из текстильной подкладки с карманами для повседневных вещей и документов.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1754860961/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-08-10_%D0%B2_15.33.55_wualrp.png",
      available: true,
      categoryId: cat.bags,
      sizeType: "NONE",
      brandId: louisVuitton?.id,
      colorId: black?.id,
      price: 290000,
      widthCm: 32,
      heightCm: 26,
      depthCm: 16,
      oldPrice: 310000,
      badge: "EXCLUSIVE",
      premium: true,
      popularity: 90,
      subcategory: "bag",
      updatedAt: new Date(),
      stock: 1,
    },
  });
  await addImages(product12, [
    "https://res.cloudinary.com/dc57mpiao/image/upload/v1754860961/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-08-10_%D0%B2_15.33.55_wualrp.png",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761081347/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-10-22_%D0%B2_00.15.38_ksrwfi.png",
  ]);
  const product13 = await prisma.product.create({
    data: {
      name: "Духи Maison Margiela Replica",
      description: "Унисекс‑аромат Replica с тёплыми пряными верхними нотами (бергамот, розовый перец), цветочным сердцем (жасмин, лаванда) и мягкой древесно‑ванильной базой (сандал, ваниль, кедр). Лучше всего раскрывается в прохладную погоду, осенью и зимой, днём и вечером.",
      imageUrl: "https://res.cloudinary.com/dc57mpiao/image/upload/v1727108286/2024-09-23_19.17.04_jpnpnv.jpg",
      available: true,
      gender: "unisex",
      volume: 100,
      categoryId: cat.fragrance,
      sizeType: "NONE",
      brandId: Supreme?.id, 
      colorId: black?.id,
      price: 7000,
      oldPrice: 9000,
      badge: "NEW",
      premium: false,
      popularity: 140,
      subcategory: "fragrance",
      updatedAt: new Date(),
      stock: 10,
    },
  });
  await addImages(product13, [product13.imageUrl]);


  const product14 = await prisma.product.create({
    data: {
      name: "New Balance 990v5",
      description: "Классические кроссовки из серии 990 с фирменной амортизацией ENCAP. Производятся на фабриках в США, славятся комфортом и поддержкой стопы.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180001/nb_990v5_main.jpg",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      brandId: newBalance?.id,
      colorId: gray?.id,
      price: 21900,
      oldPrice: 25900,
      badge: "HIT",
      premium: false,
      popularity: 230,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 6,
    },
  });
  await addImages(product14, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180001/nb_990v5_main.jpg",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180001/nb_990v5_side.jpg",
  ]);

  // Обувь — Reebok Club C 85
  const product15 = await prisma.product.create({
    data: {
      name: "Reebok Club C 85",
      description: "Легендарная модель теннисных кед с минималистичным силуэтом. Мягкая кожа, классический логотип и удобная посадка на каждый день.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180101/reebok_club_c_main.jpg",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      brandId: reebok?.id,
      colorId: white?.id,
      price: 11990,
      oldPrice: 13990,
      badge: "SALE",
      premium: false,
      popularity: 170,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 8,
    },
  });
  await addImages(product15, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180101/reebok_club_c_main.jpg",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180101/reebok_club_c_side.jpg",
  ]);

  // Обувь — Converse Chuck 70 Hi
  const product16 = await prisma.product.create({
    data: {
      name: "Converse Chuck 70 Hi",
      description: "Ремастеред‑версия классических Chuck Taylor с усиленной стелькой OrthoLite и плотным канвасом. Икона уличного стиля.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1769097482/y3ab0vpq04g0ne21sj73r523755rlw29_cun5lm.png",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      brandId: Converse?.id,
      colorId: black?.id,
      price: 8990,
      oldPrice: 9990,
      badge: "NEW",
      premium: false,
      popularity: 260,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 10,
    },
  });
  await addImages(product16, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1769097536/sce70zulol358qql95cju8ok0rd3kryk_i01j3m.png",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1769097567/52e3man5hhs3132cscymimpq927n3vkp_vzsuns.png",
  ]);

  // Одежда — Stone Island Shadow Project Jacket
  const product17 = await prisma.product.create({
    data: {
      name: "Stone Island Shadow Project Jacket",
      description: "Технологичная куртка из коллекции Shadow Project: влаго‑ и ветрозащитная ткань, съёмный капюшон и фирменный патч на рукаве.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180303/si_shadow_jacket_main.jpg",
      available: true,
      gender: "unisex",
      categoryId: cat.clothes,
      sizeType: "CLOTH",
      brandId: StoneIsland?.id,
      colorId: black?.id,
      price: 57900,
      oldPrice: 69900,
      badge: "EXCLUSIVE",
      premium: true,
      popularity: 180,
      subcategory: "outerwear",
      updatedAt: new Date(),
      stock: 3,
    },
  });
  await addImages(product17, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180303/si_shadow_jacket_main.jpg",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180303/si_shadow_jacket_detail.jpg",
  ]);

  // Одежда — Supreme Box Logo Tee
  const product18 = await prisma.product.create({
    data: {
      name: "Supreme Box Logo Tee",
      description: "Культовая футболка с логотипом Box Logo — главный символ уличной культуры от Supreme. Плотный хлопок и прямой крой.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1762961460/Supreme-20th-Anniversary-Box-Logo-Tee-White_luhu7j.avif",
      available: true,
      gender: "unisex",
      categoryId: cat.clothes,
      sizeType: "CLOTH",
      brandId: Supreme?.id,
      colorId: white?.id,
      price: 12990,
      oldPrice: 14990,
      badge: "HIT",
      premium: false,
      popularity: 420,
      subcategory: "tshirt",
      updatedAt: new Date(),
      stock: 12,
    },
  });
  await addImages(product18, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180404/supreme_bogo_tee_main.jpg",
  ]);

  // Одежда — Nike Tech Fleece Joggers
  const product19 = await prisma.product.create({
    data: {
      name: "Nike Tech Fleece Joggers",
      description: "Фирменные джоггеры из материала Tech Fleece — тёплые, лёгкие и дышащие. Универсальная посадка и удобные карманы на молнии.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180505/nike_tech_fleece_joggers_main.jpg",
      available: true,
      gender: "unisex",
      categoryId: cat.clothes,
      sizeType: "CLOTH",
      brandId: nike?.id,
      colorId: gray?.id,
      price: 8990,
      oldPrice: 10990,
      badge: "NEW",
      premium: false,
      popularity: 300,
      subcategory: "pants",
      updatedAt: new Date(),
      stock: 9,
    },
  });
  await addImages(product19, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180505/nike_tech_fleece_joggers_main.jpg",
  ]);

  // Аксессуары — Chrome Hearts Cross Pendant
  const product20 = await prisma.product.create({
    data: {
      name: "Chrome Hearts Cross Pendant",
      description: "Ювелирная подвеска Chrome Hearts в форме креста из серебра 925 пробы без камней и вставок. Ручная работа, культовый дизайн из Лос‑Анджелеса; лучше хранить в мягком чехле и периодически полировать специальной салфеткой для серебра.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765744453/32435385_62576272_1000_q2gsnn.png",
      available: true,
      categoryId: cat.accessories,
      sizeType: "NONE",
      brandId: ChromeHearts?.id,
      colorId: gray?.id,
      price: 120000,
      oldPrice: 135000,
      badge: "EXCLUSIVE",
      premium: true,
      popularity: 95,
      subcategory: "jewelry",
      updatedAt: new Date(),
      stock: 2,
    },
  });
  await addImages(product20, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765744453/32435385_62576289_2048_b8ij3v.png",
  ]);

  // Аксессуары — Louis Vuitton Initiales Belt 40MM
  const product21 = await prisma.product.create({
    data: {
      name: "Louis Vuitton Initiales Belt 40MM",
      description: "Кожаный ремень Louis Vuitton с пряжкой LV Initiales. Плотная кожа, премиальная отделка и культовый монограмный рисунок, который подчёркивает любой образ.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765744158/louis-vuitton-lv-initiales-40mm-reversible-belt--M0566U_PM2_Front_view_mzp7qs.avif",
      available: true,
      categoryId: cat.accessories,
      sizeType: "NONE",
      brandId: louisVuitton?.id,
      colorId: black?.id,
      price: 62000,
      oldPrice: 69000,
      badge: "PREMIUM",
      premium: true,
      popularity: 120,
      subcategory: "belt",
      updatedAt: new Date(),
      stock: 4,
    },
  });
  await addImages(product21, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765744158/louis-vuitton-lv-initiales-40mm-reversible-belt--M0566U_PM1_Detail_view_zcvipj.avif",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765744158/louis-vuitton-lv-initiales-40mm-reversible-belt--M0566U_PM1_Other_view_pfbxjm.avif"
  ]);

  // Головные уборы — Stone Island Nylon Metal Cap
  const product22 = await prisma.product.create({
    data: {
      name: "Stone Island Nylon Metal Cap",
      description: "Лёгкая кепка из фирменного материала Nylon Metal с приглушенным мерцанием. Ремешок‑регулятор и логотип‑компас спереди.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180808/si_nylon_cap_main.jpg",
      available: true,
      categoryId: cat.headwear,
      sizeType: "NONE",
      brandId: StoneIsland?.id,
      colorId: black?.id,
      price: 15900,
      oldPrice: 17900,
      badge: "NEW",
      premium: false,
      popularity: 75,
      subcategory: "caps",
      updatedAt: new Date(),
      stock: 5,
    },
  });
  await addImages(product22, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180808/si_nylon_cap_main.jpg",
  ]);

  // Головные уборы — Supreme New Era Beanie
  const product23 = await prisma.product.create({
    data: {
      name: "Supreme New Era Beanie",
      description: "Тёплая вязаная шапка, созданная совместно с New Era. Эластичная посадка и вышитый логотип Supreme.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180909/supreme_beanie_main.jpg",
      available: true,
      categoryId: cat.headwear,
      sizeType: "NONE",
      brandId: Supreme?.id,
      colorId: black?.id,
      price: 6990,
      oldPrice: 7990,
      badge: "HIT",
      premium: false,
      popularity: 210,
      subcategory: "beanies",
      updatedAt: new Date(),
      stock: 11,
    },
  });
  await addImages(product23, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761180909/supreme_beanie_main.jpg",
  ]);

  // Сумки — Nike Heritage Waist Bag
  const product24 = await prisma.product.create({
    data: {
      name: "Nike Heritage Waist Bag",
      description: "Поясная сумка с основным отделением на молнии и регулируемым ремнём. Внешняя часть выполнена из лёгкого прочного полиэстера, внутри — текстильная подкладка с небольшим карманом для документов. Крупный логотип Swoosh спереди.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761181010/nike_heritage_waistbag_main.jpg",
      available: true,
      categoryId: cat.bags,
      sizeType: "NONE",
      brandId: nike?.id,
      colorId: black?.id,
      price: 3490,
      widthCm: 28,
      heightCm: 15,
      depthCm: 7,
      oldPrice: 3990,
      badge: "NEW",
      premium: false,
      popularity: 160,
      subcategory: "waistbag",
      updatedAt: new Date(),
      stock: 20,
    },
  });
  await addImages(product24, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1761181010/nike_heritage_waistbag_main.jpg",
  ]);

  // Парфюмерия — Louis Vuitton Imagination EDP 100 ml
  const product25 = await prisma.product.create({
    data: {
      name: "Louis Vuitton Imagination EDP 100 ml",
      description: "Аромат Imagination от Louis Vuitton с яркими цитрусовыми верхними нотами (бергамот, апельсин), пряным и ароматическим сердцем (чай, нероли, имбирь) и тёплой амброво‑мускусной базой. Идеален для тёплого сезона, дневных деловых встреч и вечерних выходов.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765720884/1651526205_54885_1651526205_Louis_Vuitton_Imagination__zb958i.jpg",
      available: true,
      volume: 100,
      categoryId: cat.fragrance,
      sizeType: "NONE",
      brandId: louisVuitton?.id,
      colorId: black?.id,
      price: 31000,
      oldPrice: 34000,
      badge: "PREMIUM",
      premium: true,
      popularity: 130,
      subcategory: "fragrance",
      updatedAt: new Date(),
      stock: 7,
    },
  });
  await addImages(product25, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765720884/54885_1651526204_Louis_Vuitton_Imagination__oleimt.jpg",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765720884/1651526206_54885_1651526205_Louis_Vuitton_Imagination__tgxgcn.jpg"
  ]);

  // Дополнительные товары для более плотного каталога

  // Обувь — Adidas Campus 00s
  const product26 = await prisma.product.create({
    data: {
      name: "Adidas Campus 00s Green",
      description:
        "Adidas Campus 00s в зелёной замше — ретро‑силуэт с современным комфортом. Мягкий верх из натуральной замши, контрастные три полоски и прочная резиновая подошва для ежедневной носки.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1769096865/SK8aaz_1_kliam3.png",
      available: true,
      gender: "unisex",
      categoryId: cat.footwear,
      sizeType: "SHOE",
      brandId: adidas?.id,
      colorId: green?.id ?? gray?.id,
      price: 13990,
      oldPrice: 15990,
      badge: "NEW",
      premium: false,
      popularity: 160,
      subcategory: "sneakers",
      updatedAt: new Date(),
      stock: 7,
    },
  });
  await addImages(product26, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1769096936/a4qA7k_1_qexeie.png",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1769096936/a4qA7k_1_qexeie.png"
  ]);

  // Одежда — Stone Island Knit Sweater
  const product27 = await prisma.product.create({
    data: {
      name: "Stone Island Knit Sweater",
      description:
        "Вязаный свитшот Stone Island из мягкого хлопка с фирменным патчем‑компасом на рукаве. Универсальная базовая вещь для многослойных образов и прохладной погоды.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765744772/5100050-fancy-yarn-mouline-wool_-photo_hzcnsq.avif",
      available: true,
      gender: "unisex",
      categoryId: cat.clothes,
      sizeType: "CLOTH",
      brandId: StoneIsland?.id,
      colorId: gray?.id ?? black?.id,
      price: 45900,
      oldPrice: 49900,
      badge: "PREMIUM",
      premium: true,
      popularity: 140,
      subcategory: "sweater",
      updatedAt: new Date(),
      stock: 5,
    },
  });
  await addImages(product27, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765744772/5100050-fancy-yarn-mouline-wool_-photo_1_hyhrkj.avif",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765744772/5100050-fancy-yarn-mouline-wool_-photo_2_l6dc4i.avif"
  ]);

  // Сумка — Louis Vuitton Keepall Bandoulière 45
  const product28 = await prisma.product.create({
    data: {
      name: "Louis Vuitton Keepall Bandoulière 45",
      description:
        "Дорожная сумка Louis Vuitton Keepall 45 из фирменного монограммного канваса с отделкой и ручками из натуральной кожи. Внешняя часть выполнена из плотного монограммного канваса, внутри — текстильная подкладка с объёмным основным отделением. Удобный формат ручной клади и длинный плечевой ремень для поездок на выходные.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765721146/louis-vuitton-keepall-bandouliere-45--M41418_PM2_Front_view_e9qckd.avif", 
      available: true,
      categoryId: cat.bags,
      sizeType: "NONE",
      brandId: louisVuitton?.id,
      colorId: brown?.id ?? black?.id,
      price: 340000,
      widthCm: 45,
      heightCm: 27,
      depthCm: 20,
      oldPrice: 360000,
      badge: "EXCLUSIVE",
      premium: true,
      popularity: 85,
      subcategory: "travelbag",
      updatedAt: new Date(),
      stock: 1,
    },
  });
  await addImages(product28, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765721146/louis-vuitton-keepall-bandouliere-45--M41418_PM1_Closeup_view_w7uvic.avif",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765721146/louis-vuitton-keepall-bandouliere-45--M41418_PM1_Side_view_vcq8yr.avif",
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765721146/louis-vuitton-keepall-bandouliere-45--M41418_PM1_Interior_view_iknzgm.avif"
  ]);

  // Ювелирное изделие — Chrome Hearts Spacer Ring
  const product29 = await prisma.product.create({
    data: {
      name: "Chrome Hearts Spacer Ring",
      description:
        "Кольцо Chrome Hearts Spacer Ring из серебра 925 пробы без камней и эмали, с глубокой гравировкой логотипа по окружности. Базовое ювелирное изделие, которое легко сочетается с браслетами и другими украшениями бренда; не рекомендуется контакт с хлорированной водой и агрессивной химией.",
      imageUrl: "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765743948/chrome_ztvfty.png",
      available: true,
      categoryId: cat.accessories,
      sizeType: "NONE",
      brandId: ChromeHearts?.id,
      colorId: gray?.id ?? black?.id,
      price: 78000,
      oldPrice: 84000,
      badge: "PREMIUM",
      premium: true,
      popularity: 70,
      subcategory: "jewelry",
      updatedAt: new Date(),
      stock: 3,
    },
  });
  await addImages(product29, [
    "https://res.cloudinary.com/dhufbfxcy/image/upload/v1765743948/chrome2_ma4q1b.png",
  ]);

  // Парфюмерные варианты объёмов (50 мл и 100 мл) для духов
  await (prisma as any).perfumeVariant.createMany({
    data: [
      {
        productId: product13.id,
        volumeMl: 50,
        price: 5000,     // логичная цена для 50 мл (можно скорректировать)
        oldPrice: 7000,
      },
      {
        productId: product13.id,
        volumeMl: 100,
        price: product13.price!,
        oldPrice: product13.oldPrice ? Number(product13.oldPrice) : null,
      },
      {
        productId: product25.id,
        volumeMl: 50,
        price: 23000,    // логичная цена для 50 мл (можно скорректировать)
        oldPrice: 26000,
      },
      {
        productId: product25.id,
        volumeMl: 100,
        price: product25.price!,
        oldPrice: product25.oldPrice ? Number(product25.oldPrice) : null,
      },
    ],
  });

  // ProductItems — пакетно через createMany, чтобы исключить P1017 (разрывы соединения при множественных INSERT)
  const nowPI = new Date();
  const productItemsData: any[] = [];
  
  // ОБУВЬ (shoe sizes)
  for (const size of sizes.slice(0, 5)) productItemsData.push({ productId: product1.id, sizeId: size.id, price: product1.price!, updatedAt: nowPI });
  for (const size of sizes.slice(0, 5)) productItemsData.push({ productId: product9.id, sizeId: size.id, price: product9.price!, updatedAt: nowPI });
  for (const size of sizes.slice(0, 5)) productItemsData.push({ productId: product8.id, sizeId: size.id, price: product8.price!, updatedAt: nowPI });
  
  // Yeezy Boost 500 (product2) — разные цены по размерам
  {
    const yeezySizes = sizes.slice(0, 5);
    const yeezyPrices = [15000, 15500, 16000, 17000, 18000];
  
    yeezySizes.forEach((size, index) => {
      productItemsData.push({
        productId: product2.id,
        sizeId: size.id,
        price: yeezyPrices[index] ?? product2.price!,
        updatedAt: nowPI,
      });
    });
  }
  
  for (const size of sizes.slice(10, 22)) productItemsData.push({ productId: product3.id, sizeId: size.id, price: product3.price!, updatedAt: nowPI });
  
  // ОДЕЖДА (clothing sizes)
  for (const cl of sizecl) productItemsData.push({ productId: product4.id, sizeClId: cl.id, price: product4.price!, updatedAt: nowPI });
  for (const cl of sizecl) productItemsData.push({ productId: product10.id, sizeClId: cl.id, price: product10.price!, updatedAt: nowPI });
  for (const cl of sizecl) productItemsData.push({ productId: product5.id, sizeClId: cl.id, price: product5.price!, updatedAt: nowPI });
  
  // БЕЗРАЗМЕРНЫЕ ПОЗИЦИИ (accessories / fragrance) — по 3 записи
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product6.id, price: product6.price!, updatedAt: nowPI });
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product7.id, price: product7.price!, updatedAt: nowPI });
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product13.id, price: product13.price!, updatedAt: nowPI });
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product11.id, price: product11.price!, updatedAt: nowPI });
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product12.id, price: product12.price!, updatedAt: nowPI });
  
  // НОВЫЕ ТОВАРЫ (последняя партия)
  for (const size of sizes.slice(8, 14)) productItemsData.push({ productId: product14.id, sizeId: size.id, price: product14.price!, updatedAt: nowPI });
  for (const size of sizes.slice(0, 5)) productItemsData.push({ productId: product15.id, sizeId: size.id, price: product15.price!, updatedAt: nowPI });
  for (const size of sizes.slice(5, 10)) productItemsData.push({ productId: product16.id, sizeId: size.id, price: product16.price!, updatedAt: nowPI });
  
  for (const cl of sizecl) productItemsData.push({ productId: product17.id, sizeClId: cl.id, price: product17.price!, updatedAt: nowPI });
  for (const cl of sizecl) productItemsData.push({ productId: product18.id, sizeClId: cl.id, price: product18.price!, updatedAt: nowPI });
  for (const cl of sizecl) productItemsData.push({ productId: product19.id, sizeClId: cl.id, price: product19.price!, updatedAt: nowPI });
  
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product20.id, price: product20.price!, updatedAt: nowPI });
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product21.id, price: product21.price!, updatedAt: nowPI });
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product22.id, price: product22.price!, updatedAt: nowPI });
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product23.id, price: product23.price!, updatedAt: nowPI });
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product24.id, price: product24.price!, updatedAt: nowPI });
  for (let i = 0; i < 3; i++) productItemsData.push({ productId: product25.id, price: product25.price!, updatedAt: nowPI });

  // Новые товары: распределяем размеры и базовые позиции
  for (const size of sizes.slice(3, 9)) {
    productItemsData.push({
      productId: product26.id,
      sizeId: size.id,
      price: product26.price!,
      updatedAt: nowPI,
    });
  }

  for (const cl of sizecl) {
    productItemsData.push({
      productId: product27.id,
      sizeClId: cl.id,
      price: product27.price!,
      updatedAt: nowPI,
    });
  }

  for (let i = 0; i < 3; i++) {
    productItemsData.push({
      productId: product28.id,
      price: product28.price!,
      updatedAt: nowPI,
    });
  }

  for (let i = 0; i < 3; i++) {
    productItemsData.push({
      productId: product29.id,
      price: product29.price!,
      updatedAt: nowPI,
    });
  }
  
  // батчим по 100, чтобы не перегружать БД одним большим INSERT
  const batch = <T,>(arr: T[], size = 100): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
  
  for (const chunk of batch(productItemsData, 100)) {
    await prisma.productItem.createMany({ data: chunk });
  }
  // Корзины
  await prisma.cart.createMany({
    data: [
      { userId: 1, totalAmount: 0, token: "123221", updatedAt: new Date() },
      { userId: 2, totalAmount: 0, token: "122321", updatedAt: new Date() },
    ],
  });

  // Товар в корзину
  const productItem1 = await prisma.productItem.findFirst({
    where: { productId: product1.id },
  });

  if (productItem1) {
    await prisma.cartItem.create({
      data: {
        cartId: 1,
        productItemId: productItem1.id,
        quantity: 2,
        updatedAt: new Date(),
      },
    });
  }
}
async function down() {
  await prisma.$executeRaw`TRUNCATE TABLE "PromoRedemption" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "PromoCode" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "CartItem" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Cart" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "ProductItem" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "PerfumeVariant" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Product" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Color" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Brand" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Size" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "SizeCl" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Category" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE`;
}

async function main() {
  try {
    await down();
    await up();
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();