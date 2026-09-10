import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getProductsByCategory } from "@/lib/data/catalog";
import { CategoryView } from "@/components/storefront/category-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  const name = category.name_en;
  return {
    title: name,
    description: `Shop ${name} products from Xeemo. Made in Egypt.`,
    openGraph: {
      title: `${name} | Xeemo`,
      description: `Shop ${name} products from Xeemo.`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [category, products] = await Promise.all([
    getCategoryBySlug(slug),
    getProductsByCategory(slug),
  ]);

  if (!category) notFound();

  return <CategoryView category={category} products={products} />;
}
