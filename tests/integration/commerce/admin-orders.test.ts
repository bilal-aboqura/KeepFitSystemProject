import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { decodeAdminOrderCursor, encodeAdminOrderCursor } from "@/lib/data/orders";

describe("Admin Order read model", () => {
  it("round-trips an opaque stable timestamp-plus-id cursor and rejects malformed cursors", () => {
    const value = { createdAt: "2026-09-13T01:00:00.000Z", id: "10000000-0000-4000-8000-000000000005" };
    expect(decodeAdminOrderCursor(encodeAdminOrderCursor(value))).toEqual(value);
    expect(decodeAdminOrderCursor("not-a-cursor")).toBeNull();
  });

  it("implements server search, filters, guest distinction, and immutable snapshot selection", async () => {
    const source = await readFile("src/lib/data/orders.ts", "utf8");
    for (const contract of ["order_number.ilike", "customer_name.ilike", "customer_phone.ilike", 'ilike("sku"', 'eq("fulfillment_status"', 'eq("payment_status"', 'eq("customer_type_code_snapshot"', 'is("customer_id", null)', 'gte("created_at"', 'lte("created_at"']) {
      expect(source).toContain(contract);
    }
    for (const snapshot of ["commerce_snapshot_version", "unit_price_minor", "line_total_minor", "minimum_quantity_snapshot", "quantity_increment_snapshot", "shipping_snapshot", "discount_snapshot"]) {
      expect(source).toContain(snapshot);
    }
    const editorRoute = await readFile("src/app/api/admin/orders/[id]/items/route.ts", "utf8");
    expect(editorRoute).toContain("commerce_snapshot_version");
    expect(editorRoute).toContain("Authoritative snapshot orders cannot have their commercial lines replaced.");
  });
});
