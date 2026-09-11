import { getCurrentCustomer } from "@/lib/customers/session";
import { getCustomerTypeState } from "@/lib/customers/type-requests";
import { getT } from "@/lib/i18n/server";
import { CustomerTypeRequest } from "@/components/storefront/customer-type-request";

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  const [state, t] = await Promise.all([
    customer ? getCustomerTypeState(customer.id) : null,
    getT(),
  ]);
  return (
    <div className="grid gap-6">
      <section className="glass-elevated p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fg-dim">{t.customerType.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold text-fg">{t.customerType.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-fg-muted">{t.customerType.description}</p>
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
