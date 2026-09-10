import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  action,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "brand" | "success" | "gold" | "violet";
  action?: ReactNode;
}) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    brand: "bg-red-50 text-brand",
    success: "bg-emerald-50 text-emerald-600",
    gold: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  } as const;

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tones[tone])}>
          <Icon size={18} />
        </div>
        {action}
      </div>
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-dim">
          {label}
        </p>
        <p className="mt-2 font-heading text-3xl font-bold tracking-tight text-fg">
          {value}
        </p>
        {hint ? <p className="mt-2 text-sm text-fg-dim">{hint}</p> : null}
      </div>
    </div>
  );
}
