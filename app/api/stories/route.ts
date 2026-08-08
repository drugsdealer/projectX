import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { getActiveStories } from "@/lib/stories";

export async function GET() {
  const stories = await getActiveStories();
  return NextResponse.json({ success: true, stories });
}
