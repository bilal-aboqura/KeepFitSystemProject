import Link from "next/link";
import { CustomerTypeRequest } from "@/components/storefront/customer-type-request";
import { isCustomerProfileComplete } from "@/lib/customers/identity";
import { requireCustomerPage } from "@/lib/customers/session";
import { getCustomerTypeState } from "@/lib/customers/type-requests";
import { getT } from "@/lib/i18n/server";

export default async function AccountPage() {
  const customer = await requireCustomerPage();
  const [state, t] = await Promise.all([
    getCustomerTypeState(customer.id),
    getT(),
  ]);

  return (
    <div className="grid gap-6">
      <section className="glass-elevated p-6">
        <h1 className="break-words text-3xl font-bold">
          {customer.full_name || t.account.title}
        </h1>
        <p className="mt-3">{t.account.accountHint}</p>
        {!isCustomerProfileComplete(customer) ? (
          <div className="mt-4 rounded-xl border border-border p-4">
            <p>{t.account.completionHint}</p>
            <Link className="btn btn-primary mt-3" href="/account/complete-profile">
              {t.account.complete}
            </Link>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            ["profile", t.account.profile],
            ["addresses", t.account.addresses],
            ["orders", t.account.orders],
          ].map(([path, label]) => (
            <Link key={path} href={`/account/${path}`} className="btn btn-secondary min-h-11">
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="glass-elevated p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fg-dim">
          {t.customerType.eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-bold text-fg">{t.customerType.title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-fg-muted">
          {t.customerType.description}
        </p>
      </section>

      {state ? (
        <CustomerTypeRequest state={state} />
      ) : (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {t.customerType.unavailable}
        </p>
      )}
    </div>
  );
}
