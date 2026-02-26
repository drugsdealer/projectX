# Event Analytics Service

Spring Boot микросервис для сбора и агрегации пользовательских событий интернет-магазина.

## Что делает

- Принимает события через HTTP API.
- Сохраняет сырые события в PostgreSQL (совместимо с Neon).
- По расписанию агрегирует события в почасовые метрики.
- Отдаёт аналитические срезы: воронка и топ товаров.

## API

- `POST /api/v1/events`
- `POST /api/v1/events/batch`
- `GET /api/v1/analytics/funnel?from=<iso>&to=<iso>`
- `GET /api/v1/analytics/top-products?from=<iso>&to=<iso>&limit=20`
- `GET /actuator/health`

Все endpoints в `/api/**` требуют header `X-Events-Api-Key`.

Поддерживаемые `eventType`:

- `PRODUCT_VIEW`
- `ADD_TO_CART`
- `REMOVE_FROM_CART`
- `START_CHECKOUT`
- `PURCHASE`
- `SEARCH`
- `FAVORITE_ADD`

## Быстрый запуск

1. Подготовить env:

```bash
export EVENTS_SERVICE_API_KEY='replace-with-strong-key'
export EVENTS_SERVICE_PORT=8081
```

`EVENTS_DB_URL` принимает оба формата:

- `postgresql://...` (как в Prisma/Neon)
- `jdbc:postgresql://...` (классический JDBC)

Если `EVENTS_DB_URL` не задан, сервис попробует автоматически прочитать `DATABASE_URL`
или `EVENTS_DB_URL` из `.env` в одной из папок: `.env`, `../.env`, `../../.env`.

2. Запуск локально (из директории микросервиса):

```bash
cd /Users/proxyess/Downloads/projectX-main/services/event-analytics-service
export EVENTS_SERVICE_API_KEY='replace-with-strong-key'
mvn spring-boot:run
```

Если у вас уже есть `DATABASE_URL` в корневом `.env`, можно запустить так:

```bash
cd /Users/proxyess/Downloads/projectX-main
DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)
cd services/event-analytics-service
export EVENTS_DB_URL="$DATABASE_URL"
export EVENTS_SERVICE_API_KEY="replace-with-strong-key"
mvn spring-boot:run
```

Важно: в `DATABASE_URL` обычно есть символ `&`, поэтому не используйте `source .env` и не делайте `export EVENTS_DB_URL=...` без кавычек.

Либо из корня проекта без `cd`:

```bash
mvn -f /Users/proxyess/Downloads/projectX-main/services/event-analytics-service/pom.xml spring-boot:run
```

3. Запуск в Docker:

```bash
docker build -t event-analytics-service .
docker run --rm -p 8081:8081 \
  -e EVENTS_DB_URL="$EVENTS_DB_URL" \
  -e EVENTS_SERVICE_API_KEY="$EVENTS_SERVICE_API_KEY" \
  event-analytics-service
```

Flyway миграции применяются автоматически на старте.

Если сервис запускается в уже существующей общей БД (непустая `public` схема),
включён `baseline-on-migrate` с `baseline-version=0`, чтобы корректно создать
`flyway_schema_history` и затем применить `V1` миграцию сервиса.

## Пример события

```json
{
  "eventType": "PRODUCT_VIEW",
  "userId": 42,
  "sessionId": "sess_a1b2c3",
  "productId": 101,
  "pageUrl": "/products/101",
  "source": "web",
  "deviceType": "desktop",
  "occurredAt": "2026-02-20T13:30:12Z",
  "metadata": {
    "categoryId": 4
  }
}
```
