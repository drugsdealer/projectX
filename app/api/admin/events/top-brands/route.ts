import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import {
  buildEventsServiceUrl,
  fetchEventsServiceJson,
  getEventsServiceApiKey,
  parseAnalyticsLimit,
  parseIsoRangeDate,
} from "@/lib/events-upstream";

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
  const fromRaw = urlIn.searchParams.get("from");
  const toRaw = urlIn.searchParams.get("to");
  const from = parseIsoRangeDate(fromRaw);
  const to = parseIsoRangeDate(toRaw);
  const limit = parseAnalyticsLimit(urlIn.searchParams.get("limit"), 20);
  if ((fromRaw && !from) || (toRaw && !to)) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
  }

  const upstreamUrl = buildEventsServiceUrl("/api/v1/analytics/top-brands", { from, to, limit });
  if (!upstreamUrl) {
    return NextResponse.json(
      { success: false, message: "EVENTS_SERVICE_URL is not configured" },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetchEventsServiceJson<any>(upstreamUrl, {
      apiKey,
      requestId: req.headers.get("x-request-id"),
      timeoutMs: 6000,
      retries: 1,
    });
    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          message: upstream.message || "Failed to fetch top brands analytics",
          upstreamStatus: upstream.status,
        },
        { status: upstream.status || 502, headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    return NextResponse.json(
      { success: true, items: upstream.data },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[admin.events.top-brands] upstream error", error);
    return NextResponse.json(
      { success: false, message: "Events analytics service unavailable" },
      { status: 502 }
    );
  }
}
