export type SizeType =
  | ClothingSize
  | ShoeSize
  | RingSize
  | BraceletSize
  | PerfumeVolume
  | string
  | number;
export interface BagDimensions {
    depth: number;
    width: number;
    height: number;
  }
  
  export interface Variant {
  price: number;
  images: string[];
  sizes?: {
    available: (string | number)[];
    inStock: Record<string | number, number>;
  };
}

export interface ProductWithVariants extends BaseProduct {
  variants: Record<string, Variant>;
}

export interface Variant {
  price: number;
  images: string[];
  sizes?: {
    available: (string | number)[];
    inStock: Record<string | number, number>;
  };
}
export type ClothingProductWithVariants = ClothingProduct & {
  variants: Record<string, Variant>;
};
export type ShoeProductWithVariants = ShoeProduct & {
  variants: Record<string, Variant>;
};
export type BagProductWithVariants = BagProduct & {
  variants: Record<string, Variant>;
};
export type JewelryProductWithVariants = JewelryProduct & {
  variants: Record<string, Variant>;
};
  
  export interface BaseProduct {
  id: number;
  name: string;
  price: number;
  description: string;
  images: string[];
  category: string;
  /**
   * Normalized main category to match taxonomy anchors used on pages:
   * 'footwear' | 'clothes' | 'bags' | 'accessories' | 'fragrance' | 'headwear'
   */
  main?: 'footwear' | 'clothes' | 'bags' | 'accessories' | 'fragrance' | 'headwear' | string;
  /** Specific subcategory key from taxonomy (e.g., 'sneakers', 'hoodies', 'rings', 'crossbody', 'edp', ...) */
  subcategory?: string;
  colors?: string[];
  featured?: boolean;
  oneSize?: boolean;
  brandLogo?: string;
  brands?: string[];  // Человеко-читаемые названия брендов для фильтрации/подборщика
  imagesByColor?: Record<string, string[]>;
  features?: string; 
  premium?: boolean;
  premiumBadgeIcon?: string;
  premiumFeatured?: boolean;
  material?: string;
  styleNotes?: string;
  gender?: 'men' | 'women' | 'unisex';
  oldPrice?: number;    
  stock?: number;         
  isNew?: boolean;     
  createdAt?: string;  
}
  
  export type ClothingSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
  export type ShoeSize = 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43;
  export type RingSize = 16 | 17 | 18 | 19;
  export type PerfumeVolume = 30 | 50 | 100;
  export type NecklaceLength = '40cm' | '45cm' | '50cm' | '60cm' | 'custom';
  export type BraceletSize = 'S' | 'M' | 'L' | 'custom';
  
  export const sizeCharts = {
    clothing: [
      { label: 'XS', ru: '40', eu: '32', us: '2', chest: '78–82', waist: '60–64' },
      { label: 'S',  ru: '42', eu: '34', us: '4', chest: '83–86', waist: '65–68' },
      { label: 'M',  ru: '44', eu: '36', us: '6', chest: '87–90', waist: '69–72' },
      { label: 'L',  ru: '46', eu: '38', us: '8', chest: '91–94', waist: '73–76' },
      { label: 'XL', ru: '48', eu: '40', us: '10', chest: '95–98', waist: '77–80' },
      { label: 'XXL',ru: '50', eu: '42', us: '12', chest: '99–102', waist: '81–84' },
    ],
    shoes: [
      { size: 36, eu: 36, us: 5.5, uk: 3.5, cm: 23 },
      { size: 37, eu: 37, us: 6.5, uk: 4.5, cm: 23.5 },
      { size: 38, eu: 38, us: 7.5, uk: 5.5, cm: 24 },
      { size: 39, eu: 39, us: 8.5, uk: 6.5, cm: 25 },
      { size: 40, eu: 40, us: 9, uk: 7, cm: 25.5 },
      { size: 41, eu: 41, us: 9.5, uk: 7.5, cm: 26 },
      { size: 42, eu: 42, us: 10, uk: 8, cm: 27 },
      { size: 43, eu: 43, us: 11, uk: 9, cm: 27.5 }
    ],
    rings: [
      { size: 16, ru: '16', us: 5.5, diameter: '16 мм', circumference: '50 мм' },
      { size: 17, ru: '17', us: 6.5, diameter: '17 мм', circumference: '53 мм' },
      { size: 18, ru: '18', us: 7.5, diameter: '18 мм', circumference: '56 мм' },
      { size: 19, ru: '19', us: 8.5, diameter: '19 мм', circumference: '59 мм' }
    ],
    bracelets: [
      { size: 'S', wrist: '15–16 см', description: 'Маленький обхват' },
      { size: 'M', wrist: '17–18 см', description: 'Средний обхват' },
      { size: 'L', wrist: '19–20 см', description: 'Большой обхват' },
      { size: 'custom', wrist: 'на заказ', description: 'Индивидуальный размер' }
    ],
    perfume: [
      { volume: 30, duration: 'до 4 часов', note: 'лёгкий дневной аромат' },
      { volume: 50, duration: 'до 6 часов', note: 'стандартный' },
      { volume: 100, duration: '8–10 часов', note: 'стойкий вечерний аромат' }
    ]
  };
  
  export interface ClothingProduct extends BaseProduct {
    category: 'clothing';
    sizes: {
      available: ClothingSize[];
      inStock: Partial<Record<ClothingSize, number>>;
      inStockMoscow?: Partial<Record<SizeType, boolean>>;
      prices: Record<SizeType, number>;
    };
    material: string;
    careInstructions: string;
  }
  
  export interface ShoeProduct extends BaseProduct {
    category: 'shoes';
    sizes: {
      available: ShoeSize[];
      inStock: Partial<Record<ShoeSize, number>>;
      inStockMoscow?: Partial<Record<SizeType, boolean>>;
      prices: Record<SizeType, number>;
    };
    soleMaterial: string;
    upperMaterial: string;
  }
  
  export interface JewelryProduct extends BaseProduct {
    category: 'jewelry';
    jewelryType: 'ring' | 'necklace' | 'bracelet' | 'earrings';
    material: 'gold' | 'silver' | 'platinum' | 'steel';
    gemstone?: string;
  }
  
  export interface RingProduct extends JewelryProduct {
    jewelryType: 'ring';
    sizes: {
      available: RingSize[];
      inStock: Partial<Record<RingSize, number>>;
      inStockMoscow?: Partial<Record<SizeType, boolean>>;
      prices: Record<SizeType, number>;
    };
  }
  
  export interface NecklaceProduct extends JewelryProduct {
    jewelryType: 'necklace';
    lengths: {
      available: NecklaceLength[];
      inStock: Record<NecklaceLength, number>;
      inStockMoscow?: Partial<Record<NecklaceLength, boolean>>;
      prices: Record<SizeType, number>;
    };
    claspType: string;
  }
  
  export interface BraceletProduct extends JewelryProduct {
    jewelryType: 'bracelet';
    sizes: {
      available: BraceletSize[];
      inStock: Partial<Record<BraceletSize, number>>;
      inStockMoscow?: Partial<Record<SizeType, boolean>>;
    };
    adjustable: boolean;
  }
  
  export interface BagProduct extends BaseProduct {
    category: 'bags';
    bagType: 'regular' | 'tote' | 'clutch' | 'crossbody';
    dimensions: BagDimensions;
    material: string;
    pockets: number;
    weight: number;
    sizes?: {
      available: string[];
      inStock: Record<string, number>;
      inStockMoscow?: Partial<Record<SizeType, boolean>>;
      prices: Record<SizeType, number>;
    };
  }
  export type Product =
  | ClothingProduct
  | ShoeProduct
  | JewelryProduct
  | RingProduct
  | NecklaceProduct
  | BraceletProduct
  | BagProduct
  | PerfumeProduct;
  
  export interface PerfumeProduct extends BaseProduct {
    category: 'perfume';
    sizes: {
      available: PerfumeVolume[];
      inStock: Partial<Record<PerfumeVolume, number>>;
      inStockMoscow?: Partial<Record<SizeType, boolean>>;
      prices: Record<SizeType, number>;
    };
    fragranceNotes: {
      top: string[];
      middle: string[];
      base: string[];
    };
    concentration: 'Eau de Toilette' | 'Eau de Parfum' | 'Parfum';
  }
  
