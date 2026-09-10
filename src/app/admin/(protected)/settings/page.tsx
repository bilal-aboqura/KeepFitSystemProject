import { CheckCircle, XCircle } from "lucide-react";
import { getLang } from "@/lib/i18n/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSectionCard } from "@/components/admin/section-card";

export default async function AdminSettingsPage() {
  const lang = await getLang();
  const ar = lang === "ar";

  const config = [
    {
      label: ar ? "حالة Supabase" : "Supabase status",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      value: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Connected" : "Not configured",
    },
    {
      label: ar ? "حالة Kashier" : "Kashier status",
      ok: Boolean(process.env.KASHIER_MERCHANT_ID),
      value: process.env.KASHIER_MERCHANT_ID
        ? `${process.env.KASHIER_MERCHANT_ID} (${process.env.KASHIER_TESTMODE !== "false" ? "TEST" : "LIVE"})`
        : "Not configured",
    },
    {
      label: ar ? "رقم WhatsApp" : "WhatsApp number",
      ok: Boolean(process.env.WHATSAPP_ALERT_NUMBER),
      value: process.env.WHATSAPP_ALERT_NUMBER || "Not set",
    },
    {
      label: ar ? "Google Sheets" : "Google Sheets",
      ok: Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL),
      value: process.env.GOOGLE_SHEETS_WEBHOOK_URL ? "Configured" : "Not set",
    },
    {
      label: ar ? "رابط الموقع" : "Site URL",
      ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      value: process.env.NEXT_PUBLIC_SITE_URL || "Not set",
    },
  ];

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "البيئة" : "Environment"}
        title={ar ? "الإعدادات" : "Settings"}
        description={
          ar
            ? "راجع اتصالات الخدمات والحسابات الأساسية التي يعتمد عليها المتجر."
            : "Review the service connections and core environment values that power the store."
        }
      />

      <AdminSectionCard
        className="mt-6"
        title={ar ? "حالة التكاملات" : "Integration status"}
        description={
          ar ? "هذه القيم تُدار من ملف البيئة على الخادم." : "These values are managed from the server environment file."
        }
        contentClassName="p-0"
      >
        <div className="divide-y divide-border">
          {config.map((item) => (
            <div key={item.label} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span className="text-sm text-fg-muted">{item.label}</span>
              <span className="flex items-center gap-2 text-sm font-medium text-fg">
                {item.ok ? (
                  <CheckCircle size={14} className="text-emerald-600" />
                ) : (
                  <XCircle size={14} className="text-brand" />
                )}
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        className="mt-6"
        title={ar ? "حساب المالك" : "Owner account"}
        description={
          ar ? "بيانات الوصول الأساسية الخاصة بالإدارة." : "Core access details for the admin owner account."
        }
      >
        <p className="text-sm text-fg-muted">
          {ar ? "البريد:" : "Email:"}{" "}
          <code className="rounded-md bg-slate-100 px-2 py-1 text-xs text-fg-muted">
            {process.env.ADMIN_EMAIL}
          </code>
        </p>
        <p className="mt-3 text-xs text-fg-dim">
          {ar
            ? "لتغيير كلمة المرور استخدم Supabase Studio أو أعد تشغيل scripts/seed-admin.mjs."
            : "To change the password, use Supabase Studio or rerun scripts/seed-admin.mjs."}
        </p>
      </AdminSectionCard>
    </div>
  );
}
