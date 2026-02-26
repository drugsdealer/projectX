"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2, Eye, EyeOff, Star } from "lucide-react";

type CatalogItem = { id: number; name: string; slug?: string; categoryId?: number };

type CatalogResp = {
  success?: boolean;
  categories?: CatalogItem[];
  brands?: CatalogItem[];
  subcategories?: CatalogItem[];
  colors?: CatalogItem[];
};

type ProductRow = {
  id: number;
  name: string;
  price: number | null;
  imageUrl: string;
  available: boolean;
  premium: boolean;
  gender: string | null;
  subcategory: string | null;
  Category?: { name: string } | null;
  Brand?: { name: string } | null;
  Color?: { name: string } | null;
};

type ProductsResp = {
  success?: boolean;
  products?: ProductRow[];
  message?: string;
};

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='14' font-family='Arial'%3ENo image%3C/text%3E%3C/svg%3E";

const EMPTY_FORM = {
  name: "",
  price: "",
  imageUrl: "",
  imagesText: "",
  categoryId: "",
  brandId: "",
  colorId: "",
  subcategoryId: "",
  gender: "",
  premium: false,
  description: "",
};

export default function AdminStudioClient() {
  const [catalog, setCatalog] = useState<CatalogResp>({});
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [metaRes, productsRes] = await Promise.all([
        fetch("/api/admin/catalog", { cache: "no-store" }),
        fetch("/api/admin/products?take=120", { cache: "no-store" }),
      ]);

      const metaData = (await metaRes.json().catch(() => ({}))) as CatalogResp;
      const productsData = (await productsRes.json().catch(() => ({}))) as ProductsResp;

      if (!metaRes.ok || metaData.success === false) {
        throw new Error("Не удалось загрузить категории/бренды.");
      }
      if (!productsRes.ok || productsData.success === false) {
        throw new Error(productsData.message || "Не удалось загрузить товары.");
      }

      setCatalog(metaData);
      setProducts(productsData.products || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = [
        p.name,
        p.Brand?.name || "",
        p.Category?.name || "",
        p.subcategory || "",
        p.Color?.name || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [products, query]);

  const selectedCategoryId = Number(form.categoryId);
  const availableSubcategories = useMemo(() => {
    const all = catalog.subcategories || [];
    if (!Number.isFinite(selectedCategoryId)) return all;
    return all.filter((s) => s.categoryId === selectedCategoryId);
  }, [catalog.subcategories, selectedCategoryId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const images = form.imagesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: form.name,
        price: Number(form.price),
        imageUrl: form.imageUrl.trim() || undefined,
        images,
        categoryId: Number(form.categoryId),
        brandId: form.brandId ? Number(form.brandId) : undefined,
        colorId: form.colorId ? Number(form.colorId) : undefined,
        subcategoryId: form.subcategoryId ? Number(form.subcategoryId) : undefined,
        gender: form.gender || undefined,
        premium: Boolean(form.premium),
        description: form.description.trim() || undefined,
        sizeType: "NONE",
      };

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Не удалось создать товар");
      }

      setMessage("Товар успешно опубликован.");
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function patchProduct(id: number, patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      throw new Error(data?.message || "Не удалось обновить товар");
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...(data.product || patch) } : p))
    );
  }

  async function removeProduct(id: number) {
    const ok = window.confirm("Удалить товар? Он будет скрыт из каталога.");
    if (!ok) return;
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      setError(data?.message || "Не удалось удалить товар");
      return;
    }
    setMessage("Товар удален.");
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Admin Studio</h2>
            <p className="text-sm text-black/60">Новая панель для публикации товаров в каталог.</p>
          </div>
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition"
          >
            <RefreshCw className="h-4 w-4" />
            Обновить
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <form onSubmit={handleCreate} className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold">Выложить новый товар</h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="Название товара"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="Цена (₽)"
            value={form.price}
            onChange={(e) => setForm((p) => ({ ...p, price: e.target.value.replace(/[^\d.]/g, "") }))}
            required
          />
          <input
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            placeholder="URL главного фото"
            value={form.imageUrl}
            onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
          />

          <select
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            value={form.categoryId}
            onChange={(e) =>
              setForm((p) => ({ ...p, categoryId: e.target.value, subcategoryId: "" }))
            }
            required
          >
            <option value="">Категория*</option>
            {(catalog.categories || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            value={form.subcategoryId}
            onChange={(e) => setForm((p) => ({ ...p, subcategoryId: e.target.value }))}
          >
            <option value="">Подкатегория</option>
            {availableSubcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            value={form.brandId}
            onChange={(e) => setForm((p) => ({ ...p, brandId: e.target.value }))}
          >
            <option value="">Бренд</option>
            {(catalog.brands || []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            value={form.colorId}
            onChange={(e) => setForm((p) => ({ ...p, colorId: e.target.value }))}
          >
            <option value="">Цвет</option>
            {(catalog.colors || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            value={form.gender}
            onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
          >
            <option value="">Пол</option>
            <option value="men">Мужской</option>
            <option value="women">Женский</option>
            <option value="unisex">Унисекс</option>
          </select>

          <label className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.premium}
              onChange={(e) => setForm((p) => ({ ...p, premium: e.target.checked }))}
            />
            Premium товар
          </label>
        </div>

        <textarea
          className="mt-3 min-h-[90px] w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          placeholder="Описание товара"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />

        <textarea
          className="mt-3 min-h-[90px] w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          placeholder={"Доп. фото (по одному URL на строку)"}
          value={form.imagesText}
          onChange={(e) => setForm((p) => ({ ...p, imagesText: e.target.value }))}
        />

        <button
          type="submit"
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {saving ? "Публикуем..." : "Опубликовать товар"}
        </button>
      </form>

      <section className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Товары в каталоге</h3>
          <input
            className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm sm:w-80"
            placeholder="Поиск по названию, бренду, категории..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-black/50">Загрузка...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-black/50">Товары не найдены.</p>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((p) => (
              <article
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-black/10 bg-[#fafafa] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={p.imageUrl || FALLBACK_IMAGE}
                    alt={p.name}
                    className="h-16 w-16 rounded-lg object-cover bg-white border border-black/10"
                  />
                  <div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-black/55">
                      {p.Brand?.name || "Без бренда"} • {p.Category?.name || "Без категории"} •{" "}
                      {p.price ? `${new Intl.NumberFormat("ru-RU").format(Math.round(p.price))} ₽` : "Цена не задана"}
                    </p>
                    <p className="text-[11px] text-black/45">
                      {p.subcategory || "Без подкатегории"} {p.gender ? `• ${p.gender}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => patchProduct(p.id, { available: !p.available })}
                    className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black hover:text-white transition"
                  >
                    {p.available ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {p.available ? "Скрыть" : "Опубликовать"}
                  </button>
                  <button
                    onClick={() => patchProduct(p.id, { premium: !p.premium })}
                    className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black hover:text-white transition"
                  >
                    <Star className="h-3.5 w-3.5" />
                    {p.premium ? "Снять Premium" : "В Premium"}
                  </button>
                  <button
                    onClick={() => removeProduct(p.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-600 hover:text-white transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