export const productCategories = {
  footwear: [
    {
      id: 1001,
      category: 'shoes',
      main: 'footwear',
      subcategory: 'sneakers',
      name: 'Balenciaga 3xl',
      description: 'Легендарная модель в современном исполнении.',
      oldPrice: 9900,
      price: 8990,
      brandLogo: '/img/баленса лого.png',
      brands: ['Balenciaga'],
      stock: 3,
      isNew: true,
      createdAt: new Date().toISOString(),
      colors: ['black'],
      images: ['/img/balenciaga3xl.jpg', '/img/balenciaga3xl3.jpg', '/img/balenciaga3xl4.jpg'],
      features: "Дышащая сеточка в совокупности с прочными материалами, дает особенный комфорт при длительной носке",
      sizes: {
        available: [38, 39, 40, 41],
        inStock: { 38: 0, 39: 2, 40: 4, 41: 1 },
        inStockMoscow: { 38: false, 39: true, 40: true, 41: false },
        prices: {38: 4000, 39: 4500, 40: 3200, 41: 3600}
      },
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль'
    } as ShoeProduct,
    {
      id: 1025,
      category: 'shoes',
      main: 'footwear',
      subcategory: 'sneakers',
      name: 'Balenciaga 3xl(red-blue)',
      description: 'Легендарная модель в современном исполнении.',
      price: 8990,
      brandLogo: '/img/баленса лого.png',
      brands: ['Balenciaga'],
      colors: ['white'],
      images: ['/img/balenciaga 3xl go.jpg', '/img/balenciaga 3xl go2.jpg', '/img/balenciaga 3xl go3.jpg'],
      features: "Дышащая сеточка в совокупности с прочными материалами, дает особенный комфорт при длительной носке",
      sizes: {
        available: [38, 39, 40, 41],
        inStock: { 38: 3, 39: 2, 40: 4, 41: 1 },
        inStockMoscow: { 38: true, 39: true, 40: false, 41: true },
        prices: {38: 4000, 39: 4500, 40: 3200, 41: 3600}
      },
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль'
    } as ShoeProduct,
{
  id: 1036,
  category: 'shoes',
  main: 'footwear',
  subcategory: 'sneakers',
  name: 'Nike Air Zoom Pegasus',
  description: 'Повседневные кроссовки для бега и города.',
  price: 7490,
  brandLogo: '/img/nike.svg',
  brands: ['Nike'],
  colors: ['black', 'white'],
  images: ['/img/nike_pegasus_1.jpg', '/img/nike_pegasus_2.jpg'],
  sizes: {
    available: [38, 39, 40, 41, 42],
    inStock: { 38: 4, 39: 3, 40: 5, 41: 2, 42: 2 },
    inStockMoscow: { 38: true, 39: true, 40: true, 41: false, 42: true },
    prices: { 38: 6990, 39: 6990, 40: 7490, 41: 7490, 42: 7990 }
  },
  soleMaterial: 'Резина',
  upperMaterial: 'Текстиль'
} as ShoeProduct,
{
  id: 1037,
  category: 'shoes',
  main: 'footwear',
  subcategory: 'sneakers',
  name: 'Adidas Samba Classic',
  description: 'Легендарные кроссовки в минималистичном стиле.',
  price: 6990,
  brandLogo: '/img/adidas.svg',
  brands: ['Adidas'],
  colors: ['white', 'black'],
  images: ['/img/adidas_samba_1.jpg', '/img/adidas_samba_2.jpg'],
  sizes: {
    available: [38, 39, 40, 41],
    inStock: { 38: 2, 39: 3, 40: 3, 41: 2 },
    inStockMoscow: { 38: true, 39: false, 40: true, 41: false },
    prices: { 38: 6490, 39: 6490, 40: 6990, 41: 6990 }
  },
  soleMaterial: 'Резина',
  upperMaterial: 'Кожа'
} as ShoeProduct,
{
  id: 1038,
  category: 'shoes',
  main: 'footwear',
  subcategory: 'boots',
  name: 'Timberland 6-Inch',
  description: 'Классические водоотталкивающие ботинки.',
  price: 12990,
  brandLogo: '/img/timberland.svg',
  brands: ['Timberland'],
  colors: ['wheat'],
  images: ['/img/timberland_6inch_1.jpg', '/img/timberland_6inch_2.jpg'],
  sizes: {
    available: [39, 40, 41, 42, 43],
    inStock: { 39: 2, 40: 3, 41: 2, 42: 2, 43: 1 },
    inStockMoscow: { 39: false, 40: true, 41: true, 42: false, 43: true },
    prices: { 39: 12990, 40: 12990, 41: 12990, 42: 13490, 43: 13990 }
  },
  soleMaterial: 'Резина',
  upperMaterial: 'Нубук'
} as ShoeProduct,
{
  id: 1039,
  category: 'shoes',
  main: 'footwear',
  subcategory: 'sandals',
  name: 'Birkenstock Arizona',
  description: 'Лёгкие и удобные сандалии на пробковой стельке.',
  price: 5590,
  brandLogo: '/img/birkenstock.svg',
  brands: ['Birkenstock'],
  colors: ['black'],
  images: ['/img/birkenstock_arizona_1.jpg'],
  sizes: {
    available: [38, 39, 40, 41],
    inStock: { 38: 3, 39: 3, 40: 2, 41: 2 },
    inStockMoscow: { 38: true, 39: true, 40: false, 41: true },
    prices: { 38: 5590, 39: 5590, 40: 5590, 41: 5790 }
  },
  soleMaterial: 'Резина',
  upperMaterial: 'Эко-кожа'
} as ShoeProduct,
    {
      id: 1006,
      category: 'shoes',
      main: 'footwear',
      subcategory: 'sneakers',
      name: 'Maison Margiela Replica Paint (White)',
      description: 'Белые повседневные кроссовки от модного дома.',
      price: 8990,
      colors: ['white'],
      images: ['/img/белые.jpg', '/img/белые 2.webp', '/img/белые 3.jpg'],
      sizes: {
        available: [40],
        inStock: { 40: 2 }
      },
      brandLogo: '/img/марджелка.png',
      brands: ['Maison Margiela'],
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль',
      premium: false,
      premiumBadgeIcon: '/img/star-icon.png',
      premiumFeatured: true
    } as ShoeProduct,
    {
      id: 1007,
      category: 'shoes',
      main: 'footwear',
      subcategory: 'sneakers',
      name: 'Maison Margiela Replica Paint (Black)',
      description: 'Черные повседневные кроссовки от модного дома.',
      price: 9990,
      colors: ['black'],
      images: ['/img/черные.webp'],
      sizes: {
        available: [38],
        inStock: { 38: 1 }
      },
      brandLogo: '/img/марджелка.png',
      brands: ['Maison Margiela'],
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль',
      premium: false,
      premiumBadgeIcon: '/img/star-icon.png'
    } as ShoeProduct,
    {
      id: 1010,
      category: 'shoes',
      main: 'footwear',
      subcategory: 'sneakers',
      name: 'Rick Owens Jumbo Lace',
      description: 'Переосмысление обуви в более уродливом, но и привлекательном виде.',
      price: 45.000,
      brandLogo: '/img/Rick-Owens-logo.png',
      brands: ['Rick Owens'],
      colors: ['black'],
      images: ['/img/rick owens jumbo.webp', '/img/rick owens jumbo 2.webp', '/img/rick owens jumbo 3.webp'],
      sizes: {
        available: [38, 39, 40, 41],
        inStock: { 38: 3, 39: 2, 40: 4, 41: 1 },
        prices: {38: 45000, 39: 39000, 40: 41000, 41: 35000}
      },
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль',
      gender: 'men',
      premium: true,
      premiumBadgeIcon: '/img/star-icon.png'
    } as ShoeProduct,
    {
      id: 1034,
      category: 'shoes',
      main: 'footwear',
      subcategory: 'sneakers',
      name: 'Chanel Runner CC',
      description: 'Переосмысление обуви в более уродливом, но и привлекательном виде.',
      price: 45.000,
      brandLogo: '/img/chanel logo.png',
      brands: ['Chanel'],
      colors: ['black'],
      images: ['/img/chanel cc.jpg', '/img/chanel cc 2.jpg', '/img/chanel cc 3.jpg'],
      sizes: {
        available: [38, 39, 40, 41],
        inStock: { 38: 3, 39: 2, 40: 4, 41: 1 },
        prices: {38: 45000, 39: 39000, 40: 41000, 41: 35000}
      },
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль',
      gender: 'women',
      premium: true,
      premiumBadgeIcon: '/img/star-icon.png'
    } as ShoeProduct,
    
  ],
  clothing: [
    {
      id: 1002,
      category: 'clothing',
      main: 'clothes',
      subcategory: 'hoodies',
      name: 'Chrome Hearts Hoodie "Los Angeles"',
      description: 'Плотная хлопковая толстовка с логотипом.',
      price: 6990,
      brandLogo: '/img/chrome-hearts.svg',
      brands: ['Chrome Hearts'],
      colors: ['gray', 'navy'],
      images: ['/img/hoodie chrome.webp'],
      features: "Фирменный крой Chrome Hearts, премиальный хлопок, прочные швы",
      sizes: {
        available: ['S', 'M', 'L'],
        inStock: { S: 3, M: 2, L: 0 },
        inStockMoscow: { S: true, M: false, L: false },
        prices: {S: 3000, M: 1500}
      },
      material: '100% хлопок',
      careInstructions: 'Стирка при 30°С',
      premiumBadgeIcon: '/img/star-icon.png'
    } as ClothingProduct,
    {
      id: 1040,
      category: 'clothing',
      main: 'clothes',
      subcategory: 'tshirts',
      name: 'Basic Tee',
      description: 'Базовая футболка из хлопка.',
      price: 1990,
      brandLogo: '/img/blank.svg',
      brands: ['Stage'],
      colors: ['white', 'black'],
      images: ['/img/basic_tee_1.jpg'],
      sizes: {
        available: ['S', 'M', 'L', 'XL'],
        inStock: { S: 5, M: 5, L: 4, XL: 3 },
        inStockMoscow: { S: true, M: true, L: true, XL: false },
        prices: { S: 1990, M: 1990, L: 1990, XL: 2190 }
      },
      material: '100% хлопок',
      careInstructions: 'Стирка при 30°С'
    } as ClothingProduct,
    {
      id: 1200,
      category: 'clothing',
      main: 'clothes',
      subcategory: 'hoodies',
      name: 'Хлопковая худи x "Rolling Loud"',
      description: 'Плотная хлопковая толстовка с логотипом.',
      price: 6990,
      brandLogo: '/img/chrome-hearts.svg',
      brands: ['Chrome Hearts'],
      colors: ['gray', 'navy'],
      premium: true,
      images: ['/img/хром кофта 1.jpg', '/img/хром кофта 2.jpg'],
      features: "Фирменный крой Chrome Hearts, премиальный хлопок, прочные швы",
      sizes: {
        available: ['S', 'M', 'L'],
        inStock: { S: 3, M: 2, L: 0 },
        inStockMoscow: { S: true, M: false, L: false },
        prices: {S: 3000, M: 1500}
      },
      material: '100% хлопок',
      careInstructions: 'Стирка при 30°С',
      premiumBadgeIcon: '/img/star-icon.png'
    } as ClothingProduct,
    {
      id: 1041,
      category: 'clothing',
      main: 'clothes',
      subcategory: 'sweatshirts',
      name: 'Crewneck Sweatshirt',
      description: 'Тёплый свитшот без капюшона.',
      price: 3490,
      brandLogo: '/img/blank.svg',
      brands: ['Stage'],
      colors: ['gray'],
      images: ['/img/crewneck_1.jpg'],
      sizes: {
        available: ['S', 'M', 'L'],
        inStock: { S: 3, M: 4, L: 3 },
        inStockMoscow: { S: false, M: true, L: true },
        prices: { S: 3490, M: 3490, L: 3690 }
      },
      material: 'Хлопок, полиэстер',
      careInstructions: 'Деликатная стирка'
    } as ClothingProduct,
    {
      id: 1042,
      category: 'clothing',
      main: 'clothes',
      subcategory: 'pants',
      name: 'Tapered Chinos',
      description: 'Чиносы со слегка зауженной посадкой.',
      price: 4990,
      brandLogo: '/img/blank.svg',
      brands: ['Stage'],
      colors: ['khaki', 'navy'],
      images: ['/img/chinos_1.jpg'],
      sizes: {
        available: ['S', 'M', 'L', 'XL'],
        inStock: { S: 2, M: 3, L: 3, XL: 2 },
        inStockMoscow: { S: true, M: false, L: true, XL: true },
        prices: { S: 4990, M: 4990, L: 5190, XL: 5190 }
      },
      material: 'Хлопок с эластаном',
      careInstructions: 'Стирка при 30°С'
    } as ClothingProduct,
  ],
  perfumes: [
    {
      id: 123,
      name: "Парфюм Eau de Parfum",
      price: 120,
      description: "Лёгкий свежий аромат с нотками цитруса.",
      images: ["/img/jpg perfume.jpg"],
      category: "perfume",
      main: 'fragrance',
      subcategory: 'edp',
      brands: ['Jean Paul Gaultier'],
      sizes: {
        available: [30, 50, 100],
        inStock: {
          30: 5,
          50: 3,
          100: 2
        },
        prices: {
          30: 3900,
          50: 5900,
          100: 7900
        }
      }, fragranceNotes: {
          top: ["бергамот", "лимон"],
          middle: ["лаванда", "жасмин"],
          base: ["мускус", "амбра"],
        },
      concentration: "Eau de Parfum",
      brandLogo: "/img/jean-paul-gaultier.svg",
    } as PerfumeProduct
  ],
  jewelry: [
    {
      id: 1004,
      category: 'jewelry',
      main: 'accessories',
      subcategory: 'rings',
      jewelryType: 'ring',
      name: 'Кольцо Tiffany & Co.',
      description: 'Элегантное кольцо из серебра с логотипом бренда.',
      price: 10990,
      colors: ['silver'],
      gender: 'women',
      premium: true,
      images: ['/img/tiffany ring.webp'],
      material: 'silver',
      brands: ['Tiffany & Co.'],
      sizes: {
        available: [16, 17, 18],
        inStock: { 16: 2, 17: 2, 18: 1 },
        inStockMoscow: { 16: true, 17: false, 18: true },
        prices: { 16: 10990, 17: 10990, 18: 11990 },
      },
      premiumBadgeIcon: '/img/star-icon.png'
    } as RingProduct,
    {
      id: 1043,
      category: 'jewelry',
      main: 'accessories',
      subcategory: 'bracelets',
      jewelryType: 'bracelet',
      name: 'Steel Link Bracelet',
      description: 'Стальной браслет с надёжной застёжкой.',
      price: 2990,
      colors: ['steel'],
      images: ['/img/bracelet_steel_1.jpg'],
      material: 'steel',
      brands: ['Generic'],
      sizes: { available: ['S', 'M', 'L'], inStock: { S: 3, M: 3, L: 2 }, inStockMoscow: { S: true, M: true, L: false } },
      // для совместимости с интерфейсом BraceletProduct
      adjustable: true
    } as BraceletProduct,
    {
      id: 1044,
      category: 'jewelry',
      main: 'accessories',
      subcategory: 'necklaces',
      jewelryType: 'necklace',
      name: 'Minimal Pendant',
      description: 'Минималистичная подвеска на цепочке.',
      price: 2590,
      colors: ['silver'],
      images: ['/img/necklace_minimal_1.jpg'],
      material: 'steel',
      brands: ['Generic'],
      lengths: {
        available: ['45cm', '50cm'],
        inStock: { '40cm': 0, '45cm': 4, '50cm': 3, '60cm': 0, 'custom': 0 },
        inStockMoscow: { '45cm': true, '50cm': false },
        prices: { '45cm': 2590, '50cm': 2790 }
      },
      claspType: 'spring'
    } as NecklaceProduct,
  ],
  bags: [
    {
      id: 1005,
      category: 'bags',
      main: 'bags',
      subcategory: 'crossbody',
      name: 'Сумка Prada Nylon',
      description: 'Компактная и практичная сумка из нейлона.',
      price: 24990,
      gender: 'women',
      brandLogo: '/img/prada-logo.png',
      brands: ['Prada'],
      premium: true,
      colors: ['black'],
      images: ['/img/prada bag.jpg'],
      bagType: 'crossbody',
      dimensions: {
        width: 10,
        height: 10,
        depth: 10
      },
      sizes: {
        available: ['tote', 'regular'],
        inStock: {
          tote: 2,
          regular: 3
        },
        inStockMoscow: { tote: false, regular: true },
      prices: {
    tote: 15990,
    regular: 24990
      }
      },
      material: 'нейлон',
      pockets: 3,
      weight: 0.7
    } as BagProduct,
    {
      id: 1012,
      category: 'bags',
      main: 'bags',
      subcategory: 'crossbody',
      name: 'Goyard Saigon Mini (Green)',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 1488,
      brandLogo: '/img/Logo_Goyard.png',
      brands: ['Goyard'],
      gender: 'women',
      colors: ['green'],
      images: ['/img/green saigon.webp', '/img/goyard saigon2.webp', '/img/goyard saigon3.webp'],
      bagType: 'crossbody',
      dimensions: {
        width: 15,
        height: 21,
        depth: 24
      },
      sizes: {
        available: ['mini', 'regular'],
        inStock: {
          mini: 2,
          regular: 3
        },
        inStockMoscow: { mini: true, regular: false },
      prices: {
    mini: 1488,
    regular: 52
      }
      },
      material: 'нейлон',
      pockets: 3,
      weight: 0.7,
      premium: true,
      premiumBadgeIcon: '/img/star-icon.png'
    } as BagProduct,
    {
      id: 1113,
      category: 'bags',
      main: 'bags',
      subcategory: 'crossbody',
      name: 'Mini Saddle Messenger Bag with Flap',
      description: 'Компактная и практичная сумка из нейлона.',
      price: 24990,
      gender: 'women',
      brandLogo: '/img/dior logo.svg.png',
      brands: ['Dior'],
      premium: true,
      colors: ['black'],
      images: ['/img/диор сумка.webp', '/img/диор сумка 2.jpeg', '/img/диор сумка 3.webp'],
      bagType: 'crossbody',
      dimensions: {
        width: 10,
        height: 10,
        depth: 10
      },
      sizes: {
        available: ['tote', 'regular'],
        inStock: {
          tote: 2,
          regular: 3
        },
        inStockMoscow: { tote: false, regular: true },
      prices: {
    tote: 15990,
    regular: 24990
      }
      },
      material: 'нейлон',
      pockets: 3,
      weight: 0.7
    } as BagProduct,
    {
      id: 1020,
      category: 'bags',
      main: 'bags',
      subcategory: 'crossbody',
      name: 'YSL LOULOU large in MATELASSÉ lambskin',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      brandLogo: '/img/ysl logo.png',
      brands: ['YSL'],
      colors: ['black'],
      gender: 'women',
      images: ['/img/ysl bag.avif', '/img/ysl bag 2.avif', '/img/ysl bag 3.avif'],
      bagType: 'crossbody',
      dimensions: {
        width: 14,
        height: 32,
        depth: 20
      },
      sizes: {
        available: ['mini', 'regular'],
        inStock: {
          mini: 2,
          regular: 3
        },
        inStockMoscow: { mini: false, regular: true },
      prices: {
    mini: 20000,
    regular: 38000
      }
      },
      material: 'нейлон',
      pockets: 3,
      weight: 0.7,
      premium: true,
      premiumBadgeIcon: '/img/star-icon.png'
    } as BagProduct,
    {
      id: 1014,
      category: 'bags',
      main: 'bags',
      subcategory: 'crossbody',
      name: 'Goyard Saigon Mini (Blue)',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      gender: 'women',
      features: "Всеми узнаваемая монограмма старинного дома Goyard в маленькой компактной сумочке",
      brandLogo: '/img/Logo_Goyard.png',
      brands: ['Goyard'],
      colors: ['Blue'],
      images: ['/img/goyard blue.webp', '/img/goyard blue 2.webp', '/img/goyard blue 3.webp'],
      bagType: 'crossbody',
      dimensions: {
        width: 15,
        height: 21,
        depth: 24
      },
      sizes: {
        available: ['mini', 'regular'],
        inStock: {
          mini: 2,
          regular: 3
        },
        inStockMoscow: { mini: true, regular: true },
      prices: {
    mini: 15990,
    regular: 24990
      }
      },
      material: 'Натуральная Кожа',
      pockets: 3,
      weight: 0.7,
      premium: true,
      premiumBadgeIcon: '/img/star-icon.png'
    } as BagProduct,
    {
      id: 1021,
      category: 'bags',
      main: 'bags',
      subcategory: 'crossbody',
      name: 'Aventure nappa leather bag',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      features: "Всеми узнаваемая монограмма старинного дома Goyard в маленькой компактной сумочке",
      brandLogo: '/img/miu miu logo.png',
      brands: ['Miu Miu'],
      colors: ['black'],
      gender: 'women',
      images: ['/img/miu miu bag.avif', '/img/miu miu bag2.avif', '/img/miu miu bag3.avif'],
      bagType: 'crossbody',
      dimensions: {
        width: 15,
        height: 21,
        depth: 24
      },
      sizes: {
        available: ['mini', 'regular'],
        inStock: {
          mini: 2,
          regular: 3
        },
        inStockMoscow: { mini: false, regular: false },
      prices: {
    mini: 15990,
    regular: 24990
      }
      },
      material: 'Натуральная Кожа',
      pockets: 3,
      weight: 0.7,
      premium: true,
      premiumBadgeIcon: '/img/star-icon.png'
    } as BagProduct,
    {
      id: 1015,
      category: 'bags',
      main: 'bags',
      subcategory: 'crossbody',
      name: 'Goyard Saigon Mini (Black)',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      features: "Всеми узнаваемая монограмма старинного дома Goyard в маленькой компактной сумочке",
      brandLogo: '/img/Logo_Goyard.png',
      brands: ['Goyard'],
      colors: ['black'],
      gender: 'women',
      premium: true,
      images: ['/img/goyard_saigon1.webp', '/img/goyard saigon2.webp', '/img/goyard saigon3.webp'],
      bagType: 'crossbody',
      dimensions: {
        width: 15,
        height: 21,
        depth: 24
      },
      sizes: {
        available: ['mini', 'regular'],
        inStock: {
          mini: 2,
          regular: 3
        },
        inStockMoscow: { mini: true, regular: false },
      prices: {
    mini: 15990,
    regular: 24990
      }
      },
      material: 'Натуральная Кожа',
      pockets: 3,
      weight: 0.7,
      premiumBadgeIcon: '/img/star-icon.png'
    } as BagProduct,
    {
      id: 1022,
      category: 'bags',
      main: 'bags',
      subcategory: 'crossbody',
      name: 'Chanel Timless (Pink)',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      features: "Всеми узнаваемая монограмма старинного дома Goyard в маленькой компактной сумочке",
      brandLogo: '/img/chanel logo.png',
      brands: ['Chanel'],
      colors: ['black'],
      gender: 'women',
      premium: true,
      images: ['/img/chanel bag.webp', '/img/chanel bag 2.webp', '/img/chanel bag 3.webp'],
      bagType: 'crossbody',
      dimensions: {
        width: 15,
        height: 21,
        depth: 24
      },
      sizes: {
        available: ['mini', 'regular'],
        inStock: {
          mini: 2,
          regular: 3
        },
        inStockMoscow: { mini: false, regular: true },
      prices: {
    mini: 15990,
    regular: 24990
      }
      },
      material: 'Натуральная Кожа',
      pockets: 3,
      weight: 0.7,
      premiumBadgeIcon: '/img/звездочка.png'
    } as BagProduct,

  ]
};

