This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel
![Image alt](https://github.com/2DJoker/Stage/blob/main/Screenshot%202024-09-06%20at%204.02.21%20PM.png)


The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.


Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

used in the project https://vercel.com / for the Postgresql database and linked nextjs to the prisma library

<p><img align="center" src="https://github.com/2DJoker/2DJoker/assets/109986015/942f02bb-b4c5-4aeb-a25e-bbb30468b596"/></p>
# STAGESTORE.FNL

## DB safety / backups

- Для прод базы не используем `prisma migrate dev`, `prisma db push --force`, `prisma migrate reset`. Только `npm run prisma:migrate:deploy`.
- Для разработки держите отдельный DATABASE_URL в `.env.local`, продовый URL в репо не коммитим.
- Резервная копия: `npm run db:backup` (создаст `backups/backup-YYYY-MM-DD-HHMM.sql`, нужен установленный `pg_dump`).
- Перед миграциями/сидом на боевой — обязательно сделать бэкап и убедиться, что смотрите в отдельную dev/test базу.
# projectX

## Event analytics microservice (Spring Boot)

В проект добавлен отдельный сервис сбора и агрегации событий:

- Путь: `services/event-analytics-service`
- Документация запуска и API: `services/event-analytics-service/README.md`
- Next.js endpoint-прокси: `app/api/events/track/route.ts`
- Клиентская утилита отправки событий: `lib/events-client.ts`
- Серверная отправка событий из API: `lib/events-server.ts`
- Админ UI аналитики: `app/admin/events/page.tsx`
- Админ API прокси аналитики: `app/api/admin/events/funnel/route.ts`, `app/api/admin/events/top-products/route.ts`

По умолчанию уже подключены серверные события:

- `ADD_TO_CART` в `app/api/cart/route.ts` (после добавления в корзину)
- `PURCHASE` в `app/api/order/complete/route.ts` (после подтверждения оплаты)

