"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRoundCog } from "lucide-react";
import { useLang } from "@/components/language/provider";
import type { CustomerType } from "@/lib/customers/types";

export function CustomerTypeAssignment({
  customerId,
  currentType,
  types,
  hasPendingRequest,
}: {
  customerId: string;
  currentType: CustomerType;
  types: CustomerType[];
  hasPendingRequest: boolean;
}) {
  const { t, lang } = useLang();
  const router = useRouter();
  const copy = t.customerTypeAdmin;
  const available = types.filter((type) => type.is_active && type.id !== currentType.id);
  const [target, setTarget] = useState(available[0]?.code ?? currentType.code);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function assign() {
    if (!window.confirm(copy.confirmAssign)) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/admin/customers/${customerId}/customer-type`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_type_code: target, reason }),
    });
    if (response.ok) {
      router.refresh();
      return;
    }
    setError(copy.assignmentError);
    setSaving(false);
  }

  if (available.length === 0) return null;
  return (
    <details className="min-w-[230px] rounded-xl border border-border bg-white p-3">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-brand">
        <UserRoundCog size={16} /> {copy.assignType}
      </summary>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-xs font-medium text-fg-dim">
          {copy.targetType}
          <select value={target} onChange={(event) => setTarget(event.target.value as typeof target)} className="min-h-11 rounded-lg border border-border bg-white px-2 text-sm text-fg">
            {available.map((type) => (
              <option key={type.id} value={type.code}>{lang === "ar" ? type.name_ar : type.name_en}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-fg-dim">
          {copy.assignmentReason}
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={2} maxLength={1000} rows={2} className="rounded-lg border border-border p-2 text-sm text-fg" />
        </label>
        {hasPendingRequest ? <p className="text-xs leading-5 text-amber-700">{copy.pendingWillClose}</p> : null}
        {error ? <p role="alert" className="text-xs text-red-600">{error}</p> : null}
        <button type="button" onClick={assign} disabled={saving || reason.trim().length < 2} className="min-h-11 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? copy.assigning : copy.assignType}
        </button>
      </div>
    </details>
  );
}
