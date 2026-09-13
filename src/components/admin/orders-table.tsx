"use client";

import { OrderNotesEditor } from "@/components/admin/order-notes-editor";
import { MylerzShipmentPanel } from "@/components/admin/mylerz-shipment-panel";
import { BostaShipmentPanel } from "@/components/admin/bosta-shipment-panel";
import { mylerzStatusLabel } from "@/lib/mylerz-status";
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import { useToast } from "@/components/admin/toast";
import type { AdminOrder } from "@/lib/data/admin-crud";
import { getBostaStateMeta } from "@/lib/bosta-status";
import { adminStatusLabel, StatusBadge } from "@/components/admin/status-badge";

interface ServerOrderRow {
  id: string; order_number: string; customer_id: string | null; customer_name: string; customer_phone: string;
  governorate: string; city: string; grand_total: number; payment_method: string; payment_status: string;
  fulfillment_status: string; customer_type_code_snapshot: string | null; commerce_snapshot_version: number | null;
  shipping_snapshot: Record<string, unknown> | null; created_at: string;
}

export function ServerOrdersTable({ orders, nextCursor, lang, filters }: { orders: ServerOrderRow[]; nextCursor: string | null; lang: "en" | "ar"; filters: Record<string, string | undefined> }) {
  const ar = lang === "ar";
  const params = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-white">
    <form method="get" className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <input name="query" defaultValue={filters.query} placeholder={ar ? "رقم، اسم، هاتف أو SKU" : "Number, name, phone or SKU"} className="input"/>
      <select name="fulfillment" defaultValue={filters.fulfillment ?? ""} className="input"><option value="">{ar ? "كل حالات التنفيذ" : "All fulfillment"}</option>{FULFILLMENT_OPTIONS.map((value) => <option key={value} value={value}>{adminStatusLabel(value, lang)}</option>)}</select>
      <select name="payment" defaultValue={filters.payment ?? ""} className="input"><option value="">{ar ? "كل حالات الدفع" : "All payment"}</option>{PAYMENT_OPTIONS.map((value) => <option key={value} value={value}>{adminStatusLabel(value, lang)}</option>)}</select>
      <select name="customerType" defaultValue={filters.customerType ?? ""} className="input"><option value="">{ar ? "كل أنواع العملاء" : "All customer types"}</option><option value="guest">{ar ? "زائر" : "Guest"}</option><option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="gym_owner">Gym</option></select>
      <input type="date" name="dateFrom" defaultValue={filters.dateFrom} aria-label={ar ? "من تاريخ" : "From date"} className="input"/>
      <input type="date" name="dateTo" defaultValue={filters.dateTo} aria-label={ar ? "إلى تاريخ" : "To date"} className="input"/>
      <button className="btn btn-primary">{ar ? "تطبيق" : "Apply"}</button>
    </form>
    {orders.length === 0 ? <p className="p-10 text-center text-fg-dim">{ar ? "لا توجد طلبات مطابقة." : "No matching orders."}</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-fg-dim"><th className="p-3">#</th><th className="p-3">{ar ? "العميل" : "Customer"}</th><th className="p-3">{ar ? "السياق" : "Context"}</th><th className="p-3">{ar ? "الشحن" : "Shipping"}</th><th className="p-3">{ar ? "الدفع" : "Payment"}</th><th className="p-3">{ar ? "التنفيذ" : "Fulfillment"}</th><th className="p-3">{ar ? "الإجمالي" : "Total"}</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-border"><td className="p-3"><Link className="font-mono text-brand underline" href={`/admin/orders/${order.id}`}>{order.order_number}</Link></td><td className="p-3"><span className="font-medium">{order.customer_name}</span><span className="block text-xs text-fg-dim" dir="ltr">{order.customer_phone}</span></td><td className="p-3">{order.customer_id ? order.customer_type_code_snapshot ?? "legacy" : (ar ? "زائر" : "Guest")}</td><td className="p-3">{String(order.shipping_snapshot?.policy ?? (ar ? "قديم" : "legacy"))}</td><td className="p-3"><span className="flex flex-wrap items-center gap-1"><StatusBadge value={order.payment_status} lang={lang}/><span>· {adminStatusLabel(order.payment_method, lang)}</span></span></td><td className="p-3"><StatusBadge value={order.fulfillment_status} lang={lang}/></td><td className="p-3 font-semibold text-brand">{formatPrice(Number(order.grand_total), lang)}</td></tr>)}</tbody></table></div>}
    {nextCursor && <div className="border-t border-border p-4 text-center"><Link href={`/admin/orders?${new URLSearchParams({ ...Object.fromEntries(params), cursor: nextCursor }).toString()}`} className="btn btn-secondary">{ar ? "الصفحة التالية" : "Next page"}</Link></div>}
  </section>;
}

