import { deriveUnitAmountMinor } from "./money";
import type { PricingCandidate, PricingCatalogTarget, PricingResolutionKind } from "./types";

export class PricingConversionError extends Error {
  constructor(message = "Pricing conversion graph is invalid") {
    super(message);
    this.name = "PricingConversionError";
  }
}

export interface PackagingCandidateResolution {
  candidate: PricingCandidate;
  amountMinor: bigint;
  resolutionKind: PricingResolutionKind;
  derivedFromUnitId: string | null;
  conversionPath: string[];
}

export function resolvePackagingCandidate(
  catalogTarget: PricingCatalogTarget,
  sourceCandidates: PricingCandidate[],
): PackagingCandidateResolution | null {
  const explicit = sourceCandidates.find((candidate) => candidate.sellableUnitId === catalogTarget.selectedUnit.id);
  if (explicit) {
    return { candidate: explicit, amountMinor: explicit.amountMinor, resolutionKind: "explicit", derivedFromUnitId: null, conversionPath: [] };
  }

  const units = new Map(catalogTarget.units.map((unit) => [unit.id, unit]));
  const visited = new Set<string>();
  const ancestors: typeof catalogTarget.units = [];
  let current = catalogTarget.selectedUnit;
  while (current.parentUnitId) {
    if (visited.has(current.id)) throw new PricingConversionError();
    visited.add(current.id);
    const parent = units.get(current.parentUnitId);
    if (!parent || parent.variantId !== catalogTarget.variantId || !parent.isActive) throw new PricingConversionError();
    if (current.quantityPerParent.numerator <= BigInt(0) || current.quantityPerParent.denominator <= BigInt(0)) throw new PricingConversionError();
    ancestors.push(parent);
    current = parent;
  }
  if (visited.has(current.id)) throw new PricingConversionError();

  const path: string[] = [];
  for (const parent of ancestors) {
    path.push(parent.id);
    const parentPrice = sourceCandidates.find((candidate) => candidate.sellableUnitId === parent.id);
    if (parentPrice) {
      return {
        candidate: parentPrice,
        amountMinor: deriveUnitAmountMinor(parentPrice.amountMinor, parent.baseQuantity, catalogTarget.selectedUnit.baseQuantity),
        resolutionKind: "derived",
        derivedFromUnitId: parent.id,
        conversionPath: [...path],
      };
    }
  }
  return null;
}
