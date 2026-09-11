import Link from "next/link";
import { requireCustomerPage } from "@/lib/customers/session";
import { isCustomerProfileComplete } from "@/lib/customers/identity";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
export default async function AccountPage() {
  const c=await requireCustomerPage();const t=ui[await getLang()].account;
  return <section className="glass-elevated p-6"><h1 className="break-words text-3xl font-bold">{c.full_name||t.title}</h1><p className="mt-3">{t.accountHint}</p>
  {!isCustomerProfileComplete(c)&&<div className="mt-4 rounded-xl border border-border p-4"><p>{t.completionHint}</p><Link className="btn btn-primary mt-3" href="/account/complete-profile">{t.complete}</Link></div>}
  <div className="mt-6 flex flex-wrap gap-3">{[["profile",t.profile],["addresses",t.addresses],["orders",t.orders]].map(([path,label])=><Link key={path} href={"/account/"+path} className="btn btn-secondary min-h-11">{label}</Link>)}</div></section>;
}
