"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

export function OrderNotesEditor({
  orderId,
  initialNotes,
  lang,
}: {
  orderId: string;
  initialNotes: string | null;
  lang: "ar" | "en";
}) {
  const ar = lang === "ar";
  const inputId = useId();
  const router = useRouter();
  const toast = useToast();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = notes.trim() !== savedNotes.trim();

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    setError("");
    const value = notes.trim();
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, notes: value || null }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : ar
              ? "تعذر حفظ الملاحظات."
              : "Could not save notes.",
        );
      setSavedNotes(value);
      setNotes(value);
      toast.success(ar ? "تم حفظ ملاحظات الطلب." : "Order notes saved.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "تعذر حفظ الملاحظات."
            : "Could not save notes.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <label htmlFor={inputId} className="block text-sm font-semibold">
        {ar ? "ملاحظات الطلب" : "Order notes"}
      </label>
      <textarea
        id={inputId}
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
          setError("");
        }}
        disabled={saving}
        maxLength={5000}
        rows={4}
        dir="auto"
        placeholder={
          ar ? "أضف ملاحظة لهذا الطلب…" : "Add a note to this order…"
        }
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className="block w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm text-fg placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      />
      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !changed}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
        >
          {saving
            ? ar
              ? "جاري الحفظ…"
              : "Saving…"
            : ar
              ? "حفظ الملاحظات"
              : "Save notes"}
        </button>
        {changed && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setNotes(savedNotes);
              setError("");
            }}
            className="rounded-lg px-3 py-2 text-sm underline disabled:opacity-50"
          >
            {ar ? "تراجع" : "Discard changes"}
          </button>
        )}
      </div>
    </section>
  );
}
