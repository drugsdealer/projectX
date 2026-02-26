import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { buildEventsServiceUrl, getEventsServiceApiKey } from "@/lib/events-upstream";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const apiKey = getEventsServiceApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "Events service API key is not configured" },
      { status: 503 }
    );
  }

  const urlIn = new URL(req.url);
  const from = urlIn.searchParams.get("from");
  const to = urlIn.searchParams.get("to");
  const limit = urlIn.searchParams.get("limit") || "20";

  const upstreamUrl = buildEventsServiceUrl("/api/v1/analytics/top-products", {
    from,
    to,
    limit,
  });
  if (!upstreamUrl) {
    return NextResponse.json(
      { success: false, message: "EVENTS_SERVICE_URL is not configured" },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Events-Api-Key": apiKey,
      },
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || "Failed to fetch top products analytics",
          upstreamStatus: upstream.status,
        },
        { status: upstream.status || 502 }
      );
    }
    return NextResponse.json({ success: true, items: data });
  } catch (error) {
    console.error("[admin.events.top-products] upstream error", error);
    return NextResponse.json(
      { success: false, message: "Events analytics service unavailable" },
      { status: 502 }
    );
  }
}
