import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/admin";

export async function POST(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const slug = body?.slug ? String(body.slug).trim() : null;

  revalidatePath("/brands");
  if (slug) {
    revalidatePath(`/brand/${slug}`);
  }

  return NextResponse.json({ success: true });
}
