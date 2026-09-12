import { HomeHero } from "@/components/storefront/home-hero-carousel";
import { CategoryGrid } from "@/components/storefront/category-grid";
import {
  TrustGuaranteeSection,
  WhyKeepFitSection,
  BundleOffersSection,
} from "@/components/storefront/home-hero";
import { ProductCard } from "@/components/storefront/product-card";
import { getFeaturedProducts, resolveBundles, getHeroOverrides } from "@/lib/data/catalog";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/i18n/server";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { FadeIn, FadeInStagger } from "@/components/ui/fade-in";

export default async function Home() {
  const supabase = await getSupabaseServerClient();
  const [products, bundles, heroOverrides] = await Promise.all([
    getFeaturedProducts(8),
    resolveBundles(),
    getHeroOverrides(),
  ]);
  const connected = Boolean(supabase);
  const lang = await getLang();
  const ar = lang === "ar";

  return (
    <>
      <HomeHero overrides={heroOverrides} />

      <CategoryGrid />

      <section id="bestsellers" className="mx-auto max-w-7xl px-5 py-20 sm:py-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
              {ar ? "الأكثر مبيعاً" : "Best Sellers"}
            </h2>
            <p className="mt-2 text-base text-fg-dim">
              {ar ? "اختيارات مميزة علشان تكمّل هدفك." : "Featured picks to keep your goal moving."}
            </p>
          </div>
          <Link
            href="#categories"
            className="hidden items-center gap-1.5 text-sm font-medium text-brand transition hover:underline sm:flex"
          >
            {ar ? "عرض الكل" : "View all"}
            <ArrowRight size={14} />
          </Link>
        </div>
        {connected && products.length > 0 ? (
          <FadeInStagger className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">
            {products.map((p) => (
              <FadeIn key={p.id}>
                <ProductCard product={p} />
              </FadeIn>
            ))}
          </FadeInStagger>
        ) : (
          <div className="glass mt-8 p-12 text-center text-fg-dim">
            {connected
              ? (ar ? "لا توجد منتجات بعد." : "No products yet.")
              : (ar ? "اربط Supabase لعرض المنتجات." : "Connect Supabase to load products.")}
          </div>
        )}
      </section>

      <TrustGuaranteeSection />

      <WhyKeepFitSection />

      {bundles.length > 0 ? <BundleOffersSection bundles={bundles} /> : null}

    </>
  );
}
