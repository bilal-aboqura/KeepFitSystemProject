import { AdminPageHeader } from "@/components/admin/page-header";
import { PriceListManager } from "@/components/admin/price-list-manager";
import { getLang } from "@/lib/i18n/server";
import { listCustomerTypeMappings, listPriceLists } from "@/lib/pricing/commands";

export default async function PricingPage() {
  const [lang, lists, mappings] = await Promise.all([getLang(), listPriceLists().catch(() => []), listCustomerTypeMappings().catch(() => [])]);
  const ar = lang === "ar";
  return <div><AdminPageHeader eyebrow={ar ? "التجارة" : "Commerce"} title={ar ? "قوائم الأسعار" : "Price Lists"} description={ar ? "أسعار معتمدة حسب نوع العميل والفترات الزمنية." : "Authoritative prices by customer context and effective period."}/><div className="mt-6"><PriceListManager lists={lists as never[]} mappings={mappings as never[]} lang={lang}/></div></div>;
}
