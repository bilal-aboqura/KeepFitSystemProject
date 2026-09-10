import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGetProduct } from "@/lib/data/admin-crud";
import { getAllCategories } from "@/lib/data/catalog";
import { getLang } from "@/lib/i18n/server";
import { ProductForm, type ProductFormData } from "@/components/admin/product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories, lang] = await Promise.all([
    adminGetProduct(id),
    getAllCategories(),
    getLang(),
  ]);
  const ar = lang === "ar";

  if (!product) notFound();

  const formData: ProductFormData = {
    id: product.id,
    name_en: product.name_en,
    name_ar: product.name_ar,
    slug: product.slug,
    sku: product.sku ?? "",
    category_id: product.category_id ?? "",
    price: Number(product.price),
    compare_at_price: product.compare_at_price ? String(product.compare_at_price) : "",
    stock: product.stock,
    is_active: product.is_active,
    is_featured: product.is_featured,
    images: (product.images ?? []).join("\n"),
    short_desc_en: product.short_desc_en ?? "",
    short_desc_ar: product.short_desc_ar ?? "",
    long_desc_en: product.long_desc_en ?? "",
    long_desc_ar: product.long_desc_ar ?? "",
    weight: product.weight ?? "",
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/products" className="text-sm text-fg-dim hover:text-fg">
          {ar ? "← المنتجات" : "← Products"}
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-bold text-fg">
          {ar ? product.name_ar : product.name_en}
        </h1>
      </div>
      <div className="glass p-6">
        <ProductForm initial={formData} categories={categories} lang={lang} />
      </div>
    </div>
  );
}
