import { HomeHero } from "@/components/storefront/home-hero-carousel";
import { CategoryGrid } from "@/components/storefront/category-grid";
import {
  TrustGuaranteeSection,
  Testimonials,
  WhyXeemoSection,
  BundleOffersSection,
} from "@/components/storefront/home-hero";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getAllCategories,
  getFeaturedProducts,
  resolveBundles,
  getSocialStats,
  getHeroOverrides,
} from "@/lib/data/catalog";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/i18n/server";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { FadeIn, FadeInStagger } from "@/components/ui/fade-in";

export default async function Home() {
  const supabase = await getSupabaseServerClient();
  const [products, bundles, stats, heroOverrides, categories] = await Promise.all([
    getFeaturedProducts(8),
    resolveBundles(),
    getSocialStats(),
    getHeroOverrides(),
    getAllCategories(),
  ]);
  const connected = Boolean(supabase);
  const lang = await getLang();
  const ar = lang === "ar";

  return (
    <>
      {/* 1. Hero — texts editable from admin/customize */}
      <HomeHero overrides={heroOverrides} />

      {/* 2. Categories */}
      <CategoryGrid categories={categories} />

      {/* 3. Best Sellers (limited to top 8) */}
      <section id="bestsellers" className="mx-auto max-w-7xl px-5 pb-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
              {ar ? "الأكثر مبيعاً" : "Best Sellers"}
            </h2>
            <p className="mt-1 text-sm text-fg-dim">
              {ar ? "المنتجات اللي عملاؤنا بيرجعوا يشتروها تاني" : "What our customers keep coming back for"}
            </p>
          </div>
          <Link
            href="/category/carcare"
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

      {/* 4. Trust & Guarantee */}
      <TrustGuaranteeSection />

      {/* 5. Social Proof / Testimonials (stats loaded from DB settings) */}
      <Testimonials stats={stats} />

      {/* 6. Why Xeemo — differentiators */}
      <WhyXeemoSection />

      {/* 7. Bundle Offers (with real products from DB) */}
      <BundleOffersSection bundles={bundles} />

    </>
  );
}
