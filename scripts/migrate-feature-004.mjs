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

  const sql = await readFile(new URL("../supabase/migrations/004_pricing_engine.sql", import.meta.url), "utf8");
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("Feature 004 pricing migration applied after prerequisite validation.");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
