import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSectionCard } from "@/components/admin/section-card";
import { AdminStatCard } from "@/components/admin/stat-card";
import { adminListCustomers } from "@/lib/data/admin-crud";
import { getLang } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/utils";
import { BadgeCheck, ShoppingBag, Wallet } from "lucide-react";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const [{ customerId }, lang, customers] = await Promise.all([params, getLang(), adminListCustomers()]);
  const customer = customers.find((candidate) => candidate.kind === "customer" && candidate.id === customerId);
  if (!customer) notFound();
  const ar = lang === "ar";
  return <div>
    <Link href="/admin/customers" className="text-sm text-brand underline">{ar ? "العودة إلى العملاء" : "Back to customers"}</Link>
    <AdminPageHeader eyebrow={ar ? "حساب عميل دائم" : "Persistent customer"} title={customer.full_name} description={ar ? "هوية الحساب وسياقه التجاري، مستقلة عن بيانات طلبات الزوار." : "Account identity and commercial context, kept separate from guest order snapshots."}/>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <AdminStatCard icon={ShoppingBag} label={ar ? "الطلبات" : "Orders"} value={customer.order_count} tone="brand"/>
      <AdminStatCard icon={Wallet} label={ar ? "إجمالي الإنفاق" : "Total spent"} value={formatPrice(customer.total_spent, lang)} tone="success"/>
      <AdminStatCard icon={BadgeCheck} label={ar ? "نوع العميل" : "Customer type"} value={ar ? customer.effective_type?.name_ar ?? "—" : customer.effective_type?.name_en ?? "—"} tone="gold"/>
    </div>
    <AdminSectionCard className="mt-6" title={ar ? "بيانات الحساب" : "Account record"} description={customer.id}>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-fg-dim">{ar ? "الهاتف" : "Phone"}</dt><dd dir="ltr" className="mt-1 font-medium">{customer.phone || "—"}</dd></div>
        <div><dt className="text-fg-dim">{ar ? "البريد" : "Email"}</dt><dd className="mt-1 font-medium">{customer.email || "—"}</dd></div>
        <div><dt className="text-fg-dim">{ar ? "آخر طلب" : "Last order"}</dt><dd className="mt-1 font-medium">{new Date(customer.last_order_at).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</dd></div>
        <div><dt className="text-fg-dim">{ar ? "طلب نوع معلق" : "Pending type request"}</dt><dd className="mt-1 font-medium">{customer.pending_request_id ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")}</dd></div>
      </dl>
    </AdminSectionCard>
  </div>;
}
