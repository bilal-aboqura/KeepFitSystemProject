import { getMylerzConfiguration } from "@/lib/mylerz";
import { MylerzConnection } from "@/components/admin/mylerz-shipment-panel";
import { adminListOrders } from "@/lib/data/admin-crud";
import { getLang } from "@/lib/i18n/server";
import { OrdersTable } from "@/components/admin/orders-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BostaOperations } from "@/components/admin/bosta-operations";
import { getBostaConfiguration } from "@/lib/bosta";
import { getLatestBostaPickups } from "@/lib/bosta-pickups";

export default async function AdminOrdersPage() {
  const lang = await getLang();
  const ar = lang === "ar";
  const [orders, pickups] = await Promise.all([
    adminListOrders(),
    getLatestBostaPickups(),
  ]);
  const bostaConfigured = getBostaConfiguration().ready;

  return (
    <div>
      <AdminPageHeader
        eyebrow={ar ? "تنفيذ الطلبات" : "Fulfillment"}
        title={ar ? "الطلبات" : "Orders"}
        description={
          ar
            ? "ابحث عن الطلبات وتابع الدفع والتجهيز والشحن من مكان واحد."
            : "Search orders and manage payment, fulfillment, and shipping in one place."
        }
      />
      <BostaOperations configured={bostaConfigured} pickups={pickups} lang={lang} />
      <MylerzConnection configured={getMylerzConfiguration().ready} lang={lang} />
      <OrdersTable orders={orders} lang={lang} mylerzConfigured={getMylerzConfiguration().ready} bostaConfigured={bostaConfigured} />
    </div>
  );
}
