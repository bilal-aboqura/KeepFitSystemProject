import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";

export function commerceIds() {
  return {
    customerId: randomUUID(),
    customerTypeId: randomUUID(),
    variantId: randomUUID(),
    sellableUnitId: randomUUID(),
    quoteId: randomUUID(),
    submissionId: randomUUID(),
    orderId: randomUUID(),
    correlationId: randomUUID(),
  };
}

export function commerceLineIntent(overrides: Record<string, unknown> = {}) {
  return {
    variantId: randomUUID(),
    sellableUnitId: randomUUID(),
    quantity: 1,
    ...overrides,
  };
}

export function quantityRuleFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    context_kind: "public",
    customer_type_id: null,
    variant_id: randomUUID(),
    sellable_unit_id: randomUUID(),
    minimum_quantity: 1,
    quantity_increment: 1,
    is_active: true,
    archived_at: null,
    ...overrides,
  };
}

export function checkoutDeliveryFixture(overrides: Record<string, unknown> = {}) {
  return {
    address: {
      fullName: "Commerce Test Customer",
      phone: "01012345678",
      altPhone: "",
      governorate: "Cairo",
      city: "Nasr City",
      address: "15 Test Street",
    },
    ...overrides,
  };
}

export function checkoutQuoteIntent(overrides: Record<string, unknown> = {}) {
  return {
    lines: [commerceLineIntent()],
    delivery: checkoutDeliveryFixture(),
    contact: null,
    paymentMethod: "cod",
    discountCode: null,
    notes: null,
    ...overrides,
  };
}

export async function confirmedQuote(db: pg.Client) {
  const target = (await db.query(`select v.id variant_id,v.sku,v.label_en variant_en,v.label_ar variant_ar,p.id product_id,p.name_en product_en,p.name_ar product_ar,u.id unit_id,u.code,u.label_en unit_en,u.label_ar unit_ar,u.base_quantity_num::text base_num,u.base_quantity_den::text base_den from public.product_variants v join public.products p on p.id=v.product_id join public.variant_packaging_units u on u.variant_id=v.id where v.is_active and v.archived_at is null and p.is_active and p.archived_at is null and u.is_active and u.archived_at is null and u.is_sellable limit 1`)).rows[0];
  const price = (await db.query("select public.pricing_resolve_targets(null,$1::jsonb,transaction_timestamp()) result", [JSON.stringify([{ variantId: target.variant_id, sellableUnitId: target.unit_id }])])).rows[0].result[0];
  const document = { version: 1, currency: "EGP", context: { contextKind: "public", customerTypeId: null, directPriceListId: null, customerTypeCode: "public", customerTypeNameEn: "Public", customerTypeNameAr: "عام" }, lines: [{ variantId: target.variant_id, sellableUnitId: target.unit_id, quantity: 1, productId: target.product_id, productNameEn: target.product_en, productNameAr: target.product_ar, variantLabelEn: target.variant_en, variantLabelAr: target.variant_ar, sku: target.sku, unitCode: target.code, unitLabelEn: target.unit_en, unitLabelAr: target.unit_ar, baseQuantityNumerator: target.base_num, baseQuantityDenominator: target.base_den, unitAmountMinor: price.amountMinor, lineAmountMinor: price.amountMinor, quantityRule: { contextKind: "public", customerTypeId: null, minimum: 1, increment: 1, eligible: true }, price: { source: price.source, resolutionKind: price.resolutionKind, referenceId: price.priceListItemId ?? price.overrideId, derivedFromUnitId: price.derivedFromUnitId } }], adjustments: [], shipping: { amountMinor: "0", policy: "free_shipping", governorate: "Cairo", city: "Nasr City" }, delivery: { fullName: "Idempotent Guest", phone: "01012345678", altPhone: "01112345678", governorate: "Cairo", city: "Nasr City", address: "15 Test Street" }, paymentMethod: "cod", discountCode: null, notes: null, subtotalMinor: price.amountMinor, discountMinor: "0", shippingMinor: "0", totalMinor: price.amountMinor };
  const quoteId = randomUUID();
  const guestHash = createHash("sha256").update(randomUUID()).digest("hex");
  const fingerprint = createHash("sha256").update(JSON.stringify(document)).digest("hex");
  await db.query(`insert into public.checkout_quotes(id,scope_kind,guest_context_hash,state,commercial_document,safe_projection,commercial_fingerprint,confirmed_revision,confirmed_fingerprint,confirmed_at,expires_at) values($1,'guest',$2,'confirmed',$3,$4,$5,1,$5,transaction_timestamp(),transaction_timestamp()+interval '30 minutes')`, [quoteId, guestHash, document, { validationState: "valid" }, fingerprint]);
  return { quoteId, guestHash };
}
