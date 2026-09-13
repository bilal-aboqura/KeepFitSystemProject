import { describe, expect, it } from "vitest";
import { classifyCommerceBlocker } from "@/lib/commerce/diagnostics";

describe("safe commerce blocker diagnostics", () => {
  it("routes missing units, prices, and invalid rules to their owners", () => {
    expect(classifyCommerceBlocker({ unitExists: false, unitSellable: false, priceAvailable: false }).code).toBe("UNIT_NOT_SELLABLE");
    expect(classifyCommerceBlocker({ unitExists: true, unitSellable: true, priceAvailable: false }).destination).toBe("/admin/pricing/diagnostics");
    expect(classifyCommerceBlocker({ unitExists: true, unitSellable: true, priceAvailable: true, minimum: 0, increment: 1 }).code).toBe("QUANTITY_RULE_INVALID");
  });
  it("identifies the valid 1/1 fallback without exposing pricing sources", () => {
    expect(classifyCommerceBlocker({ unitExists: true, unitSellable: true, priceAvailable: true })).toMatchObject({ code: null, fallback: true, minimum: 1, increment: 1 });
  });
});
