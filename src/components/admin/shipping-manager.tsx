"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/admin/toast";
import { Pencil, X, Check } from "lucide-react";
import type { AdminShippingRate } from "@/lib/data/admin-crud";

export function ShippingManager({
  rates,
  lang,
}: {
  rates: AdminShippingRate[];
  lang: "en" | "ar";
}) {
  const ar = lang === "ar";
  const router = useRouter();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ governorate: "", city: "", cost: 0 });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed");
      }
      setShowForm(false);
      setForm({ governorate: "", city: "", cost: 0 });
      toast.success(ar ? "تمت إضافة السعر" : "Rate added");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(rate: AdminShippingRate) {
    setEditSaving(true);
    try {
      const res = await fetch("/api/admin/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ governorate: rate.governorate, city: rate.city, cost: editCost }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed");
      }
      setEditingId(null);
      toast.success(ar ? "تم تحديث السعر" : "Rate updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(ar ? "هل تريد حذف هذا السعر؟" : "Delete this rate?")) return;
    try {
      const res = await fetch(`/api/admin/shipping?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed");
      }
      toast.success(ar ? "تم حذف السعر" : "Rate deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  function startEdit(rate: AdminShippingRate) {
    setEditingId(rate.id);
    setEditCost(Number(rate.cost));
  }

  return (
    <>
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          {showForm ? (ar ? "إلغاء" : "Cancel") : ar ? "+ سعر جديد" : "+ New rate"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass mt-4 grid gap-4 p-6 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">{ar ? "المحافظة" : "Governorate"}</span>
            <input required value={form.governorate} onChange={(e) => setForm({ ...form, governorate: e.target.value })} className={inputCls} placeholder="القاهرة or *" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">{ar ? "المدينة" : "City"}</span>
            <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} placeholder="مدينة نصر or *" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">{ar ? "التكلفة (ج.م)" : "Cost (EGP)"}</span>
            <input required type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className={inputCls} />
          </label>
          <button type="submit" disabled={saving} className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white sm:col-span-3">
            {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "إضافة سعر" : "Add rate")}
          </button>
        </form>
      )}

      <div className="glass mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-fg-dim">
            <tr>
              <th className="px-4 py-3">{ar ? "المحافظة" : "Governorate"}</th>
              <th className="px-4 py-3">{ar ? "المدينة" : "City"}</th>
              <th className="px-4 py-3">{ar ? "التكلفة" : "Cost"}</th>
              <th className="px-4 py-3 text-right">{ar ? "إجراءات" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-fg-dim">
                  {ar ? "لا توجد أسعار شحن." : "No shipping rates yet."}
                </td>
              </tr>
            ) : (
              rates.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium text-fg">{r.governorate}</td>
                  <td className="px-4 py-3 text-fg-muted">{r.city}</td>
                  <td className="px-4 py-3">
                    {editingId === r.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editCost}
                          onChange={(e) => setEditCost(Number(e.target.value))}
                          className="w-24 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-sm text-fg outline-none focus:border-brand"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEdit(r)}
                          disabled={editSaving}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald/10 text-emerald transition hover:bg-emerald/20"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-fg-dim transition hover:bg-white/10"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="font-semibold text-brand">{formatPrice(Number(r.cost), lang)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editingId !== r.id && (
                        <button
                          onClick={() => startEdit(r)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-dim transition hover:bg-white/5 hover:text-brand"
                          title={ar ? "تعديل" : "Edit"}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-xs text-red-300 hover:underline"
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
