import { AdminPageHeader } from "@/components/admin/page-header";
import { CatalogEntityManager } from "@/components/admin/catalog-entity-manager";
import { listBrands } from "@/lib/catalog/brands";
import { getLang } from "@/lib/i18n/server";

export default async function BrandsPage() { const [brands, lang] = await Promise.all([listBrands(true), getLang()]); const ar = lang === "ar"; return <div><AdminPageHeader eyebrow={ar ? "الكتالوج" : "Catalog"} title={ar ? "العلامات التجارية" : "Brands"} description={ar ? "هوية قابلة لإعادة الاستخدام عبر المنتجات." : "Reusable brand identities across products."}/><div className="mt-6"><CatalogEntityManager kind="brands" entities={brands as never[]} lang={lang}/></div></div>; }
