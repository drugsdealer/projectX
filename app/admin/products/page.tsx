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

type EditForm = {
  name: string;
  price: string;
  oldPrice: string;
  discountMode: boolean; // true = show old price as crossed out
  imageUrl: string;
  galleryText: string;
  description: string;
  categoryId: string;
  brandId: string;
  colorId: string;
  gender: string;
  badge: string;
  premium: boolean;
  material: string;
  features: string;
  styleNotes: string;
  widthCm: string;
  heightCm: string;
  depthCm: string;
  article: string;
};

const emptyEditForm = (): EditForm => ({
  name: "",
  price: "",
  oldPrice: "",
  discountMode: false,
  imageUrl: "",
  galleryText: "",
  description: "",
  categoryId: "",
  brandId: "",
  colorId: "",
  gender: "",
  badge: "",
  premium: false,
  material: "",
  features: "",
  styleNotes: "",
  widthCm: "",
  heightCm: "",
  depthCm: "",
  article: "",
});

const newGroup = (): SizeGroup => ({
  id: Math.random().toString(36).slice(2),
  price: "",
  sizeIds: [],
  sizeClIds: [],
});

const inputCls = "w-full rounded-xl border border-black/10 px-3 py-2 text-sm";
const btnPrimary =
  "rounded-full bg-black text-white px-5 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50";
