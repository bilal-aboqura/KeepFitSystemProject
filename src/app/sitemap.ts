import type { MetadataRoute } from "next";
import { getAllCategories } from "@/lib/data/catalog";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/cart`, changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/checkout`, changeFrequency: "weekly", priority: 0.3 },
  ];

  const [categories, products] = await Promise.all([getAllCategories(), getProducts()]);

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${base}/category/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/product/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}

async function getProducts() {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const { data } = await sb
    .from("products")
    .select("slug")
    .eq("is_active", true);
  return (data as { slug: string }[]) ?? [];
}
