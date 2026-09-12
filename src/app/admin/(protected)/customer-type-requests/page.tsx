import { AdminPageHeader } from "@/components/admin/page-header";
import { CustomerTypeRequestQueue } from "@/components/admin/customer-type-request-queue";
import { listCustomerTypes } from "@/lib/customers/customer-types";
import { listAdminCustomerTypeRequests } from "@/lib/customers/type-requests";
import { adminCustomerTypeFiltersSchema } from "@/lib/customers/validation";
import { getLang, getT } from "@/lib/i18n/server";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerTypeRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const parsed = adminCustomerTypeFiltersSchema.safeParse({
    status: first(search.status) || "pending",
    requestedType: first(search.requestedType) || undefined,
    effectiveType: first(search.effectiveType) || undefined,
  });
  const filters = parsed.success ? parsed.data : { status: "pending" as const };
  const [requests, types, lang, t] = await Promise.all([
    listAdminCustomerTypeRequests(filters),
    listCustomerTypes(),
    getLang(),
    getT(),
  ]);
  return (
    <div>
      <AdminPageHeader
        eyebrow={t.customerTypeAdmin.eyebrow}
        title={t.customerTypeAdmin.queueTitle}
        description={t.customerTypeAdmin.queueDescription}
      />
      <div className="mt-6"><CustomerTypeRequestQueue requests={requests} types={types} filters={filters} lang={lang} /></div>
    </div>
  );
}
