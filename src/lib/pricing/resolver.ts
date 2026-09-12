import "server-only";
import { loadPricingCatalogTargets, pricingTargetKey } from "./catalog-targets";
import { resolvePackagingCandidate, PricingConversionError } from "./packaging";
import {
  getActivePricingSources,
  getTrustedPricingTime,
  loadCustomerOverrideCandidates,
  loadPriceListCandidates,
  type PricingSourceList,
} from "./queries";
import type {
  CustomerPricingContext,
  PricingCandidate,
  PricingCatalogTarget,
  PricingSource,
  PricingTarget,
  ResolvedPrice,
} from "./types";

const SOURCE_PRIORITY: PricingSource[] = ["customer_override", "direct_price_list", "customer_type_price_list", "default_price_list"];

export const PRICING_CACHE_POLICY = {
  scope: "request",
  personalized: true,
  sharedCache: false,
  activationClock: "database",
} as const;

export interface PricingResolverDependencies {
  getTime: (at?: string) => Promise<string>;
  loadCatalogTargets: (targets: PricingTarget[]) => Promise<Map<string, PricingCatalogTarget>>;
  loadSources: (context: CustomerPricingContext) => Promise<PricingSourceList[]>;
  loadListCandidates: (sources: PricingSourceList[], targets: PricingTarget[], at: string) => Promise<PricingCandidate[]>;
  loadOverrideCandidates: (customerId: string | null, targets: PricingTarget[], at: string) => Promise<PricingCandidate[]>;
}

const defaultDependencies: PricingResolverDependencies = {
  getTime: getTrustedPricingTime,
  loadCatalogTargets: loadPricingCatalogTargets,
  loadSources: getActivePricingSources,
  loadListCandidates: loadPriceListCandidates,
  loadOverrideCandidates: loadCustomerOverrideCandidates,
};

export function resolvePricesFromSnapshot(
  targets: PricingTarget[],
  catalogTargets: Map<string, PricingCatalogTarget>,
  candidates: PricingCandidate[],
  effectiveAt: string,
): ResolvedPrice[] {
  return targets.map((target) => {
    const catalogTarget = catalogTargets.get(pricingTargetKey(target));
    if (!catalogTarget?.isActive) {
      return { ...target, availability: "unavailable", reason: "target_unavailable", effectiveAt };
    }
    try {
      for (const source of SOURCE_PRIORITY) {
        const sourceCandidates = candidates.filter((candidate) => candidate.source === source && candidate.variantId === target.variantId);
        const selected = resolvePackagingCandidate(catalogTarget, sourceCandidates);
        if (!selected) continue;
        return {
          ...target,
          availability: "priced",
          amountMinor: selected.amountMinor,
          currency: selected.candidate.currency,
          source,
          resolutionKind: selected.resolutionKind,
          priceListId: selected.candidate.priceListId,
          priceListItemId: source === "customer_override" ? null : selected.candidate.id,
          overrideId: source === "customer_override" ? selected.candidate.id : null,
          derivedFromUnitId: selected.derivedFromUnitId,
          conversionPath: selected.conversionPath,
          effectiveAt,
        };
      }
    } catch (error) {
      if (error instanceof PricingConversionError) {
        return { ...target, availability: "unavailable", reason: "invalid_conversion", effectiveAt };
      }
      throw error;
    }
    return { ...target, availability: "unavailable", reason: "no_price", effectiveAt };
  });
}

export async function resolvePrices(input: {
  customerContext: CustomerPricingContext;
  targets: PricingTarget[];
  at?: string;
  dependencies?: PricingResolverDependencies;
}) {
  const dependencies = input.dependencies ?? defaultDependencies;
  const uniqueTargets = [...new Map(input.targets.map((target) => [pricingTargetKey(target), target])).values()];
  const effectiveAt = await dependencies.getTime(input.at);
  const [catalogTargets, sources] = await Promise.all([
    dependencies.loadCatalogTargets(uniqueTargets),
    dependencies.loadSources(input.customerContext),
  ]);
  const [listCandidates, overrideCandidates] = await Promise.all([
    dependencies.loadListCandidates(sources, uniqueTargets, effectiveAt),
    dependencies.loadOverrideCandidates(input.customerContext.customerId, uniqueTargets, effectiveAt),
  ]);
  return resolvePricesFromSnapshot(uniqueTargets, catalogTargets, [...overrideCandidates, ...listCandidates], effectiveAt);
}

export async function resolvePrice(input: { customerContext: CustomerPricingContext; target: PricingTarget; at?: string }) {
  return (await resolvePrices({ customerContext: input.customerContext, targets: [input.target], at: input.at }))[0];
}
