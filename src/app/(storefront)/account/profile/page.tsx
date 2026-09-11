import { requireCustomerPage } from "@/lib/customers/session";
import { CustomerProfileForm } from "@/components/storefront/customer-profile-form";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
export default async function ProfilePage() {
  const c=await requireCustomerPage();const t=ui[await getLang()].account;
  return <section className="glass-elevated max-w-xl p-6"><h1 className="text-3xl font-bold">{t.profile}</h1><dl className="mt-4 break-words"><dt>{t.email}</dt><dd dir="ltr">{c.email||"—"}</dd><dt className="mt-3">ID</dt><dd className="text-sm" dir="ltr">{c.id}</dd></dl><CustomerProfileForm initial={c}/></section>;
}
