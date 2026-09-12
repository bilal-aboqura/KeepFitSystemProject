"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Building2, Clock3, History, ShieldCheck } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { cn } from "@/lib/utils";
import type {
  CustomerTypeCode,
  CustomerTypeRequestPublic,
  CustomerTypeState,
} from "@/lib/customers/types";

function requestStatusTone(status: CustomerTypeRequestPublic["status"]) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  if (status === "superseded") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function CustomerTypeRequest({ state }: { state: CustomerTypeState }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const copy = t.customerType;
  const [selectedType, setSelectedType] = useState<CustomerTypeCode>(
    state.available_types[0]?.code ?? "wholesale",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const typeName = (type: CustomerTypeState["effective_type"]) =>
    lang === "ar" ? type.name_ar : type.name_en;
  const statusName = (status: CustomerTypeRequestPublic["status"]) => copy[status];
  const selectedIsGym = selectedType === "gym_owner";

  async function submit(formData: FormData) {
    setSaving(true);
    setError("");
    const response = await fetch("/api/customer/type-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requested_type_code: selectedType,
        business_name: formData.get("business_name"),
        business_phone: formData.get("business_phone"),
        governorate: formData.get("governorate"),
        city: formData.get("city"),
        business_description: formData.get("business_description"),
        customer_note: formData.get("customer_note"),
      }),
    });
    if (response.ok) {
      router.refresh();
      return;
    }
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(
      body?.error === "validation"
        ? copy.validationError
        : body?.error === "conflict"
          ? copy.conflictError
          : copy.genericError,
    );
    setSaving(false);
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-border bg-surface/70 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-dim">{copy.effective}</p>
            <h2 className="mt-2 text-2xl font-bold text-fg">{typeName(state.effective_type)}</h2>
          </div>
          <span className="flex min-h-11 items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            <ShieldCheck size={17} />
            {copy.approved}
          </span>
        </div>
      </section>

      {state.pending_request ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 shrink-0 text-amber-700" size={22} />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-amber-950">{copy.pendingTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-amber-900/80">{copy.pendingBody}</p>
              {state.effective_type.code !== "retail" ? (
                <p className="mt-2 text-sm font-medium text-amber-950">{copy.protectedTransition}</p>
              ) : null}
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-amber-900/60">{copy.requestedType}: </span>{typeName(state.pending_request.requested_type)}</p>
                <p><span className="text-amber-900/60">{copy.businessName}: </span>{state.pending_request.business_name}</p>
              </div>
            </div>
          </div>
        </section>
      ) : state.can_request ? (
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Building2 size={21} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-fg">{copy.requestTitle}</h2>
              {state.history.some((request) => request.status === "rejected") ? (
                <p className="mt-1 text-sm text-fg-dim">{copy.reapply}</p>
              ) : null}
            </div>
          </div>
          <form action={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-fg sm:col-span-2">
              {copy.requestedType}
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value as CustomerTypeCode)}
                className="min-h-11 rounded-xl border border-border bg-ink px-3 py-2.5"
              >
                {state.available_types.map((type) => (
                  <option key={type.id} value={type.code}>{typeName(type)}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-fg sm:col-span-2">
              {selectedIsGym ? copy.gymName : copy.businessName}
              <input required name="business_name" maxLength={160} className="min-h-11 rounded-xl border border-border bg-ink px-3 py-2.5" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-fg">
              {copy.businessPhone}
              <input name="business_phone" inputMode="tel" dir="ltr" className="min-h-11 rounded-xl border border-border bg-ink px-3 py-2.5" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-fg">
              {copy.governorate}
              <input name="governorate" maxLength={100} className="min-h-11 rounded-xl border border-border bg-ink px-3 py-2.5" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-fg sm:col-span-2">
              {copy.city}
              <input name="city" maxLength={100} className="min-h-11 rounded-xl border border-border bg-ink px-3 py-2.5" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-fg sm:col-span-2">
              {copy.descriptionLabel}
              <textarea name="business_description" maxLength={1000} rows={3} className="rounded-xl border border-border bg-ink px-3 py-2.5" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-fg sm:col-span-2">
              {copy.note}
              <textarea name="customer_note" maxLength={1000} rows={3} className="rounded-xl border border-border bg-ink px-3 py-2.5" />
            </label>
            {error ? <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
            <button disabled={saving} className="btn btn-primary min-h-11 justify-center disabled:opacity-60 sm:col-span-2" aria-busy={saving}>
              {saving ? copy.submitting : copy.submit}
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface/70 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <History size={19} className="text-brand" />
          <h2 className="text-lg font-bold text-fg">{copy.history}</h2>
        </div>
        {state.history.length === 0 ? (
          <p className="mt-4 text-sm text-fg-dim">{copy.historyEmpty}</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {state.history.map((request) => (
              <article key={request.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-fg">
                    {request.status === "approved" ? <BadgeCheck size={17} className="text-emerald-600" /> : null}
                    {typeName(request.requested_type)}
                  </div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", requestStatusTone(request.status))}>
                    {statusName(request.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-fg-muted">{request.business_name}</p>
                <p className="mt-2 text-xs text-fg-dim">
                  {copy.submitted}: {new Date(request.submitted_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB")}
                </p>
                {request.rejection_reason_public ? (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {copy.publicReason}: {request.rejection_reason_public}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
