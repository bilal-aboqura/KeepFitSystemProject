import "server-only";
import { resolveDiscount, getShippingCostForProducts } from "@/lib/data/orders";
import { getCheckoutSettings } from "@/lib/data/catalog";
import { calcOnlinePaymentDiscount } from "@/lib/pricing/legacy-adjustments";
import { minorToCompatibilityNumber, parseEgpToMinor } from "@/lib/pricing/money";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveCommerceContext, resolveOwnedDeliveryAddress } from "./context";
import { CommerceError } from "./errors";
import { normalizeCart } from "./normalize-cart";
import { commercialFingerprint, diffCommercialDocuments } from "./fingerprint";
import type { CheckoutQuoteInput } from "./validation";
import type { CommerceAdjustment, CommerceContext, CommerceDeliveryAddress, CommerceLineSnapshot, CommerceQuoteProjection } from "./types";

interface CheckoutQuoteRecord {
  scope_kind: "customer" | "guest";
  customer_id: string | null;
  guest_context_hash: string | null;
  commercial_document: Record<string, unknown>;
  safe_projection: CommerceQuoteProjection;
  commercial_fingerprint: string;
  expires_at: string;
}

export interface CheckoutQuoteDependencies {
  context?: CommerceContext;
  normalize?: typeof normalizeCart;
  ownedAddress?: (customerId: string, addressId: string) => Promise<CommerceDeliveryAddress>;
  discount?: (subtotalMinor: bigint, input: CheckoutQuoteInput) => Promise<CommerceAdjustment[]>;
  shipping?: (address: CommerceDeliveryAddress, lines: CommerceLineSnapshot[], subtotalMinor: bigint) => Promise<{ amountMinor: string; policy: string }>;
  persist?: (record: CheckoutQuoteRecord) => Promise<{ id: string }>;
}

function safeLines(lines: CommerceLineSnapshot[]) {
  return lines.map((line) => ({
    variantId: line.variantId,
    sellableUnitId: line.sellableUnitId,
    quantity: line.quantity,
    productName: { en: line.productNameEn, ar: line.productNameAr },
    variantLabel: { en: line.variantLabelEn, ar: line.variantLabelAr },
    unitLabel: { en: line.unitLabelEn, ar: line.unitLabelAr },
    sku: line.sku,
    unitAmountMinor: line.unitAmountMinor,
    lineAmountMinor: line.lineAmountMinor,
    quantityRule: {
      minimum: line.quantityRule.minimum,
      increment: line.quantityRule.increment,
      eligible: line.quantityRule.eligible,
    },
    availability: "purchasable" as const,
  }));
}

async function defaultDiscounts(subtotalMinor: bigint, input: CheckoutQuoteInput) {
  const subtotal = minorToCompatibilityNumber(subtotalMinor);
  const coupon = await resolveDiscount(input.discountCode, subtotal);
  const cardAmount = calcOnlinePaymentDiscount(subtotal, input.paymentMethod);
  const adjustments: CommerceAdjustment[] = [];
  if (coupon) adjustments.push({ kind: "coupon", code: coupon.code, amountMinor: parseEgpToMinor(String(coupon.amount)).toString(), eligible: true });
  if (cardAmount > 0) adjustments.push({ kind: "card", code: null, amountMinor: parseEgpToMinor(String(cardAmount)).toString(), eligible: true });
  return adjustments;
}

async function defaultShipping(address: CommerceDeliveryAddress, lines: CommerceLineSnapshot[], subtotalMinor: bigint) {
  const settings = await getCheckoutSettings();
  const subtotal = minorToCompatibilityNumber(subtotalMinor);
  if (subtotal >= settings.freeShippingThreshold) return { amountMinor: "0", policy: "free_shipping" };
  const shipping = await getShippingCostForProducts(address.governorate, address.city, lines.map((line) => line.productId));
  return { amountMinor: parseEgpToMinor(String(shipping.cost)).toString(), policy: shipping.matched };
}

async function defaultPersist(record: CheckoutQuoteRecord) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  const { data, error } = await db.from("checkout_quotes").insert(record).select("id").single();
  if (error || !data) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  return data;
}

export async function buildCartQuote(input: { lines: CheckoutQuoteInput["lines"]; discountCode?: string }) {
  const context = await resolveCommerceContext();
  const normalized = await normalizeCart(input.lines, context);
  const subtotalMinor = normalized.lines.reduce((sum, line) => sum + BigInt(line.lineAmountMinor), BigInt(0));
  return {
    kind: "cart_quote" as const,
    currency: "EGP" as const,
    context: { kind: context.contextKind, label: context.customerTypeNameEn },
    lines: safeLines(normalized.lines),
    subtotalMinor: subtotalMinor.toString(),
    discount: { code: input.discountCode ?? null, amountMinor: "0", state: input.discountCode ? "pending" : "none" },
    validationState: normalized.errors.length ? "invalid" as const : "valid" as const,
    errors: normalized.errors,
  };
}

