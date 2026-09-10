"use client";

import { useState } from "react";
import { ShoppingBag, CheckCircle } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { addToCart } from "@/lib/cart";
import { productMetaParams, trackMetaEvent } from "@/lib/meta-pixel";
import { trackStoreEvent } from "@/lib/store-analytics";

interface Props {
  product: { id: string; slug: string; name_en: string; name_ar: string; price: number; images?: string[]; image?: string; stock: number };
  quantity?: number;
  variant?: "primary" | "ghost";
  className?: string;
}

export function AddToCartButton({ product, quantity = 1, variant = "primary", className = "" }: Props) {
  const { t, lang } = useLang();
  const [added, setAdded] = useState(false);
  const out = product.stock <= 0;

  function handle() {
    if (out) return;
    addToCart({ id: product.id, slug: product.slug, name_en: product.name_en, name_ar: product.name_ar, price: Number(product.price), image: product.images?.[0] ?? product.image ?? "/images/placeholder.webp", stock: product.stock }, quantity);
    trackMetaEvent("AddToCart", productMetaParams({
      id: product.id,
      price: Number(product.price),
      quantity,
    }));
    trackStoreEvent("add_to_cart");
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={out}
      className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"} gap-2 ${className}`}
    >
      {out ? t.product.outOfStock : added ? <><CheckCircle size={16} /> {lang === "ar" ? "تمت الإضافة" : "Added"}</> : <><ShoppingBag size={16} /> {t.product.addToCart}</>}
    </button>
  );
}
