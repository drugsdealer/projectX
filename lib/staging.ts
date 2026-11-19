/**
 * Тестовый сайт: test.stagestore.app (ветка dev) и любые другие preview-сборки Vercel.
 * Основной сайт stagestore.app — это VERCEL_ENV === "production".
 */
export const IS_STAGING = process.env.VERCEL_ENV === "preview";
