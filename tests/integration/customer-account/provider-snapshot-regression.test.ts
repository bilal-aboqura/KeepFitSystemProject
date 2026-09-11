import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BostaOrder } from "@/lib/bosta";
const redirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error(url); }));
vi.mock("next/navigation", () => ({ redirect }));
const snapshot: BostaOrder = {
  id: "order", order_number: "XE-TEST", customer_name: "Snapshot Customer",
  customer_phone: "01012345678", alt_phone: "01112345678", governorate: "Cairo",
  city: "Nasr", address: "15 Snapshot Street", notes: null, items_total: 100,
  grand_total: 220, payment_method: "cod", payment_status: "pending",
  fulfillment_status: "pending", bosta: null, mylerz: null,
  order_items: [{ name_en: "Snapshot Product", name_ar: null, quantity: 2 }],
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.invalid");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it.each(["cod", "card"] as const)("Bosta preserves %s snapshot input without customer identity fields", async payment_method => {
  vi.stubEnv("BOSTA_API_KEY", "test-only"); vi.stubEnv("BOSTA_WEBHOOK_SECRET", "test-only");
  const responses = [
    { list: [{ _id: "cairo", name: "Cairo", code: "EG-01" }] },
    [{ districtId: "nasr", districtName: "Nasr", zoneId: "zone", zoneName: "Nasr" }],
    { _id: "delivery", trackingNumber: "tracking", state: 10 },
    { _id: "delivery", trackingNumber: "tracking", state: 10 },
  ];
  fetchMock.mockImplementation(async () => Response.json({ success: true, data: responses.shift() }));
  const { createBostaDelivery } = await import("@/lib/bosta");
  await createBostaDelivery({ ...snapshot, payment_method, payment_status: "paid" });
  const body = JSON.parse(fetchMock.mock.calls[2][1].body);
  expect(body.receiver.fullName).toBe(snapshot.customer_name);
  expect(body.dropOffAddress.firstLine).toBe(snapshot.address);
  expect(body.businessReference).toBe(snapshot.order_number);
  expect(body.cod).toBe(payment_method === "cod" ? 220 : 0);
  expect(body).not.toHaveProperty("customer_id");
});
it.each(["cod", "card"] as const)("Mylerz preserves %s snapshot input without customer identity fields", async payment_method => {
  vi.stubEnv("MYLERZ_USERNAME", "test-only"); vi.stubEnv("MYLERZ_PASSWORD", "test-only");
  const responses = [
    { access_token: "test-token", expires_in: 300 },
    { Value: [{ Code: "CAI", EnName: "Cairo", Zones: [{ Code: "NAS", EnName: "Nasr" }] }] },
    { Value: { Packages: [{ BarCode: "tracking" }] } },
  ];
  fetchMock.mockImplementation(async () => Response.json(responses.shift()));
  const { createMylerzShipment } = await import("@/lib/mylerz");
  await createMylerzShipment({ ...snapshot, payment_method, payment_status: "paid" });
  const body = JSON.parse(fetchMock.mock.calls[2][1].body)[0];
  expect(body.Customer_Name).toBe(snapshot.customer_name);
  expect(body.Mobile_No).toBe(snapshot.customer_phone);
  expect(body.Street).toBe(snapshot.address); expect(body.Reference).toBe(snapshot.order_number);
  expect(body.COD_Value).toBe(payment_method === "cod" ? 220 : 0);
  expect(body).not.toHaveProperty("customer_id");
});
it("Kashier return routes to protected confirmation without trusting payment status", async () => {
  const { default: returnPage } = await import("@/app/(storefront)/checkout/return/page");
  await expect(returnPage({ searchParams: Promise.resolve({ orderId: "XE-TEST", status: "SUCCESS" }) })).rejects.toThrow("/checkout/success?order=XE-TEST");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("analytics remains anonymous and excludes customer/contact data", async () => {
  vi.stubGlobal("window", { localStorage: { getItem: () => "visitor-id" }, location: { pathname: "/checkout" } });
  fetchMock.mockResolvedValue(new Response());
  const { trackStoreEvent } = await import("@/lib/store-analytics");
  trackStoreEvent("initiate_checkout");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ visitorId: "visitor-id", eventType: "initiate_checkout", path: "/checkout" });
});
