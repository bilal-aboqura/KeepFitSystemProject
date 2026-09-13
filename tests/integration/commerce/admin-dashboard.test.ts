import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OperationalAttention } from "@/components/admin/operational-attention";

describe("Admin operational attention", () => {
  it("shows live counts with filtered destinations in both languages", () => {
    const english = renderToStaticMarkup(createElement(OperationalAttention, { pendingApprovals: 2, pendingOrders: 7, blockers: 3, lang: "en" }));
    const arabic = renderToStaticMarkup(createElement(OperationalAttention, { pendingApprovals: 2, pendingOrders: 7, blockers: 3, lang: "ar" }));
    expect(english).toContain("Pending commercial approvals");
    expect(english).toContain("/admin/orders?fulfillment=pending");
    expect(english).toContain("/admin/commerce/quantity-rules?blockers=1");
    expect(arabic).toContain("طلبات تنتظر التنفيذ");
    for (const count of ["2", "7", "3"]) expect(english).toContain(`>${count}<`);
  });

  it("counts every pending approval and pending-fulfillment Order from live queries", async () => {
    const source = await readFile("src/lib/data/admin.ts", "utf8");
    expect(source).toContain('.from("customer_type_requests")');
    expect(source).toContain('.eq("status", "pending")');
    expect(source).toContain('.from("orders").select("id", { count: "exact", head: true }).eq("fulfillment_status", "pending")');
  });
});
