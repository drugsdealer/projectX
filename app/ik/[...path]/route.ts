import { NextRequest, NextResponse } from "next/server";

// Отдаём картинки ImageKit со своего домена.
// Прямой ik.imagekit.io не проходит у части российских операторов, а наш сервер
// до него достучаться может. Ходим за файлом сами и отдаём браузеру как свой.
const ALLOWED_HOST = "ik.imagekit.io";
const CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  const segments = (path ?? []).filter(Boolean);
  if (segments.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Собираем адрес только внутри разрешённого хоста — чтобы это не превратилось
  // в открытый прокси, через который можно тянуть что угодно.
  const target = new URL(
    `https://${ALLOWED_HOST}/${segments.map(encodeURIComponent).join("/")}`
  );
  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  // Ошибку не кешируем нигде: иначе разовый сбой ImageKit «залипает» и фото пропадает
  // для всех, пока кеш не истечёт.
  const NO_STORE = { "cache-control": "no-store" };
  const load = () =>
    fetch(target, {
      headers: { accept: req.headers.get("accept") ?? "image/*" },
      next: { revalidate: 2592000 },
    });

  try {
    let upstream: Response | null = null;
    try {
      upstream = await load();
    } catch {
      upstream = null;
    }
    // Один повтор при сбое сети или ответе 5xx/429 — у ImageKit такое бывает кратковременно.
    if (!upstream || upstream.status >= 500 || upstream.status === 429) {
      await new Promise((r) => setTimeout(r, 300));
      upstream = await load();
    }

    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Image not available", { status: upstream.status || 502, headers: NO_STORE });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
        "cache-control": CACHE,
      },
    });
  } catch {
    return new NextResponse("Image fetch failed", { status: 502, headers: NO_STORE });
  }
}
