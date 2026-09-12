"use client";

import { useState } from "react";

export function PricingDiagnostic({ lang }: { lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const [form, setForm] = useState({ customer_id: "", variant_id: "", sellable_unit_id: "", at: "" });
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/pricing/diagnostics/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customer_id: form.customer_id || null, variant_id: form.variant_id, sellable_unit_id: form.sellable_unit_id, ...(form.at ? { at: new Date(form.at).toISOString() } : {}) }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? body.code ?? "Failed"); setResult(null); return; }
    setError(""); setResult(body);
  }
  return <section className="rounded-2xl border border-border bg-white p-5"><h2 className="font-semibold">{ar ? "تفسير السعر" : "Resolve and explain"}</h2><form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2"><input className="input" placeholder={ar ? "معرّف العميل (اختياري)" : "Customer UUID (optional)"} value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })}/><input required className="input" placeholder="Variant UUID" value={form.variant_id} onChange={(event) => setForm({ ...form, variant_id: event.target.value })}/><input required className="input" placeholder="Sellable Unit UUID" value={form.sellable_unit_id} onChange={(event) => setForm({ ...form, sellable_unit_id: event.target.value })}/><input type="datetime-local" className="input" value={form.at} onChange={(event) => setForm({ ...form, at: event.target.value })}/><button className="btn btn-primary md:col-span-2">{ar ? "حلّل السعر" : "Resolve price"}</button></form>{error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}{result ? <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(result, null, 2)}</pre> : null}</section>;
}