// Все товары объединяем в один список
const rawProducts: Product[] = Object.values(productCategories).flat();

/** Возвращает массив всех цен по размерам/объёмам для товара */
function collectSizePrices(p: any): number[] {
  const prices: number[] = [];
  // Унифицированное поле sizes.prices
  if (p?.sizes?.prices && typeof p.sizes.prices === 'object') {
    for (const val of Object.values(p.sizes.prices as Record<string, number>)) {
      if (typeof val === 'number' && !Number.isNaN(val)) prices.push(val);
    }
  }
  // Ювелирка с длинами (ожерелья)
  if (p?.lengths?.prices && typeof p.lengths.prices === 'object') {
    for (const val of Object.values(p.lengths.prices as Record<string, number>)) {
      if (typeof val === 'number' && !Number.isNaN(val)) prices.push(val);
    }
  }
  return prices;
}

/** Минимальная цена товара из любых размеров/объемов. Если нет — берём p.price */
function minPriceOf(p: any): number {
  const sizePrices = collectSizePrices(p);
  if (sizePrices.length > 0) return Math.min(...sizePrices);
  return typeof p.price === 'number' ? p.price : 0;
}

/** Нормализуем цену: цена карточки = минимальная цена; скидку показываем, если базовая выше */
function normalizeProductPricing<T extends Product>(p: T): T {
  const minimal = minPriceOf(p);
  // База для сравнения: сначала указанный oldPrice, затем старая price
  const baseForCompare = (typeof p.oldPrice === 'number' && p.oldPrice > 0)
    ? p.oldPrice
    : (typeof p.price === 'number' ? p.price : minimal);

  const hasDiscount = baseForCompare > minimal;

  return {
    ...p,
    // Всегда показываем минимальную цену на карточке
    price: minimal,
    // Если база выше минимальной — формируем oldPrice для отображения скидки,
    // иначе убираем oldPrice, чтобы не светилась «скидка» при повышении цены
    oldPrice: hasDiscount ? baseForCompare : undefined,
  } as T;
}

