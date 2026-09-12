export function normalizeCatalogSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export function normalizeCatalogSlugInput(input: unknown, fallbackToName = true) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const record = input as Record<string, unknown>;
  if (!("slug" in record) && (!fallbackToName || !("name_en" in record))) return input;
  const requested = normalizeCatalogSlug(typeof record.slug === "string" ? record.slug : "");
  const fallback = normalizeCatalogSlug(typeof record.name_en === "string" ? record.name_en : "");
  return { ...record, slug: requested || (fallbackToName ? fallback : "") };
}
