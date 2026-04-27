"use client";

import { useState, useEffect } from "react";

export type AcProduct = {
  id: string;
  name: string;
  price: number | null;
  brandName: string | null;
  imageUrl: string | null;
};

export type AcBrand = {
  name: string;
  slug: string;
};

export function useAutocomplete(query: string) {
  const q = query.trim();
  const [products, setProducts] = useState<AcProduct[]>([]);
  const [brands, setBrands] = useState<AcBrand[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) {
      setProducts([]);
      setBrands([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        setProducts(data.products ?? []);
        setBrands(data.brands ?? []);
      } catch {
        // silent — partial results are fine
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [q]);

  return { products, brands, loading, active: q.length >= 2 };
}
