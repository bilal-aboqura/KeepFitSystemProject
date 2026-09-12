import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withPricingTestDatabase } from "../../helpers/pricing-test-db";

describe("pricing migration and RLS invariants", () => {
  it.skipIf(!process.env.DIRECT_URL)("enforces singleton default and non-overlapping periods", async () => withPricingTestDatabase(async (db) => {
    const target = (await db.query(`
      select variant.id as variant_id, unit.id as sellable_unit_id
      from public.product_variants variant
      join public.variant_packaging_units unit on unit.variant_id = variant.id
      where variant.is_active and variant.archived_at is null
        and unit.is_active and unit.archived_at is null and unit.is_sellable
      limit 1
    `)).rows[0];
    expect(target).toBeTruthy();

    const listId = randomUUID();
    await db.query("insert into public.price_lists(id,code,name_en,name_ar) values($1,$2,'Test','اختبار')", [listId, `test-${listId}`]);
    await db.query("insert into public.price_list_items(price_list_id,variant_id,sellable_unit_id,amount_minor,valid_from,valid_until) values($1,$2,$3,100,'2026-01-01','2026-02-01')", [listId, target.variant_id, target.sellable_unit_id]);
    await db.query("savepoint overlap");
    await expect(db.query("insert into public.price_list_items(price_list_id,variant_id,sellable_unit_id,amount_minor,valid_from,valid_until) values($1,$2,$3,120,'2026-01-15','2026-03-01')", [listId, target.variant_id, target.sellable_unit_id])).rejects.toMatchObject({ code: "23P01" });
    await db.query("rollback to overlap");

    const defaultRows = await db.query("select count(*)::int count from public.pricing_configuration");
    expect(defaultRows.rows[0].count).toBe(1);
    await expect(db.query("insert into public.pricing_configuration(singleton,default_price_list_id) select true,id from public.price_lists where id=$1", [listId])).rejects.toBeTruthy();
  }));

  it.skipIf(!process.env.DIRECT_URL)("revokes customer reads and mutations", async () => withPricingTestDatabase(async (db) => {
    const privileges = await db.query(`
      select
        has_table_privilege('authenticated', 'public.price_lists', 'select') as can_select,
        has_table_privilege('authenticated', 'public.price_list_items', 'insert') as can_insert,
        has_table_privilege('anon', 'public.customer_unit_price_overrides', 'select') as anon_can_select
    `);
    expect(privileges.rows[0]).toEqual({ can_select: false, can_insert: false, anon_can_select: false });
  }));
});
