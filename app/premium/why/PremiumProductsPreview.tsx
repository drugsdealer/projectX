// app/premium/why/PremiumProductsPreview.tsx
"use client";

import { useEffect, useState } from "react";

type PreviewProduct = {
  id: number;
  imageUrl?: string | null;
  images?: string[];
  name: string;
  premium?: boolean;
};

const PremiumProductsPreview = () => {
  const [randomProducts, setRandomProducts] = useState<PreviewProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/products?category=premium&take=12", {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        const items: PreviewProduct[] = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data)
          ? data
          : [];
        const premiumOnly = items.filter((p) => p?.premium);
        const list = premiumOnly.length ? premiumOnly : items;
        const shuffled = [...list].sort(() => 0.5 - Math.random());
        if (!cancelled) setRandomProducts(shuffled.slice(0, 3));
      } catch {
        if (!cancelled) setRandomProducts([]);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <div className="flex gap-6 justify-center mt-8">
      {randomProducts.map((product) => (
        <img
          key={product.id}
          src={product.imageUrl ?? product.images?.[0] ?? "/img/placeholder.png"}
          alt={product.name}
          className="w-40 h-52 object-cover rounded-lg shadow-lg transition-transform hover:scale-105"
        />
      ))}
    </div>
  );
};

export default PremiumProductsPreview;
