import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { withTestDatabase } from "../../helpers/supabase-test-db";

describe("Feature 005 prerequisite contracts", () => {
  it.skipIf(!process.env.DIRECT_URL)("binds distinct sellable units and transaction-callable batched pricing", async () => withTestDatabase(async (db) => {
    await db.query(await readFile("supabase/migrations/003b_catalog_packaging_units.sql", "utf8"));
    await db.query(await readFile("supabase/migrations/004_pricing_engine.sql", "utf8"));

    const contract = (await db.query(`
      select
        to_regclass('public.variant_packaging_units') is not null as has_units,
        exists (
          select 1 from pg_constraint
          where conrelid = 'public.variant_packaging_units'::regclass
            and contype = 'u'
            and pg_get_constraintdef(oid) = 'UNIQUE (id, variant_id)'
        ) as has_unit_variant_identity,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'variant_packaging_units' and column_name = 'is_sellable'
        ) as has_independent_sellability,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'variant_packaging_units' and column_name = 'base_quantity_num'
        ) and exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'variant_packaging_units' and column_name = 'base_quantity_den'
        ) as has_base_equivalent,
        to_regclass('public.price_lists') is not null as has_price_lists,
        to_regclass('public.price_list_items') is not null as has_price_items,
        to_regprocedure('public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)') is not null as has_transaction_resolver
    `)).rows[0];

    expect(contract).toEqual({
      has_units: true,
      has_unit_variant_identity: true,
      has_independent_sellability: true,
      has_base_equivalent: true,
      has_price_lists: true,
      has_price_items: true,
      has_transaction_resolver: true,
    });

    const coverage = (await db.query(`
      select count(*)::int as missing
      from public.product_variants variant
      join public.variant_packaging_units unit on unit.variant_id = variant.id
      where variant.is_active and variant.archived_at is null
        and unit.is_active and unit.archived_at is null and unit.is_sellable
        and not exists (
          select 1
          from jsonb_array_elements(public.pricing_resolve_targets(
            null,
            jsonb_build_array(jsonb_build_object('variantId', variant.id, 'sellableUnitId', unit.id)),
            transaction_timestamp()
          )) result
          where result->>'availability' = 'priced'
        )
    `)).rows[0];
    expect(coverage.missing).toBe(0);

    const batch = (await db.query(`
      select public.pricing_resolve_targets(null, '[]'::jsonb, transaction_timestamp()) as result
    `)).rows[0].result;
    expect(batch).toEqual([]);
  }), 30_000);
});
