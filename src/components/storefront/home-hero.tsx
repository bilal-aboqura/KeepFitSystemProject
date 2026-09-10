"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import {
  ArrowRight,
  Sparkles,
  Truck,
  CreditCard,
  Car,
  Bike,
  Armchair,
  Wind,
  Quote,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Banknote,
  Factory,
  FlaskConical,
  Flame,
  Users,
  Star,
  Package,
  CheckCircle,
  ShoppingBag,
} from "lucide-react";
import { useLang } from "@/components/language/provider";
import { cn, formatPrice } from "@/lib/utils";
import { addToCart } from "@/lib/cart";
import type { ResolvedBundle, SocialStats, HeroOverrides } from "@/lib/data/catalog";
import { FadeIn, FadeInStagger } from "@/components/ui/fade-in";

/* ─── Constants ───────────────────────────────────────────────────────────── */

const MARQUEE_ITEMS = [
  { en: "Pay when it arrives — not before", ar: "ادفع لما المنتج يوصلك — مش قبلها", Icon: Banknote },
  { en: "7-day hassle-free returns", ar: "استرجاع خلال 7 أيام", Icon: RotateCcw },
  { en: "100% Made in Egypt", ar: "صناعة مصرية 100%", Icon: Sparkles },
  { en: "Free shipping over 600 EGP", ar: "شحن مجاني فوق 600 ج.م", Icon: Truck },
  { en: "Secure card payments", ar: "دفع آمن بالبطاقة", Icon: CreditCard },
];

const CATEGORIES = [
  { href: "/category/carcare", key: "carcare" as const, Icon: Car, image: "/images/carcare.webp", imageClassName: "object-[center_30%]" },
  { href: "/category/motocare", key: "motocare" as const, Icon: Bike, image: "/images/motocare.webp", imageClassName: "object-[center_35%]" },
  { href: "/category/carpets", key: "carpets" as const, Icon: Armchair, image: "/images/carpetscare.webp", imageClassName: "object-center" },
  { href: "/category/air-freshener", key: "freshener" as const, Icon: Wind, image: "/images/freshnerWEBPAGE.webp", imageClassName: "object-[center_40%]" },
];

const TESTIMONIALS = [
  { src: "/images/testimonial1.webp", name: { en: "Ahmed M.", ar: "أحمد م." }, city: { en: "Cairo", ar: "القاهرة" } },
  { src: "/images/testimonial2.webp", name: { en: "Mohamed S.", ar: "محمد س." }, city: { en: "Giza", ar: "الجيزة" } },
  { src: "/images/testimonial3.webp", name: { en: "Khaled A.", ar: "خالد أ." }, city: { en: "Alexandria", ar: "الإسكندرية" } },
  { src: "/images/testimonial4.webp", name: { en: "Omar H.", ar: "عمر ح." }, city: { en: "Mansoura", ar: "المنصورة" } },
  { src: "/images/testimonial5.webp", name: { en: "Youssef R.", ar: "يوسف ر." }, city: { en: "Tanta", ar: "طنطا" } },
  { src: "/images/testimonial6.webp", name: { en: "Mahmoud T.", ar: "محمود ت." }, city: { en: "Cairo", ar: "القاهرة" } },
  { src: "/images/testimonial7.webp", name: { en: "Hassan F.", ar: "حسن ف." }, city: { en: "Assiut", ar: "أسيوط" } },
  { src: "/images/testimonial8.webp", name: { en: "Tarek B.", ar: "طارق ب." }, city: { en: "Giza", ar: "الجيزة" } },
];

const BUNDLES = [
  {
    key: "fullCare" as const,
    image: "/images/gold_1l.webp",
    originalPrice: 560,
    bundlePrice: 470,
    items: 4,
  },
  {
    key: "proPack" as const,
    image: "/images/foam4k.webp",
    originalPrice: 1140,
    bundlePrice: 950,
    items: 3,
  },
  {
    key: "motoPack" as const,
    image: "/images/tire-1l.webp",
    originalPrice: 560,
    bundlePrice: 450,
    items: 4,
  },
];

