"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: number; name: string; slug: string };
type Brand = { id: number; name: string; slug: string };
type Subcategory = { id: number; name: string; slug: string; categoryId: number };
type Size = { id: number; name: string };
type SizeCl = { id: number; name: string };
type Color = { id: number; name: string };

type SizeGroup = {
  id: string;
  price: string;
  sizeIds: number[];
  sizeClIds: number[];
};

const newGroup = (): SizeGroup => ({
  id: Math.random().toString(36).slice(2),
  price: "",
  sizeIds: [],
  sizeClIds: [],
});

export default function AdminProductsPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [sizeCls, setSizeCls] = useState<SizeCl[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [subcategoriesEnabled, setSubcategoriesEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [catalogMsg, setCatalogMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [colorId, setColorId] = useState("");
  const [gender, setGender] = useState("");
  const [description, setDescription] = useState("");
  const [sizeType, setSizeType] = useState<"NONE" | "SHOE" | "CLOTH">("NONE");
  const [shoeGroups, setShoeGroups] = useState<SizeGroup[]>([newGroup()]);
  const [clothGroups, setClothGroups] = useState<SizeGroup[]>([newGroup()]);
  const [premium, setPremium] = useState(false);
  const [badge, setBadge] = useState("");
  const [galleryText, setGalleryText] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [depthCm, setDepthCm] = useState("");

  const [newBrand, setNewBrand] = useState("");
  const [newBrandLogo, setNewBrandLogo] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [newSubcategoryCategoryId, setNewSubcategoryCategoryId] = useState("");
  const [newColor, setNewColor] = useState("");
  const [badgeDrafts, setBadgeDrafts] = useState<Record<number, string>>({});
  const [savingBadgeId, setSavingBadgeId] = useState<number | null>(null);

  const authGuardOrData = useCallback(async (res: Response) => {
    const data = await res.json().catch(() => ({} as any));
    if (res.status === 403 && data?.message === "2FA required") {
      router.replace("/admin/2fa");
      throw new Error("Требуется повторное подтверждение 2FA");
    }
    return data;
  }, [router]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [catalogRes, productsRes] = await Promise.all([
        fetch("/api/admin/catalog", { cache: "no-store" }),
        fetch("/api/admin/products?take=80", { cache: "no-store" }),
      ]);
      const catalogData = await authGuardOrData(catalogRes);
      if (catalogRes.ok && catalogData?.success) {
        setCategories(catalogData.categories || []);
        setBrands(catalogData.brands || []);
        setSubcategories(catalogData.subcategories || []);
        setSizes(catalogData.sizes || []);
        setSizeCls(catalogData.sizeCls || []);
        setColors(catalogData.colors || []);
        setSubcategoriesEnabled(catalogData.subcategoriesEnabled !== false);
      } else {
        throw new Error(catalogData?.message || "Не удалось загрузить каталог");
      }

      const productsData = await authGuardOrData(productsRes);
      if (productsRes.ok && productsData?.success) {
        const rows = productsData.products || [];
        setProducts(rows);
        const drafts: Record<number, string> = {};
        for (const p of rows) {
          drafts[p.id] = p?.badge ?? "";
        }
        setBadgeDrafts(drafts);
      } else {
        throw new Error(productsData?.message || "Не удалось загрузить товары");
      }
    } catch (e: any) {
      setMsg(e?.message || "Ошибка загрузки админ-панели");
    } finally {
      setLoading(false);
    }
  }, [authGuardOrData]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const filteredSubcategories = useMemo(() => {
    const catId = Number(categoryId);
    if (!Number.isFinite(catId)) return subcategories;
    return subcategories.filter((s) => s.categoryId === catId);
  }, [categoryId, subcategories]);

  const toggleSize = (groupId: string, id: number, type: "shoe" | "cloth") => {
    if (type === "shoe") {
      setShoeGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                sizeIds: g.sizeIds.includes(id) ? g.sizeIds.filter((x) => x !== id) : [...g.sizeIds, id],
              }
            : g
        )
      );
      return;
    }
    setClothGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              sizeClIds: g.sizeClIds.includes(id)
                ? g.sizeClIds.filter((x) => x !== id)
                : [...g.sizeClIds, id],
            }
          : g
      )
    );
  };

  const addBrand = async () => {
    setCatalogMsg(null);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBrand, logoUrl: newBrandLogo }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setCatalogMsg(data?.message || "Ошибка добавления бренда");
        return;
      }
      setCatalogMsg("Бренд добавлен");
      setNewBrand("");
      setNewBrandLogo("");
      await loadCatalog();
    } catch (e: any) {
      setCatalogMsg(e?.message || "Ошибка добавления бренда");
    }
  };

  const addCategory = async () => {
    setCatalogMsg(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategory }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setCatalogMsg(data?.message || "Ошибка добавления категории");
        return;
      }
      setCatalogMsg("Категория добавлена");
      setNewCategory("");
      await loadCatalog();
    } catch (e: any) {
      setCatalogMsg(e?.message || "Ошибка добавления категории");
    }
  };

  const addSubcategory = async () => {
    setCatalogMsg(null);
    try {
      const res = await fetch("/api/admin/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubcategory,
          categoryId: Number(newSubcategoryCategoryId),
        }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setCatalogMsg(data?.message || "Ошибка добавления подкатегории");
        return;
      }
      setCatalogMsg("Подкатегория добавлена");
      setNewSubcategory("");
      setNewSubcategoryCategoryId("");
      await loadCatalog();
    } catch (e: any) {
      setCatalogMsg(e?.message || "Ошибка добавления подкатегории");
    }
  };

  const addColor = async () => {
    setCatalogMsg(null);
    try {
      const res = await fetch("/api/admin/colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newColor }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setCatalogMsg(data?.message || "Ошибка добавления цвета");
        return;
      }
      setCatalogMsg("Цвет добавлен");
      setNewColor("");
      await loadCatalog();
    } catch (e: any) {
      setCatalogMsg(e?.message || "Ошибка добавления цвета");
    }
  };

  const submit = async () => {
    setMsg(null);
    if (!name.trim()) {
      setMsg("Введите название товара");
      return;
    }
    const catId = Number(categoryId);
    if (!Number.isFinite(catId) || catId <= 0) {
      setMsg("Выберите категорию");
      return;
    }
    const sizeGroups =
      sizeType === "SHOE"
        ? shoeGroups.map((g) => ({ price: Number(g.price), sizeIds: g.sizeIds }))
        : sizeType === "CLOTH"
          ? clothGroups.map((g) => ({ price: Number(g.price), sizeClIds: g.sizeClIds }))
          : [];
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: Number(price),
          badge: badge || null,
          imageUrl,
          images: galleryText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          categoryId: catId,
          subcategoryId: subcategoryId ? Number(subcategoryId) : null,
          brandId: brandId ? Number(brandId) : null,
          colorId: colorId ? Number(colorId) : null,
          gender: gender || null,
          description,
          sizeType,
          sizeGroups,
          premium,
          widthCm: widthCm ? Number(widthCm) : null,
          heightCm: heightCm ? Number(heightCm) : null,
          depthCm: depthCm ? Number(depthCm) : null,
        }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка добавления");
        return;
      }
      setMsg("Товар добавлен");
      setName("");
      setPrice("");
      setImageUrl("");
      setBrandId("");
      setColorId("");
      setGender("");
      setDescription("");
      setSubcategoryId("");
      setSizeType("NONE");
      setShoeGroups([newGroup()]);
      setClothGroups([newGroup()]);
      setPremium(false);
      setBadge("");
      setGalleryText("");
      setWidthCm("");
      setHeightCm("");
      setDepthCm("");
      await loadCatalog();
    } catch (e: any) {
      setMsg(e?.message || "Ошибка добавления");
    }
  };

  const saveProductBadge = async (id: number) => {
    setMsg(null);
    setSavingBadgeId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badge: (badgeDrafts[id] || "").trim() || null,
        }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка обновления тематики");
        return;
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, badge: data?.product?.badge ?? null } : p))
      );
      setMsg("Тематика обновлена");
    } finally {
      setSavingBadgeId(null);
    }
  };

  const removeProduct = async (id: number) => {
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка удаления");
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setMsg(e?.message || "Ошибка удаления");
    }
  };

  return (
    <div className="grid gap-10">
      <section>
        <h2 className="text-lg font-semibold">Каталог: бренды и категории</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Добавить бренд</div>
            <input
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="Название бренда"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
            />
            <input
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="Ссылка на логотип (URL)"
              value={newBrandLogo}
              onChange={(e) => setNewBrandLogo(e.target.value)}
            />
            <button
              onClick={addBrand}
              className="mt-3 rounded-full bg-black text-white px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
            >
              Добавить
            </button>
          </div>
          <div className="rounded-2xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Добавить категорию</div>
            <input
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="Название категории"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button
              onClick={addCategory}
              className="mt-3 rounded-full bg-black text-white px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
            >
              Добавить
            </button>
          </div>
          <div className="rounded-2xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Добавить подкатегорию</div>
            <input
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="Название подкатегории"
              value={newSubcategory}
              onChange={(e) => setNewSubcategory(e.target.value)}
            />
            <select
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              value={newSubcategoryCategoryId}
              onChange={(e) => setNewSubcategoryCategoryId(e.target.value)}
            >
              <option value="">Категория</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={addSubcategory}
              className="mt-3 rounded-full bg-black text-white px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
            >
              Добавить
            </button>
          </div>
          <div className="rounded-2xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Добавить цвет</div>
            <input
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="Название цвета"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
            />
            <button
              onClick={addColor}
              className="mt-3 rounded-full bg-black text-white px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
            >
              Добавить
            </button>
          </div>
        </div>
        {catalogMsg && <div className="mt-3 text-sm">{catalogMsg}</div>}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Добавить товар</h2>
        {loading ? (
          <div className="mt-4 text-sm text-black/60">Загрузка справочников…</div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-xl border border-black/10 px-3 py-2 text-sm disabled:bg-black/5"
              placeholder="Цена (если без размеров)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={sizeType !== "NONE"}
            />
            <input
              className="rounded-xl border border-black/10 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Ссылка на фото"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <textarea
              className="rounded-xl border border-black/10 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Галерея фото (по одному URL на строку)"
              rows={4}
              value={galleryText}
              onChange={(e) => setGalleryText(e.target.value)}
            />
            <select
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId("");
              }}
            >
              <option value="">Категория</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
            >
              <option value="">Подкатегория (необязательно)</option>
              {filteredSubcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {!subcategoriesEnabled && (
              <div className="sm:col-span-2 text-xs text-red-600">
                Подкатегории недоступны. Выполни `npx prisma db push` и `npx prisma generate`, затем перезапусти сервер.
              </div>
            )}
            {subcategoriesEnabled && filteredSubcategories.length === 0 && (
              <div className="sm:col-span-2 text-xs text-black/60">
                Сначала добавь подкатегории в блоке выше.
              </div>
            )}
            <select
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">Бренд (необязательно)</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              value={colorId}
              onChange={(e) => setColorId(e.target.value)}
            >
              <option value="">Цвет (необязательно)</option>
              {colors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Пол (необязательно)</option>
              <option value="men">Мужское</option>
              <option value="women">Женское</option>
              <option value="unisex">Унисекс</option>
            </select>
            <select
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              value={sizeType}
              onChange={(e) => setSizeType(e.target.value as "NONE" | "SHOE" | "CLOTH")}
            >
              <option value="NONE">Без размеров</option>
              <option value="SHOE">Обувь</option>
              <option value="CLOTH">Одежда</option>
            </select>
            <textarea
              className="rounded-xl border border-black/10 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Описание"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="sm:col-span-2 rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-semibold">Габариты сумки (см)</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                  placeholder="Длина / Высота"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
                <input
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                  placeholder="Ширина"
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                />
                <input
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                  placeholder="Глубина"
                  value={depthCm}
                  onChange={(e) => setDepthCm(e.target.value)}
                />
              </div>
              <div className="mt-2 text-xs text-black/60">Если не нужно — оставь пустым.</div>
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={premium}
                onChange={(e) => setPremium(e.target.checked)}
              />
              Премиум товар (показывать на premium странице)
            </label>
            <input
              className="rounded-xl border border-black/10 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Тематика/подборка (badge), например: urban capsule"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
            />

            {sizeType !== "NONE" && (
              <div className="sm:col-span-2 rounded-2xl border border-black/10 p-4">
                <div className="text-sm font-semibold">Цены по размерам</div>
                <div className="mt-2 text-xs text-black/60">
                  Создай группу: укажи цену и выбери несколько размеров — всем выбранным размерам назначится эта цена.
                </div>
                {(sizeType === "SHOE" ? shoeGroups : clothGroups).map((group) => (
                  <div key={group.id} className="mt-4 rounded-2xl border border-black/10 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        className="w-40 rounded-xl border border-black/10 px-3 py-2 text-sm"
                        placeholder="Цена"
                        value={group.price}
                        onChange={(e) =>
                          sizeType === "SHOE"
                            ? setShoeGroups((prev) =>
                                prev.map((g) => (g.id === group.id ? { ...g, price: e.target.value } : g))
                              )
                            : setClothGroups((prev) =>
                                prev.map((g) => (g.id === group.id ? { ...g, price: e.target.value } : g))
                              )
                        }
                      />
                      <button
                        onClick={() =>
                          sizeType === "SHOE"
                            ? setShoeGroups((prev) => prev.filter((g) => g.id !== group.id))
                            : setClothGroups((prev) => prev.filter((g) => g.id !== group.id))
                        }
                        className="text-xs text-red-600"
                      >
                        Удалить группу
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(sizeType === "SHOE" ? sizes : sizeCls).map((size) => {
                        const checked =
                          sizeType === "SHOE"
                            ? group.sizeIds.includes(size.id)
                            : group.sizeClIds.includes(size.id);
                        return (
                          <label
                            key={`${group.id}-${size.id}`}
                            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                              checked ? "border-black bg-black text-white" : "border-black/10"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={() => toggleSize(group.id, size.id, sizeType === "SHOE" ? "shoe" : "cloth")}
                            />
                            {size.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    sizeType === "SHOE"
                      ? setShoeGroups((prev) => [...prev, newGroup()])
                      : setClothGroups((prev) => [...prev, newGroup()])
                  }
                  className="mt-4 rounded-full border border-black/10 px-4 py-2 text-xs font-semibold"
                >
                  Добавить группу размеров
                </button>
              </div>
            )}

            <div className="sm:col-span-2">
              <button
                onClick={submit}
                className="rounded-full bg-black text-white px-5 py-2 text-sm font-semibold hover:opacity-90 transition"
              >
                Добавить
              </button>
              {msg && <span className="ml-3 text-sm">{msg}</span>}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Товары</h2>
        <div className="mt-4 grid gap-3">
          {products.length === 0 ? (
            <div className="text-sm text-black/60">Нет товаров для отображения.</div>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 p-4"
              >
                <div className="flex items-center gap-3">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-black/5" />
                  )}
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-black/60">
                      {p.Category?.name || "Без категории"} • {p.Brand?.name || "Без бренда"}
                      {p.Color?.name ? ` • ${p.Color.name}` : ""}
                      {p.gender ? ` • ${p.gender === "men" ? "Мужское" : p.gender === "women" ? "Женское" : "Унисекс"}` : ""}
                      {p.premium ? " • Премиум" : ""}
                    </div>
                    <div className="mt-1 text-xs text-black/60">
                      Тематика: {p.badge || "—"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm font-semibold">{p.price ? `${p.price} ₽` : "—"}</div>
                  <input
                    className="w-44 rounded-full border border-black/10 px-3 py-1.5 text-xs"
                    placeholder="тематика"
                    value={badgeDrafts[p.id] ?? ""}
                    onChange={(e) =>
                      setBadgeDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => saveProductBadge(p.id)}
                    disabled={savingBadgeId === p.id}
                    className="text-xs text-black/70 disabled:text-black/30"
                  >
                    {savingBadgeId === p.id ? "Сохранение..." : "Сохранить тему"}
                  </button>
                  <button onClick={() => removeProduct(p.id)} className="text-xs text-red-600">
                    Удалить
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
