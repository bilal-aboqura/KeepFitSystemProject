import type { CommerceChange } from "@/lib/commerce/types";

const labels: Record<CommerceChange["kind"], { en: string; ar: string }> = {
  line_identity_changed: { en: "Selected item or quantity changed", ar: "تغير المنتج أو الكمية المحددة" },
  eligibility_changed: { en: "Purchase eligibility changed", ar: "تغيرت أهلية الشراء" },
  quantity_rule_changed: { en: "Minimum or increment changed", ar: "تغير الحد الأدنى أو مقدار الزيادة" },
  unit_price_changed: { en: "Unit price changed", ar: "تغير سعر الوحدة" },
  adjustment_changed: { en: "Discount changed", ar: "تغير الخصم" },
  shipping_changed: { en: "Shipping changed", ar: "تغير الشحن" },
  payment_changed: { en: "Payment terms changed", ar: "تغيرت شروط الدفع" },
  total_changed: { en: "Final total changed", ar: "تغير الإجمالي النهائي" },
};

export function QuoteChangeAlert({ changes, lang }: { changes: CommerceChange[]; lang: "en" | "ar" }) {
  const ar = lang === "ar";
  return <div role="alert" tabIndex={-1} className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><p className="font-semibold">{ar ? "تغيرت شروط الطلب. راجعها وأكد مرة أخرى." : "Checkout terms changed. Review and confirm again."}</p><ul className="mt-2 list-disc ps-5 text-sm">{changes.map((change, index) => <li key={`${change.kind}:${index}`}>{labels[change.kind][lang]}</li>)}</ul></div>;
}
