import { randomUUID } from "node:crypto";
import type { CommerceChange, CommerceErrorCode, CommercePublicError, CommerceQuoteProjection } from "./types";

const defaultMessages: Record<CommerceErrorCode, string> = {
  INVALID_JSON: "The request body is invalid.",
  QUOTE_NOT_FOUND: "The checkout quote was not found.",
  QUOTE_REVISION_CONFLICT: "The checkout quote has a newer revision.",
  QUOTE_INVALID: "The checkout quote contains items that need attention.",
  QUOTE_EXPIRED: "The checkout quote expired. Refresh it to continue.",
  RECONFIRMATION_REQUIRED: "Commercial terms changed. Review and confirm the updated quote.",
  IDEMPOTENCY_CONFLICT: "This submission identity was already used for different checkout terms.",
  PROFILE_INCOMPLETE: "Complete your profile before placing the order.",
  VARIANT_UNAVAILABLE: "The selected variant is unavailable.",
  UNIT_NOT_SELLABLE: "The selected unit is unavailable for purchase.",
  QUANTITY_BELOW_MINIMUM: "The quantity is below the current minimum.",
  INVALID_QUANTITY_INCREMENT: "The quantity does not match the current increment.",
  PRICE_UNAVAILABLE: "A current price is unavailable.",
  COUPON_INVALID: "The coupon is invalid or unavailable.",
  DELIVERY_INVALID: "The delivery information is invalid.",
  LEGACY_CART_SELECTION_REQUIRED: "Choose a current variant and unit for this saved cart item.",
  LEGACY_CART_ITEM_UNAVAILABLE: "This saved cart item is no longer available.",
  QUANTITY_RULE_INVALID: "The quantity rule is invalid.",
  QUANTITY_RULE_CONFLICT: "The quantity rule changed while it was being saved.",
  ADMIN_UNAUTHORIZED: "Administrator access is required.",
  CHECKOUT_UNAVAILABLE: "Checkout is temporarily unavailable. Try again.",
};

export class CommerceError extends Error {
  readonly code: CommerceErrorCode;
  readonly status: number;
  readonly correlationId: string;
  readonly changes?: CommerceChange[];
  readonly quote?: CommerceQuoteProjection;

  constructor(
    code: CommerceErrorCode,
    options: { status?: number; correlationId?: string; message?: string; changes?: CommerceChange[]; quote?: CommerceQuoteProjection } = {},
  ) {
    super(options.message ?? defaultMessages[code]);
    this.name = "CommerceError";
    this.code = code;
    this.status = options.status ?? statusForCommerceCode(code);
    this.correlationId = options.correlationId ?? randomUUID();
    this.changes = options.changes;
    this.quote = options.quote;
  }
}

export function statusForCommerceCode(code: CommerceErrorCode) {
  if (code === "INVALID_JSON") return 400;
  if (code === "QUOTE_NOT_FOUND") return 404;
  if (["QUOTE_REVISION_CONFLICT", "QUOTE_EXPIRED", "RECONFIRMATION_REQUIRED", "IDEMPOTENCY_CONFLICT", "QUANTITY_RULE_CONFLICT"].includes(code)) return 409;
  if (code === "CHECKOUT_UNAVAILABLE") return 503;
  if (code === "ADMIN_UNAUTHORIZED") return 403;
  return 422;
}

export function toCommercePublicError(error: unknown, fallbackCorrelationId?: string): CommercePublicError {
  if (error instanceof CommerceError) {
    return { code: error.code, message: error.message, correlationId: error.correlationId, ...(error.changes ? { changes: error.changes } : {}) };
  }
  return {
    code: "CHECKOUT_UNAVAILABLE",
    message: defaultMessages.CHECKOUT_UNAVAILABLE,
    correlationId: fallbackCorrelationId ?? randomUUID(),
  };
}
