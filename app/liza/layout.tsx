import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import AdminSessionGuard from "../admin/AdminSessionGuard";

export default async function LizaLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-black">
      <AdminSessionGuard />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-black/50">Liza</p>
            <h1 className="text-2xl font-bold">Liza Studio</h1>
            <p className="text-xs text-black/60">Вы вошли как {admin.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              prefetch={false}
              href="/api/admin/2fa/clear?next=/"
              className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition"
            >
              На сайт
            </Link>
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/liza/studio"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition"
          >
            Studio
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition"
          >
            Старая админка
          </Link>
        </nav>

        <div className="mt-6 rounded-3xl border border-black/10 bg-white p-4 sm:p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
