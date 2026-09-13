import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ finalize: vi.fn(), lookup: vi.fn(), notify: vi.fn(), meta: vi.fn(), after: vi.fn() }));
vi.mock("@/lib/commerce/finalization", () => ({ finalizeConfirmedQuote: mock.finalize }));
vi.mock("@/lib/data/orders", () => ({ getOrderByNumber: mock.lookup }));
vi.mock("@/lib/notifications", () => ({ sendNewOrderNotifications: mock.notify }));
vi.mock("@/lib/meta-conversions", () => ({ sendPurchaseOrderToMeta: mock.meta }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: mock.after }));
import { POST } from "@/app/api/orders/route";

const payload = { quoteId: "10000000-0000-4000-8000-000000000001", quoteRevision: 1, submissionId: "20000000-0000-4000-8000-000000000001" };
const request = (body: object) => new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mock.finalize.mockResolvedValue({ result: "created", replayed: false, orderId: "order-id", orderNumber: "KF-TEST", redirect: "/checkout/success?order=KF-TEST", confirmationGrant: { secret: "s".repeat(43), expiresAt: new Date(Date.now() + 86400000) } }); mock.lookup.mockResolvedValue({ order_number: "KF-TEST" }); });

it("keeps guest confirmation private and runs post-commit effects once", async () => { const response = await POST(request(payload)); expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toContain("HttpOnly"); expect(response.headers.get("set-cookie")).toContain("Path=/checkout"); expect(mock.finalize).toHaveBeenCalledWith(payload); await mock.after.mock.calls[0][0](); expect(mock.notify).toHaveBeenCalledOnce(); expect(mock.meta).toHaveBeenCalledOnce(); });
it("does not replay purchase side effects or replace an existing guest grant", async () => { mock.finalize.mockResolvedValue({ result: "created", replayed: true, orderId: "order-id", orderNumber: "KF-TEST", redirect: "/checkout/success?order=KF-TEST" }); const response = await POST(request(payload)); expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toBeNull(); expect(mock.after).not.toHaveBeenCalled(); });
it("rejects all legacy identity, contact, and money authority", async () => { const response = await POST(request({ customer_id: "fake", grand_total: 1, items: [] })); expect(response.status).toBe(422); expect(mock.finalize).not.toHaveBeenCalled(); });
it("maps finalization failure safely", async () => { mock.finalize.mockRejectedValue(new Error("private")); const response = await POST(request(payload)); expect(response.status).toBe(503); expect((await response.json()).error.code).toBe("CHECKOUT_UNAVAILABLE"); });
