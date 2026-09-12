import Link from "next/link";
import { ArrowUpRight, Filter, Inbox } from "lucide-react";
import { ui, type Lang } from "@/lib/i18n/translations";
import type {
  AdminCustomerTypeFilters,
  AdminCustomerTypeRequest,
  CustomerType,
  CustomerTypeRequestStatus,
} from "@/lib/customers/types";

export function CustomerTypeRequestQueue({
  requests,
  types,
  filters,
  lang,
}: {
  requests: AdminCustomerTypeRequest[];
  types: CustomerType[];
  filters: AdminCustomerTypeFilters;
  lang: Lang;
}) {
  const t = ui[lang];
  const copy = t.customerTypeAdmin;
  const dateLocale = lang === "ar" ? "ar-EG" : "en-GB";
  const typeName = (type: CustomerType) => lang === "ar" ? type.name_ar : type.name_en;
  const statuses: CustomerTypeRequestStatus[] = ["pending", "approved", "rejected", "superseded"];

  return (
    <div className="grid gap-5">
      <form method="get" className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-dim">
          {copy.status}
          <select name="status" defaultValue={filters.status ?? "pending"} className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium normal-case tracking-normal text-fg">
            {statuses.map((status) => <option key={status} value={status}>{t.customerType[status]}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-dim">
          {copy.requestedType}
          <select name="requestedType" defaultValue={filters.requestedType ?? ""} className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium normal-case tracking-normal text-fg">
            <option value="">{copy.allRequestedTypes}</option>
            {types.map((type) => <option key={type.id} value={type.code}>{typeName(type)}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-dim">
          {copy.currentType}
          <select name="effectiveType" defaultValue={filters.effectiveType ?? ""} className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium normal-case tracking-normal text-fg">
            <option value="">{copy.allEffectiveTypes}</option>
            {types.map((type) => <option key={type.id} value={type.code}>{typeName(type)}</option>)}
          </select>
        </label>
        <button className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark">
          <Filter size={16} /> {copy.applyFilters}
        </button>
      </form>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-14 text-center">
          <Inbox className="mx-auto text-fg-dim" size={30} />
          <p className="mt-3 text-sm text-fg-dim">{copy.empty}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{copy.customer}</p>
                  <p className="mt-1 truncate font-semibold text-fg">{request.customer.full_name || request.customer.email || request.customer.phone || "—"}</p>
                  <p className="mt-1 truncate text-xs text-fg-dim">{request.customer.email || request.customer.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{copy.requestedType}</p>
                  <p className="mt-1 font-semibold text-fg">{typeName(request.requested_type)}</p>
                  <p className="mt-1 text-xs text-fg-dim">{copy.currentType}: {typeName(request.effective_type)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{copy.business}</p>
                  <p className="mt-1 truncate font-medium text-fg">{request.business_name}</p>
                  <p className="mt-1 text-xs text-fg-dim">{new Date(request.submitted_at).toLocaleString(dateLocale)}</p>
                </div>
                <Link href={`/admin/customer-type-requests/${request.id}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand/20 bg-brand/5 px-4 text-sm font-semibold text-brand transition hover:bg-brand/10">
                  {copy.open} <ArrowUpRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
