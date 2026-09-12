import { randomUUID } from "node:crypto";

export function catalogIds() {
  return {
    categoryId: randomUUID(),
    brandId: randomUUID(),
    productId: randomUUID(),
    variantId: randomUUID(),
    weightDefinitionId: randomUUID(),
    flavorDefinitionId: randomUUID(),
  };
}

export function defaultVariant(overrides: Record<string, unknown> = {}) {
  return {
    sku: `TEST-${randomUUID().slice(0, 8).toUpperCase()}`,
    barcode: null,
    base_price: 250,
    compare_at_price: null,
    stock: 10,
    is_active: true,
    attributes: [],
    ...overrides,
  };
}
