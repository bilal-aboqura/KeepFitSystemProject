"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useToast } from "@/components/admin/toast";
import { Loader2, Plus, Trash2, Save, GripVertical, Eye, EyeOff } from "lucide-react";
import type { BundleConfig } from "@/lib/data/catalog";
import { ImageUpload } from "@/components/admin/image-upload";

interface Product {
  id: string;
  name_en: string;
  name_ar: string;
  price: number;
  images: string[];
}

const inputCls = "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-fg outline-none focus:border-brand";

export default function AdminBundlesPage() {
  const router = useRouter();
  const toast = useToast();
  const [bundles, setBundles] = useState<BundleConfig[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/bundles").then((r) => r.json()),
      fetch("/api/admin/products").then((r) => r.json()),
    ])
      .then(([bundlesData, productsData]) => {
        setBundles(bundlesData.bundles ?? []);
        setProducts(productsData.products ?? []);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [toast]);

  function updateBundle<K extends keyof BundleConfig>(index: number, field: K, value: BundleConfig[K]) {
    setBundles((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }

  function toggleProduct(bundleIndex: number, productId: string) {
    setBundles((prev) =>
      prev.map((b, i) => {
        if (i !== bundleIndex) return b;
        const has = b.product_ids.includes(productId);
        return {
          ...b,
          product_ids: has ? b.product_ids.filter((id) => id !== productId) : [...b.product_ids, productId],
        };
      }),
    );
  }

  function addBundle() {
    setBundles((prev) => [
      ...prev,
      {
        key: `bundle_${Date.now()}`,
        title_en: "New Bundle",
        title_ar: "باكدج جديد",
        desc_en: "",
        desc_ar: "",
        product_ids: [],
        bundle_price: 0,
        image: "/images/placeholder.webp",
        active: true,
        sort_order: prev.length,
      },
    ]);
  }

  function removeBundle(index: number) {
    if (!confirm("Delete this bundle?")) return;
    setBundles((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bundles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundles }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Bundles saved");
      router.refresh();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-fg-dim" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-fg">Bundles</h1>
          <p className="mt-1 text-sm text-fg-dim">Edit bundle images, prices, descriptions, and products</p>
        </div>
        <div className="flex gap-2">
          <button onClick={addBundle} className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
            <Plus size={16} /> Add bundle
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-full bg-emerald px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald/80 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save all
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {bundles.length === 0 && (
          <div className="glass p-12 text-center text-fg-dim">No bundles yet. Click &quot;Add bundle&quot; to create one.</div>
        )}
        {bundles.map((bundle, bi) => (
          <div key={bundle.key} className="glass p-6">
            {/* Bundle header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical size={16} className="text-fg-dim" />
                <span className="text-sm font-semibold text-fg">{bundle.title_en || bundle.key}</span>
                <button
                  onClick={() => updateBundle(bi, "active", !bundle.active)}
                  className="ml-2"
                  title={bundle.active ? "Active" : "Hidden"}
                >
                  {bundle.active ? <Eye size={14} className="text-emerald" /> : <EyeOff size={14} className="text-fg-dim" />}
                </button>
              </div>
              <button onClick={() => removeBundle(bi)} className="flex items-center gap-1 text-sm text-red-300 hover:underline">
                <Trash2 size={14} /> Delete
              </button>
            </div>

            {/* Grid: image preview + fields */}
            <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
              {/* Image upload + price */}
              <div>
                <ImageUpload
                  value={bundle.image}
                  onChange={(url) => updateBundle(bi, "image", url)}
                  label="Image"
                  aspectRatio={4/3}
                />
                <label className="mt-2 block">
                  <span className="mb-1 block text-xs text-fg-dim">Bundle Price (EGP)</span>
                  <input
                    type="number"
                    value={bundle.bundle_price}
                    onChange={(e) => updateBundle(bi, "bundle_price", Number(e.target.value))}
                    className={inputCls}
                  />
                </label>
                <label className="mt-2 block">
                  <span className="mb-1 block text-xs text-fg-dim">Sort order</span>
                  <input
                    type="number"
                    value={bundle.sort_order}
                    onChange={(e) => updateBundle(bi, "sort_order", Number(e.target.value))}
                    className={inputCls}
                  />
                </label>
              </div>

              {/* Text fields + product picker */}
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-fg-dim">Title (English)</span>
                    <input value={bundle.title_en} onChange={(e) => updateBundle(bi, "title_en", e.target.value)} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-fg-dim">Title (Arabic)</span>
                    <input value={bundle.title_ar} onChange={(e) => updateBundle(bi, "title_ar", e.target.value)} className={inputCls} dir="rtl" />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs text-fg-dim">Description (English)</span>
                  <textarea rows={2} value={bundle.desc_en} onChange={(e) => updateBundle(bi, "desc_en", e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-fg-dim">Description (Arabic)</span>
                  <textarea rows={2} value={bundle.desc_ar} onChange={(e) => updateBundle(bi, "desc_ar", e.target.value)} className={inputCls} dir="rtl" />
                </label>

                {/* Product picker */}
                <div>
                  <span className="mb-1.5 block text-xs text-fg-dim">
                    Products ({bundle.product_ids.length} selected)
                  </span>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 p-2">
                    {products.length === 0 ? (
                      <p className="px-2 py-4 text-center text-xs text-fg-dim">No products available</p>
                    ) : (
                      <div className="space-y-1">
                        {products.map((p) => {
                          const selected = bundle.product_ids.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleProduct(bi, p.id)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                                selected ? "bg-brand/10 text-brand" : "text-fg-muted hover:bg-white/[0.04]"
                              }`}
                            >
                              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-brand bg-brand" : "border-border"}`}>
                                {selected && <span className="text-[10px] text-white">✓</span>}
                              </div>
                              {p.images?.[0] && (
                                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-white">
                                  <Image src={p.images[0]} alt="" fill sizes="32px" className="object-contain p-0.5" />
                                </div>
                              )}
                              <span className="flex-1 truncate">{p.name_en}</span>
                              <span className="shrink-0 text-fg-dim">{p.price} EGP</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-fg-dim">
                    Leave empty to auto-select products based on bundle key.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {bundles.length > 0 && (
        <div className="mt-6 flex justify-end">
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald/80 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save all bundles
          </button>
        </div>
      )}
    </div>
  );
}
