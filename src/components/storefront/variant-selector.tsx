"use client";

import type { CatalogVariant } from "@/lib/catalog/types";
import { useLang } from "@/components/language/provider";
import { cn } from "@/lib/utils";

function assignmentKey(assignment: CatalogVariant["attributes"][number]) {
  return assignment.attribute_value_id ?? assignment.text_value ?? String(assignment.number_value ?? assignment.boolean_value ?? "");
}

export function resolveVariantSelection(variants: CatalogVariant[], selection: Record<string, string>) {
  return variants.find((variant) => variant.is_active && variant.attributes.every((assignment) => selection[assignment.attribute_definition_id] === assignmentKey(assignment))) ?? null;
}

export function VariantSelector({ variants, selectedId, onChange }: { variants: CatalogVariant[]; selectedId: string; onChange: (variant: CatalogVariant) => void }) {
  const { lang } = useLang();
  if (variants.length <= 1) return null;
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];
  const definitions = new Map<string, { en: string; ar: string; values: Map<string, { en: string; ar: string }> }>();
  for (const variant of variants) {
    for (const assignment of variant.attributes) {
      const id = assignment.attribute_definition_id;
      const group = definitions.get(id) ?? { en: assignment.definition?.label_en ?? "Option", ar: assignment.definition?.label_ar ?? "خيار", values: new Map() };
      const key = assignmentKey(assignment);
      group.values.set(key, {
        en: assignment.value?.label_en ?? assignment.text_value ?? String(assignment.number_value ?? assignment.boolean_value ?? ""),
        ar: assignment.value?.label_ar ?? assignment.text_value ?? String(assignment.number_value ?? assignment.boolean_value ?? ""),
      });
      definitions.set(id, group);
    }
  }
  const selection = Object.fromEntries(selected.attributes.map((assignment) => [assignment.attribute_definition_id, assignmentKey(assignment)]));

  return (
    <div className="mt-6 space-y-5">
      {[...definitions.entries()].map(([definitionId, group]) => (
        <fieldset key={definitionId}>
          <legend className="mb-2 text-sm font-semibold text-fg">{lang === "ar" ? group.ar : group.en}</legend>
          <div className="flex flex-wrap gap-2">
            {[...group.values.entries()].map(([valueKey, label]) => {
              const next = resolveVariantSelection(variants, { ...selection, [definitionId]: valueKey });
              const active = selection[definitionId] === valueKey;
              return (
                <button key={valueKey} type="button" disabled={!next} onClick={() => next && onChange(next)}
                  className={cn("min-h-11 rounded-xl border px-4 text-sm font-medium transition", active ? "border-brand bg-brand text-white" : "border-border bg-white text-fg hover:border-brand", !next && "cursor-not-allowed opacity-35")}>
                  {lang === "ar" ? label.ar : label.en}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
