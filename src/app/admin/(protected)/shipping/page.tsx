import { adminListShippingRates } from "@/lib/data/admin-crud";
import { getLang } from "@/lib/i18n/server";
import { ShippingManager } from "@/components/admin/shipping-manager";
import { AdminPageHeader } from "@/components/admin/page-header";

export default async function AdminShippingPage() {
  const lang = await getLang();
  const ar = lang === "ar";
  const rates = await adminListShippingRates();

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "الشحن" : "Shipping"}
        title={ar ? "أسعار الشحن" : "Shipping Rates"}
        description={
          ar
            ? "حدد الأسعار حسب المحافظة والمدينة، مع دعم القيم العامة باستخدام النجمة."
            : "Set rates by governorate and city, with wildcard support for broader coverage."
        }
      />

      <ShippingManager rates={rates} lang={lang} />
    </div>
  );
}
