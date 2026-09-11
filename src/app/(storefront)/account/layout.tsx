import { requireCustomerPage } from "@/lib/customers/session";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
import { CustomerAuth } from "@/components/storefront/customer-auth";
import Link from "next/link";
export default async function AccountLayout({children}:{children:React.ReactNode}) {
  await requireCustomerPage(); const lang=await getLang();const t=ui[lang].account;
  return <div dir={lang==="ar"?"rtl":"ltr"} className="mx-auto w-full max-w-5xl px-5 py-10">
    <nav aria-label={t.title} className="mb-6 flex flex-wrap gap-2">
      {[["/account",t.overview],["/account/profile",t.profile],["/account/addresses",t.addresses],["/account/orders",t.orders]].map(([href,label])=><Link className="flex min-h-11 items-center rounded-lg border border-border px-3 py-2" key={href} href={href}>{label}</Link>)}
      <CustomerAuth authenticated/>
    </nav>{children}</div>;
}
