import Link from "next/link";
import { CatalogProductEditor } from "@/components/admin/catalog-product-editor";
import { listAttributes } from "@/lib/catalog/attributes";
import { listBrands } from "@/lib/catalog/brands";
import { listCategories } from "@/lib/catalog/categories";
import { getLang } from "@/lib/i18n/server";

export default async function NewProductPage() {
  const [categories, brands, attributes, lang] = await Promise.all([listCategories(), listBrands(), listAttributes(), getLang()]);
  return <div><Link href="/admin/products" className="text-sm text-fg-dim hover:text-fg">{lang === "ar" ? "← المنتجات" : "← Products"}</Link><h1 className="mb-6 mt-2 font-heading text-2xl font-bold text-fg">{lang === "ar" ? "منتج جديد" : "New catalog product"}</h1><CatalogProductEditor categories={categories as never[]} brands={brands as never[]} attributes={attributes as never[]} lang={lang} /></div>;
}
