import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
      take: 5,
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Prisma test error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}