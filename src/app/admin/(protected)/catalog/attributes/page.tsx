import { AdminPageHeader } from "@/components/admin/page-header";
import { CatalogAttributeManager } from "@/components/admin/catalog-attribute-manager";
import { listAttributes } from "@/lib/catalog/attributes";
import { getLang } from "@/lib/i18n/server";

export default async function AttributesPage() { const [attributes, lang] = await Promise.all([listAttributes(true), getLang()]); const ar = lang === "ar"; return <div><AdminPageHeader eyebrow={ar ? "الكتالوج" : "Catalog"} title={ar ? "الخصائص" : "Attributes"} description={ar ? "افصل خصائص الخيارات عن مواصفات المنتج." : "Keep variant-defining options separate from product specifications."}/><div className="mt-6"><CatalogAttributeManager initialAttributes={attributes as never[]} lang={lang}/></div></div>; }
