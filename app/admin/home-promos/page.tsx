"use client";

import { useEffect, useMemo, useState } from "react";

type PromoRow = {
  id: string;
  name: string;
  tag: string;
  title: string;
  subtitle: string;
  backgroundImageUrl: string;
  logoImageUrl?: string;
  accentColor?: string;
  brandQueries: string[];
  productIds: number[];
  maxItems: number;
  position: number;
  enabled: boolean;
  variant: "generic";
};

const emptyPromo = (): PromoRow => ({
  id: `promo-${Date.now()}`,
  name: "Новая промо",
  tag: "PROMO",
  title: "Новый блок",
  subtitle: "Описание блока",
  backgroundImageUrl: "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg",
  logoImageUrl: "",
  accentColor: "#111111",
  brandQueries: [],
  productIds: [],
  maxItems: 8,
  position: 2,
  enabled: true,
  variant: "generic",
});

const arrayToCsv = (arr: Array<string | number>) => arr.join(", ");

export default function AdminHomePromosPage() {
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/admin/home-promos", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setMsg(data?.message || "Не удалось загрузить CMS-промо");
      setLoading(false);
      return;
    }
    setPromos(Array.isArray(data.promos) ? data.promos : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (idx: number, patch: Partial<PromoRow>) => {
    setPromos((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const remove = (idx: number) => {
    setPromos((prev) => prev.filter((_, i) => i !== idx));
  };

  const add = () => {
    setPromos((prev) => [...prev, emptyPromo()]);
  };

  const sortedPreview = useMemo(
    () => [...promos].sort((a, b) => a.position - b.position),
    [promos]
  );

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const payload = {
      promos: promos.map((row) => ({
        ...row,
        brandQueries: row.brandQueries,
        productIds: row.productIds,
      })),
    };

    const res = await fetch("/api/admin/home-promos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setSaving(false);
      setMsg(data?.message || "Не удалось сохранить CMS-промо");
      return;
    }

    setPromos(Array.isArray(data.promos) ? data.promos : []);
    setSaving(false);
    setMsg("CMS-промо сохранены");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">CMS промо главной</h2>
        <p className="mt-1 text-xs text-black/55">
          Здесь создаются типовые промо. Для уникальных блоков с кастомным JSX используйте файл
          <code className="ml-1 rounded bg-black/5 px-1 py-0.5">components/home/promos/author-promos.tsx</code>.
        </p>
      </div>

      {msg ? <p className="text-sm text-black/70">{msg}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition"
        >
          Добавить промо
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full border border-black/15 bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-white hover:text-black transition disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить CMS"}
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition disabled:opacity-50"
        >
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60">Загрузка...</div>
      ) : null}

      {!loading && promos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/20 bg-white p-4 text-sm text-black/60">
          Пока нет CMS-промо.
        </div>
      ) : null}

      <div className="space-y-4">
        {promos.map((promo, idx) => (
          <div key={`${promo.id}-${idx}`} className="rounded-2xl border border-black/10 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{promo.name || promo.id}</div>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-full border border-red-300 px-3 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
              >
                Удалить
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input value={promo.id} onChange={(e) => update(idx, { id: e.target.value })} placeholder="id" className="rounded-xl border border-black/10 px-3 py-2 text-sm" />
              <input value={promo.name} onChange={(e) => update(idx, { name: e.target.value })} placeholder="Название" className="rounded-xl border border-black/10 px-3 py-2 text-sm" />
              <input value={promo.tag} onChange={(e) => update(idx, { tag: e.target.value })} placeholder="Тег" className="rounded-xl border border-black/10 px-3 py-2 text-sm" />
              <input value={promo.title} onChange={(e) => update(idx, { title: e.target.value })} placeholder="Заголовок" className="rounded-xl border border-black/10 px-3 py-2 text-sm" />
              <input value={promo.subtitle} onChange={(e) => update(idx, { subtitle: e.target.value })} placeholder="Подзаголовок" className="rounded-xl border border-black/10 px-3 py-2 text-sm sm:col-span-2" />
              <input value={promo.backgroundImageUrl} onChange={(e) => update(idx, { backgroundImageUrl: e.target.value })} placeholder="Cloudinary фон" className="rounded-xl border border-black/10 px-3 py-2 text-sm sm:col-span-2" />
              <input value={promo.logoImageUrl || ""} onChange={(e) => update(idx, { logoImageUrl: e.target.value })} placeholder="Cloudinary логотип (опционально)" className="rounded-xl border border-black/10 px-3 py-2 text-sm sm:col-span-2" />
              <input value={promo.accentColor || ""} onChange={(e) => update(idx, { accentColor: e.target.value })} placeholder="Акцентный цвет (#111111)" className="rounded-xl border border-black/10 px-3 py-2 text-sm" />
              <input
                value={arrayToCsv(promo.brandQueries)}
                onChange={(e) => update(idx, {
                  brandQueries: e.target.value
                    .split(",")
                    .map((v) => v.trim().toLowerCase())
                    .filter(Boolean),
                })}
                placeholder="Бренды/ключи (через запятую)"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={arrayToCsv(promo.productIds)}
                onChange={(e) => update(idx, {
                  productIds: e.target.value
                    .split(",")
                    .map((v) => Number(v.trim()))
                    .filter((v) => Number.isFinite(v) && v > 0)
                    .map((v) => Math.round(v)),
                })}
                placeholder="ID товаров (через запятую)"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={promo.position}
                onChange={(e) => update(idx, { position: Number(e.target.value || 0) })}
                placeholder="Позиция вставки"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={promo.maxItems}
                onChange={(e) => update(idx, { maxItems: Number(e.target.value || 8) })}
                placeholder="Макс. товаров"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-black/70">
              <input type="checkbox" checked={promo.enabled} onChange={(e) => update(idx, { enabled: e.target.checked })} />
              Включено
            </label>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">Предпросмотр порядка</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {sortedPreview.map((promo) => (
            <span key={`preview-${promo.id}`} className="rounded-full border border-black/10 px-3 py-1 text-xs">
              #{promo.position} {promo.name} {promo.enabled ? "• on" : "• off"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
