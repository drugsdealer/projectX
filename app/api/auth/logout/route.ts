import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../_session";

export const runtime = "nodejs";


const AUTH_COOKIE = "auth_session";


const UI_COOKIES = [
  "ui_user_id",
  "ui_user_email",
  "ui_user_fullName",
  "ui_loyalty",
  "ui_avatar",
];

function unsetCookie(res: NextResponse, name: string, httpOnly = false) {
  res.cookies.set({
    name,
    value: "",
    path: "/",
    httpOnly,
    secure: true,
    sameSite: "lax",
    expires: new Date(0),
  });
}

async function doLogout() {
  const res = NextResponse.json({ success: true, loggedOut: true });

  unsetCookie(res, AUTH_COOKIE, true);
  unsetCookie(res, SESSION_COOKIE, true);

  for (const k of UI_COOKIES) unsetCookie(res, k, false);

  res.headers.set("Clear-Site-Data", '"cookies"');

  return res;
}

export async function POST() {
  return doLogout();
}

export async function GET() {
  return doLogout();
}