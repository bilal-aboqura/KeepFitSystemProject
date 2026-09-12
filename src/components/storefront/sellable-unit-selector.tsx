"use client";

import type { CatalogPackagingUnit } from "@/lib/catalog/types";
import { useLang } from "@/components/language/provider";

export function SellableUnitSelector({ units, selectedId, onChange, lang }: {
  units: CatalogPackagingUnit[];
  selectedId: string;
  onChange: (unit: CatalogPackagingUnit) => void;
  lang: "en" | "ar";
}) {
  const { t } = useLang();
  const sellable = units.filter((unit) => unit.is_active && unit.is_sellable);
  if (sellable.length <= 1) return null;
  const ar = lang === "ar";

  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg-dim">
        {t.product.packaging.sellableUnit}
      </legend>
      <div className="flex flex-wrap gap-2">
        {sellable.map((unit) => (
          <button
            key={unit.id}
            type="button"
            onClick={() => onChange(unit)}
            aria-pressed={unit.id === selectedId}
            className={unit.id === selectedId
              ? "min-h-11 rounded-xl border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white"
              : "min-h-11 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-fg hover:border-brand"}
          >
            {ar ? unit.label_ar : unit.label_en}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
