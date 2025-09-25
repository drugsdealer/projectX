import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { getUserById, publicUser } from "../_users";
import { getSessionTokenFromRequest, getUserIdBySession } from "../_session";

export async function GET(req: Request) {
  try {
    const token = getSessionTokenFromRequest(req);
    const userId = await getUserIdBySession(token);
    if (!userId) {
      return NextResponse.json({ success: false, user: null }, { status: 200 });
    }
    const user = await getUserById(userId);
    return NextResponse.json({ success: true, user: user ? publicUser(user) : null });
  } catch (e) {
    console.error("[ME] exception", e);
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}