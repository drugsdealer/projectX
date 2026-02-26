import { NextResponse } from "next/server";
import { buildEventsServiceUrl, getEventsServiceApiKey } from "@/lib/events-upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = getEventsServiceApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "Events service is not configured" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const isBatch = Array.isArray((body as any).events);
  const upstreamUrl = buildEventsServiceUrl(
    isBatch ? "/api/v1/events/batch" : "/api/v1/events"
  );

  if (!upstreamUrl) {
    return NextResponse.json(
      { success: false, message: "EVENTS_SERVICE_URL is not configured" },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Events-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error("[events.track] upstream error", error);
    return NextResponse.json(
      { success: false, message: "Events service unavailable" },
      { status: 502 }
    );
  }
}
