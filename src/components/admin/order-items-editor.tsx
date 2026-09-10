"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Package, Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/components/admin/toast";
import { formatPrice } from "@/lib/utils";

interface OrderLine {
  key: string;
  line_id?: string;
  product_id: string | null;
  name_en: string;
  name_ar: string | null;
  price: number;
  quantity: number;
  image: string | null;
}

interface CatalogProduct {
  id: string;
  name_en: string;
  name_ar: string;
  price: number;
  stock: number;
  images: string[];
}

interface Totals {
  items_total: number;
  shipping_cost: number;
  discount: number;
  grand_total: number;
}

export function OrderItemsEditor({
  orderId,
  initialItems,
  products,
  initialTotals,
  discountCode,
  paymentMethod,
  lang,
}: {
  orderId: string;
  initialItems: Array<Omit<OrderLine, "key"> & { id: string }>;
  products: CatalogProduct[];
  initialTotals: Totals;
  discountCode: string | null;
  paymentMethod: string;
  lang: "en" | "ar";
}) {
  const ar = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<OrderLine[]>(
    initialItems.map(({ id, ...item }) => ({ ...item, line_id: id, key: id })),
  );
  const [selectedProductId, setSelectedProductId] = useState("");
  const [totals, setTotals] = useState(initialTotals);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lineSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  function updateQuantity(key: string, quantity: number) {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, quantity: Math.max(1, Math.min(999, quantity)) } : item,
      ),
    );
    setDirty(true);
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
    setDirty(true);
  }

  function addProduct() {
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) return;
    const existing = items.find((item) => item.product_id === product.id);
    if (existing) {
      updateQuantity(existing.key, existing.quantity + 1);
    } else {
      setItems((current) => [
        ...current,
        {
          key: `new-${product.id}`,
          product_id: product.id,
          name_en: product.name_en,
          name_ar: product.name_ar,
          price: Number(product.price),
          quantity: 1,
          image: product.images?.[0] ?? null,
        },
      ]);
      setDirty(true);
    }
    setSelectedProductId("");
  }

  async function saveItems() {
    if (!items.length) {
      toast.error(ar ? "يجب أن يحتوي الطلب على منتج واحد على الأقل." : "An order must contain at least one product.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            ...(item.line_id ? { line_id: item.line_id } : {}),
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof result?.error === "string" ? result.error : "Save failed");
      }
      if (result?.totals) setTotals(result.totals as Totals);
      setDirty(false);
      toast.success(ar ? "تم تحديث منتجات الطلب وإعادة حساب الإجمالي." : "Order products and totals were updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Package size={16} className="text-brand" />
              {ar ? "منتجات الطلب" : "Order products"}
            </div>
            <p className="mt-1 text-xs text-fg-dim">
              {ar ? "الأسعار القديمة تبقى كما هي، والمنتجات الجديدة تستخدم سعرها الحالي." : "Existing prices are preserved; new products use their current catalog price."}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="input min-w-0 sm:w-72">
              <option value="">{ar ? "اختر منتجًا لإضافته" : "Select a product to add"}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {ar ? product.name_ar : product.name_en} · {formatPrice(Number(product.price), lang)}
                </option>
              ))}
            </select>
            <button type="button" onClick={addProduct} disabled={!selectedProductId} className="btn btn-secondary shrink-0 px-3">
              <Plus size={16} />
              <span className="hidden sm:inline">{ar ? "إضافة" : "Add"}</span>
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                {item.image ? <Image src={item.image} alt="" fill sizes="48px" className="object-contain p-1" /> : <Package size={18} className="absolute inset-0 m-auto text-fg-dim" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{ar ? item.name_ar || item.name_en : item.name_en}</p>
                <p className="text-xs text-fg-dim">{formatPrice(item.price, lang)}</p>
              </div>
              <div className="flex items-center rounded-lg border border-border bg-white">
                <button type="button" onClick={() => updateQuantity(item.key, item.quantity - 1)} className="flex h-9 w-9 items-center justify-center text-fg-dim hover:text-brand" aria-label={ar ? "تقليل الكمية" : "Decrease quantity"}><Minus size={14} /></button>
                <input type="number" min={1} max={999} value={item.quantity} onChange={(event) => updateQuantity(item.key, Number(event.target.value) || 1)} className="h-9 w-12 border-x border-border bg-transparent text-center text-sm font-semibold text-fg outline-none" />
                <button type="button" onClick={() => updateQuantity(item.key, item.quantity + 1)} className="flex h-9 w-9 items-center justify-center text-fg-dim hover:text-brand" aria-label={ar ? "زيادة الكمية" : "Increase quantity"}><Plus size={14} /></button>
              </div>
              <p className="w-24 text-end text-sm font-bold text-fg">{formatPrice(item.price * item.quantity, lang)}</p>
              <button type="button" onClick={() => removeItem(item.key)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50" aria-label={ar ? "حذف المنتج" : "Remove product"}><Trash2 size={16} /></button>
            </div>
          ))}
          {!items.length ? <p className="py-8 text-center text-sm text-red-600">{ar ? "لا يمكن حفظ طلب فارغ." : "An empty order cannot be saved."}</p> : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg-dim">
            {ar ? "مجموع السطور الآن" : "Current line subtotal"}: <strong className="text-fg">{formatPrice(lineSubtotal, lang)}</strong>
          </p>
          <button type="button" onClick={() => void saveItems()} disabled={!dirty || saving || !items.length} className="btn btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? (ar ? "جارٍ الحفظ..." : "Saving...") : ar ? "حفظ وإعادة الحساب" : "Save and recalculate"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="space-y-2 text-sm">
          <TotalRow label={ar ? "مجموع العناصر" : "Items total"} value={formatPrice(totals.items_total, lang)} />
          <TotalRow label={ar ? "الشحن" : "Shipping"} value={formatPrice(totals.shipping_cost, lang)} />
          {totals.discount > 0 ? (
            <TotalRow
              label={`${ar ? "الخصم" : "Discount"}${discountCode ? ` (${discountCode})` : paymentMethod === "card" ? ar ? " (دفع إلكتروني 5%)" : " (5% online payment)" : ""}`}
              value={`-${formatPrice(totals.discount, lang)}`}
              discount
            />
          ) : null}
          <div className="flex justify-between border-t border-border pt-3 text-lg font-bold text-fg">
            <span>{ar ? "الإجمالي" : "Grand total"}</span>
            <span className="text-brand">{formatPrice(totals.grand_total, lang)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function TotalRow({ label, value, discount }: { label: string; value: string; discount?: boolean }) {
  return (
    <div className={discount ? "flex justify-between text-emerald-700" : "flex justify-between text-fg-dim"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
