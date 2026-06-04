# Stage Store — Claude Code контекст

## Проект
**Stage Store** — интернет-магазин брендовой одежды, обуви и аксессуаров.  
Production URL: https://stagestore.app  
GitHub: https://github.com/drugsdealer/projectX  
Деплой: **Vercel** — автодеплой при `git push origin main`

---

## Стек

| Слой | Технология |
|------|-----------|
| Framework | Next.js 14+ App Router (TypeScript) |
| Стили | Tailwind CSS + Framer Motion |
| ORM | Prisma → Neon PostgreSQL |
| CDN | ImageKit (`ik.imagekit.io/qowmy92ny`) |
| Хостинг | Vercel |
| Анимации | Framer Motion, Swiper |
| UI компоненты | Radix UI |

---

## Критические правила

1. **Деплой = git push** — `git add → commit → push origin main` → Vercel деплоит автоматически. Без push изменения не попадают на продакшен.
2. **Prisma schema изменения** → всегда `npx prisma db push` после правок schema.prisma, затем push.
3. **ISR кеш** → после изменений в админке вызывать `revalidatePath()` для нужных страниц.
4. **ImageKit** → все медиа через `getOptimizedImageUrl()` из `lib/media.ts`. Не использовать `unoptimized` без `shouldBypassNextImageOptimization()`.
5. **`normalizeProduct()`** → стрипает неизвестные поля. Дополнительные данные читать из `rawProduct`, не из `product`.

---

## Структура ключевых файлов

```
app/
  HomeClient.tsx          — главная страница (клиент)
  page.tsx                — главная (сервер, ISR revalidate=60)
  product/[id]/
    page.tsx              — страница товара (ISR revalidate=300)
    ProductPageClient.tsx — карточка товара (огромный файл)
  premium/
    PremiumClient.tsx     — Premium страница
  brand/[slug]/page.tsx   — страница бренда
  brands/page.tsx         — список брендов
  search/SearchClient.tsx — страница поиска
  admin/
    products/page.tsx     — админка товаров
    brands/page.tsx       — админка брендов
  api/
    products/[id]/route.ts        — публичный API одного товара
    admin/products/[id]/route.ts  — PATCH/DELETE товара (admin)
    recommendations/
      personal/route.ts   — персональные рекомендации (events service)
      bestsellers/route.ts
      for-you/route.ts    — DB-based персонализация (поведенческий профиль)
    events/track/route.ts — трекинг событий

lib/
  prisma.ts               — Prisma client singleton
  media.ts                — getOptimizedImageUrl, shouldBypassNextImageOptimization
  user-behavior.ts        — клиентский поведенческий профиль (localStorage)
  normalizeProduct.ts     — нормализатор данных товара
  events-client.ts        — trackShopEvent()
  rate-limit.ts           — rateLimit()
  admin.ts                — requireAdminApi()

components/
  shared/
    header.tsx            — хедер с прозрачным режимом на главной
    BannerMargiela.tsx    — hero-слайдер главной страницы
    SearchBar.tsx         — поиск с историей и dropdown
  home/
    ForYouFeed.tsx        — "Снова смотришь" + "Для тебя"
    HomeFeedInsert.tsx    — "Вам может понравиться"
    promos/
      SafariBanner.tsx    — промо "Зов саванны"
      GentleMonsterBanner.tsx
  ui/
    BrandClient.tsx       — страница бренда (товары, фильтры, сортировка)

hooks/
  useTrackBehavior.ts     — хуки для трекинга поведения пользователя
```

---

## Prisma модели (ключевые поля)

**Product:**
- `collabBrandIds Int[] @default([])` — ID брендов-коллабораторов
- `features String?` — для аксессуаров: габариты; для брендов: hero фото
- `material String?` — материал; для брендов: cover фото (/brands страница)

**Brand:**
- `logoUrl` — логотип
- `features` — hero background на странице бренда `/brand/[slug]`
- `material` — cover на странице `/brands`

---

## Система рекомендаций

```
lib/user-behavior.ts          — профиль в localStorage (бренды, категории, dwell-time)
hooks/useTrackBehavior.ts     — React хуки (useTrackProduct, useTrackBrandClick...)
app/api/recommendations/
  for-you/route.ts            — POST с ProfileSnapshot → персональные товары из DB
  personal/route.ts           — через внешний events service
  bestsellers/route.ts        — топ по events service
components/home/ForYouFeed.tsx — "Снова смотришь" + "Для тебя" на главной
```

---

## Команды

```bash
npm run dev          # локальный сервер
npm run build        # сборка (= prisma generate + next build)
npm run lint         # ESLint
npx tsc --noEmit     # проверка типов без сборки
npx prisma db push   # применить изменения schema к Neon DB
npx prisma studio    # GUI для DB

# Деплой (всегда так):
git add <files>
git commit -m "коммитN: описание"
git push origin main
```

---

## Паттерны которые надо знать

**ISR + ревалидация после сохранения в админке:**
```ts
import { revalidatePath } from "next/cache";
revalidatePath(`/product/${id}`, "page");
revalidatePath(`/api/products/${id}`);
```

**Изображения ImageKit:**
```ts
import { getOptimizedImageUrl, shouldBypassNextImageOptimization } from "@/lib/media";
const src = getOptimizedImageUrl(url, { width: 800, quality: 82 });
const bypass = shouldBypassNextImageOptimization(url);
<Image src={src} unoptimized={bypass} ... />
```

**Трекинг поведения на странице товара:**
```ts
import { useTrackProduct } from "@/hooks/useTrackBehavior";
useTrackProduct({ product: trackInput }); // автоматически дwell-time при unmount
```

**Читать collabBrands из rawProduct (НЕ из product):**
```ts
// product проходит через normalizeProduct() — поле стрипается
// rawProduct — сырой JSON из API, содержит collabBrands
const collabBrands = (rawProduct as any)?.collabBrands ?? [];
```

---

## Переменные окружения (production Vercel)
- `DATABASE_URL` — Neon PostgreSQL connection string
- `EVENTS_SERVICE_URL` — внешний аналитический сервис
- `EVENTS_SERVICE_API_KEY`
- `NEXT_PUBLIC_SITE_URL` — https://stagestore.app
- `IMAGEKIT_*` — ImageKit credentials

---

## Пользователь
Владелец проекта, не технический специалист. Работает через Claude Code.  
Предпочитает: коммитить и пушить после каждого набора изменений, видеть результат на живом сайте.
