import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const metadata: Metadata = {
  title: "Таблица размеров",
  description: "Базовая размерная сетка Stage Store для обуви и одежды.",
  alternates: { canonical: `${SITE_URL}/size-guide` },
  robots: { index: true, follow: true },
};

export default function SizeGuidePage() {
  return (
    <LegalPage
      title="Таблица размеров"
      subtitle="Размеры у брендов могут отличаться. Если сомневаетесь между двумя вариантами, уточните замеры перед заказом."
      updatedAt="29 апреля 2026 г."
      relatedLinks={[
        { label: "Доставка", href: "/shipping" },
        { label: "Возврат и обмен", href: "/returns" },
        { label: "Контакты", href: "/contacts" },
      ]}
      sections={[
        {
          title: "Обувь",
          content: [
            "EU 39: стопа примерно 24,5-25 см.",
            "EU 40: стопа примерно 25-25,5 см.",
            "EU 41: стопа примерно 26-26,5 см.",
            "EU 42: стопа примерно 26,5-27 см.",
            "EU 43: стопа примерно 27,5-28 см.",
            "EU 44: стопа примерно 28-28,5 см.",
          ],
        },
        {
          title: "Одежда",
          content: [
            "S: обычно подходит на российский 44-46.",
            "M: обычно подходит на российский 46-48.",
            "L: обычно подходит на российский 48-50.",
            "XL: обычно подходит на российский 50-52.",
          ],
        },
        {
          title: "Как выбрать точнее",
          content: "Сравните замеры своей вещи с замерами товара. Для обуви ориентируйтесь на длину стопы и особенности модели: узкая, широкая, маломерит или идет в размер.",
        },
        {
          title: "Помощь с подбором",
          content: "Если нужной размерной сетки нет в карточке товара, напишите нам в Telegram @stagestore или на storestage@yandex.ru.",
        },
      ]}
    />
  );
}
