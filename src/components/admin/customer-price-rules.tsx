"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ListOption { id: string; name_en: string; name_ar: string; is_active: boolean }

export function CustomerPriceRules({ customerId, lists, lang }: { customerId: string; lists: ListOption[]; lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [listId, setListId] = useState("");
  const [message, setMessage] = useState("");
  const [override, setOverride] = useState({ variant_id: "", sellable_unit_id: "", amount_minor: "", reason: "" });
  async function call(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json();
    setMessage(response.ok ? (ar ? "تم الحفظ" : "Saved") : result.error ?? result.code ?? "Failed");
    if (response.ok) router.refresh();
  }
  return <div className="mt-2"><button className="text-xs font-semibold text-brand underline" onClick={() => setOpen((value) => !value)}>{ar ? "قواعد السعر" : "Price rules"}</button>{open ? <div className="mt-2 w-72 space-y-2 rounded-xl border border-border bg-white p-3 shadow-lg"><select className="input" value={listId} onChange={(event) => setListId(event.target.value)}><option value="">{ar ? "القائمة حسب النوع" : "Use type/default list"}</option>{lists.filter((list) => list.is_active).map((list) => <option key={list.id} value={list.id}>{ar ? list.name_ar : list.name_en}</option>)}</select><div className="flex gap-2"><button className="btn btn-secondary flex-1" onClick={() => call(`/api/admin/customers/${customerId}/price-list`, listId ? "PUT" : "DELETE", listId ? { price_list_id: listId } : undefined)}>{ar ? "حفظ القائمة" : "Save list"}</button></div><div className="border-t border-border pt-2"><input className="input" placeholder="Variant UUID" value={override.variant_id} onChange={(event) => setOverride({ ...override, variant_id: event.target.value })}/><input className="input mt-2" placeholder="Unit UUID" value={override.sellable_unit_id} onChange={(event) => setOverride({ ...override, sellable_unit_id: event.target.value })}/><input className="input mt-2" placeholder={ar ? "السعر بالقروش" : "Piastres"} value={override.amount_minor} onChange={(event) => setOverride({ ...override, amount_minor: event.target.value.replace(/\D/g, "") })}/><input className="input mt-2" placeholder={ar ? "السبب" : "Reason"} value={override.reason} onChange={(event) => setOverride({ ...override, reason: event.target.value })}/><button className="btn btn-secondary mt-2 w-full" onClick={() => call(`/api/admin/customers/${customerId}/price-overrides`, "POST", override)}>{ar ? "إضافة استثناء" : "Add override"}</button></div>{message ? <p className="text-xs text-fg-dim">{message}</p> : null}</div> : null}</div>;
}
