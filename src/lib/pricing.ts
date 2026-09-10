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
