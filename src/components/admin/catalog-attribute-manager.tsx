"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AttributeDefinition } from "@/lib/catalog/types";
import { useToast } from "./toast";

export function CatalogAttributeManager({ initialAttributes, lang }: { initialAttributes: (AttributeDefinition & { values?: { id: string; label_en: string; label_ar: string }[] })[]; lang: "en" | "ar" }) {
  const router = useRouter();
  const toast = useToast();
  const ar = lang === "ar";
  const [form, setForm] = useState({ code: "", label_en: "", label_ar: "", value_type: "option", unit: "", is_variant_defining: false, is_filterable: false });
  const [valueForm, setValueForm] = useState({ attribute_definition_id: "", code: "", label_en: "", label_ar: "" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/catalog/attributes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "definition", data: { ...form, unit: form.unit || null, is_visible: true, is_active: true, sort_order: initialAttributes.length } }) });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error || "Could not create attribute");
    toast.success(ar ? "تم إنشاء الخاصية" : "Attribute created");
    setForm({ code: "", label_en: "", label_ar: "", value_type: "option", unit: "", is_variant_defining: false, is_filterable: false });
    router.refresh();
  }

  async function submitValue(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/catalog/attributes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "value", data: { ...valueForm, sort_order: 0, is_active: true } }) });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error || "Could not create value");
    toast.success(ar ? "تم إنشاء القيمة" : "Value created");
    setValueForm({ attribute_definition_id: "", code: "", label_en: "", label_ar: "" });
    router.refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-3">{initialAttributes.map((attribute) => <article key={attribute.id} className="rounded-2xl border border-border bg-white p-5"><div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold text-fg">{ar ? attribute.label_ar : attribute.label_en}</h3><p className="text-xs text-fg-dim">{attribute.code} · {attribute.value_type}</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="pill pill-neutral">{attribute.is_variant_defining ? (ar ? "يحدد الخيار" : "Variant") : (ar ? "معلومة" : "Specification")}</span>{attribute.is_filterable && <span className="pill pill-info">{ar ? "فلتر" : "Filter"}</span>}</div></div></article>)}</div>
      <div className="space-y-4"><form onSubmit={submit} className="h-fit space-y-3 rounded-2xl border border-border bg-white p-5">
        <h2 className="font-semibold text-fg">{ar ? "خاصية جديدة" : "New attribute"}</h2>
        <input required placeholder="weight" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className={inputClass} />
        <input required placeholder="English label" value={form.label_en} onChange={(event) => setForm({ ...form, label_en: event.target.value })} className={inputClass} />
        <input required dir="rtl" placeholder="الاسم العربي" value={form.label_ar} onChange={(event) => setForm({ ...form, label_ar: event.target.value })} className={inputClass} />
        <select value={form.value_type} onChange={(event) => setForm({ ...form, value_type: event.target.value })} className={inputClass}><option value="option">Option</option><option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option></select>
        <input placeholder={ar ? "الوحدة (اختياري)" : "Unit (optional)"} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} className={inputClass} />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.is_variant_defining} onChange={(event) => setForm({ ...form, is_variant_defining: event.target.checked })} />{ar ? "خاصية خيار" : "Variant defining"}</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.is_filterable} onChange={(event) => setForm({ ...form, is_filterable: event.target.checked })} />{ar ? "قابلة للفلترة" : "Filterable"}</label>
        <button className="btn btn-primary w-full">{ar ? "إنشاء" : "Create"}</button>
      </form><form onSubmit={submitValue} className="space-y-3 rounded-2xl border border-border bg-white p-5"><h2 className="font-semibold text-fg">{ar ? "قيمة اختيار جديدة" : "New option value"}</h2><select required value={valueForm.attribute_definition_id} onChange={(event) => setValueForm({ ...valueForm, attribute_definition_id: event.target.value })} className={inputClass}><option value="">{ar ? "اختر الخاصية" : "Choose attribute"}</option>{initialAttributes.filter((attribute) => attribute.value_type === "option").map((attribute) => <option key={attribute.id} value={attribute.id}>{ar ? attribute.label_ar : attribute.label_en}</option>)}</select><input required placeholder="code" value={valueForm.code} onChange={(event) => setValueForm({ ...valueForm, code: event.target.value })} className={inputClass}/><input required placeholder="English label" value={valueForm.label_en} onChange={(event) => setValueForm({ ...valueForm, label_en: event.target.value })} className={inputClass}/><input required dir="rtl" placeholder="الاسم العربي" value={valueForm.label_ar} onChange={(event) => setValueForm({ ...valueForm, label_ar: event.target.value })} className={inputClass}/><button className="btn btn-secondary w-full">{ar ? "إضافة القيمة" : "Add value"}</button></form></div>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-brand";
