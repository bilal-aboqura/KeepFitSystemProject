"use client";

import { useState } from "react";
import { Plus, Check, Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/admin/image-upload";
import { useToast } from "@/components/admin/toast";
import type { AdminSetting } from "@/lib/data/admin-crud";
import type { CategoryInfo } from "@/lib/data/catalog";

const KEY_DESCRIPTIONS: Record<string, { en: string; ar: string }> = {
  stat_customers: { en: "Total customers count", ar: "عدد العملاء الإجمالي" },
  stat_carwashes: { en: "Total car washes count", ar: "عدد غسلات السيارات" },
  stat_rating: { en: "Average customer rating", ar: "متوسط تقييم العملاء" },
  hero_title: { en: "Hero section title", ar: "عنوان القسم الرئيسي" },
  hero_subtitle: { en: "Hero section subtitle", ar: "العنوان الفرعي للقسم الرئيسي" },
  hero_marquee_cod: { en: "Hero marquee cash-on-delivery text", ar: "نص شريط الدفع عند الاستلام" },
  hero_marquee_returns: { en: "Hero marquee returns text", ar: "نص شريط الاسترجاع" },
  hero_marquee_made: { en: "Hero marquee made in Egypt text", ar: "نص شريط صناعة مصرية" },
  hero_marquee_shipping: { en: "Hero marquee shipping text", ar: "نص شريط الشحن" },
  hero_marquee_payments: { en: "Hero marquee payments text", ar: "نص شريط الدفع الإلكتروني" },
  about_text: { en: "About us text", ar: "نص من نحن" },
  footer_text: { en: "Footer text", ar: "نص التذييل" },
  contact_email: { en: "Contact email", ar: "البريد الإلكتروني للتواصل" },
  contact_phone: { en: "Contact phone number", ar: "رقم هاتف التواصل" },
};

const LABELS = {
  en: {
    save: "Save",
    saving: "Saving…",
    addSetting: "Add setting",
    addNew: "Add new setting",
    key: "Key",
    english: "English",
    arabic: "Arabic",
    cancel: "Cancel",
    create: "Create",
    creating: "Creating…",
    keyPlaceholder: "setting_key",
    valuePlaceholder: "Value",
  },
  ar: {
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    addSetting: "إضافة إعداد",
    addNew: "إضافة إعداد جديد",
    key: "المفتاح",
    english: "English",
    arabic: "Arabic",
    cancel: "إلغاء",
    create: "إنشاء",
    creating: "جارٍ الإنشاء…",
    keyPlaceholder: "setting_key",
    valuePlaceholder: "القيمة",
  },
};

function ValueField({
  value,
  onChange,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  dir?: "rtl";
}) {
  const isLong = value.length > 80;

  if (isLong) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        dir={dir}
        className={textareaCls}
      />
    );
  }

  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      dir={dir}
      className={inputCls}
    />
  );
}

