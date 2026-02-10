import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../_session";
import { cookies as nextCookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_TOKEN_COOKIE } from "../../_utils/session";

export const runtime = "nodejs";


const AUTH_COOKIE = "auth_session";


const UI_COOKIES = [
  "ui_user_id",
  "ui_user_email",
  "ui_user_fullName",
  "ui_user_data",
  "ui_fullname",
  "ui_loyalty",
  "ui_avatar",
  "stage_session",
  "uid",
];
const ADMIN_COOKIES = ["admin_2fa_ok", "admin_impersonator"];

const IS_PROD = process.env.NODE_ENV === "production";

function unsetCookie(res: NextResponse, name: string, httpOnly = false) {
  res.cookies.set({
    name,
    value: "",
    path: "/",
    httpOnly,
    secure: IS_PROD,
    sameSite: "lax",
    expires: new Date(0),
  });
}

async function doLogout() {
  const res = NextResponse.json({ success: true, loggedOut: true });

  unsetCookie(res, AUTH_COOKIE, true);
  unsetCookie(res, SESSION_COOKIE, true);
  unsetCookie(res, SESSION_TOKEN_COOKIE, true);
  unsetCookie(res, "auth_user_id", true);
  for (const k of ADMIN_COOKIES) unsetCookie(res, k, true);

  for (const k of UI_COOKIES) unsetCookie(res, k, false);

  res.headers.set("Clear-Site-Data", '"cookies"');

  return res;
}

export async function POST() {
  try {
    const jar = await nextCookies();
    const token = jar.get(SESSION_TOKEN_COOKIE)?.value;
    if (token) {
      prisma.userSession.update({
        where: { token },
        data: { revokedAt: new Date() },
      }).catch(() => {});
    }
  } catch {}
  return doLogout();
}

export async function GET() {
  try {
    const jar = await nextCookies();
    const token = jar.get(SESSION_TOKEN_COOKIE)?.value;
    if (token) {
      prisma.userSession.update({
        where: { token },
        data: { revokedAt: new Date() },
      }).catch(() => {});
    }
  } catch {}
  return doLogout();
}
