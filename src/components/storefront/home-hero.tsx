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
  const { t } = useLang();
  const pillars = [
    { image: "/images/keepfit-easy-returns.png", title: t.home.trustReturn, desc: t.home.trustReturnDesc },
    { image: "/images/keepfit-cod-delivery.png", title: t.home.trustCod, desc: t.home.trustCodDesc },
    { image: "/images/keepfit-egypt-delivery.png", title: t.home.trustLocal, desc: t.home.trustLocalDesc },
  ];

  return (
    <section className="border-y border-white/8 bg-[#080808] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5">
        <FadeIn>
          <h2 className="max-w-2xl font-heading text-3xl font-black text-white sm:text-4xl">
            {t.home.trustTitle}
          </h2>
        </FadeIn>
        <FadeInStagger className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
          {pillars.map(({ image, title, desc }) => (
            <FadeIn key={title} className="overflow-hidden bg-[#0d0d0d]">
              <div className="relative aspect-[4/3] bg-black">
                <Image src={image} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain" />
              </div>
              <div className="p-7 sm:p-8">
                <div className="h-px w-10 bg-brand" />
                <h3 className="mt-5 text-lg font-black text-white">{title}</h3>
                <p className="mt-3 text-base leading-7 text-white/60">{desc}</p>
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
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[radial-gradient(circle_at_left,rgba(255,204,0,0.1),transparent_68%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <FadeIn>
          <h2 className="text-balance font-heading text-3xl font-black text-fg sm:text-5xl">
            {t.home.whyTitle}
          </h2>
          <p className="mt-4 max-w-lg text-base leading-8 text-fg-dim">{t.home.whySub}</p>
        </FadeIn>
        <FadeInStagger className="divide-y divide-border border-y border-border">
          {reasons.map(({ image, title, desc }) => (
            <FadeIn key={title} className="flex gap-5 py-7 first:pt-0 last:pb-0 sm:gap-7">
              <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-lg border border-brand/70 sm:h-28 sm:w-36">
                <Image src={image} alt="" fill sizes="144px" className="object-cover" />
              </div>
              <div>
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
      if (!selectedVariant) continue;
      addToCart({
        id: selectedVariant.id,
        variant_id: selectedVariant.id,
        product_id: product.id,
        sku: selectedVariant.sku,
        slug: product.slug,
        name_en: product.name_en,
        name_ar: product.name_ar,
        price: Math.round(Number(product.price) * ratio),
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