export async function createCheckoutQuote(input: CheckoutQuoteInput, dependencies: CheckoutQuoteDependencies = {}) {
  const context = dependencies.context ?? await resolveCommerceContext({ issueGuest: true });
  if (!context.profileComplete) throw new CommerceError("PROFILE_INCOMPLETE");
  if (context.scopeKind === "guest" && !context.guestContextHash) throw new CommerceError("CHECKOUT_UNAVAILABLE");

  let address: CommerceDeliveryAddress;
  if ("savedAddressId" in input.delivery) {
    if (!context.customerId) throw new CommerceError("DELIVERY_INVALID");
    address = await (dependencies.ownedAddress ?? resolveOwnedDeliveryAddress)(context.customerId, input.delivery.savedAddressId);
  } else {
    address = input.delivery.address;
  }

  const normalized = await (dependencies.normalize ?? normalizeCart)(input.lines, context);
  const subtotalMinor = normalized.lines.reduce((sum, line) => sum + BigInt(line.lineAmountMinor), BigInt(0));
  const adjustments = await (dependencies.discount ?? defaultDiscounts)(subtotalMinor, input);
  const discountMinor = adjustments.reduce((sum, adjustment) => sum + BigInt(adjustment.amountMinor), BigInt(0));
  const shipping = await (dependencies.shipping ?? defaultShipping)(address, normalized.lines, subtotalMinor);
  const shippingMinor = BigInt(shipping.amountMinor);
  const totalMinor = subtotalMinor + shippingMinor > discountMinor ? subtotalMinor + shippingMinor - discountMinor : BigInt(0);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const safeProjection: CommerceQuoteProjection = {
    revision: 1,
    state: "draft",
    expiresAt,
    currency: "EGP",
    context: { kind: context.contextKind, label: context.customerTypeNameEn },
    lines: safeLines(normalized.lines),
    subtotalMinor: subtotalMinor.toString(),
    discounts: adjustments,
    shipping: { amountMinor: shipping.amountMinor, label: `${address.governorate} / ${address.city}` },
    totalMinor: totalMinor.toString(),
    validationState: normalized.errors.length ? "invalid" : "valid",
    errors: normalized.errors,
  };
  const commercialDocument = {
    version: 1,
    currency: "EGP",
    context,
    lines: normalized.lines,
    adjustments,
    shipping: { ...shipping, governorate: address.governorate, city: address.city },
    delivery: address,
    paymentMethod: input.paymentMethod,
    discountCode: input.discountCode ?? null,
    notes: input.notes ?? null,
    subtotalMinor: subtotalMinor.toString(),
    discountMinor: discountMinor.toString(),
    shippingMinor: shipping.amountMinor,
    totalMinor: totalMinor.toString(),
  };
  const fingerprint = commercialFingerprint(commercialDocument);
  const record: CheckoutQuoteRecord = {
    scope_kind: context.scopeKind,
    customer_id: context.customerId,
    guest_context_hash: context.guestContextHash,
    commercial_document: commercialDocument,
    safe_projection: safeProjection,
    commercial_fingerprint: fingerprint,
    expires_at: expiresAt,
  };
  const saved = await (dependencies.persist ?? defaultPersist)(record);
  return { ...safeProjection, quoteId: saved.id };
}

export async function revalidateConfirmedQuote(quoteId: string, revision: number, context: CommerceContext) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  let scope = db.from("checkout_quotes").select("*").eq("id", quoteId).eq("scope_kind", context.scopeKind);
  scope = context.scopeKind === "customer"
    ? scope.eq("customer_id", context.customerId!).is("guest_context_hash", null)
    : scope.is("customer_id", null).eq("guest_context_hash", context.guestContextHash!);
  const { data: current, error } = await scope.maybeSingle();
  if (error) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  if (!current) throw new CommerceError("QUOTE_NOT_FOUND");
  if (current.revision !== revision) throw new CommerceError("QUOTE_REVISION_CONFLICT", { quote: current.safe_projection as CommerceQuoteProjection });
  if (new Date(current.expires_at).getTime() <= Date.now()) {
    await db.from("checkout_quotes").update({ state: "expired" }).eq("id", quoteId);
    throw new CommerceError("QUOTE_EXPIRED");
  }
  const priorDocument = current.commercial_document as Record<string, unknown>;
  let refreshedRecord: CheckoutQuoteRecord | undefined;
  const lines = Array.isArray(priorDocument.lines) ? priorDocument.lines as Array<Record<string, unknown>> : [];
  const refreshedInput: CheckoutQuoteInput = {
    lines: lines.map((line) => ({ variantId: String(line.variantId), sellableUnitId: String(line.sellableUnitId), quantity: Number(line.quantity) })),
    delivery: { address: priorDocument.delivery as CheckoutQuoteInput["delivery"] extends { address: infer T } ? T : never },
    contact: null,
    paymentMethod: priorDocument.paymentMethod === "card" ? "card" : "cod",
    discountCode: typeof priorDocument.discountCode === "string" ? priorDocument.discountCode : null,
    notes: typeof priorDocument.notes === "string" ? priorDocument.notes : null,
  };
  await createCheckoutQuote(refreshedInput, {
    context,
    persist: async (record) => {
      refreshedRecord = record;
      return { id: quoteId };
    },
  });
  if (!refreshedRecord) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  if (refreshedRecord.commercial_fingerprint === current.commercial_fingerprint) return;
  const nextRevision = revision + 1;
  const projection = { ...refreshedRecord.safe_projection, quoteId, revision: nextRevision, state: "draft" as const };
  const { error: updateError } = await db.from("checkout_quotes").update({
    revision: nextRevision,
    state: "draft",
    commercial_document: refreshedRecord.commercial_document,
    safe_projection: projection,
    commercial_fingerprint: refreshedRecord.commercial_fingerprint,
    confirmed_revision: null,
    confirmed_fingerprint: null,
    confirmed_at: null,
    expires_at: refreshedRecord.expires_at,
  }).eq("id", quoteId).eq("revision", revision);
  if (updateError) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  throw new CommerceError("RECONFIRMATION_REQUIRED", { changes: diffCommercialDocuments(priorDocument, refreshedRecord.commercial_document), quote: projection });
}
