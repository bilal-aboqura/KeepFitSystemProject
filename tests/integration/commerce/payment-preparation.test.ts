import { describe, expect, it, vi } from "vitest";
import { prepareCommittedPayment } from "@/lib/commerce/finalization";

describe("payment preparation", () => {
  it("uses only the committed authoritative total for Kashier", async () => {
    const createCheckoutUrl = vi.fn(() => "https://payments.example.invalid/committed");
    const result = await prepareCommittedPayment({
      orderId: "10000000-0000-4000-8000-000000000005",
      orderNumber: "KF-TEST-260913",
      grandTotalMinor: "12345",
      paymentMethod: "card",
      customerName: "Snapshot Customer",
    }, { createCheckoutUrl });
    expect(result).toBe("https://payments.example.invalid/committed");
    expect(createCheckoutUrl).toHaveBeenCalledWith(expect.objectContaining({
      orderId: "KF-TEST-260913",
      amount: 123.45,
    }));
  });

  it("prepares COD confirmation without calling a payment provider", async () => {
    const createCheckoutUrl = vi.fn();
    const result = await prepareCommittedPayment({
      orderId: "10000000-0000-4000-8000-000000000005",
      orderNumber: "KF-TEST-260913",
      grandTotalMinor: "12345",
      paymentMethod: "cod",
      customerName: "Snapshot Customer",
    }, { createCheckoutUrl });
    expect(result).toBe("/checkout/success?order=KF-TEST-260913");
    expect(createCheckoutUrl).not.toHaveBeenCalled();
  });
});
