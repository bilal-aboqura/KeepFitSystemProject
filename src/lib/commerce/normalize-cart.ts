import "server-only";
import { resolvePurchasableSellableUnits } from "@/lib/catalog/variants";
import { resolvePrices } from "@/lib/pricing/resolver";
import type { CustomerPricingContext, ResolvedPrice } from "@/lib/pricing/types";
import type { CatalogSellableUnitTarget } from "@/lib/catalog/types";
import { calculateLineTotalMinor } from "@/lib/pricing/money";
import { createCommerceCorrelationId } from "./audit";
import { CommerceError, toCommercePublicError } from "./errors";
import { resolveQuantityRules } from "./quantity-rules";
import type { CommerceContext, CommerceLineIntent, CommerceLineSnapshot, CommercePublicError, QuantityRuleResolution } from "./types";

export interface NormalizeCartDependencies {
  catalog: (targets: { variantId: string; sellableUnitId: string }[]) => Promise<Map<string, CatalogSellableUnitTarget>>;
  prices: (context: CustomerPricingContext, targets: { variantId: string; sellableUnitId: string }[]) => Promise<ResolvedPrice[]>;
  rules: (context: CommerceContext, lines: CommerceLineIntent[]) => Promise<Map<string, QuantityRuleResolution>>;
}

const defaultDependencies: NormalizeCartDependencies = {
  catalog: resolvePurchasableSellableUnits,
  prices: async (customerContext, targets) => resolvePrices({ customerContext, targets }),
  rules: resolveQuantityRules,
};

export async function normalizeCart(
  requestedLines: CommerceLineIntent[],
  context: CommerceContext,
  dependencies: NormalizeCartDependencies = defaultDependencies,
) {
  const correlationId = createCommerceCorrelationId();
  const merged = new Map<string, CommerceLineIntent>();
  for (const line of requestedLines) {
    const key = `${line.variantId}:${line.sellableUnitId}`;
    const quantity = (merged.get(key)?.quantity ?? 0) + line.quantity;
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new CommerceError("INVALID_QUANTITY_INCREMENT", { correlationId });
    merged.set(key, { ...line, quantity });
  }
  const lines = [...merged.values()];
  const targets = lines.map(({ variantId, sellableUnitId }) => ({ variantId, sellableUnitId }));
  const pricingContext: CustomerPricingContext = {
    customerId: context.customerId,
    customerTypeId: context.customerTypeId,
    customerTypeCode: context.contextKind === "customer_type" ? context.customerTypeCode : null,
    directPriceListId: context.directPriceListId,
  };
  const [catalog, prices, rules] = await Promise.all([
    dependencies.catalog(targets),
    dependencies.prices(pricingContext, targets),
    dependencies.rules(context, lines),
  ]);
  const priceByKey = new Map(prices.map((price) => [`${price.variantId}:${price.sellableUnitId}`, price]));
  const normalized: CommerceLineSnapshot[] = [];
  const errors: CommercePublicError[] = [];

  for (const line of lines) {
    const key = `${line.variantId}:${line.sellableUnitId}`;
    const unit = catalog.get(key);
    const rule = rules.get(key);
    const price = priceByKey.get(key);
    const target = { variantId: line.variantId, sellableUnitId: line.sellableUnitId };
    if (!unit?.is_active || !unit.is_sellable || unit.stock <= 0) {
      errors.push({ ...toCommercePublicError(new CommerceError("UNIT_NOT_SELLABLE", { correlationId })), line: target });
      continue;
    }
    if (!rule) {
      errors.push({ ...toCommercePublicError(new CommerceError("QUANTITY_RULE_INVALID", { correlationId })), line: target });
      continue;
    }
    if (!price || price.availability !== "priced") {
      errors.push({ ...toCommercePublicError(new CommerceError("PRICE_UNAVAILABLE", { correlationId })), line: target });
      continue;
    }
    const referenceId = price.overrideId ?? price.priceListItemId;
    if (!referenceId) {
      errors.push({ ...toCommercePublicError(new CommerceError("PRICE_UNAVAILABLE", { correlationId })), line: target });
      continue;
    }
    const lineAmountMinor = calculateLineTotalMinor(price.amountMinor, line.quantity);
    if (!rule.eligible) {
      const code = line.quantity < rule.minimum ? "QUANTITY_BELOW_MINIMUM" : "INVALID_QUANTITY_INCREMENT";
      errors.push({ ...toCommercePublicError(new CommerceError(code, { correlationId })), line: target });
    }
    normalized.push({
      ...line,
      productId: unit.product_id,
      productNameEn: unit.product_name_en,
      productNameAr: unit.product_name_ar,
      variantLabelEn: unit.variant_label_en,
      variantLabelAr: unit.variant_label_ar,
      sku: unit.sku,
      unitCode: unit.unit_code,
      unitLabelEn: unit.unit_label_en,
      unitLabelAr: unit.unit_label_ar,
      baseQuantityNumerator: String(unit.base_quantity.numerator),
      baseQuantityDenominator: String(unit.base_quantity.denominator),
      unitAmountMinor: price.amountMinor.toString(),
      lineAmountMinor: lineAmountMinor.toString(),
      currency: "EGP",
      quantityRule: rule,
      price: {
        source: price.source,
        resolutionKind: price.resolutionKind,
        referenceId,
        derivedFromUnitId: price.derivedFromUnitId,
      },
    });
  }
  return { lines: normalized, errors, correlationId };
}
