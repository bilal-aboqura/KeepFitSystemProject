import { it,expect,vi } from "vitest";
import { newConfirmationGrant,hashConfirmationSecret,confirmationCookieOptions } from "@/lib/customers/grants";
const mock=vi.hoisted(()=>({from:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseServiceClient:()=>({from:mock.from})}));
import { hasGuestConfirmationGrant,getConfirmationOrder } from "@/lib/customers/queries";
function resultQuery(data: unknown, error: unknown = null) {
  const q = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), gt: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
  for (const key of ["select", "eq", "is", "gt"] as const) q[key].mockReturnValue(q);
  return q;
}
it("rejects malformed grant secrets without touching storage", async () => {
  mock.from.mockClear();
  expect(await hasGuestConfirmationGrant("order", "bad")).toBe(false);
  expect(mock.from).not.toHaveBeenCalled();
});
it("retrieves guest details only after a matching grant succeeds", async () => {
  const reference = resultQuery({ id: "guest-order" });
  const grant = resultQuery({ id: "grant" });
  const detail = resultQuery({ order_number: "XE-TEST", customer_name: "Private" });
  mock.from.mockReset().mockReturnValueOnce(reference).mockReturnValueOnce(grant).mockReturnValueOnce(detail);
  expect(await getConfirmationOrder("XE-TEST", undefined, newConfirmationGrant().secret)).toEqual({ order_number: "XE-TEST", customer_name: "Private" });
  expect(reference.select).toHaveBeenCalledWith("id");
  expect(detail.eq).toHaveBeenCalledWith("id", "guest-order");
  expect(detail.is).toHaveBeenCalledWith("customer_id", null);
});
it("does not read guest details when the grant query denies access", async () => {
  mock.from.mockReset().mockReturnValueOnce(resultQuery({ id: "guest-order" })).mockReturnValueOnce(resultQuery(null));
  expect(await getConfirmationOrder("XE-TEST", undefined, newConfirmationGrant().secret)).toBeNull();
  expect(mock.from).toHaveBeenCalledTimes(2);
});
it("uses owned authenticated confirmation without a guest grant", async () => {
  mock.from.mockReset().mockReturnValue(resultQuery({ order_number: "XE-OWN" }));
  expect(await getConfirmationOrder("XE-OWN", "owner")).toEqual({ order_number: "XE-OWN" });
  expect(mock.from).toHaveBeenCalledTimes(1);
});
it("does not treat a grant database failure as authorization", async () => {
  mock.from.mockReset().mockReturnValue(resultQuery(null, new Error("unavailable")));
  await expect(hasGuestConfirmationGrant("order", newConfirmationGrant().secret)).rejects.toThrow("unavailable");
});
it("creates independent 256-bit secrets with only hashes for persistence",()=>{const a=newConfirmationGrant(),b=newConfirmationGrant();expect(a.secret).toHaveLength(43);expect(a.hash).toBe(hashConfirmationSecret(a.secret));expect(a.secret).not.toBe(b.secret);expect(confirmationCookieOptions.httpOnly).toBe(true);expect(confirmationCookieOptions.sameSite).toBe("lax");});
it("never retrieves PII with order number only",async()=>{mock.from.mockClear();expect(await getConfirmationOrder("guess")).toBeNull();expect(mock.from).not.toHaveBeenCalled();});
it("requires matching order, hash, unrevoked state and future expiry",async()=>{const q={select:vi.fn(),eq:vi.fn(),is:vi.fn(),gt:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})};for(const k of ["select","eq","is","gt"] as const)q[k].mockReturnValue(q);mock.from.mockReturnValue(q);const g=newConfirmationGrant();expect(await hasGuestConfirmationGrant("order",g.secret)).toBe(false);expect(q.eq).toHaveBeenCalledWith("order_id","order");expect(q.eq).toHaveBeenCalledWith("secret_hash",g.hash);expect(q.is).toHaveBeenCalledWith("revoked_at",null);expect(q.gt).toHaveBeenCalledWith("expires_at",expect.any(String));});
