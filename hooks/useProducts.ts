"use client";

import useSWR from "swr";

export interface ProductListItem {
  id: number | string;
  name: string;
  imageUrl?: string | null;
  images?: string[];
  price?: number;
  minPrice?: number;
  amount?: number;
  brand?: any;
  brandName?: string | null;
}

type ProductsResponse = {
  products: ProductListItem[];
};

export function useProducts() {
  const {
    data,
    error,
    isLoading,
  } = useSWR<ProductsResponse>("/api/products", {
    revalidateIfStale: true,
    keepPreviousData: true,
  });

  const products: ProductListItem[] = Array.isArray(data?.products)
    ? data!.products
    : [];

  return {
    products,
    isLoading,
    isError: !!error,
    error,
  };
}