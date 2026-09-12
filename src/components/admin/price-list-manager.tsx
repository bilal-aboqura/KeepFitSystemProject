"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "./toast";

interface PriceListRow { id: string; code: string; name_en: string; name_ar: string; is_active: boolean; archived_at: string | null; pricing_configuration?: { version: number }[] }
interface TypeMapping { id: string; code: string; name_en: string; name_ar: string; mapping?: { price_list_id: string; is_active: boolean; archived_at: string | null }[] }

export function PriceListManager({ lists, mappings, lang }: { lists: PriceListRow[]; mappings: TypeMapping[]; lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ code: "", name_en: "", name_ar: "" });
  const [busy, setBusy] = useState(false);

  async function request(url: string, method: string, body: unknown) {
    setBusy(true);
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? result.code ?? "Pricing command failed");
      toast.success(ar ? "تم حفظ إعدادات التسعير" : "Pricing configuration saved");
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pricing command failed");
      return false;
    } finally { setBusy(false); }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (await request("/api/admin/pricing/lists", "POST", { ...form, currency: "EGP", is_active: true })) setForm({ code: "", name_en: "", name_ar: "" });
  }

  return <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {lists.map((list) => <article key={list.id} className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-fg">{ar ? list.name_ar : list.name_en}</h2><p className="mt-1 font-mono text-xs text-fg-dim">{list.code}</p></div><span className={list.pricing_configuration?.length ? "pill pill-success" : list.is_active ? "pill pill-info" : "pill pill-neutral"}>{list.pricing_configuration?.length ? (ar ? "افتراضي" : "Default") : list.is_active ? (ar ? "نشط" : "Active") : (ar ? "مؤرشف" : "Archived")}</span></div>
          <div className="mt-4 flex flex-wrap gap-2"><Link className="btn btn-secondary" href={`/admin/pricing/lists/${list.id}`}>{ar ? "إدارة الأسعار" : "Manage prices"}</Link>{list.is_active && !list.pricing_configuration?.length ? <button disabled={busy} className="btn btn-secondary" onClick={() => request("/api/admin/pricing/default", "PUT", { price_list_id: list.id })}>{ar ? "اجعله افتراضيًا" : "Make default"}</button> : null}</div>
        </article>)}
      </div>
      <section className="rounded-2xl border border-border bg-white p-5"><h2 className="font-semibold text-fg">{ar ? "ربط أنواع العملاء" : "Customer Type mappings"}</h2><div className="mt-4 space-y-3">{mappings.map((type) => {
        const current = type.mapping?.find((mapping) => mapping.is_active && !mapping.archived_at)?.price_list_id ?? "";
        return <label key={type.id} className="grid gap-2 sm:grid-cols-[1fr_240px] sm:items-center"><span className="text-sm text-fg">{ar ? type.name_ar : type.name_en}</span><select defaultValue={current} disabled={busy} className="input" onChange={(event) => request("/api/admin/pricing/customer-type-mappings", "PUT", { customer_type_id: type.id, price_list_id: event.target.value || null })}><option value="">{ar ? "بدون قائمة مخصصة" : "No mapped list"}</option>{lists.filter((list) => list.is_active).map((list) => <option key={list.id} value={list.id}>{ar ? list.name_ar : list.name_en}</option>)}</select></label>;
      })}</div></section>
    </div>
    <form onSubmit={create} className="h-fit space-y-3 rounded-2xl border border-border bg-white p-5"><h2 className="font-semibold text-fg">{ar ? "قائمة أسعار جديدة" : "New Price List"}</h2><input required className="input" placeholder="retail-cairo" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}/><input required className="input" placeholder="English name" value={form.name_en} onChange={(event) => setForm({ ...form, name_en: event.target.value })}/><input required dir="rtl" className="input" placeholder="الاسم العربي" value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })}/><button disabled={busy} className="btn btn-primary w-full">{ar ? "إنشاء القائمة" : "Create list"}</button></form>
  </div>;
}
