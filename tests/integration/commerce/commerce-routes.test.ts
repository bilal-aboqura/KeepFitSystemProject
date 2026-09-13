import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildCartQuote: vi.fn(),
  createCheckoutQuote: vi.fn(),
  confirmCheckoutQuote: vi.fn(),
  finalizeConfirmedQuote: vi.fn(),
}));

vi.mock("@/lib/commerce/quote", () => ({
  buildCartQuote: mocks.buildCartQuote,
  createCheckoutQuote: mocks.createCheckoutQuote,
}));
vi.mock("@/lib/commerce/confirmation", () => ({ confirmCheckoutQuote: mocks.confirmCheckoutQuote }));
vi.mock("@/lib/commerce/finalization", () => ({ finalizeConfirmedQuote: mocks.finalizeConfirmedQuote }));

import { POST as cartQuote } from "@/app/api/commerce/cart-quote/route";
import { POST as checkoutQuote } from "@/app/api/commerce/checkout-quotes/route";
import { POST as confirmQuote } from "@/app/api/commerce/checkout-quotes/[quoteId]/confirm/route";
import { POST as createOrder } from "@/app/api/orders/route";

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const line = {
  variantId: "10000000-0000-4000-8000-000000000005",
  sellableUnitId: "20000000-0000-4000-8000-000000000005",
  quantity: 1,
};

describe("Commerce Route Handler contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects browser authority fields and accepts canonical cart intent", async () => {
    const rejected = await cartQuote(request("/api/commerce/cart-quote", { lines: [{ ...line, price: 1 }] }));
    expect(rejected.status).toBe(422);
    expect((await rejected.json()).error.code).toBe("INVALID_JSON");
    expect(mocks.buildCartQuote).not.toHaveBeenCalled();

    mocks.buildCartQuote.mockResolvedValue({ kind: "cart_quote", lines: [], errors: [] });
    const accepted = await cartQuote(request("/api/commerce/cart-quote", { lines: [line] }));
    expect(accepted.status).toBe(200);
    expect(mocks.buildCartQuote).toHaveBeenCalledWith({ lines: [line] });
  });

  it("validates checkout quote, confirmation, and final submission DTOs", async () => {
    mocks.createCheckoutQuote.mockResolvedValue({ quoteId: line.variantId, revision: 1, state: "draft" });
    const quoted = await checkoutQuote(request("/api/commerce/checkout-quotes", {
      lines: [line],
      delivery: { address: { fullName: "Test User", phone: "01012345678", altPhone: "01112345678", governorate: "Cairo", city: "Nasr City", address: "15 Test Street" } },
      contact: null,
      paymentMethod: "cod",
    }));
    expect(quoted.status).toBe(201);

    mocks.confirmCheckoutQuote.mockResolvedValue({ quoteId: line.variantId, revision: 1, state: "confirmed" });
    const confirmed = await confirmQuote(
      request(`/api/commerce/checkout-quotes/${line.variantId}/confirm`, { revision: 1 }),
      { params: Promise.resolve({ quoteId: line.variantId }) },
    );
    expect(confirmed.status).toBe(200);

    mocks.finalizeConfirmedQuote.mockResolvedValue({
      kind: "created",
      orderNumber: "KF-TEST-260913",
      redirect: "/checkout/success?order=KF-TEST-260913",
      replayed: false,
    });
    const placed = await createOrder(request("/api/orders", {
      quoteId: line.variantId,
      quoteRevision: 1,
      submissionId: "30000000-0000-4000-8000-000000000005",
    }));
    expect(placed.status).toBe(200);
    expect(mocks.finalizeConfirmedQuote).toHaveBeenCalled();

    const legacy = await createOrder(request("/api/orders", { items: [{ ...line, price: 1 }], grand_total: 1 }));
    expect(legacy.status).toBe(422);
    expect((await legacy.json()).error.code).toBe("INVALID_JSON");
  });
});
