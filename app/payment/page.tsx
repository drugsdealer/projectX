import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stagestore.app";

export const metadata: Metadata = {
  title: "Оплата",
  description: "Способы оплаты заказов в Stage Store: банковские карты, СБП и подтверждение платежа.",
  alternates: { canonical: `${SITE_URL}/payment` },
  robots: { index: true, follow: true },
};

export default function PaymentPage() {
  return (
    <LegalPage
      title="Оплата"
      subtitle="Принимаем онлайн-оплату банковскими картами и СБП. Финальная сумма фиксируется перед подтверждением заказа."
      updatedAt="29 апреля 2026 г."
      relatedLinks={[
        { label: "Доставка", href: "/shipping" },
        { label: "Возврат и обмен", href: "/returns" },
        { label: "Публичная оферта", href: "/offer" },
      ]}
      sections={[
        {
          title: "Доступные способы",
          content: [
            "Банковские карты Visa, Mastercard и МИР, если способ доступен у платежного провайдера.",
            "Система быстрых платежей, если она доступна для выбранного заказа.",
            "Иные способы оплаты могут появляться на странице оформления заказа.",
          ],
        },
        {
          title: "Подтверждение платежа",
          content: "После успешной оплаты заказ получает статус подтверждения. Если банк или платежный сервис вернул ошибку, заказ можно оформить повторно.",
        },
        {
          title: "Безопасность",
          content: "Платежные данные обрабатываются на стороне платежного провайдера. Stage Store не хранит полный номер карты, CVV/CVC и одноразовые коды банка.",
        },
        {
          title: "Возврат средств",
          content: "Возврат выполняется тем же способом, которым была произведена оплата. Срок зачисления зависит от банка-эмитента карты.",
        },
      ]}
    />
  );
}
