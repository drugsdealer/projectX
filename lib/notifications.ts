import nodemailer from "nodemailer";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

type SmsPayload = {
  to: string;
  text: string;
};

function getSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendEmail(payload: EmailPayload) {
  const from = process.env.EMAIL_FROM || process.env.MAIL_FROM || process.env.SMTP_USER;
  const transport = getSmtpTransport();
  if (!from || !transport) {
    console.warn("[email] SMTP not configured, skip email", { to: payload.to });
    return false;
  }

  await transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
  });
  return true;
}

export async function sendSms(payload: SmsPayload) {
  const apiUrl = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;
  if (!apiUrl || !apiKey) {
    console.warn("[sms] SMS provider not configured, skip sms", { to: payload.to });
    return false;
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ to: payload.to, text: payload.text }),
  }).catch((err) => {
    console.error("[sms] request failed", err);
    return null;
  });

  if (!res || !res.ok) {
    console.error("[sms] provider error", { status: res?.status });
    return false;
  }
  return true;
}

export async function notifyOrderArrived(params: {
  email?: string | null;
  phone?: string | null;
  orderNumber: string | number;
}) {
  const { email, phone, orderNumber } = params;
  const text = `Ваш заказ №${orderNumber} прибыл. Теперь доступна доставка на дом в вашем личном кабинете.`;

  console.log(`[notify][email] ${email ?? "no-email"}: ${text}`);

  if (email) {
    await sendEmail({
      to: email,
      subject: `Заказ №${orderNumber} прибыл`,
      text,
    }).catch((err) => console.error("[email] notifyOrderArrived", err));
  }

  if (phone) {
    await sendSms({ to: phone, text }).catch((err) => console.error("[sms] notifyOrderArrived", err));
  }
}