const FAQ_ITEMS = [
  { q: "faq1q", a: "faq1a" },
  { q: "faq2q", a: "faq2a" },
  { q: "faq3q", a: "faq3a" },
  { q: "faq4q", a: "faq4a" },
  { q: "faq5q", a: "faq5a" },
  { q: "faq6q", a: "faq6a" },
] as const;

const DEFAULT_HERO_BACKGROUND = "/images/hs.webp";

const DEFAULT_HERO_IMAGES = [
  { src: "/images/gold_1l.webp", alt: "Dashboard Shiner Gold" },
  { src: "/images/foam4k.webp", alt: "Active Foam 4K" },
  { src: "/images/tireprime.webp", alt: "Tire Prime" },
  { src: "/images/enginecleaner-1l.webp", alt: "Engine Cleaner" },
  { src: "/images/universal-1l.webp", alt: "Universal Cleaner" },
  { src: "/images/rims-4k.webp", alt: "Rims Cleaner" },
  { src: "/images/candy-4k.webp", alt: "Candy Air Freshener" },
  { src: "/images/black-ice-4k.webp", alt: "Black Ice Air Freshener" },
];

/* ─── Hero ────────────────────────────────────────────────────────────────── */

export function HomeHero({ overrides }: { overrides?: HeroOverrides }) {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const [activeIndex, setActiveIndex] = useState(0);
  const o = overrides ?? {};
  const marqueeItems = [
    {
      ...MARQUEE_ITEMS[0],
      en: o.marquee_cod_en || MARQUEE_ITEMS[0].en,
      ar: o.marquee_cod_ar || MARQUEE_ITEMS[0].ar,
    },
    {
      ...MARQUEE_ITEMS[1],
      en: o.marquee_returns_en || MARQUEE_ITEMS[1].en,
      ar: o.marquee_returns_ar || MARQUEE_ITEMS[1].ar,
    },
    {
      ...MARQUEE_ITEMS[2],
      en: o.marquee_made_en || MARQUEE_ITEMS[2].en,
      ar: o.marquee_made_ar || MARQUEE_ITEMS[2].ar,
    },
    {
      ...MARQUEE_ITEMS[3],
      en: o.marquee_shipping_en || MARQUEE_ITEMS[3].en,
      ar: o.marquee_shipping_ar || MARQUEE_ITEMS[3].ar,
    },
    {
      ...MARQUEE_ITEMS[4],
      en: o.marquee_payments_en || MARQUEE_ITEMS[4].en,
      ar: o.marquee_payments_ar || MARQUEE_ITEMS[4].ar,
    },
  ];

  const heroBackgroundImage = o.background_image || DEFAULT_HERO_BACKGROUND;
  const heroImages = (o.product_images?.length ? o.product_images : DEFAULT_HERO_IMAGES.map((img) => img.src))
    .map((src, index) => ({
      src,
      alt: DEFAULT_HERO_IMAGES[index]?.alt ?? `Hero product ${index + 1}`,
    }));
  const heroImageCount = heroImages.length;

  useEffect(() => {
    if (heroImageCount <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((curr) => (curr + 1) % heroImageCount);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImageCount]);

  return (
    <>
      <section className="relative overflow-hidden">
        {/* Full-width Faded Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src={heroBackgroundImage}
            alt="Hero Background"
            fill
            priority
            className="object-cover opacity-40 object-center"
          />
          {/* Fade overlays to blend seamlessly */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-ink via-transparent to-ink/50" />
        </div>

        <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-brand/[0.07] blur-[140px] z-0" />
        <div className="pointer-events-none absolute -bottom-20 right-1/3 h-80 w-80 rounded-full bg-gold/[0.05] blur-[120px] z-0" />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-36">
          <div className="animate-fade-in-up">
            <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-fg sm:text-5xl lg:text-6xl">
              {(ar ? o.title_ar : o.title_en) || t.home.heroTitle}
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-fg-muted">
              {(ar ? o.subtitle_ar : o.subtitle_en) || t.home.heroSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="#bestsellers" className="btn btn-primary gap-2">
                {(ar ? o.cta_ar : o.cta_en) || t.home.shopNow}
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* Trust pills below CTA */}
            {/* <div className="mt-6 flex flex-wrap gap-2">
              <span className="pill pill-success gap-1.5">
                <Banknote size={11} />
                {(ar ? o.pill_cod_ar : o.pill_cod_en) || t.product.cod}
              </span>
              <span className="pill pill-info gap-1.5">
                <RotateCcw size={11} />
                {(ar ? o.pill_returns_ar : o.pill_returns_en) || (ar ? "استرجاع 7 أيام" : "7-day returns")}
              </span>
              <span className="pill pill-neutral gap-1.5">
                <Truck size={11} />
                {(ar ? o.pill_shipping_ar : o.pill_shipping_en) || (ar ? "شحن مجاني فوق 600 ج.م" : "Free shipping 600+ EGP")}
              </span>
            </div> */}
          </div>

          <div className="relative hidden lg:flex lg:items-center lg:justify-center">
            <div className="absolute inset-0 m-auto h-80 w-80 rounded-full bg-brand/[0.06] blur-[80px]" />
            <div className="absolute inset-0 m-auto h-64 w-64 rounded-full border border-brand/10" />
            <div className="absolute inset-0 m-auto h-[340px] w-[340px] rounded-full border border-white/[0.04]" />

            <div className="relative z-10 h-80 w-80 animate-fade-in-up">
              <div className="relative h-full w-full overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/40">
                {heroImages.map((img, i) => {
                  const isActive = i === activeIndex;
                  return (
                    <Image
                      key={img.src}
                      src={img.src}
                      alt={ar ? "منتجاتنا" : img.alt}
                      fill
                      sizes="320px"
                      priority={i === 0}
                      className={`object-contain p-4 transition-all duration-1000 ease-in-out ${
                        isActive ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-90 blur-sm"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="absolute -right-4 top-8 h-20 w-20 animate-fade-in overflow-hidden rounded-2xl bg-white shadow-xl shadow-black/30" style={{ animationDelay: "0.3s" }}>
              {heroImages.map((img, i) => {
                const isActive = i === (activeIndex + 1) % heroImages.length;
                return (
                  <Image
                    key={img.src}
                    src={img.src}
                    alt=""
                    fill
                    sizes="80px"
                    className={`object-contain p-1.5 transition-all duration-1000 ease-in-out ${
                      isActive ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-75 blur-sm"
                    }`}
                  />
                );
              })}
            </div>
            <div className="absolute -left-4 bottom-12 h-20 w-20 animate-fade-in overflow-hidden rounded-2xl bg-white shadow-xl shadow-black/30" style={{ animationDelay: "0.5s" }}>
              {heroImages.map((img, i) => {
                const isActive = i === (activeIndex + 2) % heroImages.length;
                return (
                  <Image
                    key={img.src}
                    src={img.src}
                    alt=""
                    fill
                    sizes="80px"
                    className={`object-contain p-1.5 transition-all duration-1000 ease-in-out ${
                      isActive ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-75 blur-sm"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Marquee — pill-card style with edge fade */}
      {/* <div className="relative overflow-hidden border-y border-border bg-ink py-6">
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24 bg-gradient-to-r from-ink to-transparent sm:w-40" />
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24 bg-gradient-to-l from-ink to-transparent sm:w-40" />
        
        <div className="marquee-track">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((copy) => (
            <div key={copy} className="flex shrink-0 gap-4 px-2">
              {marqueeItems.map((m, i) => (
                <div
                  key={`${copy}-${i}`}
                  className="flex shrink-0 cursor-default items-center gap-2.5 whitespace-nowrap rounded-full border-2 border-brand/20 bg-white px-8 py-3.5 text-[15px] font-bold text-black shadow-lg shadow-black/5 transition-all duration-300 hover:border-brand/40 hover:shadow-xl hover:shadow-brand/10"
                >
                  <m.Icon size={18} className="text-brand" />
                  {m[lang]}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div> */}
    </>
  );
}

/* ─── Problem / Agitation Section ─────────────────────────────────────────── */

export function ProblemSection() {
  const { t } = useLang();

  return (
    <section className="mx-auto max-w-4xl px-5 py-20 text-center">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
          {t.home.problemTitle}
        </h2>
        <p className="mt-5 text-base leading-relaxed text-fg-muted">
          {t.home.problemBody}
        </p>
        <div className="glass mt-8 border-brand/20 p-6">
          <p className="text-sm font-medium leading-relaxed text-brand-soft">
            {t.home.problemHighlight}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Trust & Guarantee Section ───────────────────────────────────────────── */

export function TrustGuaranteeSection() {
  const { t } = useLang();

  const pillars = [
    {
      id: "return",
      Icon: RotateCcw,
      title: t.home.trustReturn,
      desc: t.home.trustReturnDesc,
      color: "bg-brand/10 text-brand",
    },
    {
      id: "cash-on-delivery",
      Icon: Banknote,
      title: t.home.trustCod,
      desc: t.home.trustCodDesc,
      color: "bg-emerald/10 text-emerald",
    },
    {
      id: "made-in-egypt",
      Icon: Factory,
      title: t.home.trustLocal,
      desc: t.home.trustLocalDesc,
      color: "bg-gold/10 text-gold",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-5 py-20">
      <FadeIn>
        <h2 className="text-center font-heading text-2xl font-bold text-fg sm:text-3xl">
          {t.home.trustTitle}
        </h2>
      </FadeIn>
      <FadeInStagger className="mt-10 grid gap-5 sm:grid-cols-3">
        {pillars.map(({ id, Icon, title, desc, color }) => (
          <FadeIn key={id} className="glass p-6 text-center">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${color}`}>
              <Icon size={24} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-fg">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-dim">{desc}</p>
          </FadeIn>
        ))}
      </FadeInStagger>
    </section>
  );
}

/* ─── Why Xeemo Section ───────────────────────────────────────────────────── */

export function WhyXeemoSection() {
  const { t } = useLang();

  const reasons = [
    { Icon: FlaskConical, title: t.home.whyPro, desc: t.home.whyProDesc },
    { Icon: Factory, title: t.home.whyFactory, desc: t.home.whyFactoryDesc },
    { Icon: Flame, title: t.home.whyTested, desc: t.home.whyTestedDesc },
  ];

  return (
    <section className="border-y border-border bg-white/[0.01] py-20">
      <div className="mx-auto max-w-7xl px-5">
        <FadeIn className="text-center">
          <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
            {t.home.whyTitle}
          </h2>
          <p className="mt-2 text-sm text-fg-dim">{t.home.whySub}</p>
        </FadeIn>
        <FadeInStagger className="mt-10 grid gap-6 sm:grid-cols-3">
          {reasons.map(({ Icon, title, desc }) => (
            <FadeIn key={title} className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon size={22} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-fg">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">{desc}</p>
              </div>
            </FadeIn>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}

/* ─── Bundle Offers Section ───────────────────────────────────────────────── */

export function BundleOffersSection({ bundles }: { bundles?: ResolvedBundle[] }) {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const [addedKey, setAddedKey] = useState<string | null>(null);

  const fallbackBundles = BUNDLES;
  const resolved = bundles && bundles.length > 0;

  function handleAddBundle(bundle: ResolvedBundle) {
    const totalOriginal = bundle.originalPrice;
    const ratio = totalOriginal > 0 ? bundle.bundlePrice / totalOriginal : 1;

    for (const product of bundle.products) {
      const discountedPrice = Math.round(Number(product.price) * ratio);
      addToCart({
        id: product.id,
        slug: product.slug,
        name_en: product.name_en,
        name_ar: product.name_ar,
        price: discountedPrice,
        image: product.images?.[0] ?? "/images/placeholder.webp",
        stock: product.stock,
      });
    }
    setAddedKey(bundle.key);
    setTimeout(() => setAddedKey(null), 2500);
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-20">
      <FadeIn className="text-center">
        <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
          {t.home.bundleTitle}
        </h2>
        <p className="mt-2 text-sm text-fg-dim">{t.home.bundleSub}</p>
      </FadeIn>
      <FadeInStagger className="mt-10 grid gap-5 sm:grid-cols-3">
        {resolved
          ? bundles.map((b) => {
              const title = ar ? b.title_ar : b.title_en;
              const desc = ar ? b.desc_ar : b.desc_en;
              const saving = b.originalPrice - b.bundlePrice;
              const image = b.image || b.products[0]?.images?.[0] || "/images/placeholder.webp";
              const isAdded = addedKey === b.key;
              return (
                <FadeIn key={b.key} className="glass group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-lg hover:shadow-brand/5">
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                    <Image
                      src={image}
                      alt={title}
                      fill
                      sizes="(max-width:768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-2.5 top-2.5">
                      <span className="pill pill-warning gap-1">
                        <Package size={10} />
                        {b.products.length} {ar ? "منتجات" : "items"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-base font-semibold text-fg">{title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">{desc}</p>
                    <ul className="mt-2 space-y-0.5">
                      {b.products.map((p) => (
                        <li key={p.id} className="text-[11px] text-fg-dim">
                          &bull; {ar ? p.name_ar : p.name_en}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-brand">{formatPrice(b.bundlePrice, lang)}</span>
                        <span className="text-sm text-fg-dim line-through">{formatPrice(b.originalPrice, lang)}</span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-emerald">
                        {t.home.bundleSave} {formatPrice(saving, lang)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAddBundle(b)}
                      className="btn btn-primary mt-4 w-full gap-2 text-sm"
                    >
                      {isAdded ? (
                        <><CheckCircle size={14} /> {ar ? "تمت الإضافة للسلة" : "Added to Cart"}</>
                      ) : (
                        <><ShoppingBag size={14} /> {ar ? "أضف الباكدج للسلة" : "Add Bundle to Cart"}</>
                      )}
                    </button>
                  </div>
                </FadeIn>
              );
            })
          : fallbackBundles.map((b) => {
              const bundleDetails: Record<string, { title: string; desc: string }> = {
                fullCare: { title: t.home.bundleFullCare, desc: t.home.bundleFullCareDesc },
                proPack: { title: t.home.bundleProPack, desc: t.home.bundleProPackDesc },
                motoPack: { title: t.home.bundleMotoPack, desc: t.home.bundleMotoPackDesc },
              };
              const info = bundleDetails[b.key];
              const saving = b.originalPrice - b.bundlePrice;
              return (
                <FadeIn key={b.key} className="glass group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-lg hover:shadow-brand/5">
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                    <Image
                      src={b.image}
                      alt={info.title}
                      fill
                      sizes="(max-width:768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-2.5 top-2.5">
                      <span className="pill pill-warning gap-1">
                        <Package size={10} />
                        {b.items} {ar ? "منتجات" : "items"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-base font-semibold text-fg">{info.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">{info.desc}</p>
                    <div className="mt-auto pt-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-brand">{formatPrice(b.bundlePrice, lang)}</span>
                        <span className="text-sm text-fg-dim line-through">{formatPrice(b.originalPrice, lang)}</span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-emerald">
                        {t.home.bundleSave} {formatPrice(saving, lang)}
                      </p>
                    </div>
                    <Link
                      href="https://wa.me/201150301033"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary mt-4 w-full gap-2 text-sm"
                    >
                      {t.home.shopNow}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </FadeIn>
              );
            })}
      </FadeInStagger>
    </section>
  );
}

/* ─── FAQ / Objection Killer ──────────────────────────────────────────────── */

export function FAQSection() {
  const { t } = useLang();

  return (
    <section className="mx-auto max-w-3xl px-5 py-20">
      <div className="text-center">
        <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
          {t.home.faqTitle}
        </h2>
        <p className="mt-2 text-sm text-fg-dim">{t.home.faqSub}</p>
      </div>
      <div className="mt-10 space-y-3">
        {FAQ_ITEMS.map(({ q, a }, i) => (
          <details
            key={i}
            className="faq-item glass overflow-hidden"
            {...(i === 0 ? { open: true } : {})}
          >
            <summary className="flex items-center justify-between gap-4 p-5 text-sm font-semibold text-fg">
              <span>{t.home[q]}</span>
              <ChevronDown size={16} className="faq-chevron shrink-0 text-fg-dim" />
            </summary>
            <div className="border-t border-border px-5 pb-5 pt-4 text-sm leading-relaxed text-fg-muted">
              {t.home[a]}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ─── Final CTA ───────────────────────────────────────────────────────────── */

/* ─── Category Grid (kept for navbar/other pages) ─────────────────────────── */

export function CategoryGrid() {
  const { t, lang } = useLang();
  return (
    <section id="categories" className="mx-auto max-w-7xl px-5 py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
            {t.home.categories}
          </h2>
          <p className="mt-1 text-sm text-fg-dim">
            {lang === "ar" ? "اختر الفئة التي تناسبك" : "Browse by what you need"}
          </p>
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map(({ href, key, Icon }) => (
          <Link
            key={href}
            href={href}
            className="glass group flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-lg hover:shadow-brand/5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
              <Icon size={22} />
            </div>
            <div className="flex-1">
              <span className="block text-sm font-semibold text-fg">
                {t.nav[key]}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-fg-dim opacity-0 transition group-hover:opacity-100">
                {t.home.explore}
                <ArrowRight size={12} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─── Testimonials (upgraded with stats + names) ──────────────────────────── */

export function Testimonials({ stats }: { stats?: SocialStats }) {
  const { t, lang } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);
  const ar = lang === "ar";

  const s = stats ?? { customers: "+500", carWashes: "+50", rating: "4.8/5" };

  function scroll(action: "prev" | "next") {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    
    // In LTR: next = scroll right (+), prev = scroll left (-)
    // In RTL: next = scroll left (-), prev = scroll right (+)
    const physicalRight = ar ? action === "prev" : action === "next";
    
    el.scrollBy({ left: physicalRight ? amount : -amount, behavior: "smooth" });
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-20">
      {/* Stats bar — editable via admin settings (keys: stat_customers, stat_carwashes, stat_rating) */}
      <FadeInStagger className="mb-10 flex flex-wrap justify-center gap-6 sm:gap-10">
        <FadeIn><StatItem icon={<Users size={18} />} value={s.customers} label={ar ? "عميل" : "Customers"} /></FadeIn>
        <FadeIn><StatItem icon={<Car size={18} />} value={s.carWashes} label={ar ? "مغسلة" : "Car washes"} /></FadeIn>
        <FadeIn><StatItem icon={<Star size={18} />} value={s.rating} label={ar ? "تقييم" : "Rating"} /></FadeIn>
      </FadeInStagger>

      <FadeIn className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
            {t.home.testimonials}
          </h2>
          <p className="mt-1 text-sm text-fg-dim">
            {ar ? "آراء حقيقية من عملاؤنا" : "Real feedback from our customers"}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {/* "Prev" Button: visually on Left in LTR, on Right in RTL */}
          <button
            onClick={() => scroll("prev")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-fg-dim transition hover:border-brand/40 hover:text-fg active:scale-95"
          >
            {ar ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          
          {/* "Next" Button: visually on Right in LTR, on Left in RTL */}
          <button
            onClick={() => scroll("next")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-fg-dim transition hover:border-brand/40 hover:text-fg active:scale-95"
          >
            {ar ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </FadeIn>

      <FadeIn>
        <div
          ref={scrollRef}
          className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="group w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-ink transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-2xl hover:shadow-black/50 sm:w-[320px]"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/60 sm:aspect-[4/5]">
                {/* Blurred dynamic backdrop */}
                <div className="absolute inset-0 z-0 opacity-40 blur-2xl transition-opacity duration-500 group-hover:opacity-60">
                  <Image src={t.src} alt="" fill sizes="100px" className="object-cover" />
                </div>
                
                <Image
                  src={t.src}
                  alt={`${t.name[lang]} — ${t.city[lang]}`}
                  fill
                  sizes="(max-width: 640px) 280px, 320px"
                  className="relative z-10 object-contain p-3 transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
              
              <div className="relative z-20 border-t border-white/[0.04] bg-surface/80 px-5 py-4 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Quote size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-sm font-bold text-fg">{t.name[lang]}</span>
                    <span className="block text-[11px] font-medium text-fg-dim">{t.city[lang]}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
        {icon}
      </div>
      <div>
        <span className="block text-lg font-bold text-fg">{value}</span>
        <span className="block text-xs text-fg-dim">{label}</span>
      </div>
    </div>
  );
}
