import type { PricingSource, PricingResolutionKind } from "@/lib/pricing/types";

export type CommerceScopeKind = "customer" | "guest";
export type CommerceContextKind = "public" | "customer_type";
export type CommercePaymentMethod = "cod" | "card";
export type CheckoutQuoteState = "draft" | "confirmed" | "consumed" | "expired";

export interface CommerceLineIntent {
  variantId: string;
  sellableUnitId: string;
  quantity: number;
}

export interface CommerceDeliveryAddress {
  fullName: string;
  phone: string;
  altPhone: string;
  governorate: string;
  city: string;
  address: string;
}

export type CommerceDeliveryIntent =
  | { savedAddressId: string; address?: never }
  | { address: CommerceDeliveryAddress; savedAddressId?: never };

export interface QuantityRuleResolution {
  ruleId: string | null;
  contextKind: CommerceContextKind;
  customerTypeId: string | null;
  minimum: number;
  increment: number;
  eligible: boolean;
}

export interface CommerceContext {
  scopeKind: CommerceScopeKind;
  customerId: string | null;
  authUserId: string | null;
  guestContextHash: string | null;
  contextKind: CommerceContextKind;
  customerTypeId: string | null;
  directPriceListId: string | null;
  customerTypeCode: string;
  customerTypeNameEn: string;
  customerTypeNameAr: string;
  profileComplete: boolean;
}

export interface CommercePriceSnapshot {
  source: PricingSource;
  resolutionKind: PricingResolutionKind;
  referenceId: string;
  derivedFromUnitId: string | null;
}

export interface CommerceLineSnapshot extends CommerceLineIntent {
  productId: string;
  productNameEn: string;
  productNameAr: string;
  variantLabelEn: string;
  variantLabelAr: string;
  sku: string;
  unitCode: string | null;
  unitLabelEn: string;
  unitLabelAr: string;
  baseQuantityNumerator: string;
  baseQuantityDenominator: string;
  unitAmountMinor: string;
  lineAmountMinor: string;
  currency: "EGP";
  quantityRule: QuantityRuleResolution;
  price: CommercePriceSnapshot;
}

export interface CommerceSafeLine extends CommerceLineIntent {
  productName: { en: string; ar: string };
  variantLabel: { en: string; ar: string };
  unitLabel: { en: string; ar: string };
  sku: string;
  unitAmountMinor: string;
  lineAmountMinor: string;
  quantityRule: Pick<QuantityRuleResolution, "minimum" | "increment" | "eligible">;
  availability: "purchasable" | "blocked";
}

export interface CommerceAdjustment {
  kind: "coupon" | "card";
  code: string | null;
  amountMinor: string;
  eligible: boolean;
}

export interface CommerceShippingSnapshot {
  governorate: string;
  city: string;
  policy: string;
  amountMinor: string;
}

export interface CommerceQuoteProjection {
  quoteId?: string;
  revision?: number;
  state?: CheckoutQuoteState;
  expiresAt?: string;
  currency: "EGP";
  context: { kind: CommerceContextKind; label: string };
  lines: CommerceSafeLine[];
  subtotalMinor: string;
  discounts: CommerceAdjustment[];
  shipping?: { amountMinor: string; label: string };
  totalMinor?: string;
  validationState: "valid" | "invalid";
  errors: CommercePublicError[];
}

export interface CommercePublicError {
  code: CommerceErrorCode;
  message: string;
  correlationId: string;
  line?: Pick<CommerceLineIntent, "variantId" | "sellableUnitId">;
  field?: string;
  changes?: CommerceChange[];
}

export type FinalizationResult =
  | { kind: "created" | "replayed"; orderId: string; orderNumber: string; paymentMethod: CommercePaymentMethod }
  | { kind: "reconfirmation_required"; quote: CommerceQuoteProjection; changes: CommerceChange[] }
  | { kind: "conflict"; code: "IDEMPOTENCY_CONFLICT" };

export interface CommerceChange {
  kind:
    | "line_identity_changed"
    | "eligibility_changed"
    | "quantity_rule_changed"
    | "unit_price_changed"
    | "adjustment_changed"
    | "shipping_changed"
    | "payment_changed"
    | "total_changed";
  line?: Pick<CommerceLineIntent, "variantId" | "sellableUnitId">;
}

export type CommerceErrorCode =
  | "INVALID_JSON"
  | "QUOTE_NOT_FOUND"
  | "QUOTE_REVISION_CONFLICT"
  | "QUOTE_INVALID"
  | "QUOTE_EXPIRED"
  | "RECONFIRMATION_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "PROFILE_INCOMPLETE"
  | "VARIANT_UNAVAILABLE"
  | "UNIT_NOT_SELLABLE"
  | "QUANTITY_BELOW_MINIMUM"
  | "INVALID_QUANTITY_INCREMENT"
  | "PRICE_UNAVAILABLE"
  | "COUPON_INVALID"
  | "DELIVERY_INVALID"
  | "LEGACY_CART_SELECTION_REQUIRED"
  | "LEGACY_CART_ITEM_UNAVAILABLE"
  | "QUANTITY_RULE_INVALID"
  | "QUANTITY_RULE_CONFLICT"
  | "ADMIN_UNAUTHORIZED"
  | "CHECKOUT_UNAVAILABLE";
