const labels = {
  pending: { en: "Pending", ar: "قيد الانتظار" }, paid: { en: "Paid", ar: "مدفوع" }, failed: { en: "Failed", ar: "فشل" }, refunded: { en: "Refunded", ar: "مسترد" },
  processing: { en: "Processing", ar: "قيد التجهيز" }, shipped: { en: "Shipped", ar: "تم الشحن" }, delivered: { en: "Delivered", ar: "تم التسليم" }, cancelled: { en: "Cancelled", ar: "ملغي" }, returned: { en: "Returned", ar: "مرتجع" }, cod: { en: "Cash on delivery", ar: "الدفع عند الاستلام" }, card: { en: "Card", ar: "بطاقة" },
} as const;

export function adminStatusLabel(value: string, lang: "en" | "ar") { return labels[value as keyof typeof labels]?.[lang] ?? value; }

export function StatusBadge({ value, lang }: { value: string; lang: "en" | "ar" }) {
  const success = value === "paid" || value === "delivered";
  const danger = value === "failed" || value === "cancelled" || value === "returned";
  return <span className={`pill ${success ? "pill-success" : danger ? "pill-danger" : value === "shipped" ? "pill-info" : "pill-warning"}`}>{adminStatusLabel(value, lang)}</span>;
}
