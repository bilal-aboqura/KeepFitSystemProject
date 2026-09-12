"use client";

import Image from "next/image";
import { useState } from "react";
import {
  CheckCircle,
  Package,
  ShoppingBag,
} from "lucide-react";
import { useLang } from "@/components/language/provider";
import { addToCart } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import type { ResolvedBundle } from "@/lib/data/catalog";
import { FadeIn, FadeInStagger } from "@/components/ui/fade-in";

export function TrustGuaranteeSection() {
  const { t, lang } = useLang();
  const pillars = [
    { image: "/images/keepfit-easy-returns.png", title: t.home.trustReturn, desc: t.home.trustReturnDesc },
    { image: "/images/keepfit-cod-delivery.png", title: t.home.trustCod, desc: t.home.trustCodDesc },
    { image: "/images/keepfit-egypt-delivery.png", title: t.home.trustLocal, desc: t.home.trustLocalDesc },
  ];

  return (
    <section className="bg-[#080808] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5">
        <FadeIn className="grid gap-5 border-b border-white/15 pb-8 sm:grid-cols-[1.15fr_0.85fr] sm:items-end sm:pb-10">
          <div>
            <p className="text-sm font-extrabold text-brand" dir="ltr">KEEPFIT / YOUR ORDER</p>
            <h2 className="mt-4 max-w-2xl font-heading text-3xl font-black text-white sm:text-5xl">
              {t.home.trustTitle}
            </h2>
          </div>
          <p className="max-w-md text-base leading-8 text-white/65 sm:justify-self-end">
            {lang === "ar"
              ? "سياسة شراء واضحة تخليك تطلب وأنت مطمّن من أول خطوة لحد وصول الشحنة لبابك."
              : "A clear purchase policy that keeps every step reassuring, from checkout to your door."}
          </p>
        </FadeIn>
        <FadeInStagger className="mt-8 grid gap-3 sm:grid-cols-3">
          {pillars.map(({ image, title, desc }) => (
            <FadeIn key={title} className="group relative aspect-[4/5] overflow-hidden border border-white/15 bg-black sm:aspect-[3/4]">
              <Image
                src={image}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover object-top transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.02)_25%,rgba(5,5,5,0.92)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                <div className="h-px w-10 bg-brand" />
                <h3 className="mt-4 font-heading text-2xl font-black text-white">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/75">{desc}</p>
              </div>
            </FadeIn>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}

export function WhyKeepFitSection() {
  const { t } = useLang();
  const reasons = [
    { image: "/images/keepfit-goal-guidance.png", title: t.home.whyPro, desc: t.home.whyProDesc },
    { image: "/images/keepfit-clear-shopping.png", title: t.home.whyFactory, desc: t.home.whyFactoryDesc },
    { image: "/images/keepfit-customer-support.png", title: t.home.whyTested, desc: t.home.whyTestedDesc },
  ];

  return (
    <section className="border-y border-black/10 bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <FadeIn className="flex flex-col">
          <p className="text-sm font-extrabold text-brand" dir="ltr">KEEPFIT / WHY US</p>
          <h2 className="mt-4 text-balance font-heading text-3xl font-black text-fg sm:text-5xl">
            {t.home.whyTitle}
          </h2>
          <p className="mt-4 max-w-lg text-base leading-8 text-fg-dim">{t.home.whySub}</p>
          <div className="relative mt-8 aspect-[4/3] overflow-hidden border border-black/15 bg-black">
            <Image
              src="/images/keepfit-goal-guidance.png"
              alt="عميل يختار المكمل المناسب له داخل الجيم"
              fill
              sizes="(max-width: 1024px) 100vw, 42vw"
              className="object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 bg-black/75 px-5 py-4 text-sm font-bold text-white">
              {t.home.whyPro}
            </div>
          </div>
        </FadeIn>
        <FadeInStagger className="border-t border-black/15">
          {reasons.map(({ image, title, desc }) => (
            <FadeIn key={title} className="grid grid-cols-[minmax(0,1fr)_7rem] gap-5 border-b border-black/15 py-6 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-8 sm:py-8">
              <div className="order-2 relative aspect-square overflow-hidden border border-brand/70">
                <Image src={image} alt="" fill sizes="144px" className="object-cover object-top" />
              </div>
              <div className="order-1 self-center">
                <h3 className="text-lg font-black text-fg">{title}</h3>
                <p className="mt-2 max-w-2xl text-base leading-7 text-fg-dim">{desc}</p>
              </div>
            </FadeIn>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}

export function BundleOffersSection({ bundles }: { bundles: ResolvedBundle[] }) {
  const { t, lang } = useLang();
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const ar = lang === "ar";

  if (bundles.length === 0) return null;

  function handleAddBundle(bundle: ResolvedBundle) {
    const ratio = bundle.originalPrice > 0 ? bundle.bundlePrice / bundle.originalPrice : 1;

    for (const product of bundle.products) {
      const selectedVariant = product.default_variant;
      const selectedUnit = selectedVariant?.packaging_units.find((unit) => unit.is_active && unit.is_sellable && unit.is_default_sale_unit)
        ?? selectedVariant?.packaging_units.find((unit) => unit.is_active && unit.is_sellable);
      if (!selectedVariant || !selectedUnit) continue;
      const discountedPrice = Math.round(Number(product.price) * ratio);
      addToCart({
        id: `${selectedVariant.id}:${selectedUnit.id}`,
        variant_id: selectedVariant.id,
        sellable_unit_id: selectedUnit.id,
        product_id: product.id,
        sku: selectedVariant.sku,
        unit_code: selectedUnit.code,
        unit_label_en: selectedUnit.label_en,
        unit_label_ar: selectedUnit.label_ar,
        base_quantity_num: selectedUnit.base_quantity.numerator,
        base_quantity_den: selectedUnit.base_quantity.denominator,
        slug: product.slug,
        name_en: product.name_en,
        name_ar: product.name_ar,
        price: discountedPrice,
        image: product.images?.[0] ?? "/keepfit-logo.png",
        stock: selectedVariant.stock,
        variant_label_en: selectedVariant.label_en,
        variant_label_ar: selectedVariant.label_ar,
        offer_key: bundle.key,
      });
    }

    setAddedKey(bundle.key);
    window.setTimeout(() => setAddedKey(null), 2500);
  }

  return (
    <section className="border-t border-border bg-[#080808] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5">
        <FadeIn>
          <h2 className="font-heading text-3xl font-black text-white sm:text-4xl">{t.home.bundleTitle}</h2>
          <p className="mt-3 text-base text-white/60">{t.home.bundleSub}</p>
        </FadeIn>
        <FadeInStagger className="mt-10 grid gap-5 md:grid-cols-3">
          {bundles.map((bundle) => {
            const title = ar ? bundle.title_ar : bundle.title_en;
            const description = ar ? bundle.desc_ar : bundle.desc_en;
            const saving = bundle.originalPrice - bundle.bundlePrice;
            const image = bundle.image || bundle.products[0]?.images?.[0] || "/keepfit-logo.png";
            const isAdded = addedKey === bundle.key;

            return (
              <FadeIn key={bundle.key} className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111]">
                <div className="relative aspect-[4/3] overflow-hidden bg-white">
                  <Image src={image} alt={title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-contain p-4" />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1.5 text-xs font-bold text-white">
                    <Package size={13} />
                    {bundle.products.length} {ar ? "منتجات" : "items"}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-xl font-black text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/60">{description}</p>
                  <div className="mt-auto pt-6">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-2xl font-black text-brand">{formatPrice(bundle.bundlePrice, lang)}</span>
                      <span className="text-sm text-white/45 line-through">{formatPrice(bundle.originalPrice, lang)}</span>
                    </div>
                    {saving > 0 ? <p className="mt-1 text-sm font-bold text-emerald">{t.home.bundleSave} {formatPrice(saving, lang)}</p> : null}
                    <button
                      type="button"
                      onClick={() => handleAddBundle(bundle)}
                      className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 font-black text-black transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                    >
                      {isAdded ? <CheckCircle size={18} /> : <ShoppingBag size={18} />}
                      {isAdded ? (ar ? "تمت الإضافة" : "Added") : (ar ? "أضف الباكدج للسلة" : "Add bundle to cart")}
                    </button>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </FadeInStagger>
      </div>
    </section>
  );
}
