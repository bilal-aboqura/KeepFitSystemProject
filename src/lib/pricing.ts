import type { CatalogPackagingUnit } from "@/lib/catalog/types";

export interface PricedQuantity {
  price: number;
  quantity: number;
}

export const ONLINE_PAYMENT_DISCOUNT_RATE = 0.05;

export function calcItemsSubtotal<T extends PricedQuantity>(items: T[]): number {
  return Math.round(items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) * 100) / 100;
}

export function calcOnlinePaymentDiscount(
  itemsTotal: number,
  paymentMethod: "card" | "cod",
): number {
  if (paymentMethod !== "card") return 0;
  return Math.round(itemsTotal * ONLINE_PAYMENT_DISCOUNT_RATE * 100) / 100;
}

export function deriveCompatibilityUnitPrice(
  defaultUnitPrice: number,
  selectedUnit: CatalogPackagingUnit,
  defaultUnit: CatalogPackagingUnit,
) {
  const minor = Math.round(defaultUnitPrice * 100);
  const numerator = minor * selectedUnit.base_quantity.numerator * defaultUnit.base_quantity.denominator;
  const denominator = selectedUnit.base_quantity.denominator * defaultUnit.base_quantity.numerator;
  if (!Number.isSafeInteger(numerator) || denominator <= 0) throw new Error("Compatibility price conversion exceeds the supported exact range");
  return Math.round(numerator / denominator) / 100;
}
