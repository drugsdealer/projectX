type UpstreamQuery = Record<string, string | number | null | undefined>;

export function buildEventsServiceUrl(path: string, query?: UpstreamQuery): URL | null {
  const base = process.env.EVENTS_SERVICE_URL;
  if (!base) {
    return null;
  }

  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export function getEventsServiceApiKey(): string | null {
  return process.env.EVENTS_SERVICE_API_KEY ?? null;
}
