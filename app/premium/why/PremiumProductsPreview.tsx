// app/premium/why/PremiumProductsPreview.tsx
"use client";

import { useEffect, useState } from "react";
import products from "@/data/products";

const PremiumProductsPreview = () => {
  const [randomProducts, setRandomProducts] = useState([]);

  useEffect(() => {
    const premiumProducts = products.filter((p) => p.origin === "premium");
    const shuffled = [...premiumProducts].sort(() => 0.5 - Math.random());
    setRandomProducts(shuffled.slice(0, 3));
  }, []);

  return (
    <div className="flex gap-6 justify-center mt-8">
      {randomProducts.map((product) => (
        <img
          key={product.id}
          src={product.imageUrl}
          alt={product.name}
          className="w-40 h-52 object-cover rounded-lg shadow-lg transition-transform hover:scale-105"
        />
      ))}
    </div>
  );
};

export default PremiumProductsPreview;