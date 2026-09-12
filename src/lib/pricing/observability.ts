import "server-only";
import { createHash, randomUUID } from "node:crypto";

export type PricingOperationalCode = "PRICE_UNAVAILABLE" | "INVALID_CONVERSION" | "PRICE_PERIOD_OVERLAP" | "CHECKOUT_REPRICE_FAILED";

function redact(value: string | null | undefined) {
  return value ? createHash("sha256").update(value).digest("hex").slice(0, 12) : undefined;
}

export function logPricingOperationalEvent(code: PricingOperationalCode, context: { customerId?: string | null; variantId?: string | null; sellableUnitId?: string | null; correlationId?: string; detail?: string }) {
  console.warn(JSON.stringify({ domain: "pricing", code, correlationId: context.correlationId ?? randomUUID(), customer: redact(context.customerId), variant: redact(context.variantId), unit: redact(context.sellableUnitId), detail: context.detail?.slice(0, 160), occurredAt: new Date().toISOString() }));
}
