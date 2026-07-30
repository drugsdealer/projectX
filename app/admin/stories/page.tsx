"use client";

import { useEffect, useState } from "react";
import ImageKitUploadField from "@/components/admin/ImageKitUploadField";

type SlideRow = {
  id: number;
  imageUrl: string;
  caption: string | null;
  description: string | null;
  order: number;
  productCount: number;
};

type StoryRow = {
  id: number;
  title: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  slides: SlideRow[];
};

type SlideProduct = {
  id: number;
  name: string;
  price: number | null;
  imageUrl: string;
  brandName: string | null;
};

type SearchProduct = SlideProduct;

const formatPrice = (price?: number | null) => {
  if (typeof price !== "number" || Number.isNaN(price)) return "—";
  return `${Math.round(price).toLocaleString("ru-RU")} ₽`;
};

export default function AdminStoriesPage() {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const [newSlideText, setNewSlideText] = useState<Record<number, { caption: string; description: string }>>({});
  const [slideEdits, setSlideEdits] = useState<Record<number, { caption: string; description: string }>>({});

  const [openSlideId, setOpenSlideId] = useState<number | null>(null);
  const [slideProducts, setSlideProducts] = useState<SlideProduct[]>([]);
  const [slideProductsLoading, setSlideProductsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/stories", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) setStories(data.stories || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createStory = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setMsg(null);
    const res = await fetch("/api/admin/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setMsg(data?.message || "Не удалось создать сторис");
      return;
    }
    setNewTitle("");
    await load();
  };

  const toggleActive = async (id: number, next: boolean) => {
    await fetch(`/api/admin/stories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    await load();
  };

  const removeStory = async (id: number) => {
    if (!confirm("Удалить сторис? Слайды и привязанные товары тоже будут скрыты.")) return;
    await fetch(`/api/admin/stories/${id}`, { method: "DELETE" });
    await load();
  };

  const addSlide = async (storyId: number, imageUrl: string) => {
    const text = newSlideText[storyId];
    const res = await fetch(`/api/admin/stories/${storyId}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, caption: text?.caption || "", description: text?.description || "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setMsg(data?.message || "Не удалось добавить слайд");
      return;
    }
    setNewSlideText((prev) => ({ ...prev, [storyId]: { caption: "", description: "" } }));
    await load();
  };

  const saveSlideText = async (slideId: number) => {
    const text = slideEdits[slideId];
    if (!text) return;
    await fetch(`/api/admin/stories/slides/${slideId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: text.caption, description: text.description }),
    });
    await load();
  };

  const removeSlide = async (slideId: number) => {
    if (!confirm("Удалить слайд вместе с привязанными товарами?")) return;
    await fetch(`/api/admin/stories/slides/${slideId}`, { method: "DELETE" });
    if (openSlideId === slideId) setOpenSlideId(null);
    await load();
  };

  const replaceSlideImage = async (slideId: number, imageUrl: string) => {
    const res = await fetch(`/api/admin/stories/slides/${slideId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setMsg(data?.message || "Не удалось заменить фото");
      return;
    }
    await load();
  };

  const openSlideProducts = async (slideId: number) => {
    if (openSlideId === slideId) {
      setOpenSlideId(null);
      return;
    }
    setOpenSlideId(slideId);
    setSearch("");
    setSearchResults([]);
    setSlideProductsLoading(true);
    const res = await fetch(`/api/admin/stories/slides/${slideId}/products`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) setSlideProducts(data.products || []);
    setSlideProductsLoading(false);
  };

  const runSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const res = await fetch(`/api/admin/stories/products-search?q=${encodeURIComponent(q.trim())}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) setSearchResults(data.products || []);
    setSearching(false);
  };

  const attachProduct = async (productId: number) => {
    if (!openSlideId) return;
    const res = await fetch(`/api/admin/stories/slides/${openSlideId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setMsg(data?.message || "Не удалось привязать товар");
      return;
    }
    await openSlideProductsRefresh();
    await load();
  };

  const detachProduct = async (productId: number) => {
    if (!openSlideId) return;
    await fetch(`/api/admin/stories/slides/${openSlideId}/products`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    await openSlideProductsRefresh();
    await load();
  };

  const openSlideProductsRefresh = async () => {
    if (!openSlideId) return;
    const res = await fetch(`/api/admin/stories/slides/${openSlideId}/products`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) setSlideProducts(data.products || []);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Сторис</h2>
        <p className="text-xs text-black/50 mt-1">
          Сторис на главной странице. У каждого слайда можно привязать товары — они появятся в шторке
          «Товары из сторис».
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
        <div className="text-sm font-semibold mb-4">Создать сторис</div>
        {msg && <p className="text-sm text-red-600 mb-3">{msg}</p>}
        <div className="flex gap-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Название (напр. «Неделя Acne»)"
            className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <button
            onClick={createStory}
            className="rounded-full bg-black text-white px-4 py-2 text-xs font-semibold"
          >
            Создать
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-black/50">Загрузка...</p>
        ) : stories.length === 0 ? (
          <p className="text-sm text-black/50">Сторис не найдены</p>
        ) : (
          stories.map((story) => (
            <div key={story.id} className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{story.title}</div>
                  <div className="text-[11px] text-black/40 mt-0.5">
                    Порядок: {story.order} · {story.slides.length} слайд(ов)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(story.id, !story.isActive)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                      story.isActive ? "border-emerald-500 text-emerald-700" : "border-gray-300 text-gray-500"
                    }`}
                  >
                    {story.isActive ? "Активна" : "Выключена"}
                  </button>
                  <button
                    onClick={() => removeStory(story.id)}
                    className="rounded-full px-3 py-1 text-xs font-semibold border border-red-200 text-red-600"
                  >
                    Удалить
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {story.slides.map((slide) => (
                  <div key={slide.id} className="rounded-xl border border-black/10 p-2.5">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                        <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-black/60">Товаров: {slide.productCount}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => openSlideProducts(slide.id)}
                            className="rounded-full px-3 py-1 text-[11px] font-semibold border border-black/10 hover:bg-black hover:text-white transition"
                          >
                            {openSlideId === slide.id ? "Скрыть товары" : "Товары"}
                          </button>
                          <button
                            onClick={() => removeSlide(slide.id)}
                            className="rounded-full px-3 py-1 text-[11px] font-semibold border border-red-200 text-red-600"
                          >
                            Удалить слайд
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <ImageKitUploadField
                        label="Заменить фото"
                        hint="Заменит текущее фото слайда"
                        folder="/stories"
                        onUploaded={(url) => replaceSlideImage(slide.id, url)}
                      />
                    </div>

                    <div className="mt-2.5 space-y-1.5">
                      <input
                        value={slideEdits[slide.id]?.caption ?? slide.caption ?? ""}
                        onChange={(e) =>
                          setSlideEdits((prev) => ({
                            ...prev,
                            [slide.id]: {
                              caption: e.target.value,
                              description: prev[slide.id]?.description ?? slide.description ?? "",
                            },
                          }))
                        }
                        placeholder="Заголовок на слайде (опционально)"
                        className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs"
                      />
                      <textarea
                        value={slideEdits[slide.id]?.description ?? slide.description ?? ""}
                        onChange={(e) =>
                          setSlideEdits((prev) => ({
                            ...prev,
                            [slide.id]: {
                              caption: prev[slide.id]?.caption ?? slide.caption ?? "",
                              description: e.target.value,
                            },
                          }))
                        }
                        placeholder="Описание под заголовком (опционально)"
                        rows={2}
                        className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs resize-none"
                      />
                      <button
                        onClick={() => saveSlideText(slide.id)}
                        className="rounded-full px-3 py-1 text-[11px] font-semibold border border-black/10 hover:bg-black hover:text-white transition"
                      >
                        Сохранить текст
                      </button>
                    </div>

                    {openSlideId === slide.id && (
                      <div className="mt-3 border-t border-black/10 pt-3">
                        {slideProductsLoading ? (
                          <p className="text-xs text-black/50">Загрузка...</p>
                        ) : (
                          <div className="space-y-2 mb-3">
                            {slideProducts.length === 0 ? (
                              <p className="text-xs text-black/40">Товары ещё не привязаны</p>
                            ) : (
                              slideProducts.map((p) => (
                                <div key={p.id} className="flex items-center gap-2 text-xs">
                                  <div className="w-8 h-8 rounded overflow-hidden bg-neutral-100 shrink-0">
                                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex-1 min-w-0 truncate">
                                    {p.name} {p.brandName ? `· ${p.brandName}` : ""} · {formatPrice(p.price)}
                                  </div>
                                  <button
                                    onClick={() => detachProduct(p.id)}
                                    className="text-red-600 font-semibold shrink-0"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        <input
                          value={search}
                          onChange={(e) => runSearch(e.target.value)}
                          placeholder="Поиск товара по названию..."
                          className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs"
                        />
                        {searching && <p className="text-[11px] text-black/40 mt-1">Ищу...</p>}
                        {searchResults.length > 0 && (
                          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                            {searchResults.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => attachProduct(p.id)}
                                className="w-full flex items-center gap-2 text-xs rounded-lg border border-black/10 px-2 py-1.5 hover:border-black transition"
                              >
                                <div className="w-7 h-7 rounded overflow-hidden bg-neutral-100 shrink-0">
                                  <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                                <span className="flex-1 min-w-0 truncate text-left">
                                  {p.name} {p.brandName ? `· ${p.brandName}` : ""} · {formatPrice(p.price)}
                                </span>
                                <span className="text-emerald-700 font-semibold shrink-0">+</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <div className="rounded-xl border border-dashed border-black/15 p-2.5 space-y-1.5">
                  <input
                    value={newSlideText[story.id]?.caption ?? ""}
                    onChange={(e) =>
                      setNewSlideText((prev) => ({
                        ...prev,
                        [story.id]: { caption: e.target.value, description: prev[story.id]?.description ?? "" },
                      }))
                    }
                    placeholder="Заголовок нового слайда (опционально)"
                    className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs"
                  />
                  <textarea
                    value={newSlideText[story.id]?.description ?? ""}
                    onChange={(e) =>
                      setNewSlideText((prev) => ({
                        ...prev,
                        [story.id]: { caption: prev[story.id]?.caption ?? "", description: e.target.value },
                      }))
                    }
                    placeholder="Описание (опционально)"
                    rows={2}
                    className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs resize-none"
                  />
                  <div className="flex justify-center">
                    <ImageKitUploadField
                      label="Добавить слайд"
                      folder="/stories"
                      onUploaded={(url) => addSlide(story.id, url)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
