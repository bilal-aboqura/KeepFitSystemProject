import { AdminPageHeader } from "@/components/admin/page-header";
import { QuantityRuleManager } from "@/components/admin/quantity-rule-manager";
import { listQuantityRules, listQuantityRuleTargets } from "@/lib/commerce/quantity-rules";
import { getLang } from "@/lib/i18n/server";

export default async function QuantityRulesPage() {
  const [lang, data, targets] = await Promise.all([getLang(), listQuantityRules({ limit: 100 }).catch(() => ({ rules: [], nextCursor: null })), listQuantityRuleTargets().catch(() => ({ products: [], customerTypes: [] }))]);
  const ar = lang === "ar";
  return <div><AdminPageHeader eyebrow={ar ? "التجارة" : "Commerce"} title={ar ? "قواعد كميات الشراء" : "Commerce Quantity Rules"} description={ar ? "حدد الحد الأدنى والزيادة لكل متغير ووحدة بيع في السياق العام أو نوع العميل." : "Set minimums and increments for each Variant and Sellable Unit in Public or Customer-Type context."}/><div className="mt-6"><QuantityRuleManager rules={data.rules as never[]} products={targets.products as never[]} customerTypes={targets.customerTypes as never[]} lang={lang}/></div></div>;
}
