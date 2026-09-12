"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Star, Banknote } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { formatPrice } from "@/lib/utils";
import { addToCart } from "@/lib/cart";
import { productMetaParams, trackMetaEvent } from "@/lib/meta-pixel";
import type { ProductCard as ProductCardData } from "@/lib/data/catalog";

export function ProductCard({ product }: { product: ProductCardData }) {
  const { t, lang } = useLang();
  const name = lang === "ar" ? product.name_ar : product.name_en;
  const image = product.images?.[0] ?? "/images/placeholder.webp";
  const outOfStock = product.stock <= 0;
  const ar = lang === "ar";
  const price = Number(product.price);
  const compareAtPrice = Number(product.compare_at_price);
  const hasSale = Number.isFinite(compareAtPrice) && compareAtPrice > price;
  const savings = hasSale ? compareAtPrice - price : 0;
  const discountPercent = hasSale ? Math.round((savings / compareAtPrice) * 100) : 0;
  const quickVariant = product.variant_count === 1 ? product.default_variant : null;

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock || !quickVariant) return;
    addToCart({
      id: quickVariant.id,
      variant_id: quickVariant.id,
      product_id: product.id,
      sku: quickVariant.sku,
      slug: product.slug,
      name_en: product.name_en,
      name_ar: product.name_ar,
      price,
      image,
      stock: quickVariant.stock,
      variant_label_en: quickVariant.label_en,
      variant_label_ar: quickVariant.label_ar,
    });
    trackMetaEvent("AddToCart", productMetaParams({
      id: product.id,
      price,
    }));
  }

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/40 transition-all duration-300 hover:-translate-y-1 hover:border-border-hover hover:shadow-xl hover:shadow-black/20"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-white">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
        />

        {/* Badges */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5">
          {product.is_featured && (
            <span className="pill pill-danger gap-1">
              <Star size={10} />
              {ar ? "مميز" : "Featured"}
            </span>
          )}
        </div>

        {/* Quick add */}
        {!outOfStock && quickVariant && (
          <button
            onClick={handleQuickAdd}
            className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white transition-opacity duration-200 hover:bg-brand-dark focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
            aria-label={ar ? `أضف ${name} للسلة` : `Add ${name} to cart`}
          >
            <ShoppingBag size={16} />
          </button>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <span className="text-sm font-semibold text-white/80">
              {ar ? "غير متوفر" : "Out of stock"}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-fg">
          {name}
        </h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-2">
          <span className="text-lg font-extrabold text-brand">
            {formatPrice(price, lang)}
          </span>
          {hasSale && (
            <>
              <span className="text-xs text-fg-dim line-through">
                {formatPrice(compareAtPrice, lang)}
              </span>
              <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
                {ar ? `وفر ${formatPrice(savings, lang)} · ${discountPercent}%` : `Save ${formatPrice(savings, lang)} · ${discountPercent}%`}
              </span>
            </>
          )}
        </div>
        {/* COD trust badge */}
        <span className="flex items-center gap-1 text-[11px] text-fg-dim">
          <Banknote size={10} className="text-emerald" />
          {t.product.cod}
        </span>
      </div>
    </Link>
  );
}
