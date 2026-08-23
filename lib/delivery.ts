/**
 * Способы получения заказа — единый источник правды.
 * Используется в чекауте, админке и истории заказов, чтобы подписи не расходились.
 */

export type DeliveryMethodKey = "COURIER_MSK" | "PICKUP_MSK" | "RUSSIA";

export type DeliveryMethod = {
  key: DeliveryMethodKey;
  title: string;
  /** Короткая подпись про стоимость */
  priceLabel: string;
  description: string;
  /** Нужен ли адрес получателя */
  requiresAddress: boolean;
};

export const DELIVERY_METHODS: DeliveryMethod[] = [
  {
    key: "COURIER_MSK",
    title: "Курьером по Москве",
    priceLabel: "Бесплатно",
    description: "Доставим на следующий день после подтверждения заказа. Время согласуем заранее.",
    requiresAddress: true,
  },
  {
    key: "PICKUP_MSK",
    title: "Самовывоз в Москве",
    priceLabel: "Бесплатно",
    description: "Заберёте сами в удобное время — время визита согласует менеджер.",
    requiresAddress: false,
  },
  {
    key: "RUSSIA",
    title: "Доставка по России — СДЭК",
    priceLabel: "Рассчитывается",
    description:
      "В регионы отправляем только СДЭК — до пункта выдачи или курьером. Стоимость зависит от региона, менеджер сообщит её после оформления.",
    requiresAddress: true,
  },
];

export const DEFAULT_DELIVERY_METHOD: DeliveryMethodKey = "COURIER_MSK";

const BY_KEY = new Map(DELIVERY_METHODS.map((m) => [m.key, m]));

export function getDeliveryMethod(key?: string | null): DeliveryMethod | null {
  if (!key) return null;
  return BY_KEY.get(key as DeliveryMethodKey) ?? null;
}

/** Читаемая подпись для админки и истории заказов. */
export function deliveryMethodLabel(key?: string | null): string {
  const m = getDeliveryMethod(key);
  if (!m) return "Не указан";
  return m.key === "RUSSIA" ? `${m.title} (стоимость уточняется)` : `${m.title} — ${m.priceLabel.toLowerCase()}`;
}

export function isValidDeliveryMethod(key: unknown): key is DeliveryMethodKey {
  return typeof key === "string" && BY_KEY.has(key as DeliveryMethodKey);
}