const PAYMENT_OPTIONS = ["pending", "paid", "failed", "refunded"] as const;
const FULFILLMENT_OPTIONS = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

const paymentLabel: Record<string, Record<"en" | "ar", string>> = {
  pending: { en: "Pending", ar: "قيد الانتظار" },
  paid: { en: "Paid", ar: "مدفوع" },
  failed: { en: "Failed", ar: "فشل" },
  refunded: { en: "Refunded", ar: "مسترد" },
};

const fulfillmentLabel: Record<string, Record<"en" | "ar", string>> = {
  pending: { en: "Pending", ar: "قيد الانتظار" },
  processing: { en: "Confirmed", ar: "تم التأكيد" },
  shipped: { en: "In shipping", ar: "جاري الشحن" },
  delivered: { en: "Delivered", ar: "تم التوصيل" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
  returned: { en: "Returned", ar: "مرتجع" },
};

const fulfillmentPillColor: Record<string, string> = {
  pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
  processing: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  shipped: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700",
  delivered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-700",
  returned: "border-orange-500/30 bg-orange-500/10 text-orange-800",
};

type StatusOverrides = Record<
  string,
  {
    payment_status?: string;
    fulfillment_status?: string;
  }
>;

export function OrdersTable({
  orders,
  lang,
  mylerzConfigured,
  bostaConfigured,
}: {
  orders: AdminOrder[];
  mylerzConfigured: boolean;
  bostaConfigured: boolean;
  lang: "en" | "ar";
}) {
  const ar = lang === "ar";
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [carrier, setCarrier] = useState("all");
  const [page, setPage] = useState(0);
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<StatusOverrides>({});

  function getStatus(
    order: AdminOrder,
    field: "payment_status" | "fulfillment_status",
  ) {
    return overrides[order.id]?.[field] ?? order[field];
  }

  async function updateStatus(
    id: string,
    field: "payment_status" | "fulfillment_status",
    value: string,
  ) {
    const key = `${id}:${field}`;
    setUpdatingField(key);
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));

    try {
      const res = await fetch("/api/admin/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.error ?? res.statusText;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      toast.success(
        ar ? "تم تحديث الحالة بنجاح" : "Status updated successfully",
      );
    } catch (err) {
      setOverrides((prev) => {
        const copy = { ...prev };
        if (copy[id]) {
          delete copy[id][field];
          if (Object.keys(copy[id]).length === 0) delete copy[id];
        }
        return copy;
      });
      toast.error(
        ar
          ? `فشل التحديث: ${err instanceof Error ? err.message : "خطأ غير معروف"}`
          : `Update failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setUpdatingField(null);
    }
  }

  const filtered = orders.filter((order) => {
    const haystack = [
      order.order_number,
      order.customer_name,
      order.customer_phone,
      order.alt_phone,
      order.address,
      order.notes,
      order.bosta?.trackingNumber,
      order.mylerz?.trackingNumber,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      haystack.includes(query.trim().toLowerCase()) &&
      (filter === "all" || getStatus(order, "fulfillment_status") === filter) &&
      (carrier === "all" ||
        (carrier === "none"
          ? !order.bosta && !order.mylerz
          : carrier === "mylerz"
            ? Boolean(order.mylerz)
            : Boolean(order.bosta)))
    );
  });
  const visible = filtered.slice(page * 20, (page + 1) * 20);
  const control =
    "rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand";
  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border border-border bg-white"
      dir={ar ? "rtl" : "ltr"}
    >
      <div className="flex flex-wrap gap-3 border-b border-border p-4">
        <label className="min-w-48 flex-1">
          <span className="sr-only">
            {ar ? "ابحث في الطلبات" : "Search orders"}
          </span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={
              ar
                ? "ابحث بالاسم، الهاتف، رقم الطلب أو التتبع…"
                : "Search name, phone, order or tracking…"
            }
            className={cn(control, "w-full")}
          />
        </label>
        <select
          aria-label={ar ? "حالة الطلب" : "Order status"}
          className={control}
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(0);
          }}
        >
          <option value="all">
            {ar ? "كل حالات الطلب" : "All order statuses"}
          </option>
          {FULFILLMENT_OPTIONS.map((value) => (
            <option value={value} key={value}>
              {fulfillmentLabel[value][lang]}
            </option>
          ))}
        </select>
        <select
          aria-label={ar ? "شركة الشحن" : "Shipping carrier"}
          className={control}
          value={carrier}
          onChange={(event) => {
            setCarrier(event.target.value);
            setPage(0);
          }}
        >
          <option value="all">{ar ? "كل الشحنات" : "All shipments"}</option>
          <option value="none">
            {ar ? "غير مرسل لشركة شحن" : "Not sent to a carrier"}
          </option>
          <option value="mylerz">Mylerz</option>
          <option value="bosta">Bosta</option>
        </select>
      </div>
      <p className="px-4 py-3 text-xs text-fg-dim" role="status">
        {ar ? "الطلبات المطابقة" : "Matching orders"}: {filtered.length} /{" "}
        {orders.length}
      </p>
      {visible.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p>{ar ? "لا توجد طلبات مطابقة" : "No matching orders"}</p>
          <button
            type="button"
            className="mt-3 text-sm text-brand underline"
            onClick={() => {
              setQuery("");
              setFilter("all");
              setCarrier("all");
              setPage(0);
            }}
          >
            {ar ? "مسح الفلاتر" : "Clear filters"}
          </button>
        </div>
      ) : (
        visible.map((order) => (
          <details key={order.id} className="group border-t border-border">
            <summary className="grid cursor-pointer grid-cols-2 items-center gap-4 p-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand md:grid-cols-5">
              <span>
                <strong className="block font-mono text-sm" dir="ltr">
                  {order.order_number}
                </strong>
                <span className="mt-1 block text-xs text-fg-dim">
                  {new Date(order.created_at).toLocaleString(
                    ar ? "ar-EG" : "en-GB",
                  )}
                </span>
              </span>
              <span>
                <strong className="block text-sm">{order.customer_name}</strong>
                <span className="mt-1 block text-xs text-fg-dim" dir="ltr">
                  {order.customer_phone}
                </span>
              </span>
              <span>
                <strong className="block text-sm">
                  {formatPrice(Number(order.grand_total), lang)}
                </strong>
                <span className="mt-1 block text-xs text-fg-dim">
                  {order.payment_method === "cod"
                    ? ar
                      ? "عند الاستلام"
                      : "Cash on delivery"
                    : ar
                      ? "دفع إلكتروني"
                      : "Online payment"}{" "}
                  · {paymentLabel[getStatus(order, "payment_status")]?.[lang]}
                </span>
              </span>
              <span
                className={cn(
                  "w-fit rounded-full border px-3 py-1 text-xs",
                  fulfillmentPillColor[getStatus(order, "fulfillment_status")],
                )}
              >
                {
                  fulfillmentLabel[getStatus(order, "fulfillment_status")]?.[
                    lang
                  ]
                }
              </span>
              <span className="text-xs">
                <strong className="block">
                  {order.mylerz
                    ? `Mylerz · ${mylerzStatusLabel(order.mylerz.status, lang)}`
                    : order.bosta
                      ? `Bosta · ${ar ? getBostaStateMeta(order.bosta.stateCode).labelAr : getBostaStateMeta(order.bosta.stateCode).labelEn}`
                      : ar
                        ? "غير مرسل لشركة شحن"
                        : "Not sent to a carrier"}
                </strong>
                <span className="mt-1 block text-fg-dim">
                  {ar ? "عرض التفاصيل والإجراءات ⌄" : "Details and actions ⌄"}
                </span>
              </span>
            </summary>
            <div className="space-y-5 border-t border-border bg-slate-50/60 p-4 sm:p-5">
              <div className="grid gap-6 lg:grid-cols-2">
                <section>
                  <h3 className="mb-3 font-semibold">
                    {ar ? "بيانات العميل" : "Customer details"}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>{order.customer_name}</p>
                    <a
                      className="block text-brand underline"
                      dir="ltr"
                      href={`tel:${order.customer_phone}`}
                    >
                      {order.customer_phone}
                    </a>
                    {order.alt_phone && <p dir="ltr">{order.alt_phone}</p>}
                    <p>
                      {order.governorate} · {order.city}
                    </p>
                    <p>{order.address}</p>
                    <OrderNotesEditor
                      key={`${order.id}:${order.notes ?? ""}`}
                      orderId={order.id}
                      initialNotes={order.notes}
                      lang={lang}
                    />
                  </div>
                </section>
                <section>
                  <h3 className="mb-3 font-semibold">
                    {ar ? "المنتجات والحساب" : "Items and totals"}
                  </h3>
                  <ul className="divide-y divide-border text-sm">
                    {order.order_items.map((item) => (
                      <li
                        key={item.id}
                        className="flex justify-between gap-3 py-2"
                      >
                        <span>
                          {ar ? item.name_ar || item.name_en : item.name_en} ×{" "}
                          {item.quantity}
                        </span>
                        <span className="shrink-0">
                          {formatPrice(
                            Number(item.price) * item.quantity,
                            lang,
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                    {[
                      [ar ? "المنتجات" : "Subtotal", order.items_total],
                      [ar ? "الخصم" : "Discount", -Number(order.discount)],
                      [ar ? "الشحن" : "Shipping", order.shipping_cost],
                      [ar ? "الإجمالي" : "Total", order.grand_total],
                    ].map(([label, amount]) => (
                      <div className="flex justify-between" key={String(label)}>
                        <dt>{label}</dt>
                        <dd>{formatPrice(Number(amount), lang)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                {(["payment_status", "fulfillment_status"] as const).map(
                  (field) => (
                    <label key={field} className="space-y-1 text-sm">
                      <span className="block">
                        {field === "payment_status"
                          ? ar
                            ? "حالة الدفع"
                            : "Payment status"
                          : ar
                            ? "حالة الطلب"
                            : "Order status"}
                      </span>
                      <select
                        className={control}
                        value={getStatus(order, field)}
                        disabled={updatingField !== null}
                        onChange={(event) =>
                          updateStatus(order.id, field, event.target.value)
                        }
                      >
                        {(field === "payment_status"
                          ? PAYMENT_OPTIONS
                          : FULFILLMENT_OPTIONS
                        ).map((value) => (
                          <option value={value} key={value}>
                            {
                              (field === "payment_status"
                                ? paymentLabel
                                : fulfillmentLabel)[value][lang]
                            }
                          </option>
                        ))}
                      </select>
                    </label>
                  ),
                )}
                {updatingField?.startsWith(order.id) && (
                  <Loader2
                    className="animate-spin motion-reduce:animate-none"
                    size={18}
                  />
                )}
                <Link
                  className="mb-2 text-sm text-brand underline"
                  href={`/admin/orders/${order.id}`}
                >
                  {ar
                    ? "فتح الطلب وتعديل المنتجات"
                    : "Open order and edit items"}
                </Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <MylerzShipmentPanel
                  key={`mylerz-${order.mylerz?.statusUpdatedAt}`}
                  orderId={order.id}
                  initialShipment={order.mylerz}
                  configured={mylerzConfigured}
                  blocked={Boolean(order.bosta)}
                  lang={lang}
                />
                <BostaShipmentPanel
                  key={`bosta-${order.bosta?.stateUpdatedAt}`}
                  orderId={order.id}
                  initialShipment={order.bosta}
                  configured={bostaConfigured}
                  blocked={Boolean(order.mylerz)}
                  lang={lang}
                />
              </div>
            </div>
          </details>
        ))
      )}
      {filtered.length > 20 && (
        <nav
          aria-label={ar ? "صفحات الطلبات" : "Order pages"}
          className="flex items-center justify-between border-t border-border p-4 text-sm"
        >
          <button
            className={control}
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            {ar ? "السابق" : "Previous"}
          </button>
          <span>
            {page + 1} / {Math.ceil(filtered.length / 20)}
          </span>
          <button
            className={control}
            disabled={(page + 1) * 20 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            {ar ? "التالي" : "Next"}
          </button>
        </nav>
      )}
    </section>
  );
}
