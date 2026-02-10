import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { notifyOrderArrived } from "@/lib/notifications";

const SHIPPING_STATUSES = ["PROCESSING", "ABROAD", "IN_RUSSIA", "ARRIVED"] as const;

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      publicNumber: true,
      totalAmount: true,
      status: true,
      shippingStatus: true,
      createdAt: true,
      updatedAt: true,
      deliveryRequestedAt: true,
      deliveryScheduledAt: true,
      deliveryAddress: true,
      deliveryRecipientName: true,
      deliveryPhone: true,
      handedAt: true,
      fullName: true,
      email: true,
      phone: true,
      address: true,
      User: { select: { id: true, email: true } },
      OrderItem: { select: { id: true, name: true, price: true, quantity: true, size: true, image: true } },
    },
  });

  return NextResponse.json({ success: true, orders });
}

export async function PATCH(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  const status = String(body?.shippingStatus || "");
  const action = String(body?.action || "");
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
  }
  const isHanded = action === "handed";
  if (!isHanded && !SHIPPING_STATUSES.includes(status as any)) {
    return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      shippingStatus: true,
      email: true,
      phone: true,
      publicNumber: true,
      deliveryNotifiedAt: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: isHanded
      ? { handedAt: new Date() }
      : { shippingStatus: status as any },
    select: { id: true, shippingStatus: true, handedAt: true },
  });

  if (
    existing.shippingStatus !== "ARRIVED" &&
    status === "ARRIVED" &&
    !existing.deliveryNotifiedAt
  ) {
    try {
      await notifyOrderArrived({
        email: existing.email,
        phone: existing.phone,
        orderNumber: existing.publicNumber ?? existing.id,
      });
      await prisma.order.update({
        where: { id: existing.id },
        data: { deliveryNotifiedAt: new Date() },
      });
    } catch (err) {
      console.error("[admin.orders] notifyOrderArrived failed", err);
    }
  }

  return NextResponse.json({ success: true, order: updated });
}
