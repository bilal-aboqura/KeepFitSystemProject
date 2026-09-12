"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import type { CatalogPackagingUnit, CatalogPackagingUnitInput } from "@/lib/catalog/types";
import { useToast } from "./toast";

const inputClass = "min-h-11 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand disabled:bg-slate-100";

function editable(unit: CatalogPackagingUnit): CatalogPackagingUnitInput {
  return {
    id: unit.id, parent_unit_id: unit.parent_unit_id, code: unit.code, barcode: unit.barcode,
    label_en: unit.label_en, label_ar: unit.label_ar, quantity_per_parent: unit.quantity_per_parent,
    is_base_unit: unit.is_base_unit, is_sellable: unit.is_sellable,
    is_default_sale_unit: unit.is_default_sale_unit, default_price_mode: unit.default_price_mode,
    is_active: true,
  };
}

export function CatalogPackagingEditor({ variantId, initialUnits, lang }: {
  variantId: string;
  initialUnits: CatalogPackagingUnit[];
  lang: "en" | "ar";
}) {
  const ar = lang === "ar";
  const toast = useToast();
  const [units, setUnits] = useState<CatalogPackagingUnitInput[]>(initialUnits.filter((unit) => unit.is_active).map(editable));
  const [saving, setSaving] = useState(false);

  function update(id: string, patch: Partial<CatalogPackagingUnitInput>) {
    setUnits((current) => current.map((unit) => unit.id === id ? { ...unit, ...patch } : unit));
  }

  function addUnit() {
    const parent = units.at(-1);
    setUnits((current) => [...current, {
      id: crypto.randomUUID(), parent_unit_id: parent?.id ?? null, code: null, barcode: null,
      label_en: "", label_ar: "", quantity_per_parent: { numerator: parent ? 1 : 1, denominator: 1 },
      is_base_unit: current.length === 0, is_sellable: true, is_default_sale_unit: current.length === 0,
      default_price_mode: current.length === 0 ? "explicit" : "derived", is_active: true,
    }]);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/catalog/variants/${variantId}/packaging`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(units),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save packaging");
      setUnits((result.units as CatalogPackagingUnit[]).map(editable));
      toast.success(ar ? "تم حفظ وحدات التعبئة" : "Packaging units saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save packaging");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">{ar ? "التعبئة ووحدات البيع" : "Packaging and sellable units"}</h3>
          <p className="mt-1 text-xs text-fg-dim">{ar ? "عرّف التسلسل من العبوة الأكبر إلى أصغر وحدة، وحدد الوحدات المسموح ببيعها." : "Define the chain from the largest package to the base unit, then choose which levels are sellable."}</p>
        </div>
        <button type="button" onClick={addUnit} className="btn btn-secondary min-h-11 gap-2"><Plus size={15} />{ar ? "إضافة مستوى" : "Add level"}</button>
      </div>

      <div className="mt-4 space-y-3">
        {units.map((unit, index) => (
          <article key={unit.id} className="rounded-xl border border-border bg-slate-50 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={ar ? "الاسم بالإنجليزية" : "English label"}><input required value={unit.label_en} onChange={(event) => update(unit.id, { label_en: event.target.value })} className={inputClass} /></Field>
              <Field label={ar ? "الاسم بالعربية" : "Arabic label"}><input required dir="rtl" value={unit.label_ar} onChange={(event) => update(unit.id, { label_ar: event.target.value })} className={inputClass} /></Field>
              <Field label={ar ? "الكود التشغيلي (اختياري)" : "Operational code (optional)"}><input value={unit.code ?? ""} onChange={(event) => update(unit.id, { code: event.target.value || null })} className={inputClass} /></Field>
              <Field label={ar ? "موجود داخل" : "Contained in"}><select value={unit.parent_unit_id ?? ""} onChange={(event) => update(unit.id, { parent_unit_id: event.target.value || null, quantity_per_parent: event.target.value ? unit.quantity_per_parent : { numerator: 1, denominator: 1 } })} className={inputClass}><option value="">{ar ? "لا يوجد — العبوة الجذر" : "None — root package"}</option>{units.filter((candidate) => candidate.id !== unit.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label_en || candidate.label_ar || (ar ? "مستوى بلا اسم" : "Unnamed level")}</option>)}</select></Field>
              <Field label={ar ? "العدد داخل العبوة الأم" : "Quantity per parent"}><div className="flex items-center gap-2"><input disabled={!unit.parent_unit_id} required type="number" min="1" step="1" value={unit.quantity_per_parent.numerator} onChange={(event) => update(unit.id, { quantity_per_parent: { ...unit.quantity_per_parent, numerator: Number(event.target.value) } })} className={inputClass} /><span>/</span><input disabled={!unit.parent_unit_id} required type="number" min="1" step="1" value={unit.quantity_per_parent.denominator} onChange={(event) => update(unit.id, { quantity_per_parent: { ...unit.quantity_per_parent, denominator: Number(event.target.value) } })} className={inputClass} /></div></Field>
              <Field label={ar ? "طريقة السعر الافتراضية" : "Default price mode"}><select value={unit.default_price_mode} onChange={(event) => update(unit.id, { default_price_mode: event.target.value as "explicit" | "derived" })} className={inputClass}><option value="explicit">{ar ? "سعر صريح" : "Explicit"}</option><option value="derived">{ar ? "مشتق من العبوة" : "Derived"}</option></select></Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-5 text-sm">
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={unit.is_sellable} onChange={(event) => update(unit.id, { is_sellable: event.target.checked, is_default_sale_unit: event.target.checked ? unit.is_default_sale_unit : false })} />{ar ? "قابلة للبيع" : "Sellable"}</label>
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={unit.is_default_sale_unit} onChange={(event) => setUnits((current) => current.map((candidate) => ({ ...candidate, is_default_sale_unit: candidate.id === unit.id ? event.target.checked : false, is_sellable: candidate.id === unit.id && event.target.checked ? true : candidate.is_sellable })))} />{ar ? "وحدة البيع الافتراضية" : "Default sale unit"}</label>
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={unit.is_base_unit} onChange={(event) => setUnits((current) => current.map((candidate) => ({ ...candidate, is_base_unit: candidate.id === unit.id ? event.target.checked : false })))} />{ar ? "وحدة المخزون الأساسية" : "Base inventory unit"}</label>
              {units.length > 1 && <button type="button" onClick={() => setUnits((current) => current.filter((candidate) => candidate.id !== unit.id).map((candidate) => candidate.parent_unit_id === unit.id ? { ...candidate, parent_unit_id: null, quantity_per_parent: { numerator: 1, denominator: 1 } } : candidate))} className="ms-auto inline-flex min-h-11 items-center gap-2 text-red-600"><Trash2 size={16} />{ar ? "إزالة" : "Remove"}</button>}
            </div>
            <p className="mt-1 text-[11px] text-fg-dim">{ar ? `المستوى ${index + 1}` : `Level ${index + 1}`}</p>
          </article>
        ))}
      </div>

      <button type="button" onClick={save} disabled={saving || units.length === 0} className="btn btn-primary mt-4 min-h-11 gap-2"><Save size={15} />{saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ وحدات التعبئة" : "Save packaging")}</button>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-fg-dim">{label}</span>{children}</label>;
}
