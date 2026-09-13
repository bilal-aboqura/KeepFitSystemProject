"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Rule {
  id: string;
  context_kind: "public" | "customer_type";
  customer_type_id: string | null;
  variant_id: string;
  sellable_unit_id: string;
  minimum_quantity: number;
  quantity_increment: number;
  is_active: boolean;
  variant?: { sku?: string; label_en?: string; label_ar?: string; product?: { name_en?: string; name_ar?: string } };
  unit?: { code?: string; label_en?: string; label_ar?: string };
  customer_type?: { code?: string; name_en?: string; name_ar?: string };
}

interface TargetProduct { id: string; name_en: string; name_ar: string; variants: Array<{ id: string; sku: string; label_en: string; label_ar: string; units: Array<{ id: string; code: string | null; label_en: string; label_ar: string; is_sellable: boolean; is_active: boolean; archived_at: string | null }> }> }
interface CustomerType { id: string; code: string; name_en: string; name_ar: string }

export function QuantityRuleManager({ rules, products, customerTypes, lang }: { rules: Rule[]; products: TargetProduct[]; customerTypes: CustomerType[]; lang: "en" | "ar" }) {
  const router = useRouter();
  const ar = lang === "ar";
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ contextKind: "public", customerTypeId: "", variantId: "", sellableUnitId: "", minimumQuantity: 1, quantityIncrement: 1, reason: "" });
  const variants = products.flatMap((product) => product.variants.map((variant) => ({ ...variant, product })));
  const selectedVariant = variants.find((variant) => variant.id === form.variantId);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/admin/commerce/quantity-rules", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
      context: form.contextKind === "public" ? { kind: "public" } : { kind: "customer_type", customerTypeId: form.customerTypeId },
      variantId: form.variantId, sellableUnitId: form.sellableUnitId, minimumQuantity: form.minimumQuantity, quantityIncrement: form.quantityIncrement, reason: form.reason,
    }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(body.error?.message ?? (ar ? "تعذر حفظ القاعدة." : "Could not save the rule.")); return; }
    setMessage(ar ? "تم حفظ القاعدة واستبدال القاعدة السابقة بأمان." : "Rule saved; any prior active rule was safely replaced.");
    router.refresh();
  }

  async function archive(id: string) {
    const reason = window.prompt(ar ? "سبب الأرشفة" : "Archive reason");
    if (!reason) return;
    const response = await fetch(`/api/admin/commerce/quantity-rules/${id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
    if (response.ok) router.refresh();
  }

  return <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
    <form onSubmit={save} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-fg">{ar ? "تعيين قاعدة شراء" : "Set purchase rule"}</h2>
      <div className="mt-4 grid gap-3">
        <label className="text-sm text-fg-muted">{ar ? "السياق" : "Context"}<select className="input mt-1" value={form.contextKind} onChange={(event) => setForm({ ...form, contextKind: event.target.value, customerTypeId: "" })}><option value="public">{ar ? "عام" : "Public"}</option><option value="customer_type">{ar ? "نوع عميل" : "Customer type"}</option></select></label>
        {form.contextKind === "customer_type" && <label className="text-sm text-fg-muted">{ar ? "نوع العميل" : "Customer type"}<select required className="input mt-1" value={form.customerTypeId} onChange={(event) => setForm({ ...form, customerTypeId: event.target.value })}><option value="">—</option>{customerTypes.map((type) => <option key={type.id} value={type.id}>{ar ? type.name_ar : type.name_en}</option>)}</select></label>}
        <label className="text-sm text-fg-muted">{ar ? "المنتج / المتغير" : "Product / Variant"}<select required className="input mt-1" value={form.variantId} onChange={(event) => setForm({ ...form, variantId: event.target.value, sellableUnitId: "" })}><option value="">—</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{ar ? variant.product.name_ar : variant.product.name_en} · {variant.sku} · {ar ? variant.label_ar : variant.label_en}</option>)}</select></label>
        <label className="text-sm text-fg-muted">{ar ? "وحدة البيع" : "Sellable Unit"}<select required className="input mt-1" value={form.sellableUnitId} onChange={(event) => setForm({ ...form, sellableUnitId: event.target.value })}><option value="">—</option>{selectedVariant?.units.filter((unit) => unit.is_sellable && unit.is_active && !unit.archived_at).map((unit) => <option key={unit.id} value={unit.id}>{ar ? unit.label_ar : unit.label_en}{unit.code ? ` · ${unit.code}` : ""}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm text-fg-muted">{ar ? "الحد الأدنى" : "Minimum"}<input required type="number" min="1" className="input mt-1" value={form.minimumQuantity} onChange={(event) => setForm({ ...form, minimumQuantity: Number(event.target.value) })}/></label><label className="text-sm text-fg-muted">{ar ? "الزيادة" : "Increment"}<input required type="number" min="1" className="input mt-1" value={form.quantityIncrement} onChange={(event) => setForm({ ...form, quantityIncrement: Number(event.target.value) })}/></label></div>
        <label className="text-sm text-fg-muted">{ar ? "سبب التغيير" : "Change reason"}<textarea required className="input mt-1" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}/></label>
        <button disabled={saving} className="btn btn-primary">{saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ القاعدة" : "Save rule")}</button>
        {message && <p role="status" className="text-sm text-fg-muted">{message}</p>}
      </div>
    </form>
    <div className="overflow-x-auto rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-fg">{ar ? "القواعد المخزنة" : "Stored rules"}</h2>
      <p className="mt-1 text-sm text-fg-dim">{ar ? "أي هدف غير ظاهر يستخدم قاعدة 1 / 1 الافتراضية." : "Any target not listed uses the explicit 1 / 1 fallback."}</p>
      <table className="mt-4 w-full text-sm"><thead><tr className="text-left text-fg-dim"><th className="p-2">{ar ? "المنتج / الوحدة" : "Product / unit"}</th><th className="p-2">{ar ? "السياق" : "Context"}</th><th className="p-2">{ar ? "الحد / الزيادة" : "Min / step"}</th><th className="p-2"/></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id} className="border-t border-border"><td className="p-2"><strong>{rule.variant?.product?.name_en ?? rule.variant_id}</strong><span className="block text-xs text-fg-dim">{rule.variant?.sku} · {rule.unit?.label_en ?? rule.sellable_unit_id}</span></td><td className="p-2">{rule.context_kind === "public" ? "Public" : rule.customer_type?.name_en ?? rule.customer_type_id}</td><td className="p-2 tabular-nums">{rule.minimum_quantity} / {rule.quantity_increment}</td><td className="p-2"><button onClick={() => archive(rule.id)} className="text-red-700 underline">{ar ? "أرشفة" : "Archive"}</button></td></tr>)}</tbody></table>
    </div>
  </div>;
}
