"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils";

export function CatalogProductList({ products, lang }: { products: CatalogProduct[]; lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const visible = useMemo(() => products.filter((product) => {
    const needle = query.trim().toLocaleLowerCase();
    const identity = [product.name_en, product.name_ar, product.brand?.name_en, product.brand?.name_ar, product.category?.name_en, product.category?.name_ar, ...product.variants.flatMap((variant) => [variant.sku, variant.barcode])].filter(Boolean).join(" ").toLocaleLowerCase();
    return (!needle || identity.includes(needle)) && (status === "all" || (status === "active" ? product.is_active : !product.is_active));
  }), [products, query, status]);
  return (
    <div>
      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_180px]"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ar ? "بحث بالاسم أو SKU أو الباركود" : "Search name, SKU, or barcode"} className={inputClass} /><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}><option value="all">{ar ? "كل الحالات" : "All statuses"}</option><option value="active">{ar ? "نشط" : "Active"}</option><option value="archived">{ar ? "مؤرشف" : "Archived"}</option></select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b border-border text-start text-xs uppercase text-fg-dim"><th className="p-4">{ar ? "المنتج" : "Product"}</th><th className="p-4">{ar ? "الفئة / العلامة" : "Category / Brand"}</th><th className="p-4">{ar ? "الخيارات" : "Variants"}</th><th className="p-4">{ar ? "السعر" : "Base price"}</th><th className="p-4">{ar ? "الحالة" : "Status"}</th><th className="p-4"></th></tr></thead><tbody>{visible.map((product) => { const primary = product.media.find((item) => item.is_primary) ?? product.media[0]; const prices = product.variants.map((variant) => variant.base_price); return <tr key={product.id} className="border-b border-border/70"><td className="p-4"><div className="flex items-center gap-3">{primary && <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-border bg-white"><Image src={primary.public_url} alt="" fill sizes="48px" className="object-contain" /></div>}<div><p className="font-medium text-fg">{ar ? product.name_ar : product.name_en}</p><p className="text-xs text-fg-dim">{product.slug}</p></div></div></td><td className="p-4 text-fg-muted">{product.category ? (ar ? product.category.name_ar : product.category.name_en) : "—"}<br/><span className="text-xs text-fg-dim">{product.brand ? (ar ? product.brand.name_ar : product.brand.name_en) : "—"}</span></td><td className="p-4">{product.variants.length}<p className="mt-1 text-xs text-fg-dim">{product.variants.slice(0, 2).map((variant) => variant.sku).join(", ")}</p></td><td className="p-4 font-semibold text-brand">{prices.length ? formatPrice(Math.min(...prices), lang) : "—"}</td><td className="p-4"><span className={product.is_active ? "pill pill-success" : "pill pill-neutral"}>{product.is_active ? (ar ? "نشط" : "Active") : (ar ? "مؤرشف" : "Archived")}</span></td><td className="p-4"><Link href={`/admin/products/${product.id}`} className="font-medium text-brand hover:underline">{ar ? "تعديل" : "Edit"}</Link></td></tr>; })}</tbody></table></div>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-brand";
