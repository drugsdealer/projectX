export function handleApiError(err: unknown) {
  if (err instanceof Error) {
    switch (err.message) {
      case "UNAUTHORIZED":
        return new Response("Не авторизован", { status: 401 });
      case "USER_DELETED":
        return new Response("Профиль деактивирован", { status: 403 });
      case "FORBIDDEN":
        return new Response("Недостаточно прав", { status: 403 });
      default:
        console.error("❌ API error:", err);
        return new Response("Ошибка сервера", { status: 500 });
    }
  }
  return new Response("Неизвестная ошибка", { status: 500 });
}