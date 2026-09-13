import type { CommerceErrorCode } from "./types";

const sensitiveKeys = /address|phone|email|name|secret|token|cookie|hash|sql|stack|priceList|referenceId/i;

export type CommerceDiagnosticValue = string | number | boolean | null;

export interface CommerceDiagnostic {
  code: CommerceErrorCode;
  correlationId: string;
  operation: string;
  metadata: Record<string, CommerceDiagnosticValue>;
}

export function redactCommerceMetadata(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => !sensitiveKeys.test(key) && ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 160) : value as number | boolean]),
  ) as Record<string, CommerceDiagnosticValue>;
}

export function commerceDiagnostic(
  code: CommerceErrorCode,
  correlationId: string,
  operation: string,
  metadata: Record<string, unknown> = {},
): CommerceDiagnostic {
  return { code, correlationId, operation: operation.slice(0, 80), metadata: redactCommerceMetadata(metadata) };
}

export function classifyCommerceBlocker(input: { unitExists: boolean; unitSellable: boolean; priceAvailable: boolean; minimum?: number; increment?: number; storedRule?: boolean }) {
  if (!input.unitExists || !input.unitSellable) return { code: "UNIT_NOT_SELLABLE" as const, fallback: false, destination: "/admin/products" };
  if (!input.priceAvailable) return { code: "PRICE_UNAVAILABLE" as const, fallback: false, destination: "/admin/pricing/diagnostics" };
  const minimum = input.minimum ?? 1;
  const increment = input.increment ?? 1;
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(increment) || minimum <= 0 || increment <= 0) return { code: "QUANTITY_RULE_INVALID" as const, fallback: false, destination: "/admin/commerce/quantity-rules?blockers=1" };
  return { code: null, fallback: !input.storedRule, minimum, increment, destination: "/admin/commerce/quantity-rules" };
}
