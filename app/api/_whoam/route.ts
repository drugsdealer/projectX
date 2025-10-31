import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/apiGuard";
import { handleApiError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireUser();
    const maybe = cookies() as any;
    const jar = typeof maybe?.then === "function" ? await maybe : maybe;
    const all = jar?.getAll?.() ?? [];

    return NextResponse.json({
      userId: user.id,
      cookies: all.map((c: any) => ({
        name: c.name,
        value: c.value,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        path: c.path,
        secure: c.secure,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}