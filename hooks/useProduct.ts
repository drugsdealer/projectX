"use client";

import { useMemo } from "react";
import { useApi } from "./useApi";      
import { useProducts } from "./useProducts";

export interface ProductDto {
  id: number | string;
  name: string;
  imageUrl?: string | null;
  images?: string[];
  price?: number;
  minPrice?: number;
  amount?: number;
  // доп поля по желанию
}

export function useProduct(id: string | number | null) {
  const normId = id != null ? String(id) : null;

  // 1) пробуем взять товар из уже загруженного списка
  const { products, isLoading: listLoading } = useProducts();

  const fromList = useMemo(() => {
    if (!normId) return null;
    return (
      products.find((p: ProductDto | any) => {
        return (
          String(p.id) === normId ||
          String((p as any).productId ?? "") === normId
        );
      }) ?? null
    );
  }, [products, normId]);

  // 2) если из списка не нашли (прямой заход) — делаем отдельный запрос
  const shouldFetchSingle = !fromList && !!normId;
  const { data: single, error, isLoading: singleLoading } =
    useApi<ProductDto>(shouldFetchSingle ? `/api/products/${normId}` : null, {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    });

  const product = fromList ?? single ?? null;
  const isLoading = !product && (listLoading || singleLoading);
  const isError = !!error;

  return { product, isLoading, isError, error };
}