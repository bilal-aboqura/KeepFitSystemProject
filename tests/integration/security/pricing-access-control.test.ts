import { describe, expect, it } from "vitest";
import { withPricingTestDatabase } from "../../helpers/pricing-test-db";

describe("pricing access control", () => {
  it.skipIf(!process.env.DIRECT_URL)("denies protected list, override, audit, and trace reads to customers", async () => withPricingTestDatabase(async (db) => {
    const checks = await db.query(`select
      has_table_privilege('authenticated','public.price_lists','select') list_read,
      has_table_privilege('authenticated','public.price_list_items','select') item_read,
      has_table_privilege('authenticated','public.customer_unit_price_overrides','select') override_read,
      has_table_privilege('authenticated','public.pricing_audit_events','select') audit_read,
      has_function_privilege('authenticated','public.pricing_set_default(uuid,uuid,bigint,text,uuid)','execute') default_mutation`);
    expect(checks.rows[0]).toEqual({ list_read: false, item_read: false, override_read: false, audit_read: false, default_mutation: false });
  }), 30_000);
});
