"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ImageKitUploadField from "@/components/admin/ImageKitUploadField";
import {
  BRAND_SIZE_AUDIENCES,
  BRAND_SIZE_CHART_CATEGORIES,
  createEmptyBrandSizeChart,
  parseBrandSizeChart,
  serializeBrandSizeChart,
  type BrandSizeChart,
  type BrandSizeAudienceKey,
  type BrandSizeChartCategoryKey,
  type BrandSizeMode,
} from "@/lib/brandSizeCharts";

type BrandProduct = {
  id: number;
  name: string;
  imageUrl: string | null;
  price: number | null;
};

type Brand = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  imageUrl: string | null;
  coverUrl: string | null;
  features?: string | null;
  material?: string | null;
  description: string | null;
  aboutLong: string | null;
  sizeChart: string | null;
  heroVideo: string | null;
  styleNotes?: string | null;
  tags?: string[];
  isPremium: boolean;
  _count: { Product: number };
};

type BrandForm = {
  name: string;
  slug: string;
  logoUrl: string;
  imageUrl: string;
  coverUrl: string;
  description: string;
  aboutLong: string;
  sizeChart: string;
  heroVideo: string;
  isPremium: boolean;
};

const emptyForm = (): BrandForm => ({
  name: "",
  slug: "",
  logoUrl: "",
  imageUrl: "",
  coverUrl: "",
  description: "",
  aboutLong: "",
  sizeChart: "",
  heroVideo: "",
  isPremium: false,
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

function extractHeroVideo(brand: { heroVideo?: string | null; tags?: string[] }) {
  if (brand.heroVideo) return brand.heroVideo;
  const tag = Array.isArray(brand.tags)
    ? brand.tags.find((value) => typeof value === "string" && /^video:/i.test(value.trim()))
    : null;
  return tag ? tag.replace(/^video:/i, "").trim() : "";
}

function SizeChartEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [activeKey, setActiveKey] = useState<BrandSizeChartCategoryKey>("outerwear");
  const [activeAudienceKey, setActiveAudienceKey] = useState<BrandSizeAudienceKey>("all");
  const chart = parseBrandSizeChart(value);
  const active = chart.categories.find((category) => category.key === activeKey) ?? chart.categories[0];
  const activeAudience =
    active.audiences.find((audience) => audience.key === activeAudienceKey) ??
    active.audiences[0];

  const updateChart = (next: BrandSizeChart) => {
    onChange(serializeBrandSizeChart(next));
  };

  const updateActive = (
    updater: (category: BrandSizeChart["categories"][number]) => BrandSizeChart["categories"][number]
  ) => {
    updateChart({
      ...chart,
      categories: chart.categories.map((category) =>
        category.key === active.key ? updater(category) : category
      ),
    });
  };

  const updateActiveAudience = (
    updater: (audience: BrandSizeChart["categories"][number]["audiences"][number]) => BrandSizeChart["categories"][number]["audiences"][number]
  ) => {
    updateActive((category) => {
      const nextAudiences = category.audiences.map((audience) =>
        audience.key === activeAudience.key ? updater(audience) : audience
      );
      const allAudience = nextAudiences.find((audience) => audience.key === "all") ?? nextAudiences[0];
      return {
        ...category,
        sizeMode: allAudience.sizeMode,
        columns: allAudience.columns,
        rows: allAudience.rows,
        audiences: nextAudiences,
      };
    });
  };

  const addColumn = () => {
    updateActiveAudience((audience) => ({
      ...audience,
      columns: [...audience.columns, "Новая колонка"],
      rows: audience.rows.map((row) => [...row, ""]),
    }));
  };

  const renameColumn = (index: number, name: string) => {
    updateActiveAudience((audience) => ({
      ...audience,
      columns: audience.columns.map((column, columnIndex) =>
        columnIndex === index ? name : column
      ),
    }));
  };

  const removeColumn = (index: number) => {
    if (activeAudience.columns.length <= 1) return;
    updateActiveAudience((audience) => ({
      ...audience,
      columns: audience.columns.filter((_, columnIndex) => columnIndex !== index),
      rows: audience.rows.map((row) => row.filter((_, columnIndex) => columnIndex !== index)),
    }));
  };

  const addRow = () => {
    updateActiveAudience((audience) => ({
      ...audience,
      rows: [...audience.rows, audience.columns.map(() => "")],
    }));
  };

  const updateCell = (rowIndex: number, columnIndex: number, cellValue: string) => {
    updateActiveAudience((audience) => ({
      ...audience,
      rows: audience.rows.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? audience.columns.map((_, currentColumnIndex) =>
              currentColumnIndex === columnIndex ? cellValue : row[currentColumnIndex] ?? ""
            )
          : row
      ),
    }));
  };

  const removeRow = (rowIndex: number) => {
    updateActiveAudience((audience) => ({
      ...audience,
      rows: audience.rows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex),
    }));
  };

  const clearActive = () => {
    updateActiveAudience((audience) => ({ ...audience, rows: [] }));
  };

  const resetAll = () => {
    onChange(serializeBrandSizeChart(createEmptyBrandSizeChart()));
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 sm:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Размерная сетка бренда</div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-black/55">
            Таблица хранится отдельно по типам товаров. Можно писать любые буквы, цифры и региональные значения: EU, US, UK, JP, CM, замеры.
          </p>
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-black/60 transition hover:bg-black hover:text-white"
        >
          Очистить всё
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {BRAND_SIZE_CHART_CATEGORIES.map((category) => {
          const filled =
            chart.categories
              .find((item) => item.key === category.key)
              ?.audiences.reduce((sum, audience) => sum + audience.rows.length, 0) ?? 0;
          const activeTab = active.key === category.key;
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => setActiveKey(category.key)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                activeTab
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-white text-black/65 hover:border-black/30"
              }`}
            >
              {category.label}
              {filled > 0 ? <span className="ml-2 opacity-60">{filled}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 rounded-2xl bg-black/[0.03] p-1">
        {BRAND_SIZE_AUDIENCES.map((audience) => {
          const selected = activeAudience.key === audience.key;
          const rows = active.audiences.find((item) => item.key === audience.key)?.rows.length ?? 0;
          return (
            <button
              key={audience.key}
              type="button"
              onClick={() => setActiveAudienceKey(audience.key)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                selected ? "bg-black text-white" : "text-black/60 hover:bg-white"
              }`}
            >
              {audience.shortLabel}
              {rows > 0 ? <span className="ml-2 opacity-60">{rows}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr_auto_auto]">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">
          Формат главного размера
          <select
            className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm normal-case tracking-normal text-black"
            value={activeAudience.sizeMode}
            onChange={(event) =>
              updateActiveAudience((audience) => ({
                ...audience,
                sizeMode: event.target.value as BrandSizeMode,
              }))
            }
          >
            <option value="letters">Буквы: XS/S/M</option>
            <option value="numbers">Цифры: 44/46/48</option>
            <option value="mixed">Смешанный</option>
          </select>
        </label>
        <div className="hidden sm:block" />
        <button
          type="button"
          onClick={addColumn}
          className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold transition hover:bg-black hover:text-white"
        >
          + Колонка
        </button>
        <button
          type="button"
          onClick={addRow}
          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        >
          + Размер
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-black/10">
        <table className="w-full min-w-[760px] border-collapse bg-white text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              {activeAudience.columns.map((column, index) => (
                <th key={`${active.key}-${activeAudience.key}-head-${index}`} className="border-b border-r border-black/10 p-2 text-left last:border-r-0">
                  <div className="flex items-center gap-2">
                    <input
                      className="w-full rounded-lg border border-black/10 bg-white px-2 py-1 text-xs font-semibold"
                      value={column}
                      onChange={(event) => renameColumn(index, event.target.value)}
                      aria-label={`Название колонки ${index + 1}`}
                    />
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(index)}
                        className="rounded-full px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        aria-label="Удалить колонку"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-12 border-b border-black/10 p-2" />
            </tr>
          </thead>
          <tbody>
            {activeAudience.rows.length === 0 ? (
              <tr>
                <td colSpan={activeAudience.columns.length + 1} className="p-5 text-center text-xs text-black/45">
                  Таблица “{activeAudience.label.toLowerCase()}” пока пустая. Нажми “+ Размер” и заполни строки как на сайте бренда.
                </td>
              </tr>
            ) : (
              activeAudience.rows.map((row, rowIndex) => (
                <tr key={`${active.key}-${activeAudience.key}-row-${rowIndex}`} className="hover:bg-black/[0.015]">
                  {activeAudience.columns.map((_, columnIndex) => (
                    <td key={`${active.key}-${activeAudience.key}-${rowIndex}-${columnIndex}`} className="border-r border-t border-black/10 p-2 last:border-r-0">
                      <input
                        className="w-full rounded-lg border border-transparent px-2 py-1 text-sm outline-none transition focus:border-black/20"
                        value={row[columnIndex] ?? ""}
                        onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                        placeholder={columnIndex === 0 ? "XS / 46 / 39 EUR" : "Значение"}
                      />
                    </td>
                  ))}
                  <td className="border-t border-black/10 p-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      className="rounded-full px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-black/45">
          Первая колонка считается размером товара и будет подсвечиваться на карточке товара.
        </p>
        <button
          type="button"
          onClick={clearActive}
          className="text-xs font-semibold text-black/45 underline underline-offset-4 hover:text-black"
        >
          Очистить текущую категорию
        </button>
      </div>
    </div>
  );
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

  // Products panel
  const [productsForBrand, setProductsForBrand] = useState<number | null>(null);
  const [brandProducts, setBrandProducts] = useState<BrandProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

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
        const list = Array.isArray(data.brands)
          ? data.brands.map((brand: any) => ({
              ...brand,
              imageUrl: brand.imageUrl || brand.features || null,
              coverUrl: brand.coverUrl || brand.material || null,
              sizeChart: brand.sizeChart || brand.styleNotes || "",
              heroVideo: extractHeroVideo(brand),
            }))
          : [];
        setBrands(list);
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

  const loadBrandProducts = useCallback(
    async (brandId: number) => {
      setLoadingProducts(true);
      try {
        const res = await fetch(`/api/admin/brands/products?brandId=${brandId}`, {
          cache: "no-store",
        });
        const data = await authGuardOrData(res);
        if (res.ok && data?.success) {
          setBrandProducts(data.products || []);
        }
      } catch {
        // ignore
      } finally {
        setLoadingProducts(false);
      }
    },
    [authGuardOrData]
  );

  const toggleProducts = (brandId: number) => {
    if (productsForBrand === brandId) {
      setProductsForBrand(null);
      setBrandProducts([]);
      return;
    }
    setProductsForBrand(brandId);
    loadBrandProducts(brandId);
  };

  const unlinkProduct = async (productId: number) => {
    if (!window.confirm("Убрать товар из этого бренда?")) return;
    setMsg(null);
    try {
      const res = await fetch("/api/admin/brands/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка удаления товара из бренда");
        return;
      }
      setBrandProducts((prev) => prev.filter((p) => p.id !== productId));
      // Update count in brands list
      setBrands((prev) =>
        prev.map((b) =>
          b.id === productsForBrand
            ? { ...b, _count: { Product: Math.max(0, b._count.Product - 1) } }
            : b
        )
      );
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    }
  };

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
          imageUrl: addForm.imageUrl,
          coverUrl: addForm.coverUrl,
          description: addForm.description || null,
          aboutLong: addForm.aboutLong || null,
          sizeChart: addForm.sizeChart || null,
          heroVideo: addForm.heroVideo || null,
          isPremium: addForm.isPremium,
        }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка добавления бренда");
        return;
      }
      await fetch("/api/admin/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: addForm.slug }),
      }).catch(() => {});
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
      imageUrl: brand.imageUrl || brand.features || "",
      coverUrl: brand.coverUrl || brand.material || "",
      description: brand.description || "",
      aboutLong: brand.aboutLong || "",
      sizeChart: brand.sizeChart || brand.styleNotes || "",
      heroVideo: extractHeroVideo(brand),
      isPremium: brand.isPremium,
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
          imageUrl: editForm.imageUrl,
          coverUrl: editForm.coverUrl,
          description: editForm.description || null,
          aboutLong: editForm.aboutLong || null,
          sizeChart: editForm.sizeChart || null,
          heroVideo: editForm.heroVideo || null,
          isPremium: editForm.isPremium,
        }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка обновления бренда");
        return;
      }
      await fetch("/api/admin/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: editForm.slug }),
      }).catch(() => {});
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
    if (!window.confirm(`Удалить бренд "${name}"?`)) return;
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
      if (productsForBrand === id) {
        setProductsForBrand(null);
        setBrandProducts([]);
      }
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
        <div className="sm:col-span-2">
          <ImageKitUploadField
            folder="/stage/brands"
            label="Загрузить логотип в ImageKit"
            onUploaded={(url) => setField("logoUrl", url)}
          />
        </div>
        <div className="sm:col-span-2 rounded-xl border border-black/10 p-3 bg-black/[0.02]">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45 mb-2">
            Фото для страницы всех брендов (/brands — правая панель)
          </div>
          <input
            className={inputCls}
            placeholder="URL фото для страницы всех брендов"
            value={form.coverUrl}
            onChange={(e) => setField("coverUrl", e.target.value)}
          />
          <div className="mt-2">
            <ImageKitUploadField
              folder="/stage/brand-covers"
              label="Загрузить фото для страницы всех брендов"
              onUploaded={(url) => setField("coverUrl", url)}
            />
          </div>
        </div>
        <div className="sm:col-span-2 rounded-xl border border-black/10 p-3 bg-black/[0.02]">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45 mb-2">
            Фоновое фото страницы самого бренда (/brand/slug — фон hero)
          </div>
          <input
            className={inputCls}
            placeholder="URL фонового фото страницы бренда"
            value={form.imageUrl}
            onChange={(e) => setField("imageUrl", e.target.value)}
          />
          <div className="mt-2">
            <ImageKitUploadField
              folder="/stage/brand-heroes"
              label="Загрузить фоновое фото страницы бренда"
              onUploaded={(url) => setField("imageUrl", url)}
            />
          </div>
        </div>
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
        <input
          className={inputCls + " sm:col-span-2"}
          placeholder="URL видео-фона бренда (mp4/webm, можно оставить пустым)"
          value={form.heroVideo}
          onChange={(e) => setField("heroVideo", e.target.value)}
        />
        <SizeChartEditor
          value={form.sizeChart}
          onChange={(next) => setField("sizeChart", next)}
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

  const pluralProducts = (n: number) => {
    if (n % 10 === 1 && n % 100 !== 11) return "товар";
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "товара";
    return "товаров";
  };

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
                    {brand.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.coverUrl}
                        alt="Brands list cover"
                        title="Фото для /brands"
                        className="hidden h-10 w-16 rounded-xl object-cover bg-black/5 sm:block"
                      />
                    )}
                    {brand.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.imageUrl}
                        alt="Brand hero"
                        title="Фон /brand/slug"
                        className="hidden h-10 w-16 rounded-xl object-cover bg-black/5 sm:block opacity-60"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{brand.name}</span>
                        {brand.isPremium && (
                          <span className="rounded-full bg-black text-white px-2 py-0.5 text-[10px] font-semibold">
                            Premium
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-black/60">
                        /{brand.slug} &middot; {brand._count.Product}{" "}
                        {pluralProducts(brand._count.Product)}
                      </div>
                      {brand.description && (
                        <div className="mt-1 text-xs text-black/50 max-w-md truncate">
                          {brand.description}
                        </div>
                      )}
                      {(brand.sizeChart || brand.styleNotes) && (
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Размерная сетка добавлена
                        </div>
                      )}
                      {extractHeroVideo(brand) && (
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                          Видео-фон добавлен
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {brand._count.Product > 0 && (
                      <button
                        onClick={() => toggleProducts(brand.id)}
                        className="text-xs text-black/70 hover:text-black transition"
                      >
                        {productsForBrand === brand.id ? "Скрыть товары" : "Товары"}
                      </button>
                    )}
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

                {/* Products list */}
                {productsForBrand === brand.id && (
                  <div className="mt-2 rounded-2xl border border-black/5 bg-black/[0.02] p-3">
                    {loadingProducts ? (
                      <div className="text-xs text-black/50">Загрузка товаров...</div>
                    ) : brandProducts.length === 0 ? (
                      <div className="text-xs text-black/50">Нет товаров</div>
                    ) : (
                      <div className="grid gap-2">
                        {brandProducts.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-3 rounded-xl bg-white border border-black/5 px-3 py-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="h-8 w-8 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded bg-black/5 flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{p.name}</div>
                                {p.price != null && (
                                  <div className="text-[10px] text-black/50">
                                    {Number(p.price).toLocaleString("ru-RU")} ₽
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => unlinkProduct(p.id)}
                              className="text-[10px] text-red-600 hover:text-red-800 transition flex-shrink-0"
                            >
                              Убрать
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
