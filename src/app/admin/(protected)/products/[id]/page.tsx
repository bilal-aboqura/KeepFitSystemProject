import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogProductEditor } from "@/components/admin/catalog-product-editor";
import { listAttributes } from "@/lib/catalog/attributes";
import { listBrands } from "@/lib/catalog/brands";
import { listCategories } from "@/lib/catalog/categories";
import { adminCatalogSearch } from "@/lib/catalog/queries";
import { getLang } from "@/lib/i18n/server";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [products, categories, brands, attributes, lang] = await Promise.all([adminCatalogSearch({ status: "all" }), listCategories(true), listBrands(true), listAttributes(true), getLang()]);
  const product = products.find((item) => item.id === id);
  if (!product) notFound();
  return <div><Link href="/admin/products" className="text-sm text-fg-dim hover:text-fg">{lang === "ar" ? "← المنتجات" : "← Products"}</Link><h1 className="mb-6 mt-2 font-heading text-2xl font-bold text-fg">{lang === "ar" ? product.name_ar : product.name_en}</h1><CatalogProductEditor product={product} categories={categories as never[]} brands={brands as never[]} attributes={attributes as never[]} lang={lang} /></div>;
}
