"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SlidersHorizontal, ArrowUpDown, ChevronRight } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { ProductCard } from "@/components/storefront/product-card";
import { formatPrice } from "@/lib/utils";
import type { CategoryInfo, ProductCard as ProductData } from "@/lib/data/catalog";

type Sort = "featured" | "price-asc" | "price-desc" | "name";

export function CategoryView({
  category,
  products,
}: {
  category: CategoryInfo;
  products: ProductData[];
}) {
  const { lang } = useLang();
  const [sort, setSort] = useState<Sort>("featured");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const ar = lang === "ar";

  const name = ar ? category.name_ar : category.name_en;

  const priceCeiling = useMemo(
    () => products.reduce((m, p) => Math.max(m, Number(p.price)), 0),
    [products],
  );

  const visible = useMemo(() => {
    let list = [...products];
    if (maxPrice !== "") {
      list = list.filter((p) => Number(p.price) <= Number(maxPrice));
    }

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-desc":
        list.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "name":
        list.sort((a, b) =>
          (ar ? a.name_ar : a.name_en).localeCompare(ar ? b.name_ar : b.name_en),
        );
        break;
      default:
        list.sort(
          (a, b) =>
            Number(b.is_featured) - Number(a.is_featured) ||
            Number(a.price) - Number(b.price),
        );
    }

    return list;
  }, [products, sort, maxPrice, ar]);

  return (
    <>
      <section className="relative mx-auto max-w-7xl px-4 pt-6 sm:px-5 sm:pt-8">
        <div className="group relative overflow-hidden rounded-[2.5rem] bg-[#111111] ring-1 ring-black/10 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
          {category.image && (
            <div className="pointer-events-none absolute inset-0 z-0">
              <Image
                src={category.image}
                alt="Background"
                fill
                className="object-cover opacity-55 saturate-[1.1] transition-transform duration-[2000ms] ease-out group-hover:scale-105"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
            </div>
          )}

          <div className="relative z-10 flex min-h-[400px] flex-col justify-end p-8 sm:p-16 lg:p-20">
            <nav className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/65 animate-fade-in-up">
              <Link href="/" className="transition hover:text-brand">
                {ar ? "الرئيسية" : "HOME"}
              </Link>
              <ChevronRight size={14} className="opacity-40" />
              <span className="text-white/80">{name}</span>
            </nav>

            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                <div className="mb-4 inline-flex h-8 items-center justify-center rounded-full bg-white/10 px-4 text-xs font-bold tracking-widest text-white ring-1 ring-white/20 backdrop-blur-md shadow-2xl">
                  {products.length} {ar ? "منتج حصري" : "EXCLUSIVE PRODUCTS"}
                </div>
                <h1 className="font-heading text-5xl font-black tracking-tight text-white drop-shadow-2xl sm:text-7xl lg:text-8xl">
                  {name}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-[72px] z-40 mx-auto max-w-7xl px-5 py-4 transition-all">
        <div className="flex flex-col gap-4 rounded-2xl border border-black/8 bg-white/92 p-3 shadow-[0_8px_30px_rgba(17,17,17,0.08)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
          <div className="group flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/[0.03] text-fg-dim transition-colors group-hover:bg-brand/10 group-hover:text-brand">
              <ArrowUpDown size={18} />
            </div>
            <label className="flex-1 sm:flex-none">
              <span className="sr-only">Sort by</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="w-full min-w-[200px] cursor-pointer appearance-none bg-transparent px-2 text-sm font-medium text-fg focus:outline-none focus:ring-0"
              >
                <option value="featured" className="bg-white text-fg">
                  {ar ? "ترتيب: المميزة" : "Sort: Featured"}
                </option>
                <option value="price-asc" className="bg-white text-fg">
                  {ar ? "ترتيب: السعر (الأقل للأعلى)" : "Sort: Price (Low to High)"}
                </option>
                <option value="price-desc" className="bg-white text-fg">
                  {ar ? "ترتيب: السعر (الأعلى للأقل)" : "Sort: Price (High to Low)"}
                </option>
                <option value="name" className="bg-white text-fg">
                  {ar ? "ترتيب: أبجدي" : "Sort: Name"}
                </option>
              </select>
            </label>
          </div>

          <div className="hidden h-8 w-px bg-black/8 sm:block" />

          <div className="group flex flex-1 items-center gap-4 sm:max-w-md">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/[0.03] text-fg-dim transition-colors group-hover:bg-brand/10 group-hover:text-brand">
              <SlidersHorizontal size={18} />
            </div>
            <label className="flex flex-1 flex-col gap-1.5 px-2">
              <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
                <span>{ar ? "أقصى سعر" : "Max price"}</span>
                <span className="rounded-md bg-brand/10 px-2 py-0.5 font-bold text-brand">
                  {maxPrice === "" ? (ar ? "الكل" : "All") : formatPrice(Number(maxPrice), lang)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={priceCeiling || 1}
                step={10}
                value={maxPrice === "" ? priceCeiling || 0 : maxPrice}
                onChange={(e) =>
                  setMaxPrice(Number(e.target.value) >= (priceCeiling || 0) ? "" : Number(e.target.value))
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-brand transition-all hover:accent-brand/80 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(220,38,38,0.35)]"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-12">
        {visible.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-2xl border border-black/5 p-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
              <SlidersHorizontal size={24} />
            </div>
            <h3 className="text-lg font-bold text-fg">
              {ar ? "لا توجد منتجات" : "No products found"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-fg-dim">
              {ar
                ? "حاول تغيير إعدادات الفلترة أو السعر للبحث عن منتجات أخرى."
                : "Try adjusting your filters or price range to find what you're looking for."}
            </p>
            <button
              onClick={() => {
                setSort("featured");
                setMaxPrice("");
              }}
              className="btn btn-secondary mt-6"
            >
              {ar ? "إعادة ضبط الفلاتر" : "Reset Filters"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {visible.map((p, i) => (
              <div key={p.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
