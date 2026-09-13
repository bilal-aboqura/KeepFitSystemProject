import { describe, expect, it } from "vitest";
import { isQuantityEligible } from "@/lib/commerce/quantity-rules";

describe("commerce quantity rules", () => {
  it("applies the exact minimum and increment boundary", () => {
    expect(isQuantityEligible(6, 6, 4)).toBe(true);
    expect(isQuantityEligible(10, 6, 4)).toBe(true);
    expect(isQuantityEligible(7, 6, 4)).toBe(false);
    expect(isQuantityEligible(5, 6, 4)).toBe(false);
  });

  it("rejects fractions, unsafe values, overflow, and invalid stored rules", () => {
    expect(isQuantityEligible(1.5, 1, 1)).toBe(false);
    expect(isQuantityEligible(Number.MAX_SAFE_INTEGER + 1, 1, 1)).toBe(false);
    expect(isQuantityEligible(1, 0, 1)).toBe(false);
    expect(isQuantityEligible(1, 1, 0)).toBe(false);
  });

  it("supports the public and type-independent 1/1 fallback", () => {
    expect(isQuantityEligible(1, 1, 1)).toBe(true);
    expect(isQuantityEligible(25, 1, 1)).toBe(true);
  });
});
