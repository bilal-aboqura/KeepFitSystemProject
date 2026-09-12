import { describe, expect, it } from "vitest";
import { calcItemsSubtotal, calcOnlinePaymentDiscount } from "@/lib/pricing/legacy-adjustments";

describe("checkout adjustment regression", () => {
  it("applies card discount only after authoritative line totals", () => {
    const authoritativeLines = [{ price: 100, quantity: 2 }, { price: 50, quantity: 1 }];
    const subtotal = calcItemsSubtotal(authoritativeLines);
    expect(subtotal).toBe(250);
    expect(calcOnlinePaymentDiscount(subtotal, "card")).toBe(12.5);
    expect(calcOnlinePaymentDiscount(subtotal, "cod")).toBe(0);
  });

  it("keeps shipping and coupon adjustments outside unit pricing", () => {
    const subtotal = calcItemsSubtotal([{ price: 199.99, quantity: 2 }]);
    const shipping = 80;
    const coupon = 25;
    expect(Math.round((subtotal + shipping - coupon) * 100) / 100).toBe(454.98);
  });
});
