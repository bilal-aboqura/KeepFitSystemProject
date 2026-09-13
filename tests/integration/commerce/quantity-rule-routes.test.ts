import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdminUser: vi.fn(), list: vi.fn(), set: vi.fn(), archive: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminUser: mocks.requireAdminUser }));
vi.mock("@/lib/commerce/quantity-rules", () => ({ listQuantityRules: mocks.list, setQuantityRule: mocks.set, archiveQuantityRule: mocks.archive }));
import { GET, PUT } from "@/app/api/admin/commerce/quantity-rules/route";
import { DELETE } from "@/app/api/admin/commerce/quantity-rules/[ruleId]/route";

describe("quantity rule admin routes", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireAdminUser.mockResolvedValue({ user: { id: "admin" }, denied: null }); });
  it("enforces bounded queries and delegates authorized mutations", async () => {
    mocks.list.mockResolvedValue({ rules: [], nextCursor: null });
    expect((await GET(new Request("http://localhost/api/admin/commerce/quantity-rules?limit=101"))).status).toBe(422);
    mocks.set.mockResolvedValue({ id: "rule", correlationId: "correlation" });
    const body = { context: { kind: "public" }, variantId: "10000000-0000-4000-8000-000000000005", sellableUnitId: "20000000-0000-4000-8000-000000000005", minimumQuantity: 2, quantityIncrement: 2, reason: "Wholesale cartons" };
    expect((await PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }))).status).toBe(200);
    mocks.archive.mockResolvedValue({ id: "rule", correlationId: "correlation" });
    expect((await DELETE(new Request("http://localhost", { method: "DELETE", body: JSON.stringify({ reason: "Retired" }) }), { params: Promise.resolve({ ruleId: "10000000-0000-4000-8000-000000000005" }) })).status).toBe(200);
  });
});
