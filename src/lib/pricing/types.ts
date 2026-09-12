export type PricingCurrency = "EGP";
export type PricingAvailability = "priced" | "unavailable";
export type PricingSource =
  | "customer_override"
  | "direct_price_list"
  | "customer_type_price_list"
  | "default_price_list";
export type PricingResolutionKind = "explicit" | "derived";
export type PricingErrorCode =
  | "PRICE_UNAVAILABLE"
  | "PRICE_CHANGED"
  | "PRICE_PERIOD_OVERLAP"
  | "DEFAULT_PRICE_LIST_INVALID"
  | "PRICING_TARGET_INVALID"
  | "ADMIN_UNAUTHORIZED";

export interface PricingTarget {
  variantId: string;
  sellableUnitId: string;
}

export interface PricingRational {
  numerator: bigint;
  denominator: bigint;
}

export interface CustomerPricingContext {
  customerId: string | null;
  customerTypeId: string | null;
  customerTypeCode: string | null;
  directPriceListId: string | null;
}

export interface PricingCatalogUnit {
  id: string;
  variantId: string;
  parentUnitId: string | null;
  code: string | null;
  labelEn: string;
  labelAr: string;
  quantityPerParent: PricingRational;
  baseQuantity: PricingRational;
  isSellable: boolean;
  isDefaultSaleUnit: boolean;
  isActive: boolean;
}

export interface PricingCatalogTarget {
  variantId: string;
  productId: string;
  sku: string;
  variantLabelEn: string;
  variantLabelAr: string;
  productNameEn: string;
  productNameAr: string;
  image: string | null;
  isActive: boolean;
  stock: number;
  selectedUnit: PricingCatalogUnit;
  units: PricingCatalogUnit[];
}

export interface PricingCandidate {
  id: string;
  source: PricingSource;
  priceListId: string | null;
  variantId: string;
  sellableUnitId: string;
  amountMinor: bigint;
  currency: PricingCurrency;
  validFrom: string | null;
  validUntil: string | null;
}

export interface PricedResolution extends PricingTarget {
  availability: "priced";
  amountMinor: bigint;
  currency: PricingCurrency;
  source: PricingSource;
  resolutionKind: PricingResolutionKind;
  priceListId: string | null;
  priceListItemId: string | null;
  overrideId: string | null;
  derivedFromUnitId: string | null;
  conversionPath: string[];
  effectiveAt: string;
}

export interface UnavailablePriceResolution extends PricingTarget {
  availability: "unavailable";
  reason: "target_unavailable" | "no_price" | "invalid_conversion" | "configuration_unavailable";
  effectiveAt: string;
}

export type ResolvedPrice = PricedResolution | UnavailablePriceResolution;

export interface PublicPricedProjection extends PricingTarget {
  availability: "priced";
  amountMinor: string;
  currency: PricingCurrency;
  displayAmount: string;
  isDerived: boolean;
}

export interface PublicUnavailableProjection extends PricingTarget {
  availability: "unavailable";
  code: "PRICE_UNAVAILABLE";
}

export type PublicPriceProjection = PublicPricedProjection | PublicUnavailableProjection;

export interface RepriceCommandItem {
  variant_id: string;
  sellable_unit_id: string;
  quantity: number;
}

export interface PricingDiagnosticStep {
  source: PricingSource;
  result: "explicit" | "derived" | "missing" | "inactive" | "invalid_conversion";
  priceListId?: string | null;
  candidateId?: string | null;
  unitId?: string | null;
}

export interface PricingDiagnosticResult {
  customerContext: CustomerPricingContext;
  target: PricingTarget;
  effectiveAt: string;
  steps: PricingDiagnosticStep[];
  result: ResolvedPrice;
}

export const PRICING_BOUNDARY = {
  accepts: ["customerContext", "variantId", "sellableUnitId", "quantity"] as const,
  excludes: ["minimumOrderQuantity", "inventory", "reservation", "eligibility"] as const,
};

export interface Feature005PricingInput extends PricingTarget {
  customerContext: CustomerPricingContext;
  quantity: number;
}

export type Feature005PricingResult = ResolvedPrice;
