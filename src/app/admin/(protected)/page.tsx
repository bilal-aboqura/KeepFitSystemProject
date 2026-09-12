import Link from "next/link";
import { ShoppingCart, DollarSign, Package, AlertTriangle, ClipboardCheck, ArrowUpRight } from "lucide-react";
import { getT, getLang } from "@/lib/i18n/server";
import { getAdminStats } from "@/lib/data/admin";
import { formatPrice } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSectionCard } from "@/components/admin/section-card";
import { AdminStatCard } from "@/components/admin/stat-card";

export default async function AdminDashboardPage() {
  const t = await getT();
  const lang = await getLang();
  const stats = await getAdminStats();
  const ar = lang === "ar";

  const cards = [
    {
      Icon: ShoppingCart,
      label: ar ? "طلبات اليوم" : "Orders today",
      value: stats ? String(stats.ordersToday) : "-",
      hint: ar ? "كل الطلبات" : "all orders",
      tone: "brand" as const,
      href: "/admin/orders",
    },
    {
      Icon: DollarSign,
      label: ar ? "إيرادات الشهر" : "Revenue",
      value: stats ? formatPrice(stats.revenueMonth, lang) : "-",
      hint: ar ? "المدفوع فقط" : "paid only",
      tone: "success" as const,
      href: null,
    },
    {
      Icon: Package,
      label: ar ? "منتجات نشطة" : "Active products",
      value: stats ? String(stats.activeProducts) : "-",
      hint: ar ? "في الكتالوج" : "in catalog",
      tone: "gold" as const,
      href: "/admin/products",
    },
    {
      Icon: AlertTriangle,
      label: ar ? "مخزون منخفض" : "Low stock",
      value: stats ? String(stats.lowStock) : "-",
      hint: ar ? "10 قطع أو أقل" : "10 units or less",
      tone: "violet" as const,
      href: "/admin/products",
    },
  ];

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "نظرة عامة" : "Overview"}
        title={t.admin.dashboard}
        description={
          ar
            ? "راقب الأداء اليومي وتحرك بسرعة بين الطلبات والمخزون والمحتوى."
            : "Track daily performance and move quickly between orders, inventory, and storefront content."
        }
        actions={
          <>
            <Link
              href="/admin/orders"
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-fg transition hover:border-border-hover hover:text-brand"
            >
              {ar ? "مراجعة الطلبات" : "Review orders"}
            </Link>
            <Link
              href="/admin/products/new"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              {ar ? "منتج جديد" : "New product"}
            </Link>
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const content = (
            <AdminStatCard
              icon={card.Icon}
              label={card.label}
              value={card.value}
              hint={card.hint}
              tone={card.tone}
            />
          );

          return card.href ? (
            <Link key={card.label} href={card.href} className="block transition hover:-translate-y-0.5">
              {content}
            </Link>
          ) : (
            <div key={card.label}>{content}</div>
          );
        })}
      </div>

      <Link
        href="/admin/customer-type-requests"
        className="mt-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 transition hover:border-amber-300 hover:bg-amber-100/70 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-200/70 text-amber-800">
            <ClipboardCheck size={21} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">{t.customerTypeAdmin.needsAttention}</p>
            <p className="mt-1 text-base font-bold text-amber-950">{t.customerTypeAdmin.pendingRequests}</p>
          </div>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-white/80 px-4 text-amber-900 sm:justify-center">
          <span className="text-2xl font-bold">{stats ? stats.pendingCustomerTypeRequests : "-"}</span>
          <ArrowUpRight size={18} />
        </div>
      </Link>

      <AdminSectionCard
        className="mt-6"
        title={ar ? "أحدث الطلبات" : "Recent orders"}
        description={
          ar ? "آخر الطلبات التي دخلت المتجر." : "The latest orders that came into the store."
        }
        actions={
          <Link
            href="/admin/orders"
            className="text-sm font-medium text-brand transition hover:text-brand/80"
          >
            {ar ? "عرض الكل" : "View all"}
          </Link>
        }
        contentClassName="pt-0"
      >
        {!stats || stats.recentOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-4 py-10 text-center text-sm text-fg-dim">
            {ar ? "لا توجد طلبات بعد." : "No orders yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-fg-dim">
                <tr>
                  <th className="py-3 pr-4">#</th>
                  <th className="py-3 pr-4">{ar ? "العميل" : "Customer"}</th>
                  <th className="py-3 pr-4">{ar ? "الإجمالي" : "Total"}</th>
                  <th className="py-3 pr-4">{ar ? "الدفع" : "Payment"}</th>
                  <th className="py-3 pr-4">{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="py-3 pr-4 font-mono text-fg-muted">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-brand underline-offset-2 hover:underline"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-fg">{order.customer_name}</td>
                    <td className="py-3 pr-4 font-semibold text-brand">
                      {formatPrice(Number(order.grand_total), lang)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill value={order.payment_status} />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill value={order.fulfillment_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const cls: Record<string, string> = {
    paid: "pill-success",
    pending: "pill-warning",
    failed: "pill-danger",
    delivered: "pill-success",
    shipped: "pill-info",
    processing: "pill-warning",
    cancelled: "pill-danger",
    returned: "pill-danger",
    refunded: "pill-neutral",
  };

  return <span className={`pill ${cls[value] ?? "pill-neutral"}`}>{value}</span>;
}
