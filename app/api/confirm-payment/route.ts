import { NextResponse } from "next/server";

export async function POST() {
  const randomSuccess = Math.random() > 0.2; // 80% шанс успеха
  return NextResponse.json({ success: randomSuccess });
}