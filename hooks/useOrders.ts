"use client";

import useSWR from "swr";

type Order = {
  id: number;
  publicNumber?: string | null;
  totalAmount: number;
  status: string;
  createdAt: string;
  items?: any[];
};

type OrdersData = {
  orders: Order[];
  unauthorized: boolean;
};

export function useOrders() {
  const fetchOrders = async (url: string): Promise<OrdersData> => {
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      // Не авторизован — не считаем это "ошибкой" запроса
      return { orders: [], unauthorized: true };
    }

    if (!res.ok) {
      throw new Error("Failed to load orders");
    }

    const data = await res.json().catch(() => null);
    const raw = Array.isArray(data?.orders) ? data.orders : [];
    return { orders: raw, unauthorized: false };
  };

  const { data, error, isLoading, mutate } = useSWR<OrdersData>(
    "/api/order/history",
    fetchOrders,
    {
      revalidateIfStale: true,
      keepPreviousData: true,
    }
  );

  return {
    orders: data?.orders ?? [],
    unauth: data?.unauthorized ?? false,
    isLoading: isLoading && !data, // показываем лоадер только при самом первом запросе
    isError: !!error && !(data?.unauthorized),
    reload: () => mutate(),
  };
}