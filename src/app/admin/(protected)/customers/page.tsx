import { Users, MapPin, ShoppingBag, TrendingUp } from "lucide-react";
import { adminListCustomers } from "@/lib/data/admin-crud";
import { getLang } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSectionCard } from "@/components/admin/section-card";
import { AdminStatCard } from "@/components/admin/stat-card";

export default async function AdminCustomersPage() {
  const lang = await getLang();
  const ar = lang === "ar";
  const customers = await adminListCustomers();

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, customer) => sum + customer.total_spent, 0);
  const repeatCustomers = customers.filter((customer) => customer.order_count > 1).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "العملاء" : "Customers"}
        title={ar ? "العملاء" : "Customers"}
        description={
          ar
            ? "اعرف أكثر العملاء تكراراً وأماكن الطلبات والإنفاق الكلي بسرعة."
            : "See repeat buyers, order locations, and total spend at a glance."
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard icon={Users} label={ar ? "إجمالي العملاء" : "Total customers"} value={totalCustomers} tone="brand" />
        <AdminStatCard icon={TrendingUp} label={ar ? "إجمالي الإيرادات" : "Total revenue"} value={formatPrice(totalRevenue, lang)} tone="success" />
        <AdminStatCard icon={ShoppingBag} label={ar ? "عملاء متكررون" : "Repeat customers"} value={repeatCustomers} tone="gold" />
      </div>

      <AdminSectionCard
        className="mt-6"
        title={ar ? "سجل العملاء" : "Customer list"}
        description={
          ar ? "كل العملاء الذين طلبوا من المتجر، بما فيهم الدفع عند الاستلام." : "All customers who placed orders, including COD guests."
        }
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-fg-dim">
              <tr>
                <th className="px-5 py-4 sm:px-6">{ar ? "العميل" : "Customer"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "الهاتف" : "Phone"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "الموقع" : "Location"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "الطلبات" : "Orders"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "الإنفاق" : "Total spent"}</th>
                <th className="px-5 py-4 sm:px-6">{ar ? "آخر طلب" : "Last order"}</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-fg-dim sm:px-6">
                    {ar ? "لا يوجد عملاء بعد." : "No customers yet."}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.phone} className="border-b border-border/80 transition hover:bg-slate-50">
                    <td className="px-5 py-4 sm:px-6">
                      <div className="font-medium text-fg">{customer.full_name}</div>
                      {customer.order_count > 1 ? (
                        <span className="pill pill-warning mt-1 text-[10px]">
                          {ar ? "عميل متكرر" : "Repeat"}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 font-mono text-fg-muted sm:px-6" dir="ltr">
                      {customer.phone}
                    </td>
                    <td className="px-5 py-4 sm:px-6">
                      <div className="flex items-center gap-1 text-fg-muted">
                        <MapPin size={12} className="shrink-0 text-fg-dim" />
                        <span className="text-xs">
                          {customer.city}, {customer.governorate}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-fg sm:px-6">{customer.order_count}</td>
                    <td className="px-5 py-4 font-semibold text-brand sm:px-6">
                      {formatPrice(customer.total_spent, lang)}
                    </td>
                    <td className="px-5 py-4 text-xs text-fg-dim sm:px-6">
                      {new Date(customer.last_order_at).toLocaleDateString(ar ? "ar-EG" : "en-GB")}
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