// Приводим все товары к единому формату цен
export const products: Product[] = rawProducts.map(normalizeProductPricing);

/** Default premium badge icon for UI components */
export const PREMIUM_BADGE_ICON = '/img/звездочка.png';

/** Optional merchandising badge */
export type ProductBadge = 'NEW' | 'HIT' | 'EXCLUSIVE';

/** Helpers */
export const isPremium = (p: Product) => !!p.premium;
export const isRegular = (p: Product) => !p.premium;
export const byGender = (g?: 'men' | 'women' | 'unisex') => (p: Product) => !g || p.gender === g || p.gender === 'unisex';
export const derivedBadge = (p: Product): ProductBadge | undefined => {
  // Если премиум — по умолчанию маркируем как EXCLUSIVE (если своя логика не задана на карточке)
  // @ts-ignore — допускаем произвольное поле badge на товарах
  if ((p as any).badge) return (p as any).badge as ProductBadge;
  if (p.premium) return 'EXCLUSIVE';
  return undefined;
};

export const shuffle = <T,>(a: T[]): T[] => {
  const copy = [...a];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
export const pickTop = <T,>(arr: T[], n = 10): T[] => arr.slice(0, n);

/** Convenience helpers to split premium vs regular */
export const premiumProducts: Product[] = products.filter((p: any) => p.premium);
export const regularProducts: Product[] = products.filter((p: any) => !p.premium);

/** Товар, который идёт первым в премиум-выдаче */
export const featuredPremiumProduct: Product | undefined =
  (premiumProducts as any[]).find((p) => (p as any).premiumFeatured) || premiumProducts[0];

/** Премиум-товары с приоритетом: сначала featured, затем остальные */
export const premiumProductsOrdered: Product[] = featuredPremiumProduct
  ? [featuredPremiumProduct, ...premiumProducts.filter((p) => p !== featuredPremiumProduct)]
  : premiumProducts;

/** Gender splits for convenience */
export const premiumMen    = premiumProducts.filter(byGender('men'));
export const premiumWomen  = premiumProducts.filter(byGender('women'));
export const premiumUnisex = premiumProducts.filter(byGender('unisex'));

export const regularMen    = regularProducts.filter(byGender('men'));
export const regularWomen  = regularProducts.filter(byGender('women'));
export const regularUnisex = regularProducts.filter(byGender('unisex'));