import { getProductBySlug } from "@/lib/data/catalog";

/** JSON-LD structured data for product pages (helps Google rich results). */
export async function ProductJsonLd({ slug }: { slug: string }) {
  const product = await getProductBySlug(slug);
  if (!product) return null;

  const json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name_en,
    description: product.short_desc_en || product.long_desc_en?.slice(0, 300),
    image: product.images?.[0]
      ? [new URL(product.images[0], process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").toString()]
      : undefined,
    offers: product.variants.map((variant) => ({
      "@type": "Offer",
      sku: variant.sku,
      price: Number(variant.base_price).toFixed(2),
      priceCurrency: "EGP",
      availability: variant.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: new URL(`/product/${product.slug}`, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").toString(),
    })),
    brand: product.brand_name_en ? { "@type": "Brand", name: product.brand_name_en } : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
