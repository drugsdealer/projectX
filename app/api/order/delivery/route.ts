import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "../../_utils/session";
import { sendDeliveryRequestToTelegram } from "@/lib/telegram";

export const runtime = "nodejs";

function getMoscowNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
}

function getMoscowParts(date: Date) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isNextDaySlot(dateIso: string): boolean {
  const target = new Date(dateIso);
  if (Number.isNaN(target.getTime())) return false;

  const nowParts = getMoscowParts(getMoscowNow());
  const targetParts = getMoscowParts(target);

  let ny = nowParts.year;
  let nm = nowParts.month;
  let nd = nowParts.day + 1;
  const dim = daysInMonth(ny, nm);
  if (nd > dim) {
    nd = 1;
    nm += 1;
    if (nm > 12) {
      nm = 1;
      ny += 1;
    }
  }

  const isNextDay = targetParts.year === ny && targetParts.month === nm && targetParts.day === nd;
  const allowedStarts = new Set([13, 16, 17]);
  const hourOk = allowedStarts.has(targetParts.hour);
  const minuteOk = targetParts.minute === 0;
  return isNextDay && hourOk && minuteOk;
}

function formatDeliverySlot(date: Date): string {
  const { hour } = getMoscowParts(date);
  if (hour === 13) return "13:00–16:00";
  if (hour === 16) return "16:00–19:00";
  if (hour === 17) return "17:00–20:00";
  return `${hour}:00`;
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = Number(body?.orderId);
  const scheduledAtRaw = String(body?.scheduledAt || "").trim();
  const fullName = String(body?.fullName || "").trim();
  const address = String(body?.address || "").trim();
  const phoneRaw = String(body?.phone || "").trim();
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  const phoneValid = /^([78]\d{10})$/.test(phoneDigits);

  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ success: false, message: "Некорректный заказ" }, { status: 400 });
  }
  if (!scheduledAtRaw || !isNextDaySlot(scheduledAtRaw)) {
    return NextResponse.json(
      { success: false, message: "Неверное время доставки" },
      { status: 400 }
    );
  }
  if (!fullName || !address) {
    return NextResponse.json(
      { success: false, message: "Введите ФИО и адрес доставки" },
      { status: 400 }
    );
  }
  if (!phoneValid) {
    return NextResponse.json(
      { success: false, message: "Введите корректный мобильный телефон" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, deletedAt: null },
    select: { id: true, shippingStatus: true, publicNumber: true },
  });
  if (!order) {
    return NextResponse.json({ success: false, message: "Заказ не найден" }, { status: 404 });
  }
  if (order.shippingStatus !== "ARRIVED") {
    return NextResponse.json(
      { success: false, message: "Доставка доступна только после статуса «Заказ приехал»" },
      { status: 400 }
    );
  }

  const scheduledAt = new Date(scheduledAtRaw);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      deliveryRequestedAt: new Date(),
      deliveryScheduledAt: scheduledAt,
      deliveryAddress: address,
      deliveryRecipientName: fullName,
      deliveryPhone: phoneDigits,
    },
  });

  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(scheduledAt);

  await sendDeliveryRequestToTelegram({
    orderNumber: order.publicNumber ?? order.id,
    fullName,
    address,
    scheduledAt: `${dateLabel} ${formatDeliverySlot(scheduledAt)} (МСК)`,
    phone: phoneDigits || undefined,
  });

  return NextResponse.json({ success: true });
}
