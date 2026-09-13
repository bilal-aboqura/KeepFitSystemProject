import { describe, expect, it, vi } from "vitest";
import { createCheckoutQuote } from "@/lib/commerce/quote";
import type { normalizeCart } from "@/lib/commerce/normalize-cart";
import type { CommerceContext, CommerceLineSnapshot } from "@/lib/commerce/types";

const guest: CommerceContext = {
  scopeKind: "guest",
  customerId: null,
  authUserId: null,
  guestContextHash: "a".repeat(64),
  contextKind: "public",
  customerTypeId: null,
  directPriceListId: null,
  customerTypeCode: "public",
  customerTypeNameEn: "Public",
  customerTypeNameAr: "عام",
  profileComplete: true,
};

const normalizedLine: CommerceLineSnapshot = {
  variantId: "10000000-0000-4000-8000-000000000005",
  sellableUnitId: "20000000-0000-4000-8000-000000000005",
  quantity: 2,
  productId: "p",
  productNameEn: "Product",
  productNameAr: "منتج",
  variantLabelEn: "10 ml",
  variantLabelAr: "10 مل",
  sku: "SKU",
  unitCode: "BOX",
  unitLabelEn: "Box",
  unitLabelAr: "علبة",
  baseQuantityNumerator: "1",
  baseQuantityDenominator: "1",
  unitAmountMinor: "10000",
  lineAmountMinor: "20000",
  currency: "EGP",
  quantityRule: { ruleId: null, contextKind: "public", customerTypeId: null, minimum: 1, increment: 1, eligible: true },
  price: { source: "default_price_list", resolutionKind: "explicit", referenceId: "price", derivedFromUnitId: null },
};

describe("authoritative checkout", () => {
  it("blocks an incomplete authenticated profile before quote persistence", async () => {
    const persist = vi.fn();
    await expect(createCheckoutQuote({
      lines: [{ variantId: "10000000-0000-4000-8000-000000000005", sellableUnitId: "20000000-0000-4000-8000-000000000005", quantity: 1 }],
      delivery: { savedAddressId: "30000000-0000-4000-8000-000000000005" },
      contact: null,
      paymentMethod: "cod",
      discountCode: null,
      notes: null,
    }, {
      context: { ...guest, scopeKind: "customer", customerId: "40000000-0000-4000-8000-000000000005", authUserId: "50000000-0000-4000-8000-000000000005", contextKind: "customer_type", customerTypeId: "60000000-0000-4000-8000-000000000005", customerTypeCode: "retail", customerTypeNameEn: "Retail", customerTypeNameAr: "تجزئة", profileComplete: false },
      persist,
    })).rejects.toMatchObject({ code: "PROFILE_INCOMPLETE" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("uses owned delivery and authoritative normalized totals for guest and customer quotes", async () => {
    const persist = vi.fn(async (record) => ({ ...record, id: "70000000-0000-4000-8000-000000000005" }));
    const quote = await createCheckoutQuote({
      lines: [{ variantId: "10000000-0000-4000-8000-000000000005", sellableUnitId: "20000000-0000-4000-8000-000000000005", quantity: 2 }],
      delivery: { address: { fullName: "Guest User", phone: "01012345678", altPhone: "01112345678", governorate: "Cairo", city: "Nasr City", address: "15 Test Street" } },
      contact: null,
      paymentMethod: "cod",
      discountCode: null,
      notes: null,
    }, {
      context: guest,
      normalize: vi.fn(async (): Promise<Awaited<ReturnType<typeof normalizeCart>>> => ({
        lines: [normalizedLine],
        errors: [],
        correlationId: "test-correlation",
      })),
      shipping: vi.fn(async () => ({ amountMinor: "5000", policy: "exact" })),
      discount: vi.fn(async () => []),
      persist,
    });
    expect(quote).toMatchObject({ subtotalMinor: "20000", totalMinor: "25000", state: "draft" });
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ scope_kind: "guest", guest_context_hash: "a".repeat(64) }));
  });
});
