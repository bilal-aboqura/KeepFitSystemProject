import Link from "next/link";
import { formatPrice } from "@/lib/utils";

interface SnapshotOrder {
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  alt_phone?: string | null;
  governorate: string;
  city: string;
  address: string;
  items_total: number;
  shipping_cost: number;
  discount: number;
  grand_total: number;
  commerce_snapshot_version?: number | null;
  commerce_context_kind?: string | null;
  customer_type_name_en_snapshot?: string | null;
  customer_type_name_ar_snapshot?: string | null;
  order_items?: Array<Record<string, unknown>>;
}

export function OrderSnapshot({ order, lang }: { order: SnapshotOrder; lang: "en" | "ar" }) {
  const ar = lang === "ar";
  return <section className="rounded-2xl border border-border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-fg">{ar ? "لقطة الطلب المعتمدة" : "Authoritative order snapshot"}</h2><span className="pill pill-info">{order.commerce_snapshot_version === 1 ? "v1" : (ar ? "قديم" : "legacy")}</span></div>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div><h3 className="text-xs font-semibold uppercase text-fg-dim">{ar ? "العميل والتوصيل" : "Customer & delivery"}</h3><p className="mt-2 font-medium">{order.customer_name}</p><p dir="ltr">{order.customer_phone}{order.alt_phone ? ` · ${order.alt_phone}` : ""}</p><p>{order.address}, {order.city}, {order.governorate}</p>{order.customer_id ? <Link href={`/admin/customers/${order.customer_id}`} className="mt-2 inline-block text-brand underline">{ar ? "فتح العميل" : "Open customer"}</Link> : <p className="mt-2 text-fg-dim">{ar ? "طلب زائر — لا يتم الاستدلال بالهاتف" : "Guest order — no phone-based identity inference"}</p>}</div>
      <div><h3 className="text-xs font-semibold uppercase text-fg-dim">{ar ? "السياق التجاري" : "Commercial context"}</h3><p className="mt-2">{ar ? order.customer_type_name_ar_snapshot : order.customer_type_name_en_snapshot || (ar ? "سياق قديم" : "Legacy context")}</p><p className="text-sm text-fg-dim">{order.commerce_context_kind ?? "legacy"}</p></div>
    </div>
    <div className="mt-5 space-y-3">{order.order_items?.map((item) => <div key={String(item.id)} className="rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{String((ar ? item.product_name_ar : item.product_name_en) ?? (ar ? item.name_ar : item.name_en) ?? "Product")}</strong><span>{formatPrice(Number(item.line_total_minor ?? Number(item.line_total ?? 0) * 100) / 100, lang)}</span></div><p className="mt-1 text-sm text-fg-muted">{String((ar ? item.variant_label_ar : item.variant_label_en) ?? "")} · {String((ar ? item.unit_label_ar : item.unit_label_en) ?? item.sellable_unit_code ?? "")} · SKU {String(item.sku ?? "—")}</p><p className="mt-1 text-xs text-fg-dim">{ar ? "الكمية" : "Quantity"}: {String(item.quantity)} · {ar ? "المكافئ الأساسي" : "Base equivalent"}: {String(item.equivalent_base_quantity_num ?? "—")}/{String(item.equivalent_base_quantity_den ?? "—")} · {ar ? "القاعدة" : "Rule"}: {String(item.minimum_quantity_snapshot ?? 1)} + n×{String(item.quantity_increment_snapshot ?? 1)} · {ar ? "مصدر السعر" : "Price kind"}: {String(item.pricing_source ?? "legacy")}{item.price_is_derived ? ` (${ar ? "مشتق" : "derived"})` : ""}</p></div>)}</div>
    <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm"><Row label={ar ? "المنتجات" : "Items"} value={formatPrice(Number(order.items_total), lang)}/><Row label={ar ? "الخصم" : "Discount"} value={formatPrice(Number(order.discount), lang)}/><Row label={ar ? "الشحن" : "Shipping"} value={formatPrice(Number(order.shipping_cost), lang)}/><Row label={ar ? "الإجمالي" : "Total"} value={formatPrice(Number(order.grand_total), lang)} strong/></dl>
  </section>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className="flex justify-between"><dt>{label}</dt><dd className={strong ? "text-lg font-bold text-brand" : "font-medium"}>{value}</dd></div>; }