export function SettingsEditor({
  settings,
  categories,
  lang,
}: {
  settings: AdminSetting[];
  categories: CategoryInfo[];
  lang: "en" | "ar";
}) {
  const [items, setItems] = useState(settings);
  const [categoryItems, setCategoryItems] = useState(categories);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValueEn, setNewValueEn] = useState("");
  const [newValueAr, setNewValueAr] = useState("");
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  const t = LABELS[lang];

  async function save(key: string) {
    setSaving(key);
    const item = items.find((i) => i.key === key);
    if (!item) return;
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  function update(key: string, field: "value_en" | "value_ar", value: string) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)),
    );
  }

  function updateCategory(id: string, image: string) {
    setCategoryItems((prev) =>
      prev.map((category) =>
        category.id === id ? { ...category, image: image || null } : category,
      ),
    );
  }

  async function saveCategory(id: string) {
    const item = categoryItems.find((category) => category.id === id);
    if (!item) return;

    setSavingCategoryId(id);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, image: item.image }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(lang === "ar" ? "تم حفظ الصورة" : "Image saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingCategoryId(null);
    }
  }

  async function createSetting() {
    const trimmedKey = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmedKey) return;
    if (items.some((i) => i.key === trimmedKey)) {
      toast.error(lang === "ar" ? "المفتاح موجود بالفعل" : "Key already exists");
      return;
    }

    setCreating(true);
    const newItem: AdminSetting = {
      key: trimmedKey,
      value_en: newValueEn,
      value_ar: newValueAr,
    };
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => [...prev, newItem]);
      setNewKey("");
      setNewValueEn("");
      setNewValueAr("");
      setShowAdd(false);
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {categoryItems.length > 0 && (
        <div className="glass p-4">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-fg">
              {lang === "ar" ? "صور خلفيات الأقسام" : "Category background images"}
            </h2>
            <p className="mt-1 text-xs text-fg-dim">
              {lang === "ar"
                ? "هذه الصور تظهر كخلفية كبيرة في صفحات الأقسام مثل Moto Care."
                : "These images appear as the large backgrounds on category pages like Moto Care."}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {categoryItems.map((category) => (
              <div
                key={category.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-fg">
                      {lang === "ar" ? category.name_ar : category.name_en}
                    </div>
                    <code className="mt-1 inline-block rounded bg-white/10 px-2 py-0.5 text-[11px] text-fg-muted">
                      {category.slug}
                    </code>
                  </div>
                  <button
                    onClick={() => saveCategory(category.id)}
                    disabled={savingCategoryId === category.id}
                    className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {savingCategoryId === category.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    {savingCategoryId === category.id ? t.saving : t.save}
                  </button>
                </div>

                <ImageUpload
                  value={category.image ?? ""}
                  onChange={(url) => updateCategory(category.id, url)}
                  label={lang === "ar" ? "صورة الخلفية" : "Background image"}
                  lang={lang}
                  aspectRatio={16 / 9}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {items.map((s) => {
        const desc = KEY_DESCRIPTIONS[s.key];
        return (
          <div key={s.key} className="glass p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <code className="rounded bg-white/10 px-2 py-0.5 text-xs text-fg-muted">
                  {s.key}
                </code>
                {desc && (
                  <span className="text-xs text-fg-dim">
                    {lang === "ar" ? desc.ar : desc.en}
                  </span>
                )}
              </div>
              <button
                onClick={() => save(s.key)}
                disabled={saving === s.key}
                className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Check size={12} />
                {saving === s.key ? t.saving : t.save}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-fg-dim">{t.english}</span>
                <ValueField
                  value={s.value_en}
                  onChange={(v) => update(s.key, "value_en", v)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-fg-dim">{t.arabic}</span>
                <ValueField
                  value={s.value_ar}
                  onChange={(v) => update(s.key, "value_ar", v)}
                  dir="rtl"
                />
              </label>
            </div>
          </div>
        );
      })}

      {showAdd ? (
        <div className="glass p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg">{t.addNew}</h3>
          <div className="mb-3">
            <label className="block">
              <span className="mb-1 block text-xs text-fg-dim">{t.key}</span>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder={t.keyPlaceholder}
                className={inputCls}
              />
            </label>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-fg-dim">{t.english}</span>
              <ValueField
                value={newValueEn}
                onChange={setNewValueEn}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-fg-dim">{t.arabic}</span>
              <ValueField
                value={newValueAr}
                onChange={setNewValueAr}
                dir="rtl"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={createSetting}
              disabled={creating || !newKey.trim()}
              className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Check size={12} />
              {creating ? t.creating : t.create}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewKey("");
                setNewValueEn("");
                setNewValueAr("");
              }}
              className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-fg-muted hover:bg-white/5"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-white/20 px-4 py-2 text-xs font-semibold text-fg-muted hover:border-brand hover:text-brand"
        >
          <Plus size={14} />
          {t.addSetting}
        </button>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-fg outline-none focus:border-brand";

const textareaCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-fg outline-none focus:border-brand resize-y";
