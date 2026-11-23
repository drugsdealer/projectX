/**
 * Розыгрыш в Telegram-канале — настройки баннера на главной и страницы /giveaway.
 * Участие — только в Telegram, по ссылке на пост. После endsAt баннер в слайдере пропадает сам,
 * а страница показывает «Розыгрыш завершён — итоги в канале».
 */
export const GIVEAWAY = {
  path: "/giveaway",
  postUrl: "https://t.me/stagestore/15",
  channel: "@stagestore",
  image: "/promo/giveaway/post.jpg",
  /** Итоги — 25 ноября 2026; до конца этого дня по Москве розыгрыш считается идущим. */
  resultsDate: "25 ноября",
  endsAt: "2026-11-25T23:59:59+03:00",
  prizes: [
    { place: "1 место", name: "Шапка MM6 Maison Margiela", note: "Numbers beanie" },
    { place: "2 место", name: "Аромат Maison Margiela Replica", note: "на выбор из каталога сайта" },
  ],
  steps: ["Подписаться на @stagestore", "Сделать репост в сторис", "Нажать «Участвую!» под постом"],
} as const;

export function isGiveawayActive(now = new Date()) {
  return now.getTime() <= new Date(GIVEAWAY.endsAt).getTime();
}
