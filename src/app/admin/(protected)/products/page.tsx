import Link from "next/link";
import { Plus } from "lucide-react";
import { adminCatalogSearch } from "@/lib/catalog/queries";
import { getLang } from "@/lib/i18n/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSectionCard } from "@/components/admin/section-card";
import { CatalogProductList } from "@/components/admin/catalog-product-list";

export default async function AdminProductsPage() {
  const [products, lang] = await Promise.all([adminCatalogSearch({ status: "all" }), getLang()]);
  const ar = lang === "ar";
  return <div><AdminPageHeader eyebrow={ar ? "الكتالوج" : "Catalog"} title={ar ? "المنتجات والخيارات" : "Products & variants"} description={ar ? "ابحث وأدر الهوية القابلة للبيع والصور والحالة بأمان." : "Search and manage sellable identity, media, and lifecycle safely."} actions={<Link href="/admin/products/new" className="btn btn-primary gap-2"><Plus size={16}/>{ar ? "منتج جديد" : "New product"}</Link>} /><AdminSectionCard className="mt-6" title={ar ? "قائمة الكتالوج" : "Catalog list"} contentClassName="p-0"><CatalogProductList products={products} lang={lang} /></AdminSectionCard></div>;
}
