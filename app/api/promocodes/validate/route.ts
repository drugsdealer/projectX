import { NextRequest, NextResponse } from "next/server";
import { validatePromo } from "@/lib/promos";

function getUserIdFromRequest(req: NextRequest): number | undefined {
  try {
    const idFromHeader = req.headers.get("x-user-id") || req.headers.get("X-User-Id");
    if (idFromHeader) {
      const n = Number(idFromHeader);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  try {
    const idFromCookie = req.cookies.get("userId")?.value || req.cookies.get("uid")?.value;
    if (idFromCookie) {
      const n = Number(idFromCookie);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  return undefined;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = String(body?.code || "");
  const subtotal = Number(body?.subtotal || 0);
  const userId = getUserIdFromRequest(req);

  const result = await validatePromo({ code, subtotal, userId: userId ?? undefined });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}