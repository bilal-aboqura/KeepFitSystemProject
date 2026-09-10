"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { cn } from "@/lib/utils";
import type { HeroOverrides, HeroSlide } from "@/lib/data/catalog";
import { FadeIn, FadeInStagger } from "@/components/ui/fade-in";

const ARABIC_RE = /[\u0600-\u06ff]/;
const MOJIBAKE_RE = /[ØÙÛÃÂ]/;

function heroText(value: string | undefined, fallback = "") {
  const text = (value || fallback).trim();
  if (!text || ARABIC_RE.test(text) || !MOJIBAKE_RE.test(text)) return text;

  const decoded = new TextDecoder().decode(
    Uint8Array.from(Array.from(text), (char) => char.charCodeAt(0)),
  );
  return decoded.includes("\uFFFD") ? text : decoded;
}

const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    image: "/images/hs.webp",
    title_en: "Your car will look showroom-fresh",
    title_ar: "عربيتك هتبان كأنها لسه نازلة من المعرض",
    subtitle_en: "The detailing products that car wash pros use - now in your hands.",
    subtitle_ar: "منتجات التلميع والعناية اللي بيستخدمها أصحاب المغاسل - دلوقتي في إيدك.",
    cta_en: "See the Best Sellers",
    cta_ar: "شوف الأكثر مبيعا",
    href: "#bestsellers",
  },
];

