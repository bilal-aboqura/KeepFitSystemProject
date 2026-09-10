"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/admin/toast";
import type { AdminDiscount } from "@/lib/data/admin-crud";

interface FormState {
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_subtotal: string;
  expires_at: string;
  usage_limit: string;
}

const defaultForm: FormState = {
  code: "",
  type: "percent",
  value: 0,
  min_subtotal: "",
  expires_at: "",
  usage_limit: "",
};

export function DiscountManager({
  discounts,
  lang,
}: {
  discounts: AdminDiscount[];
  lang: "en" | "ar";
}) {
  const ar = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          type: form.type,
          value: Number(form.value),
          min_subtotal: form.min_subtotal ? Number(form.min_subtotal) : undefined,
          expires_at: form.expires_at || null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message || d.error || "Failed");
      }
      setShowForm(false);
      setForm(defaultForm);
      toast.success(ar ? "تم إنشاء الكوبون" : "Discount created");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ar ? "فشل الإنشاء" : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(d: AdminDiscount) {
    setTogglingId(d.id);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, active: !d.active }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || data.error || "Failed");
      }
      toast.success(
        ar
          ? `تم ${d.active ? "تعطيل" : "تفعيل"} الكوبون`
          : `Discount ${d.active ? "deactivated" : "activated"}`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ar ? "فشل التحديث" : "Update failed");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(ar ? "حذف هذا الكوبون؟" : "Delete this discount code?")) return;
    try {
      const res = await fetch(`/api/admin/discounts?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || data.error || "Failed");
      }
      toast.success(ar ? "تم حذف الكوبون" : "Discount deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ar ? "فشل الحذف" : "Delete failed");
    }
  }

  return (
    <>
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          {showForm ? (ar ? "إلغاء" : "Cancel") : ar ? "+ كوبون جديد" : "+ New discount"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass mt-4 grid gap-4 p-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">
              {ar ? "الكود" : "Code"}
            </span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={inputCls}
              placeholder="SAVE10"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">
              {ar ? "النوع" : "Type"}
            </span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" })}
              className={inputCls}
            >
              <option value="percent">{ar ? "نسبة مئوية (%)" : "Percent (%)"}</option>
              <option value="fixed">{ar ? "مبلغ ثابت (ج.م)" : "Fixed (EGP)"}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">
              {ar ? "القيمة" : "Value"}
            </span>
            <input
              required
              type="number"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">
              {ar ? "الحد الأدنى للطلب (اختياري)" : "Min subtotal (optional)"}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.min_subtotal}
              onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })}
              className={inputCls}
              placeholder={ar ? "مثلاً 200" : "e.g. 200"}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">
              {ar ? "تاريخ الانتهاء (اختياري)" : "Expires (optional)"}
            </span>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">
              {ar ? "حد الاستخدام (اختياري)" : "Usage limit (optional)"}
            </span>
            <input
              type="number"
              min="1"
              value={form.usage_limit}
              onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white sm:col-span-2"
          >
            {saving
              ? (ar ? "جارٍ الإنشاء…" : "Creating…")
              : (ar ? "إنشاء كوبون" : "Create discount")}
          </button>
        </form>
      )}

      <div className="glass mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-fg-dim">
            <tr>
              <th className="px-4 py-3">{ar ? "الكود" : "Code"}</th>
              <th className="px-4 py-3">{ar ? "النوع" : "Type"}</th>
              <th className="px-4 py-3">{ar ? "القيمة" : "Value"}</th>
              <th className="px-4 py-3">{ar ? "الحد الأدنى" : "Min subtotal"}</th>
              <th className="px-4 py-3">{ar ? "الاستخدام" : "Used"}</th>
              <th className="px-4 py-3">{ar ? "الحالة" : "Status"}</th>
              <th className="px-4 py-3">{ar ? "إجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {discounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-fg-dim">
                  {ar ? "لا توجد كوبونات." : "No discount codes yet."}
                </td>
              </tr>
            ) : (
              discounts.map((d) => (
                <tr key={d.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono font-semibold text-fg">{d.code}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {d.type === "percent"
                      ? (ar ? "نسبة" : "percent")
                      : (ar ? "ثابت" : "fixed")}
                  </td>
                  <td className="px-4 py-3 text-fg">
                    {d.type === "percent" ? `${d.value}%` : formatPrice(Number(d.value), lang)}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {d.min_subtotal > 0 ? formatPrice(d.min_subtotal, lang) : (ar ? "—" : "—")}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {d.used_count}{d.usage_limit ? ` / ${d.usage_limit}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    {d.active ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                        {ar ? "مفعّل" : "active"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-fg-dim">
                        {ar ? "معطّل" : "inactive"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggle(d)}
                        disabled={togglingId === d.id}
                        className="text-sm text-fg-muted hover:text-fg hover:underline disabled:opacity-50"
                      >
                        {togglingId === d.id
                          ? "…"
                          : d.active
                            ? (ar ? "تعطيل" : "Deactivate")
                            : (ar ? "تفعيل" : "Activate")}
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-sm text-red-300 hover:underline"
                      >
                        {ar ? "حذف" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-fg outline-none focus:border-brand";
