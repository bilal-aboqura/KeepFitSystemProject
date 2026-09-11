import Link from "next/link";
import { CustomerAuth } from "@/components/storefront/customer-auth";
import { safeReturnPath } from "@/lib/customers/return-path";
import { getLang } from "@/lib/i18n/server";
import { ui } from "@/lib/i18n/translations";
export default async function SignInPage({searchParams}:{searchParams:Promise<{next?:string;auth?:string}>}) {
  const sp=await searchParams;const t=ui[await getLang()].account;
  return <section className="mx-auto max-w-xl px-5 py-12"><h1 className="mb-6 text-3xl font-bold">{t.title}</h1>{sp.auth&&<p role="alert" className="mb-5">{t.authFailed}</p>}<CustomerAuth next={safeReturnPath(sp.next)}/><Link href="/" className="mt-6 inline-flex min-h-11 items-center underline">{t.guest}</Link></section>;
}
