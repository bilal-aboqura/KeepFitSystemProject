import Link from "next/link";
import { getAllCategories } from "@/lib/data/catalog";
import { getLang } from "@/lib/i18n/server";
import { ProductForm, type ProductFormData } from "@/components/admin/product-form";

export default async function NewProductPage() {
  const [categories, lang] = await Promise.all([
    getAllCategories(),
    getLang(),
  ]);
  const ar = lang === "ar";

  const empty: ProductFormData = {
    name_en: "",
    name_ar: "",
    slug: "",
    sku: "",
    category_id: "",
    price: 0,
    compare_at_price: "",
    stock: 0,
    is_active: true,
    is_featured: false,
    images: "",
    short_desc_en: "",
    short_desc_ar: "",
    long_desc_en: "",
    long_desc_ar: "",
    weight: "",
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/products" className="text-sm text-fg-dim hover:text-fg">
          {ar ? "← المنتجات" : "← Products"}
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-bold text-fg">
          {ar ? "منتج جديد" : "New product"}
        </h1>
      </div>
      <div className="glass p-6">
        <ProductForm initial={empty} categories={categories} lang={lang} />
      </div>
    </div>
  );
}
