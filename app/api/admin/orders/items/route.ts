import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { isImageKitUrl } from "@/lib/media";

export const runtime = "nodejs";

/**
 * Действия с позицией заказа в админке:
 *   receipt        — приложить чек закупки (фото или PDF, загруженный в ImageKit)
 *   removeReceipt  — убрать чек
 *   cancel         — отменить позицию (товара нет, клиенту оформлен возврат)
 *   restore        — вернуть отменённую позицию, если отменили по ошибке
 */
export async function PATCH(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;
  const adminEmail: string | null = guard.admin?.email ?? null;

  const body = await req.json().catch(() => ({} as any));
  const itemId = Number(body?.itemId);
  const action = String(body?.action || "");
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ success: false, message: "Некорректная позиция" }, { status: 400 });
  }

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { id: true, canceledAt: true, Order: { select: { id: true, status: true } } },
  });
  if (!item) {
    return NextResponse.json({ success: false, message: "Позиция не найдена" }, { status: 404 });
  }

  const select = {
    id: true,
    receiptUrl: true,
    receiptName: true,
    receiptType: true,
    receiptAddedAt: true,
    receiptAddedBy: true,
    canceledAt: true,
    canceledBy: true,
    cancelComment: true,
  } as const;

  if (action === "receipt") {
    const url = String(body?.url || "").trim();
    // Принимаем только файлы из нашего хранилища — не произвольные ссылки
    if (!/^https:\/\//i.test(url) || !isImageKitUrl(url)) {
      return NextResponse.json({ success: false, message: "Файл должен быть загружен через админку" }, { status: 400 });
    }
    if (item.canceledAt) {
      return NextResponse.json({ success: false, message: "Позиция отменена — чек к ней не нужен" }, { status: 400 });
    }
    const name = String(body?.name || "").slice(0, 200) || null;
    const type = /\.pdf(?:[?#]|$)/i.test(url) || body?.type === "pdf" ? "pdf" : "image";
    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { receiptUrl: url, receiptName: name, receiptType: type, receiptAddedAt: new Date(), receiptAddedBy: adminEmail },
      select,
    });
    return NextResponse.json({ success: true, item: updated });
  }

  if (action === "removeReceipt") {
    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { receiptUrl: null, receiptName: null, receiptType: null, receiptAddedAt: null, receiptAddedBy: null },
      select,
    });
    return NextResponse.json({ success: true, item: updated });
  }

  if (action === "cancel") {
    if (item.canceledAt) return NextResponse.json({ success: true });
    const comment = String(body?.comment || "").trim().slice(0, 500) || null;
    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { canceledAt: new Date(), canceledBy: adminEmail, cancelComment: comment },
      select,
    });
    return NextResponse.json({ success: true, item: updated });
  }

  if (action === "restore") {
    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { canceledAt: null, canceledBy: null, cancelComment: null },
      select,
    });
    return NextResponse.json({ success: true, item: updated });
  }

  return NextResponse.json({ success: false, message: "Неизвестное действие" }, { status: 400 });
}
