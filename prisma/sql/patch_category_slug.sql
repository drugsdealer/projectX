-- 1) Добавить колонку, если её нет
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Category' AND column_name = 'slug'
  ) THEN
    ALTER TABLE "Category" ADD COLUMN "slug" TEXT;
  END IF;
END $$;

-- 2) Заполнить slug из name (пробелы -> дефис, нижний регистр)
UPDATE "Category"
SET "slug" = lower(regexp_replace("name", '\s+', '-', 'g'))
WHERE "slug" IS NULL OR "slug" = '';

-- 3) Разрулить дубликаты slug (добавим суффикс -id)
WITH dups AS (
  SELECT "slug" FROM "Category"
  GROUP BY "slug"
  HAVING COUNT(*) > 1
)
UPDATE "Category" c
SET "slug" = c."slug" || '-' || c."id"
FROM dups
WHERE c."slug" = dups."slug";

-- 4) Сделать NOT NULL
ALTER TABLE "Category"
  ALTER COLUMN "slug" SET NOT NULL;

-- 5) Уникальный индекс (если его ещё нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Category_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
  END IF;
END $$;
