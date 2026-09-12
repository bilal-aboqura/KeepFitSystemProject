"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, MapPin, ShieldCheck } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { cn } from "@/lib/utils";
import type { HeroOverrides } from "@/lib/data/catalog";

const BRAND_COPY_RE = /keepfit|supplement|protein|creatine|nutrition|fitness|goal|\u0645\u0643\u0645\u0644|\u0628\u0631\u0648\u062a\u064a\u0646|\u0643\u0631\u064a\u0627\u062a\u064a\u0646|\u062a\u063a\u0630\u064a|\u0647\u062f\u0641|\u0631\u064a\u0627\u0636/i;

function safeCopy(value: string | undefined, fallback: string) {
  const text = value?.trim();
  return text && BRAND_COPY_RE.test(text) ? text : fallback;
}

export function HomeHero({ overrides }: { overrides?: HeroOverrides }) {
  const { lang } = useLang();
  const ar = lang === "ar";

  const title = safeCopy(
    ar ? overrides?.title_ar : overrides?.title_en,
    ar ? "كل هدف يبدأ من تغذية صح." : "Fuel every goal.",
  );
  const subtitle = safeCopy(
    ar ? overrides?.subtitle_ar : overrides?.subtitle_en,
    ar
      ? "مكملاتك وأساسياتك الرياضية في مكان واحد. اختار اللي يناسب هدفك وكمّل أقوى كل يوم."
      : "Supplements and training essentials in one place. Find what fits your goal and keep moving forward.",
  );
  const cta = ar ? "تسوق دلوقتي" : "Shop now";

  const trustItems = ar
    ? [
        { Icon: ShieldCheck, label: "دفع آمن ومرن" },
        { Icon: MapPin, label: "توصيل داخل مصر" },
        { Icon: Check, label: "اختيارات لكل هدف" },
      ]
    : [
        { Icon: ShieldCheck, label: "Secure, flexible payment" },
        { Icon: MapPin, label: "Delivery across Egypt" },
        { Icon: Check, label: "Options for every goal" },
      ];

  return (
    <section
      data-home-hero
      className="relative isolate overflow-hidden border-b border-white/10 bg-[#050505]"
    >
      <Image
        src="/keepfit-hero.jpeg"
        alt=""
        fill
        priority
        quality={88}
        sizes="100vw"
        className="object-cover object-[34%_center] sm:object-[38%_center] lg:object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.05)_0%,rgba(5,5,5,0.28)_38%,rgba(5,5,5,0.92)_76%,#050505_100%)] lg:bg-[linear-gradient(90deg,rgba(5,5,5,0.03)_0%,rgba(5,5,5,0.12)_42%,rgba(5,5,5,0.88)_69%,#050505_100%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent" />

      <div
        dir="ltr"
        className="relative z-10 mx-auto flex min-h-[calc(100svh-72px)] max-w-[96rem] items-end px-5 pb-10 pt-[23rem] sm:px-8 sm:pb-14 sm:pt-[27rem] lg:items-center lg:justify-end lg:px-12 lg:py-24"
      >
        <div className="max-w-[41rem] text-start lg:w-[47%]" dir={ar ? "rtl" : "ltr"}>
          <h1 className="max-w-[12ch] text-balance font-heading text-[clamp(2.85rem,6vw,5.3rem)] font-extrabold leading-[1.12] tracking-[-0.025em] text-white [text-shadow:0_3px_22px_rgba(0,0,0,0.7)]">
            {ar && title === "كل هدف يبدأ من تغذية صح." ? (
              <>
                <span className="block">كل هدف يبدأ</span>
                <span className="mt-3 block">من تغذية صح.</span>
              </>
            ) : title}
          </h1>
          <p className="mt-6 max-w-[39rem] text-pretty text-base font-medium leading-8 text-white/80 [text-shadow:0_2px_14px_rgba(0,0,0,0.8)] sm:text-lg sm:leading-9">
            {subtitle}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="#bestsellers"
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-brand px-7 text-base font-black text-black transition duration-200 hover:-translate-y-0.5 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              {cta}
              <ArrowLeft size={19} className={cn(!ar && "rotate-180")} />
            </Link>
            <Link
              href="#categories"
              className="inline-flex min-h-14 items-center justify-center rounded-lg border border-white/25 px-7 text-base font-bold text-white transition duration-200 hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              {ar ? "اختار هدفك" : "Shop by goal"}
            </Link>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6">
            {trustItems.map(({ Icon, label }) => (
              <li key={label} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-white/70">
                <Icon size={18} className="text-brand" aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
