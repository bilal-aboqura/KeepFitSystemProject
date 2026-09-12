"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { AttributeDefinition, CatalogAttributeAssignment, CatalogBrand, CatalogCategory, CatalogProduct, CatalogVariant } from "@/lib/catalog/types";
import { useToast } from "./toast";
import { CatalogMediaManager } from "./catalog-media-manager";
import { CatalogPackagingEditor } from "./catalog-packaging-editor";
import { normalizeCatalogSlug } from "@/lib/catalog/slug";
import { catalogApiErrorMessage } from "@/lib/catalog/client-errors";

type EditableVariant = Pick<CatalogVariant, "id" | "sku" | "barcode" | "label_en" | "label_ar" | "base_price" | "compare_at_price" | "stock" | "is_default" | "is_active" | "attributes" | "media">;

function blankVariant(): EditableVariant {
  return { id: "", sku: "", barcode: null, label_en: "", label_ar: "", base_price: 0, compare_at_price: null, stock: 0, is_default: true, is_active: true, attributes: [], media: [] };
}

function createVariantPayload(variant: EditableVariant) {
  return { sku: variant.sku, barcode: variant.barcode, label_en: variant.label_en, label_ar: variant.label_ar, base_price: variant.base_price, compare_at_price: variant.compare_at_price, stock: variant.stock, is_default: variant.is_default, is_active: variant.is_active, attributes: variant.attributes };
}

function updateVariantPayload(variant: EditableVariant) {
  return { barcode: variant.barcode, label_en: variant.label_en, label_ar: variant.label_ar, base_price: variant.base_price, compare_at_price: variant.compare_at_price, stock: variant.stock, is_default: variant.is_default, is_active: variant.is_active };
}

