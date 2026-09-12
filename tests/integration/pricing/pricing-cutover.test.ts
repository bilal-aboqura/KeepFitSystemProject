import { describe, expect, it } from "vitest";
import { withPricingTestDatabase } from "../../helpers/pricing-test-db";

describe("Feature 004 cutover", () => {
  it.skipIf(!process.env.DIRECT_URL)("migrates every positive legacy default-unit price without changing its value", async () => withPricingTestDatabase(async (db) => {
    const parity = await db.query(`
      select variant.id,
        round(variant.base_price * 100)::bigint::text as legacy_minor,
        item.amount_minor::text as migrated_minor
      from public.product_variants variant
      join public.variant_packaging_units unit on unit.variant_id=variant.id
        and unit.is_active and unit.archived_at is null and unit.is_sellable and unit.is_default_sale_unit
      join public.pricing_configuration configuration on configuration.singleton
      left join public.price_list_items item on item.price_list_id=configuration.default_price_list_id
        and item.variant_id=variant.id and item.sellable_unit_id=unit.id
        and item.is_active and item.archived_at is null
      where variant.is_active and variant.archived_at is null and variant.base_price > 0
    `);
    expect(parity.rows.length).toBeGreaterThan(0);
    expect(parity.rows.every((row) => row.legacy_minor === row.migrated_minor)).toBe(true);
  }));

  it.skipIf(!process.env.DIRECT_URL)("keeps compatibility prices intact during a pre-cutover rollback rehearsal", async () => withPricingTestDatabase(async (db) => {
    const before = (await db.query(`select id,base_price::text from public.product_variants where is_active and archived_at is null order by id`)).rows;
    await db.query("savepoint cutover_rehearsal");
    await db.query("delete from public.price_list_items where price_list_id=(select default_price_list_id from public.pricing_configuration)");
    expect((await db.query("select count(*)::int count from public.price_list_items where price_list_id=(select default_price_list_id from public.pricing_configuration)")).rows[0].count).toBe(0);
    await db.query("rollback to cutover_rehearsal");
    const after = (await db.query(`select id,base_price::text from public.product_variants where is_active and archived_at is null order by id`)).rows;
    expect(after).toEqual(before);
    expect((await db.query("select count(*)::int count from public.price_list_items where price_list_id=(select default_price_list_id from public.pricing_configuration)")).rows[0].count).toBeGreaterThan(0);
  }));
});
