"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/admin/toast";
import type { CategoryInfo } from "@/lib/data/catalog";

export interface ProductFormData {
  id?: string;
  name_en: string;
  name_ar: string;
  slug: string;
  sku: string;
  category_id: string;
  price: number;
  compare_at_price: string;
  stock: number;
  is_active: boolean;
  is_featured: boolean;
  images: string;
  short_desc_en: string;
  short_desc_ar: string;
  long_desc_en: string;
  long_desc_ar: string;
  weight: string;
}

const labels: Record<string, { en: string; ar: string }> = {
  name_en:           { en: "Name (English)",              ar: "الاسم (إنجليزي)" },
  name_ar:           { en: "Name (Arabic)",               ar: "الاسم (عربي)" },
  slug:              { en: "Slug (optional)",              ar: "الرابط (اختياري)" },
  sku:               { en: "SKU",                         ar: "SKU" },
  category:          { en: "Category",                    ar: "الفئة" },
  weight:            { en: "Weight / Size",               ar: "الوزن / الحجم" },
  price:             { en: "Price (EGP)",                 ar: "السعر (ج.م)" },
  compare_at_price:  { en: "Compare at price (optional)", ar: "سعر المقارنة (اختياري)" },
  stock:             { en: "Stock",                       ar: "المخزون" },
  active:            { en: "Active",                      ar: "نشط" },
  featured:          { en: "Featured",                    ar: "مميز" },
  images:            { en: "Image URLs (one per line)",   ar: "روابط الصور (واحد في كل سطر)" },
  short_desc_en:     { en: "Short description (English)", ar: "وصف مختصر (إنجليزي)" },
  short_desc_ar:     { en: "Short description (Arabic)",  ar: "وصف مختصر (عربي)" },
  long_desc_en:      { en: "Long description (English)",  ar: "وصف تفصيلي (إنجليزي)" },
  long_desc_ar:      { en: "Long description (Arabic)",   ar: "وصف تفصيلي (عربي)" },
  save:              { en: "Save changes",                ar: "حفظ التغييرات" },
  create:            { en: "Create product",              ar: "إنشاء منتج" },
  delete:            { en: "Delete",                      ar: "حذف" },
  saving:            { en: "Saving…",                     ar: "جارٍ الحفظ…" },
};

function t(key: string, lang: "en" | "ar") {
  return labels[key]?.[lang] ?? key;
}

