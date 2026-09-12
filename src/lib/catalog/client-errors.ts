const arabicFields: Record<string, string> = {
  slug: "رابط المنتج (slug)",
  name_en: "الاسم الإنجليزي",
  name_ar: "الاسم العربي",
  category_id: "الفئة",
  brand_id: "العلامة التجارية",
  variants: "خيارات البيع",
  sku: "SKU",
  base_price: "السعر",
  stock: "المخزون",
};

export function catalogApiErrorMessage(payload: unknown, lang: "en" | "ar", fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const result = payload as { error?: unknown; issues?: unknown };
  if (Array.isArray(result.issues) && result.issues.length > 0) {
    const issue = result.issues[0] as { path?: unknown; message?: unknown };
    const path = Array.isArray(issue.path) ? issue.path.map(String) : [];
    const field = path.at(-1) ?? "";
    const message = typeof issue.message === "string" ? issue.message : fallback;
    if (lang === "ar") return `${arabicFields[field] ?? (field || "البيانات")}: ${message}`;
    return `${path.join(" → ") || "Input"}: ${message}`;
  }
  return typeof result.error === "string" ? result.error : fallback;
}
