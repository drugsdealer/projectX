import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

type OrderItem = {
  name: string;
  quantity: number;
  price: number;
  size?: string | null;
};

type ReceiptParams = {
  to: string;
  orderNumber: string;
  fullName: string;
  items: OrderItem[];
  totalAmount: number;
  address: string;
  phone?: string | null;
  paidAt?: Date | null;
};

function formatPrice(amount: number): string {
  return amount.toLocaleString("ru-RU") + " \u20BD";
}

function buildReceiptHtml(params: ReceiptParams): string {
  const { orderNumber, fullName, items, totalAmount, address, phone, paidAt } = params;

  const date = paidAt
    ? paidAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:14px;color:#1a1a1a;padding-right:8px;word-break:break-word">
                ${item.name}${item.size ? `<br><span style="font-size:12px;color:#888">Размер: ${item.size}</span>` : ""}
              </td>
              <td style="font-size:14px;color:#1a1a1a;text-align:right;white-space:nowrap;vertical-align:top;min-width:80px">
                <span style="color:#888;font-size:12px;display:block">${item.quantity}&nbsp;шт</span>
                <span style="font-weight:600">${formatPrice(item.price * item.quantity)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a1a;padding:24px 20px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:1px">STAGE STORE</div>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:24px 20px 8px">
            <div style="font-size:20px;font-weight:700;color:#1a1a1a">
              Спасибо за покупку!
            </div>
            <div style="margin-top:8px;font-size:14px;color:#666">
              Заказ ${orderNumber} от ${date}
            </div>
          </td>
        </tr>

        <!-- Customer info -->
        <tr>
          <td style="padding:16px 20px 24px">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:12px;padding:16px 20px">
              <tr>
                <td style="font-size:13px;color:#888;padding:4px 0">Получатель</td>
                <td style="font-size:13px;color:#1a1a1a;text-align:right;padding:4px 0;font-weight:500">${fullName}</td>
              </tr>
              ${phone ? `<tr>
                <td style="font-size:13px;color:#888;padding:4px 0">Телефон</td>
                <td style="font-size:13px;color:#1a1a1a;text-align:right;padding:4px 0">${phone}</td>
              </tr>` : ""}
              <tr>
                <td style="font-size:13px;color:#888;padding:4px 0">Адрес</td>
                <td style="font-size:13px;color:#1a1a1a;text-align:right;padding:4px 0">${address}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="padding:0 40px 24px">
            <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:12px">Состав заказа</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${itemRows}
            </table>
          </td>
        </tr>

        <!-- Total -->
        <tr>
          <td style="padding:0 40px 32px">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;padding:20px 24px">
              <tr>
                <td style="font-size:16px;color:#ffffff;font-weight:500">Итого</td>
                <td style="font-size:20px;color:#ffffff;font-weight:700;text-align:right">${formatPrice(totalAmount)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:0 40px 32px;text-align:center">
            <a href="https://stagestore.app/user?tab=orders" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:100px;font-size:14px;font-weight:600">
              Мои заказы
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 24px;text-align:center;font-size:12px;color:#aaa;line-height:1.5">
            Если у вас есть вопросы, напишите нам в Telegram.<br>
            Stage Store &mdash; оригинальная одежда и аксессуары.
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendOrderReceipt(params: ReceiptParams): Promise<boolean> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[receipt] RESEND_API_KEY not set, skipping receipt email");
    return false;
  }

  try {
    const html = buildReceiptHtml(params);

    const { error } = await getResend().emails.send({
      from: `Stage Store <${fromEmail}>`,
      to: params.to,
      subject: `Чек по заказу ${params.orderNumber} — Stage Store`,
      html,
    });

    if (error) {
      console.error("[receipt] Resend error:", error);
      return false;
    }

    console.log(`[receipt] sent to ${params.to} for order ${params.orderNumber}`);
    return true;
  } catch (err) {
    console.error("[receipt] failed to send:", err);
    return false;
  }
}
