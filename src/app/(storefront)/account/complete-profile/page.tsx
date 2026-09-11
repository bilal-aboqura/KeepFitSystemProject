import { requireCustomerPage } from "@/lib/customers/session";
import { CustomerProfileForm } from "@/components/storefront/customer-profile-form";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
import { safeReturnPath } from "@/lib/customers/return-path";
export default async function CompleteProfilePage({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const c=await requireCustomerPage(); const t=ui[await getLang()].account;
  return <section className="glass-elevated max-w-xl p-6"><h1 className="text-2xl font-bold">{t.complete}</h1><p className="mt-3">{t.completionHint}</p><CustomerProfileForm initial={c} next={safeReturnPath((await searchParams).next)}/></section>;
}
