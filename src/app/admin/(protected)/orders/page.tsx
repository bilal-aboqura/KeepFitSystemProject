import { AdminPageHeader } from "@/components/admin/page-header";
import { ServerOrdersTable } from "@/components/admin/orders-table";
import { listAdminOrders } from "@/lib/data/orders";
import { getLang } from "@/lib/i18n/server";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [lang, raw] = await Promise.all([getLang(), searchParams]);
  const value = (key: string) => typeof raw[key] === "string" ? raw[key] as string : undefined;
  const filters = { query: value("query"), fulfillment: value("fulfillment"), payment: value("payment"), customerType: value("customerType"), dateFrom: value("dateFrom"), dateTo: value("dateTo"), cursor: value("cursor") };
  const data = await listAdminOrders({ ...filters, limit: 25 }).catch(() => ({ orders: [], nextCursor: null }));
  const ar = lang === "ar";
  return <div><AdminPageHeader eyebrow={ar ? "تنفيذ الطلبات" : "Fulfillment"} title={ar ? "الطلبات" : "Orders"} description={ar ? "بحث وفلاتر حية مع صفحات من الخادم ولقطات تجارية ثابتة." : "Live server-side search, filters, pagination, and immutable commercial snapshots."}/><ServerOrdersTable orders={data.orders as never[]} nextCursor={data.nextCursor} lang={lang} filters={filters}/></div>;
}
