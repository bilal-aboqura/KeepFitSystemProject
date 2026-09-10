import { OrderNotesEditor } from "@/components/admin/order-notes-editor";
import { getMylerzConfiguration } from "@/lib/mylerz";
import { MylerzShipmentPanel } from "@/components/admin/mylerz-shipment-panel";
import { adminGetOrder, adminListProducts } from "@/lib/data/admin-crud";
import { OrderItemsEditor } from "@/components/admin/order-items-editor";
import { BostaShipmentPanel } from "@/components/admin/bosta-shipment-panel";
import { getBostaConfiguration, type BostaShipment } from "@/lib/bosta";
import { getLang } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  CreditCard,
  Clock,
} from "lucide-react";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lang = await getLang();
  const ar = lang === "ar";
  const bostaConfigured = getBostaConfiguration().ready;

  const [order, products] = await Promise.all([
    adminGetOrder(id),
    adminListProducts(),
  ]);
  if (!order) notFound();

  const items = (order.order_items ?? []) as {
    id: string;
    product_id: string | null;
    name_en: string;
    name_ar: string | null;
    price: number;
    quantity: number;
    image: string | null;
  }[];

  const createdAt = new Date(order.created_at);
  const dateStr = createdAt.toLocaleDateString(ar ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-dim transition hover:text-brand"
      >
        <ArrowLeft size={14} />
        <span>{ar ? "كل الطلبات" : "All Orders"}</span>
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-bold text-fg">
          {ar ? "طلب" : "Order"} #{order.order_number}
        </h1>
        <StatusPill value={order.payment_status} />
        <StatusPill value={order.fulfillment_status} />
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-xs text-fg-dim">
        <Clock size={12} />
        <span>{dateStr}</span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* ── Left column: items + totals ────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          <OrderItemsEditor
            orderId={order.id}
            initialItems={items.map((item) => ({
              ...item,
              price: Number(item.price),
            }))}
            products={products.map((product) => ({
              id: product.id,
              name_en: product.name_en,
              name_ar: product.name_ar,
              price: Number(product.price),
              stock: product.stock,
              images: product.images,
            }))}
            initialTotals={{
              items_total: Number(order.items_total),
              shipping_cost: Number(order.shipping_cost),
              discount: Number(order.discount),
              grand_total: Number(order.grand_total),
            }}
            discountCode={order.discount_code}
            paymentMethod={order.payment_method}
            lang={lang}
          />
        </div>

        {/* ── Right column: customer + payment info ──────────────────── */}
        <div className="space-y-6">
          {/* Customer info */}
          <div className="glass-elevated p-5">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
              <User size={14} />
              <span>{ar ? "العميل" : "Customer"}</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User size={14} className="mt-0.5 shrink-0 text-fg-dim" />
                <span className="text-fg">{order.customer_name}</span>
              </div>
              <div className="flex items-start gap-2">
                <Phone size={14} className="mt-0.5 shrink-0 text-fg-dim" />
                <div>
                  <p className="text-fg" dir="ltr">{order.customer_phone}</p>
                  {order.alt_phone && (
                    <p className="text-fg-dim" dir="ltr">{order.alt_phone}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0 text-fg-dim" />
                <div className="text-fg">
                  <p>{order.governorate} — {order.city}</p>
                  <p className="text-fg-dim">{order.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment info */}
          <div className="glass-elevated p-5">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-fg-muted">
              <CreditCard size={14} />
              <span>{ar ? "الدفع" : "Payment"}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-fg-dim">{ar ? "الطريقة" : "Method"}</span>
                <span className="text-fg">{order.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-dim">{ar ? "الحالة" : "Status"}</span>
                <StatusPill value={order.payment_status} />
              </div>
              <div className="flex justify-between">
                <span className="text-fg-dim">{ar ? "التنفيذ" : "Fulfillment"}</span>
                <StatusPill value={order.fulfillment_status} />
              </div>
              {order.kashier_payment_id && (
                <div className="flex justify-between">
                  <span className="text-fg-dim">Kashier ID</span>
                  <span className="font-mono text-xs text-fg-dim">
                    {order.kashier_payment_id}
                  </span>
                </div>
              )}
            </div>
          </div>

          <MylerzShipmentPanel orderId={order.id} initialShipment={order.mylerz ?? null} configured={getMylerzConfiguration().ready} blocked={Boolean(order.bosta)} lang={lang} />
          <BostaShipmentPanel
            orderId={order.id}
            initialShipment={(order.bosta as BostaShipment | null) ?? null}
            configured={bostaConfigured} blocked={Boolean(order.mylerz)}
            lang={lang}
          />

          <div className="rounded-xl border border-border bg-white p-5">
            <OrderNotesEditor key={`${order.id}:${order.notes ?? ""}`} orderId={order.id} initialNotes={order.notes ?? null} lang={lang} />
          </div>
        </div>
      </div>
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
