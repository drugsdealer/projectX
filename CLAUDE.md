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

1. **Сначала тест, потом прод.** Новые доработки делаются в ветке `dev` → `git push origin dev` → Vercel сам собирает https://test.stagestore.app (пароль). В `main` (= stagestore.app) переносить только когда владелец скажет «выкатывай»: `git checkout main && git merge dev && git push origin main`. Срочные мелкие исправления можно сразу в main, потом влить main в dev.
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

# Доработка (на тестовый сайт):
git checkout dev
git add <files>
git commit -m "коммитN: описание"
git push origin dev            # → test.stagestore.app

# Выкатить на основной сайт (по команде владельца «выкатывай»):
git checkout main && git merge dev && git push origin main && git checkout dev
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
- `TBANK_TERMINAL_KEY` — терминал эквайринга T-Bank (для теста — терминал с суффиксом DEMO)
- `TBANK_PASSWORD_B64` — пароль терминала T-Bank в base64 (в пароле есть `#` и `&`, в обычной записи панель Vercel их теряет). Резервно читается `TBANK_PASSWORD`
- `TBANK_API_BASE`, `TBANK_PROXY_SECRET` — запросы к банку идут через российский посредник `pay.stagestore.app` (банк не отвечает зарубежным IP)
- `TBANK_RECEIPT=off` — временно отключить фискальный чек
- `GOOGLE_SITE_VERIFICATION`, `YANDEX_VERIFICATION` — коды подтверждения Search Console / Яндекс Вебмастера (meta в layout)

**Оплата T-Bank (non-PCI):** оформление → `/payment/pay?orderId=` создаёт платёж через `/api/tbank/init`
(сумма из БД, гость — по куке `order_token`) → редирект на форму банка → `/api/tbank/notification`
подтверждает или отменяет заказ (подпись обязательна). При сбое `/payment/pay` показывает ошибку с повтором.
Брошенные оплаты отменяются при открытии истории заказов (`lib/order-payment-sync.ts`). Заглушки оплаты нет.

---

## Пользователь
Владелец проекта, не технический специалист. Работает через Claude Code.  
Предпочитает: коммитить и пушить после каждого набора изменений, видеть результат на живом сайте.

---

## Тестовый сайт (test.stagestore.app)
- Ветка `dev` → Vercel preview; домен test.stagestore.app привязан к ветке dev. Ходит напрямую на Vercel (без DDoS-Guard) — из России может понадобиться VPN, владельца это устраивает.
- Закрыт паролем: Basic Auth в `middleware.ts` при `VERCEL_ENV=preview` (`lib/staging.ts` → `IS_STAGING`), пароль — `STAGING_PASSWORD` (Preview, ветка dev). Логин любой (stage). Пароль в чат не выводить — он у владельца в файле на рабочем столе.
- Своя база: `stagestore_test` на том же Neon-сервере (копия прода от 2026-11-19). `DATABASE_URL`/`DIRECT_URL` для ветки dev заданы в Vercel отдельно. Изменения schema.prisma сначала `db push` в тестовую базу, после «выкатывай» — в прод.
- Встроенный вход Vercel (Deployment Protection) выключен — защита только нашим паролем.
- Telegram с теста шлёт в рабочие чаты с пометкой «🧪 ТЕСТОВЫЙ САЙТ». Оплаты T-Bank на тесте нет (переменные TBANK только в Production).

## DDoS-Guard (доступ из России)
- DNS у Vercel. A-запись `stagestore.app` → `185.178.208.148` (DDoS-Guard, тариф Basic), тот проксирует на Vercel `76.76.21.21`. `www`, `pay`, почтовые записи — без изменений. Откат: A-запись обратно на `76.76.21.21`.
- Браузер не должен ходить на `ik.imagekit.io` / `res.cloudinary.com` напрямую — из России они открываются не у всех. Любой `src`/`poster` с внешней картинкой — через `getOptimizedImageUrl()` или `toProxiedImageUrl()` (→ `/ik/…`, `/cl/…`), видео — `toProxiedVideoUrl()` (→ `/ikv/…`, с докачкой). Литералы в коде писать сразу как `/ik/qowmy92ny/…`.
- IP покупателя брать только через `getClientIp()` из `lib/rate-limit.ts`: за DDoS-Guard Vercel видит адрес узла, настоящий — в `ddg-connecting-ip` (доверяем только при `x-vercel-ip-as-number` = 57724). Гео-заголовки `x-vercel-ip-*` за DDoS-Guard описывают узел, а не покупателя.

## SEO
- Фиды: `/feed.xml` (Google, RSS g:), `/yml.xml` (Яндекс, YML). `robots.txt` — route в `app/robots.txt/route.ts` (Clean-param для Яндекса).
- IndexNow: `lib/indexnow.ts`, ключ-файл в `public/`. Вызывается при создании/правке товара в админке.
- canonical в корневом layout НЕ задаём — каждая публичная страница ставит свой (иначе все страницы становятся «дублями главной»).
- `useSearchParams` на ISR-страницах не использовать напрямую — вся страница уходит в браузерный рендер и пропадает из HTML. Читать через `components/shared/SearchParamsWatcher.tsx` или `window.location` в эффекте.
- Карточка товара получает данные с сервера (`initialData` из `app/product/[id]/page.tsx`).

