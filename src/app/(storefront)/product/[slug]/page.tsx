import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProductBySlug,
  getRelatedProducts,
  getCategoryById,
} from "@/lib/data/catalog";
import { ProductPurchaseBox } from "@/components/storefront/product-purchase-box";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductJsonLd } from "@/components/seo/product-json-ld";
import { ProductReviews } from "@/components/storefront/product-reviews";
import { getApprovedProductReviews } from "@/lib/data/reviews";
import { getLang } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const name = product.name_en;
  const description = product.short_desc_en || product.long_desc_en?.slice(0, 160) || "";
  const image = product.images?.[0];
  return {
    title: name,
    description,
    openGraph: {
      type: "website",
      title: `${name} | Xeemo`,
      description,
      images: image ? [{ url: image, width: 800, height: 800, alt: name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, category, lang, reviews] = await Promise.all([
    getRelatedProducts(product, 4),
    product.category_id ? getCategoryById(product.category_id) : null,
    getLang(),
    getApprovedProductReviews(product.id),
  ]);

  const name = lang === "ar" ? product.name_ar : product.name_en;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:py-10">
      <ProductJsonLd slug={slug} />
      {/* Breadcrumb */}
      <nav className="mb-8 text-xs text-fg-dim">
        <Link href="/" className="hover:text-fg">
          {lang === "ar" ? "الرئيسية" : "Home"}
        </Link>
        <span className="mx-2">/</span>
        {category && (
          <>
            <Link
              href={`/category/${category.slug}`}
              className="hover:text-fg"
            >
              {lang === "ar" ? category.name_ar : category.name_en}
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-fg-muted">{name}</span>
      </nav>

      <ProductPurchaseBox product={product} />

      <ProductReviews productId={product.id} reviews={reviews} lang={lang} />

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-heading text-2xl font-bold text-fg">
            {lang === "ar" ? "منتجات ذات صلة" : "Related products"}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
