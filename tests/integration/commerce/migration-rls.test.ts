import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { withTestDatabase } from "../../helpers/supabase-test-db";

describe("Feature 005 migration and security", () => {
  it.skipIf(!process.env.DIRECT_URL)("is convergent, preserves legacy orders, and installs private commerce state", async () => withTestDatabase(async (db) => {
    await db.query(await readFile("supabase/migrations/003b_catalog_packaging_units.sql", "utf8"));
    await db.query(await readFile("supabase/migrations/004_pricing_engine.sql", "utf8"));

    const legacyOrderId = randomUUID();
    await db.query(`
      insert into public.orders(
        id,order_number,customer_name,customer_phone,alt_phone,governorate,city,address,
        items_total,shipping_cost,discount,grand_total,payment_method
      ) values($1,$2,'Legacy','01012345678','01112345678','Cairo','Nasr City','15 Legacy Street',100,20,0,120,'cod')
    `, [legacyOrderId, `XE-${randomUUID()}`]);

    const migration = await readFile("supabase/migrations/005_b2b_checkout_admin.sql", "utf8");
    await db.query(migration);
    await db.query(migration);

    const relations = (await db.query(`
      select relname, relrowsecurity
      from pg_class
      where oid in (
        'public.commerce_quantity_rules'::regclass,
        'public.quantity_rule_audit_events'::regclass,
        'public.checkout_quotes'::regclass,
        'public.checkout_submissions'::regclass,
        'public.order_domain_events'::regclass
      )
      order by relname
    `)).rows;
    expect(relations).toEqual([
      { relname: "checkout_quotes", relrowsecurity: true },
      { relname: "checkout_submissions", relrowsecurity: true },
      { relname: "commerce_quantity_rules", relrowsecurity: true },
      { relname: "order_domain_events", relrowsecurity: true },
      { relname: "quantity_rule_audit_events", relrowsecurity: true },
    ]);

    const privileges = (await db.query(`
      select
        has_table_privilege('anon','public.checkout_quotes','SELECT') as anon_quote_read,
        has_table_privilege('authenticated','public.checkout_submissions','INSERT') as customer_submission_write,
        has_table_privilege('service_role','public.checkout_quotes','SELECT,INSERT,UPDATE') as service_quote_access,
        has_table_privilege('service_role','public.commerce_quantity_rules','SELECT,INSERT,UPDATE') as service_rule_access
    `)).rows[0];
    expect(privileges).toEqual({
      anon_quote_read: false,
      customer_submission_write: false,
      service_quote_access: true,
      service_rule_access: true,
    });

    const functions = (await db.query(`
      select p.proname,
        coalesce(array_to_string(p.proconfig, ','), '') as config,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as customer_execute,
        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (
        'commerce_confirm_quote','commerce_finalize_order','commerce_set_quantity_rule','commerce_archive_quantity_rule'
      ) order by p.proname
    `)).rows;
    expect(functions).toHaveLength(4);
    expect(functions.every((fn) => fn.config === "search_path=\"\"" && !fn.anon_execute && !fn.customer_execute && fn.service_execute)).toBe(true);

    const indexes = (await db.query(`
      select indexname from pg_indexes
      where schemaname='public' and indexname in (
        'commerce_quantity_rules_public_active_idx',
        'commerce_quantity_rules_customer_type_active_idx',
        'checkout_submissions_scope_key_idx',
        'orders_fulfillment_created_idx',
        'order_items_sku_order_idx'
      )
    `)).rows.map((row) => row.indexname);
    expect(indexes.sort()).toEqual([
      "checkout_submissions_scope_key_idx",
      "commerce_quantity_rules_customer_type_active_idx",
      "commerce_quantity_rules_public_active_idx",
      "order_items_sku_order_idx",
      "orders_fulfillment_created_idx",
    ].sort());

    const legacy = (await db.query(`
      select commerce_snapshot_version, items_total, grand_total
      from public.orders where id=$1
    `, [legacyOrderId])).rows[0];
    expect(legacy).toEqual({ commerce_snapshot_version: null, items_total: "100.00", grand_total: "120.00" });
  }), 30_000);

  it.skipIf(!process.env.DIRECT_URL)("enforces quantity-rule context, positive values, target ownership, and one-active invariants", async () => withTestDatabase(async (db) => {
    await db.query(await readFile("supabase/migrations/003b_catalog_packaging_units.sql", "utf8"));
    await db.query(await readFile("supabase/migrations/004_pricing_engine.sql", "utf8"));
    await db.query(await readFile("supabase/migrations/005_b2b_checkout_admin.sql", "utf8"));

    const targets = (await db.query(`
      select distinct on (variant.id) variant.id as variant_id, unit.id as unit_id
      from public.product_variants variant
      join public.variant_packaging_units unit on unit.variant_id=variant.id
      where variant.is_active and variant.archived_at is null
        and unit.is_active and unit.archived_at is null and unit.is_sellable
      order by variant.id, unit.is_default_sale_unit desc, unit.id
      limit 2
    `)).rows;
    expect(targets).toHaveLength(2);

    await db.query("savepoint invalid_minimum");
    await expect(db.query(`
      insert into public.commerce_quantity_rules(context_kind,variant_id,sellable_unit_id,minimum_quantity,quantity_increment)
      values('public',$1,$2,0,1)
    `, [targets[0].variant_id, targets[0].unit_id])).rejects.toMatchObject({ code: "23514" });
    await db.query("rollback to invalid_minimum");

    await db.query("savepoint invalid_context");
    await expect(db.query(`
      insert into public.commerce_quantity_rules(context_kind,variant_id,sellable_unit_id,minimum_quantity,quantity_increment)
      values('customer_type',$1,$2,1,1)
    `, [targets[0].variant_id, targets[0].unit_id])).rejects.toMatchObject({ code: "23514" });
    await db.query("rollback to invalid_context");

    await db.query("savepoint invalid_owner");
    await expect(db.query(`
      insert into public.commerce_quantity_rules(context_kind,variant_id,sellable_unit_id,minimum_quantity,quantity_increment)
      values('public',$1,$2,1,1)
    `, [targets[0].variant_id, targets[1].unit_id])).rejects.toMatchObject({ code: "23503" });
    await db.query("rollback to invalid_owner");

    await db.query(`
      insert into public.commerce_quantity_rules(context_kind,variant_id,sellable_unit_id,minimum_quantity,quantity_increment)
      values('public',$1,$2,1,1)
    `, [targets[0].variant_id, targets[0].unit_id]);
    await db.query("savepoint duplicate_active");
    await expect(db.query(`
      insert into public.commerce_quantity_rules(context_kind,variant_id,sellable_unit_id,minimum_quantity,quantity_increment)
      values('public',$1,$2,2,1)
    `, [targets[0].variant_id, targets[0].unit_id])).rejects.toMatchObject({ code: "23505" });
    await db.query("rollback to duplicate_active");
  }), 30_000);
});
