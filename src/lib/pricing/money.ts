import type { PricingCurrency, PricingRational } from "./types";

export const PRICING_CURRENCY: PricingCurrency = "EGP";
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
export const MAX_AMOUNT_MINOR = BigInt("999999999999");

export function parseMinorAmount(value: unknown, options: { allowZero?: boolean } = {}): bigint {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error("Money must be an integer piastre value");
  }
  const text = String(value);
  if (!/^[0-9]+$/.test(text)) throw new Error("Money must be an integer piastre value");
  const amount = BigInt(text);
  if ((!options.allowZero && amount === ZERO) || amount < ZERO || amount > MAX_AMOUNT_MINOR) {
    throw new Error("Money is outside the supported range");
  }
  return amount;
}

export function parseEgpToMinor(value: string): bigint {
  const normalized = value.trim();
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/.exec(normalized);
  if (!match) throw new Error("EGP values require at most two decimal places");
  const fractional = (match[2] ?? "").padEnd(2, "0");
  return parseMinorAmount(BigInt(match[1]) * HUNDRED + BigInt(fractional || "0"), { allowZero: true });
}

export function roundHalfUpRational(numerator: bigint, denominator: bigint): bigint {
  if (numerator < ZERO || denominator <= ZERO) throw new Error("Rounding requires a non-negative numerator and positive denominator");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return quotient + (remainder * TWO >= denominator ? ONE : ZERO);
}

function assertRational(value: PricingRational) {
  if (value.numerator <= ZERO || value.denominator <= ZERO) throw new Error("Pricing conversion must be positive");
}

export function deriveUnitAmountMinor(
  sourceAmountMinor: bigint,
  sourceBaseQuantity: PricingRational,
  targetBaseQuantity: PricingRational,
) {
  parseMinorAmount(sourceAmountMinor, { allowZero: true });
  assertRational(sourceBaseQuantity);
  assertRational(targetBaseQuantity);
  return roundHalfUpRational(
    sourceAmountMinor * targetBaseQuantity.numerator * sourceBaseQuantity.denominator,
    targetBaseQuantity.denominator * sourceBaseQuantity.numerator,
  );
}

export function calculateLineTotalMinor(unitAmountMinor: bigint, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive safe integer");
  const total = unitAmountMinor * BigInt(quantity);
  if (total > MAX_AMOUNT_MINOR) throw new Error("Line total exceeds the supported range");
  return total;
}

export function formatMinorAmount(amountMinor: bigint) {
  parseMinorAmount(amountMinor, { allowZero: true });
  const whole = amountMinor / HUNDRED;
  const fractional = (amountMinor % HUNDRED).toString().padStart(2, "0");
  return `${whole}.${fractional}`;
}

export function serializeMoney(amountMinor: bigint) {
  return {
    amountMinor: amountMinor.toString(),
    currency: PRICING_CURRENCY,
    displayAmount: formatMinorAmount(amountMinor),
  };
}

export function minorToCompatibilityNumber(amountMinor: bigint) {
  return Number(formatMinorAmount(amountMinor));
}
