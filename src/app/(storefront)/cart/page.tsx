"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Trash2, ArrowRight, Minus, Plus, Truck, CheckCircle } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { useCart, updateQuantity, removeFromCart, clearCart } from "@/lib/cart";
import { calcItemsSubtotal } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/meta-pixel";
import { trackStoreEvent } from "@/lib/store-analytics";

const FREE_SHIPPING_THRESHOLD = 600;

export default function CartPage() {
  const { t, lang } = useLang();
  const items = useCart();
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(FREE_SHIPPING_THRESHOLD);
  const subtotal = calcItemsSubtotal(items);
  const ar = lang === "ar";
  const freeShipping = subtotal >= freeShippingThreshold;
  const remaining = Math.max(freeShippingThreshold - subtotal, 0);
  const progress = Math.min((subtotal / freeShippingThreshold) * 100, 100);

  useEffect(() => {
    fetch("/api/checkout-data")
      .then((r) => r.json())
      .then((data) => {
        const threshold = Number(data.freeShippingThreshold);
        if (Number.isFinite(threshold) && threshold > 0) {
          setFreeShippingThreshold(threshold);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="flex items-center gap-3 font-heading text-3xl font-bold text-fg">
        <ShoppingBag size={28} className="text-brand" />
        {t.cart.title}
      </h1>

      {items.length === 0 ? (
        <div className="glass mt-10 flex flex-col items-center gap-5 p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.03]">
            <ShoppingBag size={28} className="text-fg-dim" />
          </div>
          <p className="text-fg-muted">{t.cart.empty}</p>
          <Link href="/category/carcare" className="btn btn-primary">
            {t.cart.continueShopping}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-3">
            {/* Free shipping progress bar */}
            <div className="glass p-4">
              <div className="flex items-center gap-2 text-sm">
                <Truck size={16} className={freeShipping ? "text-emerald" : "text-brand"} />
                {freeShipping ? (
                  <span className="flex items-center gap-1.5 font-medium text-emerald">
                    <CheckCircle size={14} />
                    {t.cart.freeShippingUnlocked}
                  </span>
                ) : (
                  <span className="text-fg-muted">
                    <span className="font-semibold text-brand">{formatPrice(remaining, lang)}</span>
                    {" "}{t.cart.freeShippingRemaining}
                  </span>
                )}
              </div>
              <div className="shipping-bar mt-2">
                <div
                  className={`shipping-bar-fill ${freeShipping ? "" : "shipping-bar-fill-pending"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {items.map((item) => {
              const name = ar ? item.name_ar : item.name_en;
              return (
                <div key={item.id} className="glass flex items-center gap-4 p-4">
                  <Link href={`/product/${item.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">
                    <Image src={item.image} alt={name} fill sizes="80px" className="object-contain p-1.5" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${item.slug}`} className="line-clamp-2 text-sm font-medium text-fg transition hover:text-brand">
                      {name}
                    </Link>
                    <p className="mt-1 text-sm font-semibold text-brand">
                      {formatPrice(item.price, lang)}
                    </p>
                  </div>
                  <div className="flex items-center rounded-xl border border-border">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="flex h-9 w-9 items-center justify-center text-fg-dim hover:text-fg">
                      <Minus size={14} />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums text-fg">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="flex h-9 w-9 items-center justify-center text-fg-dim hover:text-fg">
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="hidden w-24 text-right text-sm font-semibold text-fg sm:block">
                    {formatPrice(item.price * item.quantity, lang)}
                  </div>
                  <button onClick={() => removeFromCart(item.id)} aria-label="Remove" className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-dim transition hover:bg-brand/10 hover:text-brand">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
            <button onClick={() => clearCart()} className="mt-1 flex items-center gap-1.5 self-start text-xs text-fg-dim transition hover:text-brand">
              <Trash2 size={12} />
              {ar ? "إفراغ السلة" : "Clear cart"}
            </button>
          </div>

          <aside className="glass-elevated h-fit p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
              {ar ? "ملخص الطلب" : "Order summary"}
            </h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-dim">{t.cart.subtotal}</dt>
                <dd className="font-medium text-fg">{formatPrice(subtotal, lang)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-dim">{t.cart.shipping}</dt>
                <dd className={freeShipping ? "font-medium text-emerald" : "text-fg-dim"}>
                  {freeShipping
                    ? (ar ? "مجاني" : "Free")
                    : (ar ? "عند الدفع" : "At checkout")}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex justify-between border-t border-border pt-5">
              <span className="font-semibold text-fg">{t.cart.total}</span>
              <span className="text-xl font-bold text-brand">{formatPrice(subtotal, lang)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => {
                trackMetaEvent("InitiateCheckout", {
                  value: subtotal,
                  currency: "EGP",
                  content_type: "product",
                  content_ids: items.map((item) => item.id),
                  contents: items.map((item) => ({
                    id: item.id,
                    quantity: item.quantity,
                    item_price: item.price,
                  })),
                });
                trackStoreEvent("initiate_checkout");
              }}
              className="btn btn-primary mt-6 w-full gap-2"
            >
              {t.cart.checkout}
              <ArrowRight size={16} />
            </Link>
            <Link href="/category/carcare" className="mt-3 block text-center text-xs text-fg-dim transition hover:text-fg">
              {t.cart.continueShopping}
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
