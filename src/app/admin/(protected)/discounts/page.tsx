import { adminListDiscounts } from "@/lib/data/admin-crud";
import { getLang } from "@/lib/i18n/server";
import { DiscountManager } from "@/components/admin/discount-manager";
import { AdminPageHeader } from "@/components/admin/page-header";

export default async function AdminDiscountsPage() {
  const lang = await getLang();
  const ar = lang === "ar";
  const discounts = await adminListDiscounts();

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "العروض" : "Promotions"}
        title={ar ? "الكوبونات" : "Discounts"}
        description={
          ar
            ? "أنشئ أكواد الخصم وفعّلها أو عطّلها بدون مغادرة الصفحة."
            : "Create discount codes and activate or pause them without leaving the page."
        }
      />
      <DiscountManager discounts={discounts} lang={lang} />
    </div>
  );
}
