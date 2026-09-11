"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Ban, Building2, Clock3, UserRound } from "lucide-react";
import { useLang } from "@/components/language/provider";
import type { AdminCustomerTypeRequestDetail, CustomerType } from "@/lib/customers/types";

export function CustomerTypeRequestDetail({ request }: { request: AdminCustomerTypeRequestDetail }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const copy = t.customerTypeAdmin;
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const typeName = (type: CustomerType) => lang === "ar" ? type.name_ar : type.name_en;

  async function decide(action: "approve" | "reject", formData?: FormData) {
    const confirmed = window.confirm(action === "approve" ? copy.confirmApprove : copy.confirmReject);
    if (!confirmed) return;
    setPendingAction(action);
    setError("");
    const response = await fetch(`/api/admin/customer-type-requests/${request.id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: action === "reject"
        ? JSON.stringify({
            public_reason: formData?.get("public_reason"),
            internal_note: formData?.get("internal_note"),
          })
        : undefined,
    });
    if (response.ok) {
      router.refresh();
      return;
    }
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error === "conflict" ? copy.conflict : copy.actionError);
    setPendingAction(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-5">
        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{copy.requestedType}</p>
              <h2 className="mt-1 text-2xl font-bold text-fg">{typeName(request.requested_type)}</h2>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              {t.customerType[request.status]}
            </span>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Detail label={copy.business} value={request.business_name} />
            <Detail label={copy.currentType} value={typeName(request.effective_type)} />
            <Detail label={t.customerType.businessPhone} value={request.business_phone || "—"} />
            <Detail label={copy.submitted} value={new Date(request.submitted_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")} />
            <Detail label={t.customerType.governorate} value={request.governorate || "—"} />
            <Detail label={t.customerType.city} value={request.city || "—"} />
          </dl>
          {request.business_description ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-fg-muted">{request.business_description}</p> : null}
          {request.customer_note ? <p className="mt-3 rounded-xl border border-border p-4 text-sm leading-6 text-fg-muted">{request.customer_note}</p> : null}
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2"><Clock3 size={18} className="text-brand" /><h2 className="font-bold text-fg">{copy.history}</h2></div>
          <div className="mt-4 grid gap-3">
            {request.history.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold text-fg">{typeName(item.requested_type)}</p><p className="mt-1 text-xs text-fg-dim">{new Date(item.submitted_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")}</p></div>
                <span className="text-sm font-medium text-fg-muted">{t.customerType[item.status]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid content-start gap-5">
        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2"><UserRound size={18} className="text-brand" /><h2 className="font-bold text-fg">{copy.customerDetails}</h2></div>
          <dl className="mt-4 grid gap-3">
            <Detail label={copy.customer} value={request.customer.full_name || "—"} />
            <Detail label="Email" value={request.customer.email || "—"} />
            <Detail label={copy.contact} value={request.customer.phone || "—"} />
          </dl>
        </section>

        {request.status === "pending" ? (
          <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => decide("approve")}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <BadgeCheck size={17} /> {pendingAction === "approve" ? copy.approving : copy.approve}
            </button>
            <div className="my-5 border-t border-border" />
            <form action={(formData) => decide("reject", formData)} className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium text-fg">{copy.publicReason}<textarea name="public_reason" rows={3} maxLength={1000} className="rounded-xl border border-border p-3" /></label>
              <label className="grid gap-1.5 text-sm font-medium text-fg">{copy.internalNote}<textarea name="internal_note" rows={3} maxLength={2000} className="rounded-xl border border-border p-3" /></label>
              <button disabled={pendingAction !== null} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60">
                <Ban size={17} /> {pendingAction === "reject" ? copy.rejecting : copy.reject}
              </button>
            </form>
            {error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null}
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-slate-50 p-5 text-sm text-fg-muted">
            <div className="flex items-center gap-2 font-semibold text-fg"><Building2 size={17} />{copy.decided}</div>
            {request.rejection_reason_public ? <p className="mt-3">{copy.publicReason}: {request.rejection_reason_public}</p> : null}
            {request.internal_admin_note ? <p className="mt-2">{copy.internalNote}: {request.internal_admin_note}</p> : null}
          </section>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-fg">{value}</dd></div>;
}
