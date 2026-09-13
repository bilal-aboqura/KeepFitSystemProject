import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  finalizeConfirmedQuote: vi.fn(),
  getOrderByNumber: vi.fn(),
  notify: vi.fn(),
  meta: vi.fn(),
  effects: [] as Promise<unknown>[],
}));

vi.mock("@/lib/commerce/finalization", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/commerce/finalization")>(),
  finalizeConfirmedQuote: mocks.finalizeConfirmedQuote,
}));
vi.mock("@/lib/data/orders", () => ({ getOrderByNumber: mocks.getOrderByNumber }));
vi.mock("@/lib/notifications", () => ({ sendNewOrderNotifications: mocks.notify }));
vi.mock("@/lib/meta-conversions", () => ({ sendPurchaseOrderToMeta: mocks.meta }));
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(),
  after: (effect: () => Promise<unknown>) => { mocks.effects.push(effect()); },
}));

import { prepareCommittedPayment } from "@/lib/commerce/finalization";
import { POST as createOrder } from "@/app/api/orders/route";

describe("provider replay isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.effects.length = 0;
  });

  it("regenerates a provider URL from the same committed Order and authoritative amount", async () => {
    const provider = vi.fn(() => "https://payments.example.invalid/same-order");
    const order = { orderId: "order", orderNumber: "KF-SAME-260913", grandTotalMinor: "45678", paymentMethod: "card" as const, customerName: "Snapshot" };
    expect(await prepareCommittedPayment(order, { createCheckoutUrl: provider })).toBe(await prepareCommittedPayment(order, { createCheckoutUrl: provider }));
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[0][0]).toMatchObject({ orderId: order.orderNumber, amount: 456.78 });
  });

  it("emits post-commit notifications and purchase analytics only for the created result", async () => {
    const created = { result: "created", replayed: false, orderId: "order", orderNumber: "KF-SAME-260913", redirect: "/checkout/success", confirmationGrant: undefined };
    mocks.finalizeConfirmedQuote.mockResolvedValueOnce(created).mockResolvedValueOnce({ ...created, replayed: true });
    mocks.getOrderByNumber.mockResolvedValue({ id: "order", order_number: "KF-SAME-260913" });
    const body = { quoteId: "10000000-0000-4000-8000-000000000005", quoteRevision: 1, submissionId: "20000000-0000-4000-8000-000000000005" };
    const request = () => new Request("http://localhost/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    expect((await createOrder(request())).status).toBe(200);
    await Promise.all(mocks.effects);
    expect((await createOrder(request())).status).toBe(200);
    await Promise.all(mocks.effects);

    expect(mocks.getOrderByNumber).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.meta).toHaveBeenCalledTimes(1);
  });
});
