import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ current: vi.fn(), oauth: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/customers/session", () => ({ getCurrentCustomer: mock.current }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ auth: { signInWithOAuth: mock.oauth } }),
  getSupabaseServiceClient: () => ({ rpc: mock.rpc, from: mock.from }),
}));
import { POST as google } from "@/app/api/customer/auth/google/route";
import { GET as addresses, POST as createAddress } from "@/app/api/customer/addresses/route";
import { GET as orders } from "@/app/api/customer/orders/route";
import { GET as order } from "@/app/api/customer/orders/[orderNumber]/route";
import { resolveCustomerForUser } from "@/lib/customers/identity";
import type { User } from "@supabase/supabase-js";
const owner = "00000000-0000-4000-8000-000000000001";
function query(data: unknown = []) {
  const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), maybeSingle: vi.fn() };
  q.select.mockReturnValue(q); q.eq.mockReturnValue(q);
  q.order.mockReturnValueOnce(q).mockResolvedValue({ data, error: null });
  q.range.mockResolvedValue({ data, error: null });
  q.maybeSingle.mockResolvedValue({ data, error: null });
  mock.from.mockReturnValue(q);
  return q;
}
beforeEach(() => { vi.clearAllMocks(); mock.current.mockResolvedValue({ id: owner }); });
it("initiates Google only with a safe callback return", async () => {
  mock.oauth.mockResolvedValue({ data: { url: "https://accounts.google.com/test" }, error: null });
  const response = await google(new NextRequest("http://localhost/api/customer/auth/google?next=https://evil.example"));
  expect(response.status).toBe(200);
  const args = mock.oauth.mock.calls[0][0];
  expect(args.provider).toBe("google");
  expect(new URL(args.options.redirectTo).pathname).toBe("/auth/callback");
  expect(new URL(args.options.redirectTo).searchParams.get("next")).toBe("/account");
});
it("hides OAuth provider errors", async () => {
  mock.oauth.mockRejectedValue(new Error("private provider detail"));
  const response = await google(new NextRequest("http://localhost/api/customer/auth/google"));
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("private provider");
});
it("lists only session-owned addresses", async () => {
  const q = query(); expect((await addresses()).status).toBe(200);
  expect(q.eq).toHaveBeenCalledWith("customer_id", owner);
});
it("creates a validated owned address", async () => {
  mock.rpc.mockResolvedValue({ data: { id: "new", is_default: true }, error: null });
  const response = await createAddress(new Request("http://localhost", { method: "POST", body: JSON.stringify({ full_name: "Test Name", phone: "+201012345678", governorate: "Cairo", city: "Nasr", address: "15 Test Street" }) }));
  expect(response.status).toBe(201);
  expect(mock.rpc).toHaveBeenCalledWith("customer_address_command", expect.objectContaining({ p_customer_id: owner, p_action: "create", p_data: expect.objectContaining({ phone: "01012345678" }) }));
});
it("handles malformed JSON without exposing errors", async () => {
  expect((await createAddress(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("paginates only session-owned orders", async () => {
  const q = query(); expect((await orders(new Request("http://localhost?page=2"))).status).toBe(200);
  expect(q.eq).toHaveBeenCalledWith("customer_id", owner); expect(q.range).toHaveBeenCalledWith(20, 39);
});
it("returns generic not found for an unowned order", async () => {
  const q = query(null);
  const response = await order(new Request("http://localhost"), { params: Promise.resolve({ orderNumber: "someone-else" }) });
  expect(response.status).toBe(404); expect(q.eq).toHaveBeenCalledWith("customer_id", owner);
});
it("denies all list handlers without authentication", async () => {
  mock.current.mockResolvedValue(null);
  expect((await addresses()).status).toBe(401);
  expect((await orders(new Request("http://localhost"))).status).toBe(401);
  expect(mock.from).not.toHaveBeenCalled();
});
it("resolves using only verified Auth ID, never phone/email", async () => {
  mock.rpc.mockResolvedValue({ data: { id: owner }, error: null });
  expect(await resolveCustomerForUser({ id: "auth-id", email: "shared@example.invalid" } as User)).toEqual({ id: owner });
  expect(mock.rpc).toHaveBeenCalledWith("customer_resolve", { p_user_id: "auth-id" });
});
it("fails closed when identity resolution fails", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: "private" } });
  await expect(resolveCustomerForUser({ id: "auth-id" } as User)).rejects.toThrow("Could not resolve customer");
});
