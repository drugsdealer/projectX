import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Создаём PrismaClient только если нет существующего экземпляра.
 * Проверка instanceof защищает от hot reload ошибок Next.js.
 */
function createPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || process.env.DIRECT_URL || "",
      },
    },
    errorFormat: "pretty",
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });
}

const prismaInstance =
  globalThis.__prisma instanceof PrismaClient
    ? globalThis.__prisma
    : createPrismaClient();

// Simple guard rail against catastrophic deletes/raw SQL in prod
function isDangerousSQL(sql: unknown): boolean {
  if (typeof sql !== "string") return false;
  const lower = sql.toLowerCase();

  // Явно опасные DDL-операции
  if (/(drop\s+table|truncate\s+table|drop\s+database|alter\s+table)/i.test(sql)) {
    return true;
  }

  // Примитивная защита от "DELETE FROM table" без WHERE/LIMIT
  if (lower.includes("delete from")) {
    const hasWhere = lower.includes(" where ");
    const hasLimit = lower.includes(" limit ");
    if (!hasWhere && !hasLimit) {
      return true;
    }
  }

  return false;
}

// ✅ Безопасно добавляем middleware только если $use доступен
if (
  typeof (prismaInstance as any).$use === "function" &&
  !(prismaInstance as any).__middlewareInstalled
) {
  (prismaInstance as any).$use(async (params: any, next: any) => {
    // Block raw DDL unless explicitly allowed
    if (
      (params.action === "$executeRaw" || params.action === "$executeRawUnsafe") &&
      isDangerousSQL(params.args?.[0]) &&
      process.env.ALLOW_DESTRUCTIVE_SQL !== "true"
    ) {
      throw new Error(
        "Destructive SQL is blocked. Set ALLOW_DESTRUCTIVE_SQL=true to override (not recommended in prod)."
      );
    }

    // Block deleteMany without WHERE to avoid accidental wipe
    if (
      params.action === "deleteMany" &&
      (!params.args?.where || Object.keys(params.args.where).length === 0) &&
      process.env.ALLOW_DELETE_MANY !== "true"
    ) {
      throw new Error(
        "deleteMany without WHERE is blocked to prevent full-table deletes. Set ALLOW_DELETE_MANY=true to override."
      );
    }

    const start = Date.now();
    const result = await next(params);
    const end = Date.now();

    // Redact sensitive fields (password) on read operations to reduce accidental leakage
    const redactUser = (obj: any) => {
      if (!obj) return obj;
      if (typeof obj === "object" && "password" in obj) {
        delete (obj as any).password;
      }
      return obj;
    };
    if (
      params.model === "User" &&
      ["findUnique", "findFirst", "findMany", "queryRaw", "aggregate", "groupBy"].includes(params.action)
    ) {
      if (Array.isArray(result)) {
        result.forEach((r) => redactUser(r));
      } else {
        redactUser(result);
      }
    }

    if (["create", "update", "delete"].includes(params.action) && params.model !== "AuditLog") {
      try {
        // Готовим payload для аудита с минимальным риском утечки чувствительных данных
        let auditPayload: any = result || {};

        // Для User дополнительно убираем поле password из записываемых данных
        if (params.model === "User" && auditPayload) {
          auditPayload = Array.isArray(auditPayload)
            ? auditPayload.map((r) => redactUser({ ...r }))
            : redactUser({ ...auditPayload });
        }

        const auditModel = (prismaInstance as any).auditLog;
        if (auditModel && typeof auditModel.create === "function") {
          await auditModel.create({
            data: {
              table: params.model || "unknown",
              action: params.action.toUpperCase(),
              recordId: (result && (result as any).id) || null,
              data: auditPayload,
              createdAt: new Date(),
            },
          });
        }
      } catch (err) {
        console.error("Ошибка при записи AuditLog:", err);
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        `🧾 [${params.model}.${params.action}] завершено за ${end - start}ms`
      );
    }

    return result;
  });

  (prismaInstance as any).__middlewareInstalled = true;
}

// ✅ Сохраняем глобально только в dev
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prismaInstance;
}

export const prisma = prismaInstance;
export default prisma;
