import type {
  CatalogPackagingPricingTarget,
  CatalogPackagingUnit,
  CatalogPackagingUnitInput,
  CatalogRational,
} from "./types";
import { packagingHierarchyInputSchema } from "./validation";

function gcd(left: number, right: number) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

export function normalizeRational(value: CatalogRational): CatalogRational {
  if (!Number.isSafeInteger(value.numerator) || !Number.isSafeInteger(value.denominator) || value.numerator <= 0 || value.denominator <= 0) {
    throw new Error("Packaging conversion values must be positive safe integers");
  }
  const divisor = gcd(value.numerator, value.denominator);
  return { numerator: value.numerator / divisor, denominator: value.denominator / divisor };
}

export function multiplyRational(left: CatalogRational, right: CatalogRational): CatalogRational {
  const a = normalizeRational(left);
  const b = normalizeRational(right);
  const leftCancel = gcd(a.numerator, b.denominator);
  const rightCancel = gcd(b.numerator, a.denominator);
  const numerator = (a.numerator / leftCancel) * (b.numerator / rightCancel);
  const denominator = (a.denominator / rightCancel) * (b.denominator / leftCancel);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new Error("Packaging conversion exceeds the supported exact range");
  }
  return normalizeRational({ numerator, denominator });
}

export function validatePackagingHierarchy(input: unknown): CatalogPackagingUnit[] {
  const parsed = packagingHierarchyInputSchema.parse(input) as CatalogPackagingUnitInput[];
  if (parsed.some((unit) => !unit.is_active)) throw new Error("Packaging replacement accepts active units only");
  const units = parsed.map((unit) => ({ ...unit, quantity_per_parent: normalizeRational(unit.quantity_per_parent) }));
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  if (byId.size !== units.length) throw new Error("Packaging unit identities must be unique");

  const roots = units.filter((unit) => unit.parent_unit_id === null);
  if (roots.length !== 1) throw new Error("Packaging hierarchy requires exactly one root and cannot contain a cycle");
  const bases = units.filter((unit) => unit.is_base_unit);
  if (bases.length !== 1) throw new Error("Packaging hierarchy requires exactly one base unit");
  const defaults = units.filter((unit) => unit.is_default_sale_unit);
  if (defaults.length !== 1 || !defaults[0].is_sellable) throw new Error("Exactly one default sellable unit is required");
  if (!units.some((unit) => unit.is_sellable)) throw new Error("At least one sellable unit is required");

  const children = new Map<string, number>();
  for (const unit of units) {
    if (unit.parent_unit_id === unit.id) throw new Error("A packaging unit cannot contain itself");
    if (unit.parent_unit_id && !byId.has(unit.parent_unit_id)) throw new Error("Packaging hierarchy is disconnected");
    if (unit.parent_unit_id) children.set(unit.parent_unit_id, (children.get(unit.parent_unit_id) ?? 0) + 1);
  }
  if ([...children.values()].some((count) => count > 1)) throw new Error("Packaging hierarchy has an ambiguous conversion path");
  if (roots[0].quantity_per_parent.numerator !== 1 || roots[0].quantity_per_parent.denominator !== 1) {
    throw new Error("The root packaging conversion must be one-to-one");
  }

  const quantities = new Map<string, CatalogRational>([[bases[0].id, { numerator: 1, denominator: 1 }]]);
  const visited = new Set<string>();
  let current = bases[0];
  while (current) {
    if (visited.has(current.id)) throw new Error("Packaging hierarchy contains a cycle");
    visited.add(current.id);
    if (!current.parent_unit_id) break;
    const parent = byId.get(current.parent_unit_id);
    if (!parent) throw new Error("Packaging hierarchy is disconnected");
    quantities.set(parent.id, multiplyRational(quantities.get(current.id)!, current.quantity_per_parent));
    current = parent;
  }
  if (visited.size !== units.length || current.id !== roots[0].id) throw new Error("Packaging hierarchy is disconnected or ambiguous");

  return units.map((unit) => ({ ...unit, base_quantity: quantities.get(unit.id)! }));
}

export function buildPackagingPricingTarget(
  variantId: string,
  sellableUnitId: string,
  hierarchy: CatalogPackagingUnit[],
): CatalogPackagingPricingTarget {
  const byId = new Map(hierarchy.map((unit) => [unit.id, unit]));
  const selected = byId.get(sellableUnitId);
  if (!selected || !selected.is_active || !selected.is_sellable) throw new Error("Sellable unit is unavailable");
  const conversionPath: CatalogPackagingPricingTarget["conversion_path"] = [];
  let current = selected;
  while (current.parent_unit_id) {
    const parent = byId.get(current.parent_unit_id);
    if (!parent) throw new Error("Packaging conversion path is incomplete");
    conversionPath.push({ parent_unit_id: parent.id, child_unit_id: current.id, quantity: current.quantity_per_parent });
    current = parent;
  }
  return {
    variant_id: variantId,
    sellable_unit_id: selected.id,
    code: selected.code,
    label_en: selected.label_en,
    label_ar: selected.label_ar,
    is_sellable: true,
    is_default_sale_unit: selected.is_default_sale_unit,
    default_price_mode: selected.default_price_mode,
    base_quantity: selected.base_quantity,
    conversion_path: conversionPath,
  };
}
