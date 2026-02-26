import { cookies } from "next/headers";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import AdminSessionGuard from "./AdminSessionGuard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const jar: any = cookies() as any;
  const c = typeof jar?.then === "function" ? await jar : jar;
  const isImpersonating = Boolean(c.get("admin_impersonator")?.value);

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-black">
      <AdminSessionGuard />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-black/50">Admin</p>
            <h1 className="text-2xl font-bold">Панель управления</h1>
            <p className="text-xs text-black/60">Вы вошли как {admin.email}</p>
          </div>
          <div className="flex items-center gap-3">
            {isImpersonating && (
              <a
                href="/api/admin/stop-impersonate"
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition"
              >
                Вернуться в админ
              </a>
            )}
            <Link prefetch={false} href="/api/admin/2fa/clear?next=/" className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition">
              На сайт
            </Link>
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          <Link href="/admin" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition">
            Дашборд
          </Link>
          <Link href="/admin/users" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition">
            Пользователи
          </Link>
          <Link href="/admin/orders" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition">
            Заказы
          </Link>
          <Link href="/admin/products" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition">
            Товары
          </Link>
          <Link href="/liza/studio" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition">
            Admin Studio
          </Link>
          <Link href="/admin/promocodes" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition">
            Промокоды
          </Link>
          <Link href="/admin/home-promos" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition">
            CMS промо
          </Link>
          <Link href="/admin/events" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition">
            Аналитика событий
          </Link>
        </nav>

        <div className="mt-6 rounded-3xl border border-black/10 bg-white p-4 sm:p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
