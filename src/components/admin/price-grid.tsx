"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast";

interface PriceItem { id: string; variant_id: string; sellable_unit_id: string; amount_minor: string; valid_from: string | null; valid_until: string | null; is_active: boolean; variant?: { sku?: string; label_en?: string; label_ar?: string }; unit?: { code?: string | null; label_en?: string; label_ar?: string } }

export function PriceGrid({ listId, items, lang }: { listId: string; items: PriceItem[]; lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ variant_id: "", sellable_unit_id: "", amount_minor: "", valid_from: "", valid_until: "", close_prior_at_start: true });
  const filtered = useMemo(() => items.filter((item) => `${item.variant?.sku ?? ""} ${item.variant?.label_en ?? ""} ${item.unit?.label_en ?? ""}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/admin/pricing/lists/${listId}/items/schedule`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null, valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null }) });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error ?? result.code ?? "Save failed");
    toast.success(ar ? "تم حفظ السعر" : "Price saved");
    setForm({ variant_id: "", sellable_unit_id: "", amount_minor: "", valid_from: "", valid_until: "", close_prior_at_start: true });
    router.refresh();
  }

  return <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
    <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="border-b border-border p-4"><input className="input" placeholder={ar ? "بحث بالـ SKU أو الوحدة" : "Search SKU or unit"} value={query} onChange={(event) => setQuery(event.target.value)}/></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-start text-xs text-fg-dim"><th className="p-4">SKU</th><th className="p-4">{ar ? "الوحدة" : "Unit"}</th><th className="p-4">{ar ? "السعر" : "Price"}</th><th className="p-4">{ar ? "الفترة" : "Period"}</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-b border-border/70"><td className="p-4 font-mono">{item.variant?.sku ?? item.variant_id}</td><td className="p-4">{ar ? item.unit?.label_ar : item.unit?.label_en}</td><td className="p-4 font-semibold text-brand">{(Number(item.amount_minor) / 100).toFixed(2)} EGP</td><td className="p-4 text-xs text-fg-dim">{item.valid_from ? new Date(item.valid_from).toLocaleString() : "−∞"} → {item.valid_until ? new Date(item.valid_until).toLocaleString() : "+∞"}</td></tr>)}</tbody></table></div></section>
    <form onSubmit={save} className="h-fit space-y-3 rounded-2xl border border-border bg-white p-5"><h2 className="font-semibold">{ar ? "سعر صريح / مجدول" : "Explicit / scheduled price"}</h2><input required className="input" placeholder="Variant UUID" value={form.variant_id} onChange={(event) => setForm({ ...form, variant_id: event.target.value })}/><input required className="input" placeholder="Sellable Unit UUID" value={form.sellable_unit_id} onChange={(event) => setForm({ ...form, sellable_unit_id: event.target.value })}/><input required inputMode="numeric" className="input" placeholder={ar ? "السعر بالقروش" : "Amount in piastres"} value={form.amount_minor} onChange={(event) => setForm({ ...form, amount_minor: event.target.value.replace(/\D/g, "") })}/><label className="block text-xs text-fg-dim">{ar ? "يبدأ" : "Starts"}<input type="datetime-local" className="input mt-1" value={form.valid_from} onChange={(event) => setForm({ ...form, valid_from: event.target.value })}/></label><label className="block text-xs text-fg-dim">{ar ? "ينتهي (حصري)" : "Ends (exclusive)"}<input type="datetime-local" className="input mt-1" value={form.valid_until} onChange={(event) => setForm({ ...form, valid_until: event.target.value })}/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.close_prior_at_start} onChange={(event) => setForm({ ...form, close_prior_at_start: event.target.checked })}/>{ar ? "إغلاق الفترة السابقة عند البداية" : "Close prior period at start"}</label><button className="btn btn-primary w-full">{ar ? "حفظ السعر" : "Save price"}</button></form>
  </div>;
}