export function HomeHero({ overrides }: { overrides?: HeroOverrides }) {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const [activeIndex, setActiveIndex] = useState(0);
  const o = overrides ?? {};

  const slides = o.slides?.length
    ? o.slides
    : [
        {
          image: o.background_image || DEFAULT_HERO_SLIDES[0].image,
          title_en: o.title_en || DEFAULT_HERO_SLIDES[0].title_en,
          title_ar: o.title_ar || DEFAULT_HERO_SLIDES[0].title_ar,
          subtitle_en: o.subtitle_en || DEFAULT_HERO_SLIDES[0].subtitle_en,
          subtitle_ar: o.subtitle_ar || DEFAULT_HERO_SLIDES[0].subtitle_ar,
          cta_en: o.cta_en || DEFAULT_HERO_SLIDES[0].cta_en,
          cta_ar: o.cta_ar || DEFAULT_HERO_SLIDES[0].cta_ar,
          href: DEFAULT_HERO_SLIDES[0].href,
        },
      ];
  const slideCount = slides.length;
  const activeSlide = slides[activeIndex] ?? slides[0];
  const PrevIcon = ar ? ChevronRight : ChevronLeft;
  const NextIcon = ar ? ChevronLeft : ChevronRight;
  const title = heroText(ar ? activeSlide.title_ar : activeSlide.title_en, t.home.heroTitle);
  const subtitle = heroText(ar ? activeSlide.subtitle_ar : activeSlide.subtitle_en, t.home.heroSubtitle);
  const cta = heroText(ar ? activeSlide.cta_ar : activeSlide.cta_en, t.home.shopNow);

  useEffect(() => {
    if (slideCount <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((curr) => (curr + 1) % slideCount);
    }, 5000);
    return () => clearInterval(interval);
  }, [slideCount]);

  function goToSlide(index: number) {
    if (index < 0) {
      setActiveIndex(slideCount - 1);
      return;
    }
    setActiveIndex(index % slideCount);
  }

  return (
    <section data-home-hero className="relative isolate overflow-hidden bg-ink">
      <div className="relative min-h-[calc(100svh-72px)] sm:min-h-[680px] lg:min-h-[calc(100svh-72px)]">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={`${slide.image}-${index}`}
              className={cn(
                "absolute inset-0 transition-opacity duration-700",
                isActive ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <Image
                src={slide.image}
                alt={heroText(ar ? slide.title_ar : slide.title_en, ar ? "صورة القسم الرئيسي" : "Hero slide")}
                fill
                priority={index === 0}
                sizes="100vw"
                className={cn(
                  "object-cover object-center transition-transform duration-[6000ms]",
                  isActive && "scale-105",
                )}
              />
              <div
                className={cn(
                  "absolute inset-0",
                  ar
                    ? "bg-[linear-gradient(270deg,rgba(7,10,16,0.95)_0%,rgba(7,10,16,0.82)_35%,rgba(7,10,16,0.42)_68%,rgba(7,10,16,0.72)_100%)]"
                    : "bg-[linear-gradient(90deg,rgba(7,10,16,0.95)_0%,rgba(7,10,16,0.82)_35%,rgba(7,10,16,0.42)_68%,rgba(7,10,16,0.72)_100%)]",
                )}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,16,0.2)_0%,rgba(7,10,16,0)_42%,rgba(7,10,16,0.9)_100%)]" />
            </div>
          );
        })}

        <div
          className={cn(
            "relative z-10 mx-auto flex min-h-[calc(100svh-72px)] max-w-7xl items-center px-5 pb-24 pt-10 sm:min-h-[680px] sm:pb-32 sm:pt-20 lg:min-h-[calc(100svh-72px)] lg:py-28",
            ar ? "justify-start text-right" : "justify-start text-left",
          )}
        >
          <FadeInStagger className="flex max-w-[46rem] flex-col items-start">
            <FadeIn>
              <h1
                className={cn(
                  "max-w-4xl text-white [text-wrap:balance]",
                  ar
                    ? "font-sans text-[2.6rem] font-extrabold leading-[1.24] sm:text-6xl sm:leading-[1.18] lg:text-7xl lg:leading-[1.16]"
                    : "font-heading text-5xl font-bold uppercase leading-[0.98] sm:text-7xl lg:text-8xl",
                )}
              >
                {title}
              </h1>
            </FadeIn>

            <FadeIn>
              <p
                className={cn(
                  "mt-5 max-w-2xl text-base font-medium leading-8 text-white/82 sm:text-lg lg:text-xl lg:leading-9",
                  ar && "max-w-[40rem]",
                )}
              >
                {subtitle}
              </p>
            </FadeIn>

            <FadeIn className={cn("mt-8 flex flex-wrap items-center gap-3", ar && "justify-start")}>
              <Link
                href={activeSlide.href || "#bestsellers"}
                className={cn(
                  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-white/20 bg-white px-6 py-3 text-sm font-extrabold text-black shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:bg-white/90",
                  ar ? "flex-row-reverse px-7 text-base" : "flex-row",
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  <ArrowRight size={15} strokeWidth={2.1} className={cn(ar && "rotate-180")} />
                </span>
                {cta}
              </Link>
            </FadeIn>
          </FadeInStagger>
        </div>

        {slideCount > 1 && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-7 z-20 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5",
              ar && "flex-row-reverse",
            )}
          >
            <div className="flex items-center gap-2 rounded-full border border-white/12 bg-black/22 px-3 py-2 backdrop-blur-md">
              {slides.map((slide, index) => (
                <button
                  key={`${slide.image}-dot-${index}`}
                  type="button"
                  onClick={() => goToSlide(index)}
                  aria-label={ar ? `اذهب إلى الشريحة ${index + 1}` : `Go to slide ${index + 1}`}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    index === activeIndex ? "w-9 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70",
                  )}
                />
              ))}
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => goToSlide(activeIndex - 1)}
                className="flex size-11 items-center justify-center rounded-full border border-white/16 bg-black/24 text-white backdrop-blur-md transition hover:bg-white hover:text-black"
                aria-label={ar ? "الشريحة السابقة" : "Previous slide"}
              >
                <PrevIcon size={18} />
              </button>
              <button
                type="button"
                onClick={() => goToSlide(activeIndex + 1)}
                className="flex size-11 items-center justify-center rounded-full border border-white/16 bg-black/24 text-white backdrop-blur-md transition hover:bg-white hover:text-black"
                aria-label={ar ? "الشريحة التالية" : "Next slide"}
              >
                <NextIcon size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
