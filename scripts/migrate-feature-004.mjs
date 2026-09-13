import pg from "pg";
import { readFile } from "node:fs/promises";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required.");

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const prerequisite = await client.query(`
    select
      to_regclass('public.product_variants') is not null as has_variants,
      to_regclass('public.variant_packaging_units') is not null as has_units,
      to_regclass('public.order_items') is not null as has_order_items
  `);
  const missing = Object.entries(prerequisite.rows[0]).filter(([, present]) => !present).map(([name]) => name);
  if (missing.length) throw new Error(`Feature 003 prerequisite is missing: ${missing.join(", ")}`);

  const coverage = await client.query(`
    with active_variants as (
      select * from public.product_variants where is_active and archived_at is null
    ), unit_counts as (
      select variant_id,
        count(*) filter (where is_active and archived_at is null)::int as active_units,
        count(*) filter (where is_active and archived_at is null and is_sellable and is_default_sale_unit)::int as default_units
      from public.variant_packaging_units group by variant_id
    )
    select
      (select count(*)::int from active_variants) as active_variants,
      (select count(*)::int from active_variants variant left join unit_counts counts on counts.variant_id = variant.id where coalesce(counts.default_units, 0) = 0) as missing_default_units,
      (select count(*)::int from unit_counts where default_units > 1) as duplicate_default_units,
      (select count(*)::int from active_variants where base_price <= 0 or base_price * 100 <> trunc(base_price * 100)) as invalid_legacy_prices,
      (select count(*)::int from public.variant_packaging_units unit where unit.is_active and unit.archived_at is null and (
        unit.quantity_per_parent_num <= 0 or unit.quantity_per_parent_den <= 0 or
        unit.base_quantity_num <= 0 or unit.base_quantity_den <= 0 or
        (unit.parent_unit_id is null and (unit.quantity_per_parent_num <> 1 or unit.quantity_per_parent_den <> 1))
      )) as invalid_conversions
  `);
  const report = coverage.rows[0];
  console.log(JSON.stringify({ phase: "feature-004-preflight", ...report }));
  if (report.active_variants === 0) throw new Error("Feature 003 has no active Variants to migrate.");
  const failures = ["missing_default_units", "duplicate_default_units", "invalid_legacy_prices", "invalid_conversions"]
    .filter((key) => report[key] > 0);
  if (failures.length) {
    throw new Error(`Feature 004 preflight failed: ${failures.map((key) => `${key}=${report[key]}`).join(", ")}`);
  }

  if (process.argv.includes("--preflight")) {
    console.log("Feature 004 prerequisite preflight passed without writes.");
    process.exitCode = 0;
  } else {
    const sql = await readFile(new URL("../supabase/migrations/004_pricing_engine.sql", import.meta.url), "utf8");
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended('keepfit-feature-004-migration', 0))");
    await client.query(sql);
    await client.query(sql);

    const verification = (await client.query(`
      select
        to_regclass('public.price_lists') is not null as has_price_lists,
        to_regclass('public.price_list_items') is not null as has_price_items,
        to_regclass('public.customer_type_price_list_mappings') is not null as has_type_mappings,
        to_regclass('public.customer_unit_price_overrides') is not null as has_overrides,
        to_regprocedure('public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)') is not null as has_resolver,
        not has_function_privilege('anon', 'public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)', 'EXECUTE') as anon_denied,
        not has_function_privilege('authenticated', 'public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)', 'EXECUTE') as customer_denied,
        has_function_privilege('service_role', 'public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)', 'EXECUTE') as service_allowed,
        coalesce((
          select array_to_string(proconfig, ',') like '%search_path=""%'
          from pg_proc where oid = 'public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)'::regprocedure
        ), false) as empty_search_path
    `)).rows[0];
    const invalidVerification = Object.entries(verification).filter(([, valid]) => !valid).map(([name]) => name);
    if (invalidVerification.length) throw new Error(`Feature 004 verification failed: ${invalidVerification.join(", ")}`);

    const resolverCoverage = (await client.query(`
      select count(*)::int as missing_public_prices
      from public.product_variants variant
      join public.variant_packaging_units unit on unit.variant_id = variant.id
      where variant.is_active and variant.archived_at is null
        and unit.is_active and unit.archived_at is null and unit.is_sellable
        and not exists (
          select 1 from jsonb_array_elements(public.pricing_resolve_targets(
            null,
            jsonb_build_array(jsonb_build_object('variantId', variant.id, 'sellableUnitId', unit.id)),
            transaction_timestamp()
          )) resolved
          where resolved->>'availability' = 'priced'
        )
    `)).rows[0];
    if (resolverCoverage.missing_public_prices > 0) {
      throw new Error(`Feature 004 verification failed: missing_public_prices=${resolverCoverage.missing_public_prices}`);
    }

    await client.query("commit");
    console.log(JSON.stringify({ phase: "feature-004-verification", ...verification, ...resolverCoverage }));
    console.log("Feature 004 pricing migration applied and convergent reapplication verified.");
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
