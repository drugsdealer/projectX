import Link from "next/link";

type Section = {
  title: string;
  content: string | string[];
};

type LegalPageProps = {
  title: string;
  subtitle?: string;
  updatedAt: string;
  sections: Section[];
  relatedLinks?: { label: string; href: string }[];
};

export function LegalPage({ title, subtitle, updatedAt, sections, relatedLinks }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        <div className="mb-2">
          <Link href="/" className="text-sm text-black/40 hover:text-black transition">
            ← Stage Store
          </Link>
        </div>

        <div className="mt-6 pb-8 border-b border-black/10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-3 text-base text-black/60">{subtitle}</p>
          )}
          <p className="mt-3 text-sm text-black/40">Последнее обновление: {updatedAt}</p>
        </div>

        <div className="mt-8 space-y-8">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-bold tracking-tight">{section.title}</h2>
              <div className="mt-3 text-sm text-black/70 leading-relaxed space-y-2">
                {Array.isArray(section.content)
                  ? section.content.map((para, j) => <p key={j}>{para}</p>)
                  : <p>{section.content}</p>
                }
              </div>
            </section>
          ))}
        </div>

        {relatedLinks && relatedLinks.length > 0 && (
          <div className="mt-12 pt-8 border-t border-black/10">
            <div className="text-sm font-semibold text-black/50 uppercase tracking-wider mb-4">
              Связанные документы
            </div>
            <div className="flex flex-wrap gap-3">
              {relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center px-4 py-2 rounded-full border border-black/15 text-sm font-medium text-black/70 hover:border-black/40 hover:text-black transition"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-black/10 text-xs text-black/35">
          © {new Date().getFullYear()} Stage Store. Все права защищены.
        </div>
      </div>
    </main>
  );
}
