import "server-only";
import { getCustomerPricingContext, GUEST_PRICING_CONTEXT } from "./context";
import { resolvePrices } from "./resolver";
import type { PricingDiagnosticResult, PricingDiagnosticStep, PricingSource } from "./types";

const sources: PricingSource[] = ["customer_override", "direct_price_list", "customer_type_price_list", "default_price_list"];

export async function diagnosePrice(input: { customerId?: string | null; variantId: string; sellableUnitId: string; at?: string }): Promise<PricingDiagnosticResult> {
  const customerContext = input.customerId ? await getCustomerPricingContext(input.customerId) : GUEST_PRICING_CONTEXT;
  const result = (await resolvePrices({ customerContext, targets: [{ variantId: input.variantId, sellableUnitId: input.sellableUnitId }], at: input.at }))[0];
  const selectedIndex = result.availability === "priced" ? sources.indexOf(result.source) : -1;
  const steps: PricingDiagnosticStep[] = sources.map((source, index) => ({
    source,
    result: result.availability === "priced" && source === result.source
      ? result.resolutionKind
      : result.availability === "unavailable" && result.reason === "invalid_conversion"
        ? "invalid_conversion"
        : selectedIndex >= 0 && index > selectedIndex ? "inactive" : "missing",
    priceListId: result.availability === "priced" && source === result.source ? result.priceListId : undefined,
    candidateId: result.availability === "priced" && source === result.source ? result.overrideId ?? result.priceListItemId : undefined,
    unitId: result.availability === "priced" && source === result.source ? result.derivedFromUnitId ?? result.sellableUnitId : undefined,
  }));
  return { customerContext, target: { variantId: input.variantId, sellableUnitId: input.sellableUnitId }, effectiveAt: result.effectiveAt, steps, result };
}
