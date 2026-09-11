import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomerPage } from "@/lib/customers/session";
import { getCustomerOrder } from "@/lib/customers/queries";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
import { formatPrice } from "@/lib/utils";
export default async function AccountOrderPage({params}:{params:Promise<{orderNumber:string}>}) {
  const c=await requireCustomerPage();const o=await getCustomerOrder(c.id,(await params).orderNumber);if(!o)notFound();
  const lang=await getLang();const t=ui[lang].account;const ar=lang==="ar";
  const status = (value: string) => t.statuses[value as keyof typeof t.statuses] || value;
  return <section className="glass-elevated break-words p-6"><Link href="/account/orders" className="underline">{t.back}</Link>
    <h1 className="mt-5 text-3xl font-bold">{t.details}</h1><p className="mt-2 font-mono">{o.order_number}</p>
    <dl className="mt-5 grid gap-2"><dt>{t.date}</dt><dd>{new Date(o.created_at).toLocaleDateString(ar?"ar-EG":"en-GB")}</dd><dt>{t.payment}</dt><dd>{status(o.payment_method)} · {status(o.payment_status)}</dd><dt>{t.fulfillment}</dt><dd>{status(o.fulfillment_status)}</dd></dl>
    <ul className="mt-6 space-y-3">{o.order_items.map(i=><li key={i.id} className="flex flex-wrap justify-between gap-2"><span>{ar?(i.name_ar||i.name_en):i.name_en} × {i.quantity}</span><span>{formatPrice(Number(i.price)*i.quantity,lang)}</span></li>)}</ul>
    <dl className="mt-6 grid gap-2 border-t border-border pt-4"><dt>{ui[lang].cart.subtotal}</dt><dd>{formatPrice(Number(o.items_total),lang)}</dd><dt>{ui[lang].cart.shipping}</dt><dd>{formatPrice(Number(o.shipping_cost),lang)}</dd><dt>{ar?"الخصم":"Discount"}</dt><dd>{formatPrice(Number(o.discount),lang)}</dd><dt>{t.total}</dt><dd className="font-bold">{formatPrice(Number(o.grand_total),lang)}</dd><dt>{t.recipient}</dt><dd>{o.customer_name} · <span dir="ltr">{o.customer_phone}</span></dd><dt>{t.address}</dt><dd>{o.address}, {o.city}, {o.governorate}</dd></dl></section>;
}
