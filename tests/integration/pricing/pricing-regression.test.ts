import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCartReprice, type CartItem } from "@/lib/cart";

describe("Feature 001-003 and external adapter pricing regression", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserves Variant and Sellable Unit identity while refreshing disposable cart snapshots", () => {
    const item: CartItem = { id: "product", variant_id: "variant", sellable_unit_id: "unit", quantity: 2, price: 999, price_minor: "99900", price_status: "current", slug: "product", name_en: "Product", name_ar: "منتج", image: "" };
    let stored = JSON.stringify([item]);
    vi.stubGlobal("localStorage", { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } });
    vi.stubGlobal("window", { dispatchEvent: () => true });
    vi.stubGlobal("CustomEvent", class { constructor(public type: string) {} });
    expect(applyCartReprice([{ variantId: "variant", sellableUnitId: "unit", availability: "priced", amountMinor: "1250", displayAmount: "12.50" }])).toBe(true);
    expect(JSON.parse(stored)[0]).toMatchObject({ variant_id: "variant", sellable_unit_id: "unit", quantity: 2, price: 12.5, price_minor: "1250", price_status: "changed" });
  });

  it("keeps order creation and all downstream integrations on stored authoritative totals", async () => {
    const sources = await Promise.all([
      "src/lib/data/orders.ts", "src/lib/bosta.ts", "src/lib/mylerz.ts", "src/lib/notifications.ts", "src/lib/meta-conversions.ts", "src/lib/data/analytics.ts",
    ].map((path) => readFile(path, "utf8")));
    const [orders, bosta, mylerz, notifications, meta, analytics] = sources;
    expect(orders).toContain("pricing_create_order");
    expect(orders).toContain("unit_amount_minor");
    expect(orders).not.toContain("input.items.reduce");
    expect(bosta).toContain("Number(order.grand_total)");
    expect(mylerz).toContain("Number(order.grand_total)");
    expect(notifications).toContain("line_total_minor");
    expect(meta).toContain("unit_price_minor");
    expect(analytics).toContain("grand_total");
  });

  it("retains COD/card, shipping, coupon, customer, and catalog seams without client monetary authority", async () => {
    const [route, orders] = await Promise.all([readFile("src/app/api/orders/route.ts", "utf8"), readFile("src/lib/data/orders.ts", "utf8")]);
    expect(route).toContain("getCurrentCustomer");
    expect(route).toContain("variant_id");
    expect(route).toContain("sellable_unit_id");
    expect(orders).toContain("getShippingCostForProducts");
    expect(orders).toContain("resolveDiscount");
    expect(orders).toContain("calcOnlinePaymentDiscount");
  });
});
