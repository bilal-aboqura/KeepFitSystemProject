"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/components/language/provider";
import type { CategoryInfo } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";
import { FadeIn, FadeInStagger } from "@/components/ui/fade-in";

const CATEGORY_META: Record<
  string,
  {
    href: string;
    fallbackImage: string;
    imageClassName: string;
    descEn: string;
    descAr: string;
  }
> = {
  carcare: {
    href: "/category/carcare",
    fallbackImage: "/images/carcare.webp",
    imageClassName: "object-[center_30%]",
    descEn:
      "Detailing formulas for paint, dashboard, tires, and the finish that makes the whole car feel fresh again.",
    descAr:
      "منتجات تلميع وعناية للدهان والتابلوه والإطارات علشان عربيتك ترجع بأفضل شكل.",
  },
  motocare: {
    href: "/category/motocare",
    fallbackImage: "/images/motocare.webp",
    imageClassName: "object-[center_35%]",
    descEn:
      "Cleaners and shiners made for riders who care about a sharper look and easier upkeep.",
    descAr:
      "عناية مخصصة للموتوسيكلات تحافظ على اللمعة والنظافة وتخلي الصيانة اليومية أسهل.",
  },
  carpets: {
    href: "/category/carpets",
    fallbackImage: "/images/carpetscare.webp",
    imageClassName: "object-center",
    descEn:
      "Deep-clean solutions for carpets, seats, and fabric surfaces that need a proper reset.",
    descAr:
      "حلول تنظيف عميق للسجاد والمفروشات والأسطح القماشية اللي محتاجة فرق واضح من أول استخدام.",
  },
  "air-freshener": {
    href: "/category/air-freshener",
    fallbackImage: "/images/freshnerWEBPAGE.webp",
    imageClassName: "object-[center_40%]",
    descEn:
      "Long-lasting scents that give the cabin a cleaner, calmer feel without overpowering it.",
    descAr:
      "معطرات بروائح ثابتة تضيف إحساس أنضف وأهدى داخل العربية من غير ما تبقى مزعجة.",
  },
  "home-care": {
    href: "/category/home-care",
    fallbackImage: "/images/home-care.jpeg",
    imageClassName: "object-center",
    descEn:
      "Everyday care for cleaner rooms, refreshed fabrics, and a home that feels properly looked after.",
    descAr:
      "منتجات عناية يومية لنظافة الغرف والمفروشات وبيت دايمًا شكله وإحساسه أحسن.",
  },
};

const CATEGORY_ORDER = ["carcare", "motocare", "carpets", "air-freshener", "home-care"] as const;

const NAV_KEY_BY_SLUG = {
  carcare: "carcare",
  motocare: "motocare",
  carpets: "carpets",
  "air-freshener": "freshener",
  "home-care": "homecare",
} as const;

export function CategoryGrid({
  categories,
}: {
  categories: CategoryInfo[];
}) {
  const { lang, t } = useLang();
  const ar = lang === "ar";
  const categoryMap = new Map(categories.map((category) => [category.slug, category]));

  const cards = CATEGORY_ORDER.map((slug) => {
    const category = categoryMap.get(slug);
    const meta = CATEGORY_META[slug];
    if (!category || !meta) return null;

    return {
      href: meta.href,
      title: t.nav[NAV_KEY_BY_SLUG[slug]],
      image: category.image || meta.fallbackImage,
      imageClassName: meta.imageClassName,
      description: ar ? meta.descAr : meta.descEn,
    };
  }).filter((card): card is NonNullable<typeof card> => Boolean(card));

  if (cards.length === 0) return null;

  return (
    <section id="categories" className="py-20">
      <div className="mx-auto max-w-7xl px-5">
        <div className="max-w-2xl">
          <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
            {t.home.categories}
          </h2>
          <p className="mt-1 text-sm text-fg-dim">
            {ar ? "اختر الفئة التي تناسبك" : "Browse by what you need"}
          </p>
        </div>

        <div
          className="-mx-5 mt-8 overflow-x-auto px-5 pb-2 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <FadeInStagger className="flex w-max snap-x snap-mandatory gap-4 lg:grid lg:w-auto lg:grid-cols-3 lg:gap-5 xl:grid-cols-5">
            {cards.map((card) => (
              <FadeIn key={card.href} className="shrink-0 snap-start lg:shrink-1">
                <Link
                  href={card.href}
                  className="group relative block h-[26rem] w-[min(76vw,19rem)] overflow-hidden rounded-lg border border-white/10 transition duration-300 hover:-translate-y-1 hover:border-brand/30 lg:h-[31rem] lg:w-auto"
                >
                  <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    sizes="(max-width: 1024px) 76vw, 25vw"
                    className={cn(
                      "object-cover transition duration-500 group-hover:scale-[1.03]",
                      card.imageClassName,
                    )}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.06)_0%,rgba(9,9,11,0.16)_34%,rgba(9,9,11,0.9)_100%)]" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(220,38,38,0)_0%,rgba(220,38,38,0.1)_100%)] opacity-0 transition duration-300 group-hover:opacity-100" />

                  <div className="absolute inset-x-0 bottom-0 flex min-h-[12rem] flex-col justify-end p-5 lg:p-6">
                    <div className="max-w-[15rem]">
                      <h3 className="text-[1.8rem] font-bold leading-tight text-white lg:text-[2rem]">
                        {card.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-white/78">
                        {card.description}
                      </p>
                      <div
                        className={cn(
                          "mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/14 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-sm transition group-hover:border-white/24 group-hover:bg-white/14",
                          ar ? "flex-row-reverse" : "flex-row",
                        )}
                      >
                        <span>{t.home.explore}</span>
                        <ArrowRight size={16} className={cn(ar && "rotate-180")} />
                      </div>
                    </div>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </FadeInStagger>
        </div>
      </div>
    </section>
  );
}
