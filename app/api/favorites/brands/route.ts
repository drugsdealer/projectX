// app/api/favorites/brands/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/session';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import {
  buildPrivateHeaders,
  blockIfCsrf,
  privateJson,
  requireJsonRequest,
  tooManyRequests,
} from '@/lib/api-hardening';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Дополнительные фолбэки на случай, если в БД у бренда отсутствует logoUrl
const brandLogoFallbacks: Record<string, string> = {
  adidas: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/Adidas_Logo_Alternative_2_2_l0avvn.webp',
  nike: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/nike_bkpkj3.png',
  puma: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/puma_kz0bjl.png',
  reebok: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/reebok_kfdl0e.png',
  'new-balance': 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/newbalance_v4lovh.png',
  'chrome-hearts': 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/chromehearts_iwxxvz.png',
  'stone-island': 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/stoneisland_nhhazi.png',
  converse: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176393/converse_ddr6ot.png',
  'louis-vuitton': 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761174359/LV_khvkyh.svg',
  supreme: 'https://res.cloudinary.com/dhufbfxcy/image/upload/v1761176286/idiZv-aD8G_logos_qrn7qg.png',
};

// ---- GET: list favorite brands for current user ----
export async function GET(req: NextRequest) {
  const uid = await getUserIdFromRequest();

  if (!uid) {
    // не авторизован — вернём пусто (клиент сам подставит localStorage)
    return privateJson({ items: [] }, { status: 200 });
  }

  const rows = await prisma.favoriteBrand.findMany({
    where: { userId: uid },
    select: {
      Brand: {
        select: {
          slug: true,
          name: true,
          logoUrl: true,
          description: true,
          isPremium: true,
          isOfficialBrand: true,
          tags: true,
          Product: {
            select: { imageUrl: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  const items = rows.map((r) => {
    const b = r.Brand as any;
    const fallbackImg =
      Array.isArray(b?.Product) && b.Product.length > 0
        ? b.Product[0]?.imageUrl ?? null
        : null;
    const slug = (b?.slug ?? '').toString();

    const fromDb = typeof b?.logoUrl === 'string' ? b.logoUrl : null;
    const isAbsolute = fromDb ? /^https?:\/\//i.test(fromDb) : false;
    const cleanLogo = isAbsolute ? fromDb : null; // игнорируем относительные пути без файла

    const logoUrl =
      cleanLogo ||
      brandLogoFallbacks[slug] ||
      fallbackImg ||
      null;

    return {
      slug,
      name: b?.name ?? '',
      logoUrl,
      description: b?.description ?? null,
      isPremium: b?.isPremium ?? false,
      isOfficialBrand: b?.isOfficialBrand ?? false,
      tags: b?.tags ?? [],
    };
  });
  return NextResponse.json({ items }, {
    status: 200,
    headers: buildPrivateHeaders(),
  });
}

// ---- POST: add/remove favorite brand ----
export async function POST(req: NextRequest) {
  const csrfBlocked = blockIfCsrf(req);
  if (csrfBlocked) return csrfBlocked;

  const ip = getClientIp(req);
  const limitByIp = await rateLimit(`fav:brands:ip:${ip}`, 45, 60_000);
  if (!limitByIp.ok) {
    return tooManyRequests(limitByIp.retryAfter, 'rate_limited');
  }

  const jsonBlocked = requireJsonRequest(req);
  if (jsonBlocked) return jsonBlocked;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return privateJson({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const slugRaw = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const slug = slugRaw.slice(0, 80);
  const action = body?.action;
  const actionAllowed = action === 'add' || action === 'remove';
  const slugValid = /^[a-z0-9-]{1,80}$/.test(slug);

  if (!slugValid || !actionAllowed) {
    return privateJson({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const uid = await getUserIdFromRequest();
  if (!uid) {
    return privateJson({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) {
    return privateJson({ ok: false, error: 'brand_not_found' }, { status: 404 });
  }

  if (action === 'add') {
    await prisma.favoriteBrand.upsert({
      // Prisma генерирует имя userId_brandId для @@unique([userId, brandId])
      where: { userId_brandId: { userId: uid, brandId: brand.id } },
      update: {},
      create: { userId: uid, brandId: brand.id },
    });
  } else {
    await prisma.favoriteBrand.deleteMany({
      where: { userId: uid, brandId: brand.id },
    });
  }

  return NextResponse.json({ ok: true }, {
    status: 200,
    headers: buildPrivateHeaders(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: buildPrivateHeaders({ Allow: 'GET, POST, OPTIONS' }),
  });
}
