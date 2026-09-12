"use client";

interface AuditEvent { id: string; action: string; actor_id: string | null; entity_type: string; correlation_id: string; reason: string | null; occurred_at: string }

export function PricingAuditHistory({ events, lang }: { events: AuditEvent[]; lang: "en" | "ar" }) {
  const ar = lang === "ar";
  return <section className="rounded-2xl border border-border bg-white"><div className="border-b border-border p-5"><h2 className="font-semibold">{ar ? "سجل تغييرات التسعير" : "Pricing audit history"}</h2></div><div className="divide-y divide-border">{events.map((event) => <article key={event.id} className="grid gap-2 p-4 text-sm md:grid-cols-[1fr_1fr_auto]"><div><p className="font-semibold text-fg">{event.action}</p><p className="text-xs text-fg-dim">{event.entity_type}</p></div><div><p className="font-mono text-xs text-fg-dim">{event.correlation_id}</p><p className="text-xs text-fg-dim">{event.reason ?? "—"}</p></div><time className="text-xs text-fg-dim">{new Date(event.occurred_at).toLocaleString(ar ? "ar-EG" : "en-GB")}</time></article>)}{!events.length ? <p className="p-8 text-center text-sm text-fg-dim">{ar ? "لا توجد أحداث بعد" : "No pricing events yet"}</p> : null}</div></section>;
}
