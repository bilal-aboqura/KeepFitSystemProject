"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast";
import { normalizeCatalogSlug } from "@/lib/catalog/slug";
import { catalogApiErrorMessage } from "@/lib/catalog/client-errors";

interface Entity { id: string; slug: string; name_en: string; name_ar: string; is_active: boolean }

export function CatalogEntityManager({ kind, entities, lang }: { kind: "brands" | "categories"; entities: Entity[]; lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ slug: "", name_en: "", name_ar: "" });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const slug = normalizeCatalogSlug(form.slug) || normalizeCatalogSlug(form.name_en);
    const normalizedForm = { ...form, slug };
    const data = kind === "brands" ? { ...normalizedForm, description_en: "", description_ar: "", is_active: true } : { ...normalizedForm, image: null, parent_id: null, is_active: true, sort_order: entities.length };
    const response = await fetch(`/api/admin/catalog/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) return toast.error(catalogApiErrorMessage(result, lang, ar ? "تعذر الحفظ" : "Could not save"));
    toast.success(ar ? "تم الحفظ" : "Saved");
    setForm({ slug: "", name_en: "", name_ar: "" });
    router.refresh();
  }
  return <div className="grid gap-5 xl:grid-cols-[1fr_360px]"><div className="grid gap-3 sm:grid-cols-2">{entities.map((entity) => <article key={entity.id} className="rounded-2xl border border-border bg-white p-5"><h3 className="font-semibold text-fg">{ar ? entity.name_ar : entity.name_en}</h3><p className="mt-1 text-xs text-fg-dim">{entity.slug}</p><span className={entity.is_active ? "pill pill-success mt-3" : "pill pill-neutral mt-3"}>{entity.is_active ? (ar ? "نشط" : "Active") : (ar ? "مؤرشف" : "Archived")}</span></article>)}</div><form onSubmit={submit} className="h-fit space-y-3 rounded-2xl border border-border bg-white p-5"><h2 className="font-semibold text-fg">{ar ? "إضافة جديد" : `New ${kind === "brands" ? "brand" : "category"}`}</h2><input placeholder={ar ? "الرابط الإنجليزي — يُنشأ تلقائيًا" : "URL slug — generated automatically"} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} onBlur={() => setForm((current) => ({ ...current, slug: normalizeCatalogSlug(current.slug) || normalizeCatalogSlug(current.name_en) }))} className={inputClass}/><p className="text-[11px] text-fg-dim">{ar ? "يمكن تركه فارغًا؛ سيُنشأ من الاسم الإنجليزي." : "Leave blank to generate it from the English name."}</p><input required placeholder="English name" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className={inputClass}/><input required dir="rtl" placeholder="الاسم العربي" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} className={inputClass}/><button className="btn btn-primary w-full">{ar ? "إنشاء" : "Create"}</button></form></div>;
}

const inputClass = "min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-brand";
