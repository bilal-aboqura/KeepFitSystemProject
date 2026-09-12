import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createOrder: vi.fn(), getCurrentCustomer: vi.fn(), createCheckoutUrl: vi.fn() }));
vi.mock("@/lib/data/orders", () => ({ createOrder: mocks.createOrder, getOrderByNumber: vi.fn() }));
vi.mock("@/lib/customers/session", () => ({ getCurrentCustomer: mocks.getCurrentCustomer }));
vi.mock("@/lib/kashier", () => ({ createCheckoutUrl: mocks.createCheckoutUrl }));
vi.mock("@/lib/notifications", () => ({ sendNewOrderNotifications: vi.fn() }));
vi.mock("@/lib/meta-conversions", () => ({ sendPurchaseOrderToMeta: vi.fn() }));

import { POST } from "@/app/api/orders/route";

describe("authoritative order pricing API", () => {
  const variantId = "10000000-0000-4000-8000-000000000001";
  const sellableUnitId = "20000000-0000-4000-8000-000000000001";
  const body = {
    customer_name: "Guest Customer", customer_phone: "01012345678", alt_phone: "01112345678",
    governorate: "Cairo", city: "Nasr City", address: "15 Test Street", payment_method: "card",
    items: [{ variant_id: variantId, sellable_unit_id: sellableUnitId, quantity: 1 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentCustomer.mockResolvedValue(null);
    mocks.createOrder.mockResolvedValue({ id: "order", order_number: "ORDER-1", grand_total: 100, payment_method: "card" });
    mocks.createCheckoutUrl.mockReturnValue("https://example.test/pay");
  });

  it("accepts canonical Variant and Sellable Unit identity only", async () => {
    const response = await POST(new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify(body) }) as never);
    expect(response.status).toBe(200);
    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ items: [{ variant_id: variantId, sellable_unit_id: sellableUnitId, quantity: 1 }] }));
  });

  it("rejects legacy Product, price, name, image, subtotal, and total authority", async () => {
    const forged = { ...body, subtotal: 1, grand_total: 1, items: [{ ...body.items[0], product_id: variantId, price: 1, name_en: "Forged", image: "/forged" }] };
    const response = await POST(new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify(forged) }) as never);
    expect(response.status).toBe(422);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it.each([["PRICE_CHANGED", 409], ["PRICE_UNAVAILABLE", 409]])("maps %s without creating a redirect", async (code, status) => {
    mocks.createOrder.mockRejectedValue(Object.assign(new Error(code), { code, status, safeItems: [] }));
    const response = await POST(new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify(body) }) as never);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
  });
});
