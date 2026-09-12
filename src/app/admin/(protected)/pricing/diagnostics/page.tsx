import { AdminPageHeader } from "@/components/admin/page-header";
import { PricingAuditHistory } from "@/components/admin/pricing-audit-history";
import { PricingDiagnostic } from "@/components/admin/pricing-diagnostic";
import { getLang } from "@/lib/i18n/server";
import { listPricingAuditEvents } from "@/lib/pricing/audit-queries";

export default async function PricingDiagnosticsPage() {
  const [lang, events] = await Promise.all([getLang(), listPricingAuditEvents().catch(() => [])]);
  const ar = lang === "ar";
  return <div><AdminPageHeader eyebrow={ar ? "عمليات التسعير" : "Pricing operations"} title={ar ? "التشخيص والتدقيق" : "Diagnostics and audit"} description={ar ? "تفسير قرار السعر باستخدام سياق ووقت موثوقين." : "Explain a pricing decision with trusted context and time."}/><div className="mt-6 space-y-6"><PricingDiagnostic lang={lang}/><PricingAuditHistory events={events as never[]} lang={lang}/></div></div>;
}
