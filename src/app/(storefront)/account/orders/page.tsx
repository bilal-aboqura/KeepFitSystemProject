import Link from "next/link";
import { requireCustomerPage } from "@/lib/customers/session";
import { listCustomerOrders } from "@/lib/customers/queries";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
import { formatPrice } from "@/lib/utils";
export default async function AccountOrdersPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const customer=await requireCustomerPage();const page=Math.max(1,Math.min(10000,Number.parseInt((await searchParams).page||"1")||1));
  const orders=await listCustomerOrders(customer.id,page);const lang=await getLang();const t=ui[lang].account;
  const status = (value: string) => t.statuses[value as keyof typeof t.statuses] || value;
  return <section><h1 className="text-3xl font-bold">{t.orders}</h1>
    <div className="mt-6 grid gap-3">{orders.length?orders.map(o=><Link key={o.order_number} href={"/account/orders/"+encodeURIComponent(o.order_number)} className="glass flex flex-wrap justify-between gap-3 break-words p-4">
      <span className="font-mono text-sm">{o.order_number}</span><span>{formatPrice(Number(o.grand_total),lang)}</span><span>{new Date(o.created_at).toLocaleDateString(lang==="ar"?"ar-EG":"en-GB")}</span>
      <span className="w-full text-sm">{t.payment}: {status(o.payment_status)} · {t.fulfillment}: {status(o.fulfillment_status)}</span></Link>):<p>{t.noOrders}</p>}</div>
    <nav className="mt-5 flex gap-3">{page>1&&<Link className="btn btn-secondary" href={"?page="+(page-1)}>{t.previous}</Link>}{orders.length===20&&<Link className="btn btn-secondary" href={"?page="+(page+1)}>{t.next}</Link>}</nav></section>;
}