export function ProductForm({
  initial,
  categories,
  lang,
}: {
  initial: ProductFormData;
  categories: CategoryInfo[];
  lang: "en" | "ar";
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(initial.id);

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const imageUrls = form.images
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...(isEdit ? { id: form.id } : {}),
      name_en: form.name_en,
      name_ar: form.name_ar,
      slug: form.slug || undefined,
      sku: form.sku || null,
      category_id: form.category_id || null,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      stock: Number(form.stock),
      is_active: form.is_active,
      is_featured: form.is_featured,
      images: form.images
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      short_desc_en: form.short_desc_en,
      short_desc_ar: form.short_desc_ar,
      long_desc_en: form.long_desc_en,
      long_desc_ar: form.long_desc_ar,
      weight: form.weight || null,
    };

    try {
      const res = await fetch("/api/admin/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Failed");
      toast.success(isEdit ? (lang === "ar" ? "تم حفظ المنتج" : "Product saved") : (lang === "ar" ? "تم إنشاء المنتج" : "Product created"));
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !form.id) return;
    if (!confirm(lang === "ar" ? "حذف هذا المنتج؟ لا يمكن التراجع." : "Delete this product? This cannot be undone.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products?id=${form.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(lang === "ar" ? "تم حذف المنتج" : "Product deleted");
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error(message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir={lang === "ar" ? "rtl" : undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("name_en", lang)}>
          <input required value={form.name_en} onChange={(e) => set("name_en", e.target.value)} className={inputCls} />
        </Field>
        <Field label={t("name_ar", lang)}>
          <input required value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} className={inputCls} dir="rtl" />
        </Field>
        <Field label={t("slug", lang)}>
          <input value={form.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls} placeholder="auto-generated" />
        </Field>
        <Field label={t("sku", lang)}>
          <input value={form.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} />
        </Field>
        <Field label={t("category", lang)}>
          <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)} className={inputCls}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name_en} / {c.name_ar}</option>
            ))}
          </select>
        </Field>
        <Field label={t("weight", lang)}>
          <input value={form.weight} onChange={(e) => set("weight", e.target.value)} className={inputCls} placeholder="e.g. 1L, 4kg" />
        </Field>
        <Field label={t("price", lang)}>
          <input required type="number" step="0.01" value={form.price} onChange={(e) => set("price", Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label={t("compare_at_price", lang)}>
          <input type="number" step="0.01" value={form.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value)} className={inputCls} />
        </Field>
        <Field label={t("stock", lang)}>
          <input required type="number" value={form.stock} onChange={(e) => set("stock", Number(e.target.value))} className={inputCls} />
        </Field>
        <div className="flex items-center gap-6 pt-6">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="accent-brand" />
            {t("active", lang)}
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="accent-brand" />
            {t("featured", lang)}
          </label>
        </div>
      </div>

      <Field label={t("images", lang)}>
        <textarea rows={3} value={form.images} onChange={(e) => set("images", e.target.value)} className={inputCls} placeholder="/images/gold_1l.webp&#10;One URL per line, or use upload below" />
      </Field>
      <ProductImageUpload
        lang={lang}
        onUpload={(url) => {
          const current = form.images.trim();
          set("images", current ? `${current}\n${url}` : url);
        }}
      />
      {imageUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imageUrls.map((url, i) => (
            <div key={`${url}-${i}`} className="relative h-[60px] w-[60px] overflow-hidden rounded-lg border border-white/10">
              <Image src={url} alt="" fill sizes="60px" className="object-cover" />
              <button
                type="button"
                onClick={() => {
                  const updated = imageUrls.filter((_, idx) => idx !== i).join("\n");
                  set("images", updated);
                }}
                className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-black/60 text-[8px] text-white/80 hover:bg-black/80"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <Field label={t("short_desc_en", lang)}>
        <textarea rows={2} value={form.short_desc_en} onChange={(e) => set("short_desc_en", e.target.value)} className={inputCls} />
      </Field>
      <Field label={t("short_desc_ar", lang)}>
        <textarea rows={2} value={form.short_desc_ar} onChange={(e) => set("short_desc_ar", e.target.value)} className={inputCls} dir="rtl" />
      </Field>
      <Field label={t("long_desc_en", lang)}>
        <textarea rows={5} value={form.long_desc_en} onChange={(e) => set("long_desc_en", e.target.value)} className={inputCls} />
      </Field>
      <Field label={t("long_desc_ar", lang)}>
        <textarea rows={5} value={form.long_desc_ar} onChange={(e) => set("long_desc_ar", e.target.value)} className={inputCls} dir="rtl" />
      </Field>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50">
          {saving ? t("saving", lang) : isEdit ? t("save", lang) : t("create", lang)}
        </button>
        {isEdit && (
          <button type="button" onClick={handleDelete} disabled={saving} className="rounded-full border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10">
            {t("delete", lang)}
          </button>
        )}
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-fg outline-none focus:border-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">{label}</span>
      {children}
    </label>
  );
}

function ProductImageUpload({ lang, onUpload }: { lang: "en" | "ar"; onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.url) onUpload(data.url);
    } catch {
      // silent — user can paste URL manually
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-fg-muted transition hover:border-brand/40 hover:text-fg disabled:opacity-50"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading
          ? (lang === "ar" ? "جارٍ الرفع..." : "Uploading...")
          : (lang === "ar" ? "ارفع صورة جديدة" : "Upload new image")}
      </button>
    </>
  );
}