export function CatalogProductEditor({ product, categories, brands, attributes, lang }: {
  product?: CatalogProduct;
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  attributes: (AttributeDefinition & { values?: { id: string; label_en: string; label_ar: string }[] })[];
  lang: "en" | "ar";
}) {
  const router = useRouter();
  const toast = useToast();
  const ar = lang === "ar";
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name_en: product?.name_en ?? "", name_ar: product?.name_ar ?? "", slug: product?.slug ?? "",
    category_id: product?.category_id ?? "", brand_id: product?.brand_id ?? "",
    short_desc_en: product?.short_desc_en ?? "", short_desc_ar: product?.short_desc_ar ?? "",
    long_desc_en: product?.long_desc_en ?? "", long_desc_ar: product?.long_desc_ar ?? "",
    is_active: product?.is_active ?? true, is_featured: product?.is_featured ?? false,
  });
  const [variants, setVariants] = useState<EditableVariant[]>(product?.variants ?? [blankVariant()]);
  const [specifications, setSpecifications] = useState<CatalogAttributeAssignment[]>(product?.specifications ?? []);
  const definingAttributes = attributes.filter((attribute) => attribute.is_variant_defining && attribute.value_type === "option");
  const informationalAttributes = attributes.filter((attribute) => !attribute.is_variant_defining && attribute.value_type === "option");

  function updateVariant(index: number, patch: Partial<EditableVariant>) {
    setVariants((current) => current.map((variant, itemIndex) => itemIndex === index ? { ...variant, ...patch } : variant));
  }

  function setVariantAttribute(index: number, definitionId: string, valueId: string) {
    const current = variants[index];
    const rest = current.attributes.filter((assignment) => assignment.attribute_definition_id !== definitionId);
    updateVariant(index, { attributes: valueId ? [...rest, { attribute_definition_id: definitionId, attribute_value_id: valueId }] : rest });
  }

  function setSpecification(definitionId: string, valueId: string) {
    setSpecifications((current) => {
      const rest = current.filter((item) => item.attribute_definition_id !== definitionId);
      return valueId ? [...rest, { attribute_definition_id: definitionId, attribute_value_id: valueId }] : rest;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const slug = normalizeCatalogSlug(form.slug) || normalizeCatalogSlug(form.name_en);
      const productPayload = { ...form, slug, category_id: form.category_id || null, brand_id: form.brand_id || null,
        variants: variants.map(createVariantPayload), specifications };
      if (!product) {
        const response = await fetch("/api/admin/catalog/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(productPayload) });
        const result = await response.json();
        if (!response.ok) throw new Error(catalogApiErrorMessage(result, lang, ar ? "تعذر إنشاء المنتج" : "Could not create product"));
      } else {
        const response = await fetch(`/api/admin/catalog/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, slug }) });
        const result = await response.json();
        if (!response.ok) throw new Error(catalogApiErrorMessage(result, lang, ar ? "تعذر تحديث المنتج" : "Could not update product"));
        const specificationResponse = await fetch("/api/admin/catalog/attributes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "specifications", product_id: product.id, data: specifications }) });
        if (!specificationResponse.ok) throw new Error("Could not update product specifications");
        for (const variant of variants) {
          if (variant.id) {
            const updated = await fetch(`/api/admin/catalog/variants/${variant.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updateVariantPayload(variant)) });
            if (!updated.ok) throw new Error("Could not update a variant");
          } else {
            const created = await fetch(`/api/admin/catalog/products/${product.id}/variants`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createVariantPayload(variant)) });
            if (!created.ok) throw new Error("Could not create a variant");
          }
        }
      }
      toast.success(ar ? "تم حفظ الكتالوج" : "Catalog saved");
      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function archiveProduct() {
    if (!product || !confirm(ar ? "أرشفة المنتج؟" : "Archive this product?")) return;
    const response = await fetch(`/api/admin/catalog/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error(ar ? "تعذرت أرشفة المنتج" : "Could not archive product");
    router.push("/admin/products");
    router.refresh();
  }

  async function archiveVariant(variantId: string) {
    if (!confirm(ar ? "أرشفة هذا الخيار؟" : "Archive this variant?")) return;
    const response = await fetch(`/api/admin/catalog/variants/${variantId}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) return toast.error(result.error || (ar ? "تعذرت الأرشفة" : "Could not archive variant"));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      <section className="grid gap-4 rounded-2xl border border-border bg-white p-5 sm:grid-cols-2">
        <h2 className="sm:col-span-2 font-semibold text-fg">{ar ? "بيانات المنتج" : "Product information"}</h2>
        <Field label="English name"><input required value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className={inputClass} /></Field>
        <Field label="الاسم العربي"><input required dir="rtl" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} className={inputClass} /></Field>
        <Field label={ar ? "الرابط الإنجليزي (يُنشأ تلقائيًا)" : "URL slug (generated automatically)"}><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} onBlur={() => setForm((current) => ({ ...current, slug: normalizeCatalogSlug(current.slug) || normalizeCatalogSlug(current.name_en) }))} placeholder={ar ? "اتركه فارغًا للإنشاء من الاسم الإنجليزي" : "Leave blank to use the English name"} className={inputClass} /></Field>
        <Field label={ar ? "الفئة" : "Category"}><select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={inputClass}><option value="">—</option>{categories.map((item) => <option key={item.id} value={item.id}>{ar ? item.name_ar : item.name_en}</option>)}</select></Field>
        <Field label={ar ? "العلامة التجارية" : "Brand"}><select value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} className={inputClass}><option value="">—</option>{brands.map((item) => <option key={item.id} value={item.id}>{ar ? item.name_ar : item.name_en}</option>)}</select></Field>
        <div className="flex items-center gap-6 pt-6"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />{ar ? "نشط" : "Active"}</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />{ar ? "مميز" : "Featured"}</label></div>
        <Field label={ar ? "الوصف الإنجليزي" : "English description"}><textarea rows={4} value={form.long_desc_en} onChange={(e) => setForm({ ...form, long_desc_en: e.target.value })} className={inputClass} /></Field>
        <Field label={ar ? "الوصف العربي" : "Arabic description"}><textarea rows={4} dir="rtl" value={form.long_desc_ar} onChange={(e) => setForm({ ...form, long_desc_ar: e.target.value })} className={inputClass} /></Field>
      </section>

      {informationalAttributes.length > 0 && <section className="grid gap-4 rounded-2xl border border-border bg-white p-5 sm:grid-cols-2"><div className="sm:col-span-2"><h2 className="font-semibold text-fg">{ar ? "مواصفات المنتج" : "Product specifications"}</h2><p className="text-xs text-fg-dim">{ar ? "هذه المواصفات لا تنشئ خيارات بيع." : "These values never generate sellable variants."}</p></div>{informationalAttributes.map((attribute) => <Field key={attribute.id} label={ar ? attribute.label_ar : attribute.label_en}><select value={specifications.find((item) => item.attribute_definition_id === attribute.id)?.attribute_value_id ?? ""} onChange={(e) => setSpecification(attribute.id, e.target.value)} className={inputClass}><option value="">—</option>{attribute.values?.map((value) => <option key={value.id} value={value.id}>{ar ? value.label_ar : value.label_en}</option>)}</select></Field>)}</section>}

      <section className="space-y-4 rounded-2xl border border-border bg-white p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold text-fg">{ar ? "الخيارات القابلة للبيع" : "Sellable variants"}</h2><p className="text-xs text-fg-dim">{ar ? "SKU محجوز بشكل دائم حتى بعد الأرشفة." : "SKU remains permanently reserved after archival."}</p></div><button type="button" onClick={() => setVariants((current) => [...current, { ...blankVariant(), is_default: false }])} className="btn btn-secondary min-h-11 gap-2"><Plus size={16} />{ar ? "إضافة" : "Add"}</button></div>
        {variants.map((variant, index) => (
          <article key={variant.id || index} className="rounded-xl border border-border bg-slate-50/60 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="SKU"><input required readOnly={Boolean(variant.id)} pattern="[A-Za-z0-9][A-Za-z0-9._/-]*" title={ar ? "استخدم حروفًا إنجليزية وأرقامًا و . _ / - فقط" : "Use English letters, numbers, dot, underscore, slash, or hyphen only"} value={variant.sku} onChange={(e) => updateVariant(index, { sku: e.target.value })} className={inputClass} /></Field>
              <Field label={ar ? "الباركود" : "Barcode"}><input value={variant.barcode ?? ""} onChange={(e) => updateVariant(index, { barcode: e.target.value || null })} className={inputClass} /></Field>
              <Field label={ar ? "السعر" : "Base price"}><input required type="number" min="0" step="0.01" value={variant.base_price} onChange={(e) => updateVariant(index, { base_price: Number(e.target.value) })} className={inputClass} /></Field>
              <Field label={ar ? "المخزون" : "Stock"}><input required type="number" min="0" value={variant.stock} onChange={(e) => updateVariant(index, { stock: Number(e.target.value) })} className={inputClass} /></Field>
              <Field label={ar ? "اسم الخيار بالإنجليزية" : "English variant label"}><input value={variant.label_en} onChange={(e) => updateVariant(index, { label_en: e.target.value })} className={inputClass} /></Field>
              <Field label={ar ? "اسم الخيار بالعربية" : "Arabic variant label"}><input dir="rtl" value={variant.label_ar} onChange={(e) => updateVariant(index, { label_ar: e.target.value })} className={inputClass} /></Field>
              {definingAttributes.map((attribute) => <Field key={attribute.id} label={ar ? attribute.label_ar : attribute.label_en}><select value={variant.attributes.find((item) => item.attribute_definition_id === attribute.id)?.attribute_value_id ?? ""} onChange={(e) => setVariantAttribute(index, attribute.id, e.target.value)} className={inputClass}><option value="">—</option>{attribute.values?.filter((value) => value).map((value) => <option key={value.id} value={value.id}>{ar ? value.label_ar : value.label_en}</option>)}</select></Field>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-5"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={variant.is_active} onChange={(e) => updateVariant(index, { is_active: e.target.checked })} />{ar ? "نشط" : "Active"}</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={variant.is_default} onChange={(e) => setVariants((current) => current.map((item, itemIndex) => ({ ...item, is_default: itemIndex === index ? e.target.checked : false })))} />{ar ? "افتراضي" : "Default"}</label>{variant.id ? <button type="button" onClick={() => archiveVariant(variant.id)} className="ms-auto inline-flex min-h-11 items-center gap-2 text-sm font-medium text-red-600"><Trash2 size={18}/>{ar ? "أرشفة" : "Archive"}</button> : variants.length > 1 && <button type="button" onClick={() => setVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ms-auto text-red-600"><Trash2 size={18} /></button>}</div>
            {product && variant.id && <div className="mt-4"><CatalogMediaManager productId={product.id} variantId={variant.id} initialMedia={variant.media} lang={lang} /></div>}
            {product && variant.id && <CatalogPackagingEditor variantId={variant.id} initialUnits={product.variants.find((item) => item.id === variant.id)?.packaging_units ?? []} lang={lang} />}
          </article>
        ))}
      </section>

      {product && <CatalogMediaManager productId={product.id} initialMedia={product.media} lang={lang} />}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving} className="btn btn-primary min-h-12 w-full sm:w-auto">{saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ الكتالوج" : "Save catalog")}</button>{product && <button type="button" onClick={archiveProduct} className="btn btn-secondary min-h-12 text-red-600">{ar ? "أرشفة المنتج" : "Archive product"}</button>}</div>
    </form>
  );
}

const inputClass = "min-h-11 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand disabled:bg-slate-100";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-xs font-medium text-fg-dim">{label}</span>{children}</label>; }
