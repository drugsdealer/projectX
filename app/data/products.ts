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
  colors?: string[];
  featured?: boolean;
  oneSize?: boolean;
  brandLogo?: string;
  imagesByColor?: Record<string, string[]>;
  features?: string; 
  material?: string;
  styleNotes?: string;
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
      prices: Record<SizeType, number>;
    };
  }
  
  export interface NecklaceProduct extends JewelryProduct {
    jewelryType: 'necklace';
    lengths: {
      available: NecklaceLength[];
      inStock: Record<NecklaceLength, number>;
      prices: Record<SizeType, number>;
    };
    claspType: string;
  }
  
  export interface BraceletProduct extends JewelryProduct {
    jewelryType: 'bracelet';
    sizes: {
      available: BraceletSize[];
      inStock: Partial<Record<BraceletSize, number>>;
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
      name: 'Balenciaga 3xl',
      description: 'Легендарная модель в современном исполнении.',
      price: 8990,
      brandLogo: '/img/баленса лого.png',
      colors: ['black'],
      images: ['/img/balenciaga3xl.jpg', '/img/balenciaga3xl3.jpg', '/img/balenciaga3xl4.jpg'],
      features: "Дышащая сеточка в совокупности с прочными материалами, дает особенный комфорт при длительной носке",
      sizes: {
        available: [38, 39, 40, 41],
        inStock: { 38: 3, 39: 2, 40: 4, 41: 1 },
        prices: {38: 4000, 39: 4500, 40: 3200, 41: 3600}
      },
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль'
    } as ShoeProduct,
    {
      id: 1025,
      category: 'shoes',
      name: 'Balenciaga 3xl(red-blue)',
      description: 'Легендарная модель в современном исполнении.',
      price: 8990,
      brandLogo: '/img/баленса лого.png',
      colors: ['white'],
      images: ['/img/balenciaga 3xl go.jpg', '/img/balenciaga 3xl go2.jpg', '/img/balenciaga 3xl go3.jpg'],
      features: "Дышащая сеточка в совокупности с прочными материалами, дает особенный комфорт при длительной носке",
      sizes: {
        available: [38, 39, 40, 41],
        inStock: { 38: 3, 39: 2, 40: 4, 41: 1 },
        prices: {38: 4000, 39: 4500, 40: 3200, 41: 3600}
      },
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль'
    } as ShoeProduct,
    {
      id: 1006,
      category: 'shoes',
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
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль'
    } as ShoeProduct,
    {
      id: 1007,
      category: 'shoes',
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
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль'
    } as ShoeProduct,
    {
      id: 1010,
      category: 'shoes',
      name: 'Rick Owens Jumbo Lace',
      description: 'Переосмысление обуви в более уродливом, но и привлекательном виде.',
      price: 45.000,
      brandLogo: '/img/Rick-Owens-logo.png',
      colors: ['black'],
      images: ['/img/rick owens jumbo.webp', '/img/rick owens jumbo 2.webp', '/img/rick owens jumbo 3.webp'],
      sizes: {
        available: [38, 39, 40, 41],
        inStock: { 38: 3, 39: 2, 40: 4, 41: 1 },
        prices: {38: 45000, 39: 39000, 40: 41000, 41: 35000}
      },
      soleMaterial: 'Резина',
      upperMaterial: 'Текстиль'
    } as ShoeProduct,
  ],
  clothing: [
    {
      id: 1002,
      category: 'clothing',
      name: 'Chrome Hearts Hoodie "Los Angeles"',
      description: 'Плотная хлопковая толстовка с логотипом.',
      price: 6990,
      brandLogo: '/img/chrome-hearts.svg',
      colors: ['gray', 'navy'],
      images: ['/img/hoodie chrome.webp'],
      features: "Фирменный крой Chrome Hearts, премиальный хлопок, прочные швы",
      sizes: {
        available: ['S', 'M', 'L'],
        inStock: { S: 3, M: 2, L: 0 },
        prices: {S: 3000, M: 1500}
      },
      material: '100% хлопок',
      careInstructions: 'Стирка при 30°С'
    } as ClothingProduct
  ],
  perfumes: [
    {
      id: 123,
      name: "Парфюм Eau de Parfum",
      price: 120,
      description: "Лёгкий свежий аромат с нотками цитруса.",
      images: ["/img/jpg perfume.jpg"],
      category: "perfume",
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
      jewelryType: 'ring',
      name: 'Кольцо Tiffany & Co.',
      description: 'Элегантное кольцо из серебра с логотипом бренда.',
      price: 10990,
      colors: ['silver'],
      images: ['/img/tiffany ring.webp'],
      material: 'silver',
      sizes: {
        available: [16, 17, 18],
        inStock: { 16: 2, 17: 2, 18: 1 }
      }
    } as RingProduct
  ],
  bags: [
    {
      id: 1005,
      category: 'bags',
      name: 'Сумка Prada Nylon',
      description: 'Компактная и практичная сумка из нейлона.',
      price: 24990,
      brandLogo: '/img/prada-logo.png',
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
      name: 'Goyard Saigon Mini (Green)',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      brandLogo: '/img/Logo_Goyard.png',
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
      prices: {
    mini: 15990,
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
      name: 'YSL LOULOU large in MATELASSÉ lambskin',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      brandLogo: '/img/ysl logo.png',
      colors: ['black'],
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
      prices: {
    mini: 20000,
    regular: 38000
      }
      },
      material: 'нейлон',
      pockets: 3,
      weight: 0.7
    } as BagProduct,
    {
      id: 1014,
      category: 'bags',
      name: 'Goyard Saigon Mini (Blue)',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      features: "Всеми узнаваемая монограмма старинного дома Goyard в маленькой компактной сумочке",
      brandLogo: '/img/Logo_Goyard.png',
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
      prices: {
    mini: 15990,
    regular: 24990
      }
      },
      material: 'Натуральная Кожа',
      pockets: 3,
      weight: 0.7
    } as BagProduct,
    {
      id: 1021,
      category: 'bags',
      name: 'Aventure nappa leather bag',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      features: "Всеми узнаваемая монограмма старинного дома Goyard в маленькой компактной сумочке",
      brandLogo: '/img/miu miu logo.png',
      colors: ['black'],
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
      prices: {
    mini: 15990,
    regular: 24990
      }
      },
      material: 'Натуральная Кожа',
      pockets: 3,
      weight: 0.7
    } as BagProduct,
    {
      id: 1015,
      category: 'bags',
      name: 'Goyard Saigon Mini (Black)',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      features: "Всеми узнаваемая монограмма старинного дома Goyard в маленькой компактной сумочке",
      brandLogo: '/img/Logo_Goyard.png',
      colors: ['black'],
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
      prices: {
    mini: 15990,
    regular: 24990
      }
      },
      material: 'Натуральная Кожа',
      pockets: 3,
      weight: 0.7
    } as BagProduct,
    {
      id: 1022,
      category: 'bags',
      name: 'Chanel Timless (Pink)',
      description: 'Компактная и практичная сумка от старинного дома по созданию чемоданов.',
      price: 24990,
      features: "Всеми узнаваемая монограмма старинного дома Goyard в маленькой компактной сумочке",
      brandLogo: '/img/chanel logo.png',
      colors: ['black'],
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
      prices: {
    mini: 15990,
    regular: 24990
      }
      },
      material: 'Натуральная Кожа',
      pockets: 3,
      weight: 0.7
    } as BagProduct,

  ]
};

// Все товары объединяем в один список
export const products: Product[] = Object.values(productCategories).flat();
  