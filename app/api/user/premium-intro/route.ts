import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { enforceSameOrigin } from "@/lib/security";

export async function GET() {
  try {
    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ seen: false }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { premiumIntroSeenAt: true },
    });

    return NextResponse.json(
      { seen: Boolean(user?.premiumIntroSeenAt) },
      { status: 200 }
    );
  } catch (e) {
    console.error("[premium-intro][GET] error", e);
    return NextResponse.json({ seen: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const blocked = enforceSameOrigin(req);
    if (blocked) return blocked;

    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { premiumIntroSeenAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[premium-intro][POST] error", e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
