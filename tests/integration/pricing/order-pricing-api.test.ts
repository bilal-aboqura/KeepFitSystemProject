import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommerceError } from "@/lib/commerce/errors";
const mocks = vi.hoisted(() => ({ finalize: vi.fn() }));
vi.mock("@/lib/commerce/finalization", () => ({ finalizeConfirmedQuote: mocks.finalize }));
vi.mock("@/lib/data/orders", () => ({ getOrderByNumber: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ sendNewOrderNotifications: vi.fn() }));
vi.mock("@/lib/meta-conversions", () => ({ sendPurchaseOrderToMeta: vi.fn() }));
import { POST } from "@/app/api/orders/route";

describe("authoritative order pricing API", () => {
  const body = { quoteId: "10000000-0000-4000-8000-000000000001", quoteRevision: 1, submissionId: "20000000-0000-4000-8000-000000000001" };
  beforeEach(() => { vi.clearAllMocks(); mocks.finalize.mockResolvedValue({ result: "created", replayed: true, orderId: "order", orderNumber: "KF-1", redirect: "/checkout/success?order=KF-1" }); });
  it("accepts only a confirmed quote identity and submission key", async () => { const response = await POST(new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify(body) })); expect(response.status).toBe(200); expect(mocks.finalize).toHaveBeenCalledWith(body); });
  it("rejects legacy Product, price, name, image, subtotal, and total authority", async () => { const response = await POST(new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify({ ...body, grand_total: 1 }) })); expect(response.status).toBe(422); expect(mocks.finalize).not.toHaveBeenCalled(); });
  it.each([["RECONFIRMATION_REQUIRED", 409], ["PRICE_UNAVAILABLE", 422]] as const)("maps %s without creating a redirect", async (code, status) => { mocks.finalize.mockRejectedValue(new CommerceError(code)); const response = await POST(new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify(body) })); expect(response.status).toBe(status); expect(await response.json()).toMatchObject({ error: { code } }); });
});
