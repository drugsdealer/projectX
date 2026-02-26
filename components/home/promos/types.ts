export type HomePromoProduct = {
  id: number;
  name: string;
  price?: number | null;
  imageUrl?: string | null;
  brandName?: string | null;
};

export type HomeCmsPromoConfig = {
  id: string;
  name: string;
  tag: string;
  title: string;
  subtitle: string;
  backgroundImageUrl: string;
  logoImageUrl?: string;
  accentColor?: string;
  brandQueries: string[];
  productIds: number[];
  maxItems: number;
  position: number;
  enabled: boolean;
  variant: "generic";
};
