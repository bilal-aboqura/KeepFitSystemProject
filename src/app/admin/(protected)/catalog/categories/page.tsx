import { AdminPageHeader } from "@/components/admin/page-header";
import { CatalogEntityManager } from "@/components/admin/catalog-entity-manager";
import { listCategories } from "@/lib/catalog/categories";
import { getLang } from "@/lib/i18n/server";

export default async function CategoriesPage() { const [categories, lang] = await Promise.all([listCategories(true), getLang()]); const ar = lang === "ar"; return <div><AdminPageHeader eyebrow={ar ? "الكتالوج" : "Catalog"} title={ar ? "الفئات" : "Categories"} description={ar ? "فئات ثابتة قابلة للتوسع الهرمي." : "Stable categories ready for future hierarchy."}/><div className="mt-6"><CatalogEntityManager kind="categories" entities={categories as never[]} lang={lang}/></div></div>; }
