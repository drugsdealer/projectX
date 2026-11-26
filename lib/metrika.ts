/**
 * Цели Яндекс Метрики (счётчик 108732905). В кабинете Метрики каждую цель заводят
 * как «JavaScript-событие» с тем же идентификатором:
 *   tg_click       — переход в Telegram (любая ссылка t.me)
 *   add_to_cart    — товар добавлен в корзину
 *   order_created  — заказ оформлен (до оплаты)
 *   payment_start  — покупатель ушёл на оплату в банк
 * Метрика загружается только после согласия на cookies, до этого вызовы просто ничего не делают.
 */
export const YM_ID = 108732905;

export function ymGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    window.ym?.(YM_ID, "reachGoal", goal, params);
  } catch {
    // Метрика не должна ломать сайт
  }
}
