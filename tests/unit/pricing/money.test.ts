import { describe, expect, it } from "vitest";
import {
  calculateLineTotalMinor,
  deriveUnitAmountMinor,
  formatMinorAmount,
  parseEgpToMinor,
  parseMinorAmount,
  roundHalfUpRational,
  serializeMoney,
} from "@/lib/pricing/money";

describe("pricing money", () => {
  it("parses bounded piastre and EGP values without floating point", () => {
    expect(parseMinorAmount("100")).toBe(BigInt(100));
    expect(parseEgpToMinor("123.45")).toBe(BigInt(12345));
    expect(() => parseEgpToMinor("1.001")).toThrow();
    expect(() => parseMinorAmount("-1")).toThrow();
  });

  it("rounds exact rational values half-up once", () => {
    expect(roundHalfUpRational(BigInt(100), BigInt(3))).toBe(BigInt(33));
    expect(roundHalfUpRational(BigInt(100), BigInt(6))).toBe(BigInt(17));
    expect(roundHalfUpRational(BigInt(1), BigInt(2))).toBe(BigInt(1));
  });

  it("derives a unit price from exact base equivalents", () => {
    expect(deriveUnitAmountMinor(BigInt(100), { numerator: BigInt(4), denominator: BigInt(1) }, { numerator: BigInt(1), denominator: BigInt(1) })).toBe(BigInt(25));
    expect(deriveUnitAmountMinor(BigInt(100), { numerator: BigInt(6), denominator: BigInt(1) }, { numerator: BigInt(1), denominator: BigInt(1) })).toBe(BigInt(17));
  });

  it("multiplies the rounded unit amount for line totals", () => {
    expect(calculateLineTotalMinor(BigInt(33), 3)).toBe(BigInt(99));
    expect(() => calculateLineTotalMinor(BigInt(33), 0)).toThrow();
  });

  it("serializes money as strings", () => {
    expect(formatMinorAmount(BigInt(10005))).toBe("100.05");
    expect(serializeMoney(BigInt(10005))).toEqual({ amountMinor: "10005", currency: "EGP", displayAmount: "100.05" });
  });
});
