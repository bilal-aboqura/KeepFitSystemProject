import { Mailbox, CalendarRange } from "lucide-react";
import { adminListNewsletterSubscribers } from "@/lib/data/admin-crud";
import { getLang } from "@/lib/i18n/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSectionCard } from "@/components/admin/section-card";
import { AdminStatCard } from "@/components/admin/stat-card";

export default async function AdminNewsletterPage() {
  const lang = await getLang();
  const ar = lang === "ar";
  const subscribers = await adminListNewsletterSubscribers();

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "النشرة البريدية" : "Newsletter"}
        title={ar ? "المشتركون في النشرة البريدية" : "Newsletter Subscribers"}
        description={
          ar
            ? "كل الإيميلات التي اشتركت من الفوتر تظهر هنا بترتيب الأحدث أولًا."
            : "Every email collected from the footer appears here, newest first."
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <AdminStatCard
          icon={Mailbox}
          label={ar ? "إجمالي المشتركين" : "Total subscribers"}
          value={subscribers.length}
          tone="brand"
        />
        <AdminStatCard
          icon={CalendarRange}
          label={ar ? "أحدث اشتراك" : "Latest signup"}
          value={
            subscribers[0]
              ? new Date(subscribers[0].created_at).toLocaleDateString(ar ? "ar-EG" : "en-GB")
              : ar
                ? "لا يوجد"
                : "None yet"
          }
          tone="gold"
        />
      </div>

      <AdminSectionCard
        className="mt-6"
        title={ar ? "قائمة الإيميلات" : "Subscriber list"}
        description={
          ar
            ? "استخدم هذه القائمة في حملات البريد أو العروض الخاصة."
            : "Use this list for email campaigns and special offers."
        }
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-fg-dim">
              <tr>
                <th className="px-5 py-4 sm:px-6">{ar ? "البريد الإلكتروني" : "Email"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "تاريخ الاشتراك" : "Subscribed at"}</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-12 text-center text-fg-dim sm:px-6">
                    {ar ? "لا يوجد مشتركين حتى الآن." : "No subscribers yet."}
                  </td>
                </tr>
              ) : (
                subscribers.map((subscriber) => (
                  <tr key={subscriber.id} className="border-b border-border/80 transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-fg sm:px-6">{subscriber.email}</td>
                    <td className="px-5 py-4 text-fg-dim sm:px-6">
                      {new Date(subscriber.created_at).toLocaleString(ar ? "ar-EG" : "en-GB")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSectionCard>
    </div>
  );
}