const btnSecondary =
  "rounded-full border border-black/10 px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition";

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

  // Create form state
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
  const [material, setMaterial] = useState("");
  const [features, setFeatures] = useState("");
  const [styleNotes, setStyleNotes] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [depthCm, setDepthCm] = useState("");
  const [article, setArticle] = useState("");

  const [newBrand, setNewBrand] = useState("");
  const [newBrandLogo, setNewBrandLogo] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [newSubcategoryCategoryId, setNewSubcategoryCategoryId] = useState("");
  const [newColor, setNewColor] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm());
  const [savingEdit, setSavingEdit] = useState(false);

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
        setProducts(productsData.products || []);
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
            ? { ...g, sizeIds: g.sizeIds.includes(id) ? g.sizeIds.filter((x) => x !== id) : [...g.sizeIds, id] }
            : g
        )
      );
      return;
    }
    setClothGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, sizeClIds: g.sizeClIds.includes(id) ? g.sizeClIds.filter((x) => x !== id) : [...g.sizeClIds, id] }
          : g
      )
    );
  };

  // --- Catalog helpers ---
  const addBrand = async () => {
    setCatalogMsg(null);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBrand, logoUrl: newBrandLogo }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) { setCatalogMsg(data?.message || "Ошибка"); return; }
      setCatalogMsg("Бренд добавлен");
      setNewBrand(""); setNewBrandLogo("");
      await loadCatalog();
    } catch (e: any) { setCatalogMsg(e?.message || "Ошибка"); }
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
      if (!res.ok || !data?.success) { setCatalogMsg(data?.message || "Ошибка"); return; }
      setCatalogMsg("Категория добавлена");
      setNewCategory("");
      await loadCatalog();
    } catch (e: any) { setCatalogMsg(e?.message || "Ошибка"); }
  };

  const addSubcategory = async () => {
    setCatalogMsg(null);
    try {
      const res = await fetch("/api/admin/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSubcategory, categoryId: Number(newSubcategoryCategoryId) }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) { setCatalogMsg(data?.message || "Ошибка"); return; }
      setCatalogMsg("Подкатегория добавлена");
      setNewSubcategory(""); setNewSubcategoryCategoryId("");
      await loadCatalog();
    } catch (e: any) { setCatalogMsg(e?.message || "Ошибка"); }
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
      if (!res.ok || !data?.success) { setCatalogMsg(data?.message || "Ошибка"); return; }
      setCatalogMsg("Цвет добавлен");
      setNewColor("");
      await loadCatalog();
    } catch (e: any) { setCatalogMsg(e?.message || "Ошибка"); }
  };

  // --- Create product ---
  const submit = async () => {
    setMsg(null);
    if (!name.trim()) { setMsg("Введите название товара"); return; }
    const catId = Number(categoryId);
    if (!Number.isFinite(catId) || catId <= 0) { setMsg("Выберите категорию"); return; }
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
          name, price: Number(price), badge: badge || null,
          imageUrl,
          images: galleryText.split("\n").map((l) => l.trim()).filter(Boolean),
          categoryId: catId,
          subcategoryId: subcategoryId ? Number(subcategoryId) : null,
          brandId: brandId ? Number(brandId) : null,
          colorId: colorId ? Number(colorId) : null,
          gender: gender || null,
          description,
          material: material || null,
          features: features || null,
          styleNotes: styleNotes || null,
          sizeType, sizeGroups, premium,
          widthCm: widthCm ? Number(widthCm) : null,
          heightCm: heightCm ? Number(heightCm) : null,
          depthCm: depthCm ? Number(depthCm) : null,
          article: article || null,
        }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) { setMsg(data?.message || "Ошибка добавления"); return; }
      setMsg("Товар добавлен");
      setName(""); setPrice(""); setImageUrl(""); setBrandId(""); setColorId("");
      setGender(""); setDescription(""); setSubcategoryId(""); setSizeType("NONE");
      setShoeGroups([newGroup()]); setClothGroups([newGroup()]);
      setPremium(false); setBadge(""); setGalleryText("");
      setMaterial(""); setFeatures(""); setStyleNotes("");
      setWidthCm(""); setHeightCm(""); setDepthCm(""); setArticle("");
      await loadCatalog();
    } catch (e: any) { setMsg(e?.message || "Ошибка добавления"); }
  };

  // --- Edit product ---
  const startEdit = (p: any) => {
    const hasOldPrice = p.oldPrice != null && p.oldPrice > 0;
    setEditingId(p.id);
    setEditForm({
      name: p.name || "",
      price: p.price != null ? String(p.price) : "",
      oldPrice: hasOldPrice ? String(p.oldPrice) : "",
      discountMode: hasOldPrice,
      imageUrl: p.imageUrl || "",
      galleryText: Array.isArray(p.images) ? p.images.join("\n") : "",
      description: p.description || "",
      categoryId: p.categoryId ? String(p.categoryId) : "",
      brandId: p.brandId ? String(p.brandId) : "",
      colorId: p.colorId ? String(p.colorId) : "",
      gender: p.gender || "",
      badge: p.badge || "",
      premium: Boolean(p.premium),
      material: p.material || "",
      features: p.features || "",
      styleNotes: p.styleNotes || "",
      widthCm: p.widthCm ? String(p.widthCm) : "",
      heightCm: p.heightCm ? String(p.heightCm) : "",
      depthCm: p.depthCm ? String(p.depthCm) : "",
      article: p.article || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyEditForm());
  };

  const setEditField = (field: keyof EditForm, value: any) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    setMsg(null);
    setSavingEdit(true);
    try {
      const newPrice = editForm.price ? Number(editForm.price) : null;

      let oldPrice: number | null = null;
      if (editForm.discountMode && editForm.oldPrice) {
        oldPrice = Number(editForm.oldPrice);
      }

      const res = await fetch(`/api/admin/products/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          price: newPrice,
          oldPrice: editForm.discountMode ? oldPrice : null,
          description: editForm.description || null,
          imageUrl: editForm.imageUrl || null,
          images: editForm.galleryText.split("\n").map((l) => l.trim()).filter(Boolean),
          categoryId: editForm.categoryId ? Number(editForm.categoryId) : undefined,
          brandId: editForm.brandId ? Number(editForm.brandId) : null,
          colorId: editForm.colorId ? Number(editForm.colorId) : null,
          gender: editForm.gender || null,
          badge: editForm.badge || null,
          premium: editForm.premium,
          material: editForm.material || null,
          features: editForm.features || null,
          styleNotes: editForm.styleNotes || null,
          widthCm: editForm.widthCm ? Number(editForm.widthCm) : null,
          heightCm: editForm.heightCm ? Number(editForm.heightCm) : null,
          depthCm: editForm.depthCm ? Number(editForm.depthCm) : null,
          article: editForm.article || null,
        }),
      });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) {
        setMsg(data?.message || "Ошибка сохранения");
        return;
      }
      setMsg("Товар обновлён");
      // Update product in list
      setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...data.product } : p)));
      setEditingId(null);
      setEditForm(emptyEditForm());
    } catch (e: any) {
      setMsg(e?.message || "Ошибка сохранения");
    } finally {
      setSavingEdit(false);
    }
  };

  const removeProduct = async (id: number) => {
    setMsg(null);
    if (!window.confirm("Удалить этот товар?")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const data = await authGuardOrData(res);
      if (!res.ok || !data?.success) { setMsg(data?.message || "Ошибка удаления"); return; }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) cancelEdit();
    } catch (e: any) { setMsg(e?.message || "Ошибка удаления"); }
  };

  return (
    <div className="grid gap-10">
      {/* Catalog helpers */}
      <section>
        <h2 className="text-lg font-semibold">Каталог: бренды и категории</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Добавить бренд</div>
            <input className={"mt-3 " + inputCls} placeholder="Название бренда" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
            <input className={"mt-3 " + inputCls} placeholder="Ссылка на логотип (URL)" value={newBrandLogo} onChange={(e) => setNewBrandLogo(e.target.value)} />
            <button onClick={addBrand} className={"mt-3 " + btnPrimary}>Добавить</button>
          </div>
          <div className="rounded-2xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Добавить категорию</div>
            <input className={"mt-3 " + inputCls} placeholder="Название категории" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <button onClick={addCategory} className={"mt-3 " + btnPrimary}>Добавить</button>
          </div>
          <div className="rounded-2xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Добавить подкатегорию</div>
            <input className={"mt-3 " + inputCls} placeholder="Название подкатегории" value={newSubcategory} onChange={(e) => setNewSubcategory(e.target.value)} />
            <select className={"mt-3 " + inputCls} value={newSubcategoryCategoryId} onChange={(e) => setNewSubcategoryCategoryId(e.target.value)}>
              <option value="">Категория</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={addSubcategory} className={"mt-3 " + btnPrimary}>Добавить</button>
          </div>
          <div className="rounded-2xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Добавить цвет</div>
            <input className={"mt-3 " + inputCls} placeholder="Название цвета" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
            <button onClick={addColor} className={"mt-3 " + btnPrimary}>Добавить</button>
          </div>
        </div>
        {catalogMsg && <div className="mt-3 text-sm">{catalogMsg}</div>}
      </section>

      {/* Create product */}
      <section>
        <h2 className="text-lg font-semibold">Добавить товар</h2>
        {loading ? (
          <div className="mt-4 text-sm text-black/60">Загрузка справочников...</div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className={inputCls} placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={inputCls + " disabled:bg-black/5"} placeholder="Цена (если без размеров)" value={price} onChange={(e) => setPrice(e.target.value)} disabled={sizeType !== "NONE"} />
            <input className={inputCls + " sm:col-span-2"} placeholder="Ссылка на фото" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <textarea className={inputCls + " sm:col-span-2"} placeholder="Галерея фото (по одному URL на строку)" rows={4} value={galleryText} onChange={(e) => setGalleryText(e.target.value)} />
            <select className={inputCls} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }}>
              <option value="">Категория</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={inputCls} value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
              <option value="">Подкатегория (необязательно)</option>
              {filteredSubcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {!subcategoriesEnabled && <div className="sm:col-span-2 text-xs text-red-600">Подкатегории недоступны. Выполни `npx prisma db push` и `npx prisma generate`, затем перезапусти сервер.</div>}
            <select className={inputCls} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">Бренд (необязательно)</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className={inputCls} value={colorId} onChange={(e) => setColorId(e.target.value)}>
              <option value="">Цвет (необязательно)</option>
              {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Пол (необязательно)</option>
              <option value="men">Мужское</option>
              <option value="women">Женское</option>
              <option value="unisex">Унисекс</option>
            </select>
            <select className={inputCls} value={sizeType} onChange={(e) => setSizeType(e.target.value as "NONE" | "SHOE" | "CLOTH")}>
              <option value="NONE">Без размеров</option>
              <option value="SHOE">Обувь</option>
              <option value="CLOTH">Одежда</option>
            </select>
            <textarea className={inputCls + " sm:col-span-2"} placeholder="Описание" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

            <div className="sm:col-span-2 rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-semibold">Характеристики товара</div>
              <div className="mt-2 text-xs text-black/60">Если оставить пустым — будут значения по умолчанию.</div>
              <div className="mt-3 grid gap-3">
                <input className={inputCls} placeholder="Артикул производителя" value={article} onChange={(e) => setArticle(e.target.value)} />
                <input className={inputCls} placeholder="Материалы" value={material} onChange={(e) => setMaterial(e.target.value)} />
                <input className={inputCls} placeholder="Комфорт" value={features} onChange={(e) => setFeatures(e.target.value)} />
                <input className={inputCls} placeholder="Дизайн" value={styleNotes} onChange={(e) => setStyleNotes(e.target.value)} />
              </div>
            </div>

            <div className="sm:col-span-2 rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-semibold">Габариты сумки (см)</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input className={inputCls} placeholder="Длина / Высота" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                <input className={inputCls} placeholder="Ширина" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} />
                <input className={inputCls} placeholder="Глубина" value={depthCm} onChange={(e) => setDepthCm(e.target.value)} />
              </div>
              <div className="mt-2 text-xs text-black/60">Если не нужно — оставь пустым.</div>
            </div>

            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={premium} onChange={(e) => setPremium(e.target.checked)} />
              Премиум товар (показывать на premium странице)
            </label>
            <input className={inputCls + " sm:col-span-2"} placeholder="Тематика/подборка (badge), например: urban capsule" value={badge} onChange={(e) => setBadge(e.target.value)} />

            {sizeType !== "NONE" && (
              <div className="sm:col-span-2 rounded-2xl border border-black/10 p-4">
                <div className="text-sm font-semibold">Цены по размерам</div>
                <div className="mt-2 text-xs text-black/60">Создай группу: укажи цену и выбери размеры.</div>
                {(sizeType === "SHOE" ? shoeGroups : clothGroups).map((group) => (
                  <div key={group.id} className="mt-4 rounded-2xl border border-black/10 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        className="w-40 rounded-xl border border-black/10 px-3 py-2 text-sm"
                        placeholder="Цена"
                        value={group.price}
                        onChange={(e) =>
                          sizeType === "SHOE"
                            ? setShoeGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, price: e.target.value } : g)))
                            : setClothGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, price: e.target.value } : g)))
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
                        const checked = sizeType === "SHOE" ? group.sizeIds.includes(size.id) : group.sizeClIds.includes(size.id);
                        return (
                          <label key={`${group.id}-${size.id}`} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${checked ? "border-black bg-black text-white" : "border-black/10"}`}>
                            <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleSize(group.id, size.id, sizeType === "SHOE" ? "shoe" : "cloth")} />
                            {size.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => sizeType === "SHOE" ? setShoeGroups((prev) => [...prev, newGroup()]) : setClothGroups((prev) => [...prev, newGroup()])}
                  className="mt-4 rounded-full border border-black/10 px-4 py-2 text-xs font-semibold"
                >
                  Добавить группу размеров
                </button>
              </div>
            )}

            <div className="sm:col-span-2">
              <button onClick={submit} className={btnPrimary}>Добавить</button>
              {msg && <span className="ml-3 text-sm">{msg}</span>}
            </div>
          </div>
        )}
      </section>

      {/* Product list */}
      <section>
        <h2 className="text-lg font-semibold">Товары</h2>
        {msg && editingId !== null && <div className="mt-2 text-sm">{msg}</div>}
        <div className="mt-4 grid gap-3">
          {products.length === 0 ? (
            <div className="text-sm text-black/60">Нет товаров для отображения.</div>
          ) : (
            products.map((p) => (
              <div key={p.id}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 p-4">
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
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-sm font-semibold">
                      {p.oldPrice ? (
                        <>
                          <span className="line-through text-black/40 mr-1">{Number(p.oldPrice).toLocaleString("ru-RU")} ₽</span>
                          <span className="text-red-600">{p.price ? `${Number(p.price).toLocaleString("ru-RU")} ₽` : "—"}</span>
                        </>
                      ) : (
                        p.price ? `${Number(p.price).toLocaleString("ru-RU")} ₽` : "—"
                      )}
                    </div>
                    <button
                      onClick={() => editingId === p.id ? cancelEdit() : startEdit(p)}
                      className="text-xs text-black/70 hover:text-black transition"
                    >
                      {editingId === p.id ? "Отмена" : "Редактировать"}
                    </button>
                    <button onClick={() => removeProduct(p.id)} className="text-xs text-red-600 hover:text-red-800 transition">
                      Удалить
                    </button>
                  </div>
                </div>

                {/* Full edit form */}
                {editingId === p.id && (
                  <div className="mt-2 rounded-2xl border border-black/5 bg-black/[0.02] p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <div className="text-xs font-semibold text-black/70 mb-2">Основное</div>
                      </div>
                      <input className={inputCls} placeholder="Название" value={editForm.name} onChange={(e) => setEditField("name", e.target.value)} />
                      <input className={inputCls} placeholder="Новая цена" value={editForm.price} onChange={(e) => setEditField("price", e.target.value)} />

                      {/* Discount toggle */}
                      <div className="sm:col-span-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="h-4 w-4" checked={editForm.discountMode} onChange={(e) => setEditField("discountMode", e.target.checked)} />
                          Скидка (показать старую цену зачёркнутой)
                        </label>
                        {editForm.discountMode && (
                          <div className="mt-2 flex items-center gap-3">
                            <input
                              className={inputCls + " max-w-xs"}
                              placeholder="Старая цена (до скидки)"
                              value={editForm.oldPrice}
                              onChange={(e) => setEditField("oldPrice", e.target.value)}
                            />
                            {editForm.oldPrice && editForm.price && (
                              <span className="text-xs text-black/60">
                                <span className="line-through">{Number(editForm.oldPrice).toLocaleString("ru-RU")} ₽</span>
                                {" → "}
                                <span className="text-red-600 font-semibold">{Number(editForm.price).toLocaleString("ru-RU")} ₽</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <input className={inputCls + " sm:col-span-2"} placeholder="Ссылка на главное фото" value={editForm.imageUrl} onChange={(e) => setEditField("imageUrl", e.target.value)} />
                      <textarea className={inputCls + " sm:col-span-2"} placeholder="Галерея фото (по одному URL на строку)" rows={3} value={editForm.galleryText} onChange={(e) => setEditField("galleryText", e.target.value)} />
                      <textarea className={inputCls + " sm:col-span-2"} placeholder="Описание" rows={3} value={editForm.description} onChange={(e) => setEditField("description", e.target.value)} />

                      <select className={inputCls} value={editForm.categoryId} onChange={(e) => setEditField("categoryId", e.target.value)}>
                        <option value="">Категория</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select className={inputCls} value={editForm.brandId} onChange={(e) => setEditField("brandId", e.target.value)}>
                        <option value="">Бренд</option>
                        {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <select className={inputCls} value={editForm.colorId} onChange={(e) => setEditField("colorId", e.target.value)}>
                        <option value="">Цвет</option>
                        {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select className={inputCls} value={editForm.gender} onChange={(e) => setEditField("gender", e.target.value)}>
                        <option value="">Пол</option>
                        <option value="men">Мужское</option>
                        <option value="women">Женское</option>
                        <option value="unisex">Унисекс</option>
                      </select>
                      <input className={inputCls} placeholder="Тематика (badge)" value={editForm.badge} onChange={(e) => setEditField("badge", e.target.value)} />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="h-4 w-4" checked={editForm.premium} onChange={(e) => setEditField("premium", e.target.checked)} />
                        Премиум
                      </label>

                      <div className="sm:col-span-2 mt-2">
                        <div className="text-xs font-semibold text-black/70 mb-2">Характеристики</div>
                      </div>
                      <input className={inputCls + " sm:col-span-2"} placeholder="Артикул производителя" value={editForm.article} onChange={(e) => setEditField("article", e.target.value)} />
                      <input className={inputCls} placeholder="Материалы" value={editForm.material} onChange={(e) => setEditField("material", e.target.value)} />
                      <input className={inputCls} placeholder="Комфорт" value={editForm.features} onChange={(e) => setEditField("features", e.target.value)} />
                      <input className={inputCls + " sm:col-span-2"} placeholder="Дизайн" value={editForm.styleNotes} onChange={(e) => setEditField("styleNotes", e.target.value)} />

                      <div className="sm:col-span-2 mt-2">
                        <div className="text-xs font-semibold text-black/70 mb-2">Габариты (см)</div>
                      </div>
                      <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
                        <input className={inputCls} placeholder="Высота" value={editForm.heightCm} onChange={(e) => setEditField("heightCm", e.target.value)} />
                        <input className={inputCls} placeholder="Ширина" value={editForm.widthCm} onChange={(e) => setEditField("widthCm", e.target.value)} />
                        <input className={inputCls} placeholder="Глубина" value={editForm.depthCm} onChange={(e) => setEditField("depthCm", e.target.value)} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button onClick={saveEdit} disabled={savingEdit} className={btnPrimary}>
                        {savingEdit ? "Сохранение..." : "Сохранить"}
                      </button>
                      <button onClick={cancelEdit} className={btnSecondary}>Отмена</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
