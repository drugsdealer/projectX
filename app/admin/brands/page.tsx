"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Brand = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  aboutLong: string | null;
  isPremium: boolean;
  isFeatured: boolean;
  _count: { Product: number };
};

type BrandForm = {
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  aboutLong: string;
  isPremium: boolean;
  isFeatured: boolean;
};

const emptyForm = (): BrandForm => ({
  name: "",
  slug: "",
  logoUrl: "",
  description: "",
  aboutLong: "",
  isPremium: false,
  isFeatured: false,
});

function slugify(input: string): string {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return "";
  const normalized = raw.normalize("NFKD");
  return normalized
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export default function AdminBrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<BrandForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BrandForm>(emptyForm());

  const authGuardOrData = useCallback(
    async (res: Response) => {
      const data = await res.json().catch(() => ({} as any));
      if (res.status === 403 && data?.message === "2FA required") {
        router.replace("/admin/2fa");
        throw new Error("Требуется повторное подтверждение 2FA");
      }
      return data;
    },
    [router]
  );

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/brands", { cache: "no-store" });
      const data = await authGuardOrData(res);
      if (res.ok && data?.success) {
        setBrands(data.brands || []);
      } else {
        throw new Error(data?.message || "Не удалось загрузить бренды");
      }
    } catch (e: any) {
      setMsg(e?.message || "Ошибка загрузки брендов");
    } finally {
      setLoading(false);
    }
  }, [authGuardOrData]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const handleAddNameChange = (name: string) => {
    setAddForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === slugify(prev.name) || prev.slug === "" ? slugify(name) : prev.slug,
    }));
  };

  const handleEditNameChange = (name: string) => {
    setEditForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === slugify(prev.name) || prev.slug === "" ? slugify(name) : prev.slug,
    }));
  };

  const addBrand = async () => {
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          slug: addForm.slug,
          logoUrl: addForm.logoUrl,
          description: addForm.description || null,
          aboutLong: addForm.aboutLong || null,
          isPremium: addForm.isPremium,
          isFeatured: addForm.isFeatured,
        }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка добавления бренда");
        return;
      }
      setMsg("Бренд добавлен");
      setAddForm(emptyForm());
      setShowAddForm(false);
      await loadBrands();
    } catch (e: any) {
      setMsg(e?.message || "Ошибка добавления бренда");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setEditForm({
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl || "",
      description: brand.description || "",
      aboutLong: brand.aboutLong || "",
      isPremium: brand.isPremium,
      isFeatured: brand.isFeatured,
    });
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm());
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: editForm.name,
          slug: editForm.slug,
          logoUrl: editForm.logoUrl,
          description: editForm.description || null,
          aboutLong: editForm.aboutLong || null,
          isPremium: editForm.isPremium,
          isFeatured: editForm.isFeatured,
        }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка обновления бренда");
        return;
      }
      setMsg("Бренд обновлён");
      setEditingId(null);
      setEditForm(emptyForm());
      await loadBrands();
    } catch (e: any) {
      setMsg(e?.message || "Ошибка обновления бренда");
    } finally {
      setSaving(false);
    }
  };

  const deleteBrand = async (id: number, name: string) => {
    if (!window.confirm(`Удалить бренд "${name}"? Это действие можно отменить.`)) return;
    setMsg(null);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка удаления бренда");
        return;
      }
      setMsg("Бренд удалён");
      if (editingId === id) cancelEdit();
      await loadBrands();
    } catch (e: any) {
      setMsg(e?.message || "Ошибка удаления бренда");
    }
  };

  const inputCls = "w-full rounded-xl border border-black/10 px-3 py-2 text-sm";
  const btnPrimaryCls =
    "rounded-full bg-black text-white px-5 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50";
  const btnSecondaryCls =
    "rounded-full border border-black/10 px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition";

  const renderForm = (
    form: BrandForm,
    setField: (field: keyof BrandForm, value: any) => void,
    onNameChange: (name: string) => void,
    onSubmit: () => void,
    onCancel: () => void,
    submitLabel: string
  ) => (
    <div className="rounded-2xl border border-black/10 p-4 mt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={inputCls}
          placeholder="Название бренда"
          value={form.name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Slug (авто из названия)"
          value={form.slug}
          onChange={(e) => setField("slug", e.target.value)}
        />
        <input
          className={inputCls + " sm:col-span-2"}
          placeholder="URL логотипа"
          value={form.logoUrl}
          onChange={(e) => setField("logoUrl", e.target.value)}
        />
        <textarea
          className={inputCls + " sm:col-span-2"}
          placeholder="Краткое описание"
          rows={2}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
        />
        <textarea
          className={inputCls + " sm:col-span-2"}
          placeholder="Полное описание (aboutLong)"
          rows={4}
          value={form.aboutLong}
          onChange={(e) => setField("aboutLong", e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={form.isPremium}
            onChange={(e) => setField("isPremium", e.target.checked)}
          />
          Премиум бренд
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={form.isFeatured}
            onChange={(e) => setField("isFeatured", e.target.checked)}
          />
          Featured (избранный)
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={onSubmit} disabled={saving} className={btnPrimaryCls}>
          {saving ? "Сохранение..." : submitLabel}
        </button>
        <button onClick={onCancel} className={btnSecondaryCls}>
          Отмена
        </button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Бренды</h2>
          {!showAddForm && (
            <button
              onClick={() => {
                setShowAddForm(true);
                cancelEdit();
              }}
              className={btnPrimaryCls}
            >
              Добавить бренд
            </button>
          )}
        </div>

        {msg && <div className="mt-3 text-sm">{msg}</div>}

        {showAddForm &&
          renderForm(
            addForm,
            (field, value) => setAddForm((prev) => ({ ...prev, [field]: value })),
            handleAddNameChange,
            addBrand,
            () => {
              setShowAddForm(false);
              setAddForm(emptyForm());
            },
            "Добавить"
          )}
      </section>

      <section>
        {loading ? (
          <div className="text-sm text-black/60">Загрузка брендов...</div>
        ) : brands.length === 0 ? (
          <div className="text-sm text-black/60">Нет брендов для отображения.</div>
        ) : (
          <div className="grid gap-3">
            {brands.map((brand) => (
              <div key={brand.id}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 p-4">
                  <div className="flex items-center gap-3">
                    {brand.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.logoUrl}
                        alt={brand.name}
                        className="h-10 w-10 rounded-xl object-contain bg-black/5"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-black/5 flex items-center justify-center text-xs text-black/30">
                        ?
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{brand.name}</span>
                        {brand.isPremium && (
                          <span className="rounded-full bg-black text-white px-2 py-0.5 text-[10px] font-semibold">
                            Premium
                          </span>
                        )}
                        {brand.isFeatured && (
                          <span className="rounded-full border border-black/20 px-2 py-0.5 text-[10px] font-semibold">
                            Featured
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-black/60">
                        /{brand.slug} &middot; {brand._count.Product}{" "}
                        {brand._count.Product === 1 ? "товар" : "товаров"}
                      </div>
                      {brand.description && (
                        <div className="mt-1 text-xs text-black/50 max-w-md truncate">
                          {brand.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => startEdit(brand)}
                      className="text-xs text-black/70 hover:text-black transition"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => deleteBrand(brand.id, brand.name)}
                      className="text-xs text-red-600 hover:text-red-800 transition"
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                {editingId === brand.id &&
                  renderForm(
                    editForm,
                    (field, value) => setEditForm((prev) => ({ ...prev, [field]: value })),
                    handleEditNameChange,
                    saveEdit,
                    cancelEdit,
                    "Сохранить"
                  )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
