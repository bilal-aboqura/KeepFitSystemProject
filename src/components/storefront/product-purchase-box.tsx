"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Zap, Package, CheckCircle, Banknote } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { QuantityStepper } from "./quantity-stepper";
import { formatPrice } from "@/lib/utils";
import { addToCart } from "@/lib/cart";
import { productMetaParams, trackMetaEvent } from "@/lib/meta-pixel";
import { trackStoreEvent } from "@/lib/store-analytics";
import type { ProductDetail } from "@/lib/data/catalog";
import { VariantSelector } from "./variant-selector";
import { ProductGallery } from "./product-gallery";
import { SellableUnitSelector } from "./sellable-unit-selector";

export function ProductPurchaseBox({ product }: { product: ProductDetail }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const initialVariant = product.variants.find((variant) => variant.is_default) ?? product.variants[0];
  const [selectedId, setSelectedId] = useState(initialVariant?.id ?? "");
  const selectedVariant = product.variants.find((variant) => variant.id === selectedId) ?? initialVariant;
  const sellableUnits = selectedVariant?.packaging_units.filter((unit) => unit.is_active && unit.is_sellable) ?? [];
  const initialUnit = sellableUnits.find((unit) => unit.is_default_sale_unit) ?? sellableUnits[0];
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnit?.id ?? "");
  const selectedUnit = sellableUnits.find((unit) => unit.id === selectedUnitId) ?? initialUnit;
  const out = !selectedVariant || !selectedUnit || selectedVariant.stock <= 0 || !selectedVariant.is_active;
  const ar = lang === "ar";

  const name = ar ? product.name_ar : product.name_en;
  const desc = ar ? product.long_desc_ar : product.long_desc_en;
  const image = selectedVariant?.media[0]?.public_url ?? product.images?.[0] ?? "/keepfit-logo.png";
  const price = Number(selectedUnit?.compatibility_price ?? selectedVariant?.base_price ?? product.price);
  const compareAtPrice = Number(selectedUnit?.compatibility_compare_at_price ?? selectedVariant?.compare_at_price ?? product.compare_at_price);
  const hasSale = Number.isFinite(compareAtPrice) && compareAtPrice > price;
  const savings = hasSale ? compareAtPrice - price : 0;
  const discountPercent = hasSale ? Math.round((savings / compareAtPrice) * 100) : 0;
  const addButtonContent = out
    ? t.product.outOfStock
    : added
      ? <><CheckCircle size={16} /> {ar ? "تمت الإضافة" : "Added"}</>
      : <><ShoppingBag size={16} /> {t.product.addToCart}</>;

  useEffect(() => {
    trackMetaEvent("ViewContent", productMetaParams({ id: product.id, price }));
  }, [price, product.id]);

  function handleAdd() {
    if (out || !selectedVariant || !selectedUnit) return;
    addToCart({ id: `${selectedVariant.id}:${selectedUnit.id}`, variant_id: selectedVariant.id, sellable_unit_id: selectedUnit.id, product_id: product.id, sku: selectedVariant.sku, unit_code: selectedUnit.code, unit_label_en: selectedUnit.label_en, unit_label_ar: selectedUnit.label_ar, base_quantity_num: selectedUnit.base_quantity.numerator, base_quantity_den: selectedUnit.base_quantity.denominator, slug: product.slug, name_en: product.name_en, name_ar: product.name_ar, variant_label_en: selectedVariant.label_en, variant_label_ar: selectedVariant.label_ar, price, image, stock: selectedVariant.stock }, qty);
    trackMetaEvent("AddToCart", productMetaParams({ id: selectedVariant.id, price, quantity: qty }));
    trackStoreEvent("add_to_cart");
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function buyNow() {
    if (out || !selectedVariant || !selectedUnit) return;
    addToCart({ id: `${selectedVariant.id}:${selectedUnit.id}`, variant_id: selectedVariant.id, sellable_unit_id: selectedUnit.id, product_id: product.id, sku: selectedVariant.sku, unit_code: selectedUnit.code, unit_label_en: selectedUnit.label_en, unit_label_ar: selectedUnit.label_ar, base_quantity_num: selectedUnit.base_quantity.numerator, base_quantity_den: selectedUnit.base_quantity.denominator, slug: product.slug, name_en: product.name_en, name_ar: product.name_ar, variant_label_en: selectedVariant.label_en, variant_label_ar: selectedVariant.label_ar, price, image, stock: selectedVariant.stock }, qty, { showPrompt: false });
    trackMetaEvent("AddToCart", productMetaParams({ id: selectedVariant.id, price, quantity: qty }));
    trackStoreEvent("add_to_cart");
    router.push("/checkout");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <ProductGallery productMedia={product.media} variantMedia={selectedVariant?.media ?? []} name={name} />

      {/* Info */}
      <div className="flex flex-col">
        <h1 className="font-heading text-2xl font-bold leading-tight text-fg sm:text-3xl lg:text-4xl">
          {name}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-4xl font-extrabold leading-none tracking-tight text-brand sm:text-5xl">
            {formatPrice(price, lang)}
          </span>
          {hasSale && (
            <>
              <span className="text-lg font-medium text-fg-dim line-through">
                {formatPrice(compareAtPrice, lang)}
              </span>
              <span className="rounded-full bg-brand px-3 py-1 text-sm font-bold text-black">
                {ar ? `وفر ${formatPrice(savings, lang)} · خصم ${discountPercent}%` : `Save ${formatPrice(savings, lang)} · ${discountPercent}% off`}
              </span>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {out ? (
            <span className="pill pill-danger">{t.product.outOfStock}</span>
          ) : (
            <span className="pill pill-success">
              <CheckCircle size={12} />
              {ar ? "متوفر" : "In stock"} &middot; {selectedVariant?.stock ?? 0} {ar ? "قطعة" : "units"}
            </span>
          )}
          <span className="pill pill-info gap-1">
            <Banknote size={11} />
            {t.product.cod}
          </span>
        </div>

        <VariantSelector variants={product.variants} selectedId={selectedVariant?.id ?? ""} onChange={(variant) => {
          const units = variant.packaging_units.filter((unit) => unit.is_active && unit.is_sellable);
          setSelectedId(variant.id);
          setSelectedUnitId((units.find((unit) => unit.is_default_sale_unit) ?? units[0])?.id ?? "");
          setQty(1);
        }} />

        <SellableUnitSelector units={selectedVariant?.packaging_units ?? []} selectedId={selectedUnit?.id ?? ""} onChange={(unit) => { setSelectedUnitId(unit.id); setQty(1); }} lang={lang} />

        {selectedVariant?.sku && <p className="mt-3 text-xs text-fg-dim">SKU: {selectedVariant.sku}</p>}

        {product.weight && (
          <div className="mt-4 flex items-center gap-2 text-sm text-fg-dim">
            <Package size={14} />
            <span>{product.weight}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, selectedVariant?.stock ?? 0)} />
          <button onClick={handleAdd} disabled={out} className="btn btn-primary gap-2">
            {addButtonContent}
          </button>
          <button onClick={buyNow} disabled={out} className="btn btn-secondary gap-2">
            <Zap size={16} />
            {t.product.buyNow}
          </button>
        </div>

        {/* Description */}
        {desc && (
          <div className="mt-10 border-t border-border pt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-dim">
              {ar ? "الوصف" : "Description"}
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-fg-muted">
              {desc}
            </p>
          </div>
        )}

        {product.specifications.length > 0 && (
          <dl className="mt-8 grid grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-2">
            {product.specifications.map((specification) => (
              <div key={specification.id} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-fg-dim">{ar ? specification.definition?.label_ar : specification.definition?.label_en}</dt>
                <dd className="mt-1 text-sm font-semibold text-fg">{(ar ? specification.value?.label_ar : specification.value?.label_en) ?? specification.text_value ?? String(specification.number_value ?? specification.boolean_value ?? "")}{specification.definition?.unit ? ` ${specification.definition.unit}` : ""}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <aside
        aria-label={t.product.addToCart}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 px-4 pt-3 backdrop-blur-xl sm:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 shrink-0">
            <p className="text-xs text-fg-dim">
              {qty} × {selectedUnit ? (ar ? selectedUnit.label_ar : selectedUnit.label_en) : (ar ? "قطعة" : "item")}
            </p>
            <p className="text-lg font-bold leading-tight text-brand">
              {formatPrice(price * qty, lang)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={out}
            className="btn btn-primary min-h-12 min-w-0 flex-1 gap-2 px-4"
            aria-live="polite"
          >
            {addButtonContent}
          </button>
        </div>
      </aside>
    </div>
  );
}
