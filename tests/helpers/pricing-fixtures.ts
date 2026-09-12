import { randomUUID } from "node:crypto";

export function pricingIds() {
  return {
    defaultListId: randomUUID(),
    retailListId: randomUUID(),
    wholesaleListId: randomUUID(),
    gymListId: randomUUID(),
    customerId: randomUUID(),
    variantId: randomUUID(),
    rootUnitId: randomUUID(),
    sellableUnitId: randomUUID(),
  };
}

export function priceListFixture(overrides: Record<string, unknown> = {}) {
  const suffix = randomUUID().slice(0, 8);
  return {
    id: randomUUID(),
    code: `feature-004-${suffix}`,
    name_en: `Pricing ${suffix}`,
    name_ar: `تسعير ${suffix}`,
    currency: "EGP",
    is_active: true,
    ...overrides,
  };
}

export function pricePeriodFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    amount_minor: "10000",
    valid_from: null,
    valid_until: null,
    is_active: true,
    ...overrides,
  };
}

export function pricingTargetFixture(overrides: Record<string, unknown> = {}) {
  return {
    variant_id: randomUUID(),
    sellable_unit_id: randomUUID(),
    quantity: 1,
    ...overrides,
  };
}

export function effectiveCustomerTypeFixture(overrides: Record<string, unknown> = {}) {
  return {
    customer_id: randomUUID(),
    customer_type_id: randomUUID(),
    customer_type_code: "retail",
    direct_price_list_id: null,
    ...overrides,
  };
}
