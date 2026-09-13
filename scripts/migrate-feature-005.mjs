import pg from "pg";
import { readFile } from "node:fs/promises";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required.");

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
await client.connect();

async function runPreflight() {
  const objects = (await client.query(`
    select
      to_regclass('public.customers') is not null as has_customers,
      to_regclass('public.customer_types') is not null as has_customer_types,
      to_regclass('public.product_variants') is not null as has_variants,
      to_regclass('public.variant_packaging_units') is not null as has_sellable_units,
      to_regclass('public.price_lists') is not null as has_price_lists,
      to_regclass('public.price_list_items') is not null as has_price_items,
      to_regprocedure('public.catalog_assert_packaging_graph(uuid)') is not null as has_conversion_contract,
      to_regprocedure('public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)') is not null as has_pricing_resolver
  `)).rows[0];
  const missing = Object.entries(objects).filter(([, present]) => !present).map(([name]) => name);
  if (missing.length) throw new Error(`Feature 005 prerequisite objects are missing: ${missing.join(", ")}`);

  const contract = (await client.query(`
    select
      exists (
        select 1 from pg_constraint
        where conrelid='public.variant_packaging_units'::regclass and contype='u'
          and pg_get_constraintdef(oid)='UNIQUE (id, variant_id)'
      ) as unit_variant_ownership,
      exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='variant_packaging_units' and column_name='is_sellable'
      ) as unit_sellability,
      not has_function_privilege('anon','public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)','EXECUTE') as anon_pricing_denied,
      not has_function_privilege('authenticated','public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)','EXECUTE') as customer_pricing_denied,
      has_function_privilege('service_role','public.pricing_resolve_targets(uuid,jsonb,timestamp with time zone)','EXECUTE') as service_pricing_allowed
  `)).rows[0];
  const invalid = Object.entries(contract).filter(([, valid]) => !valid).map(([name]) => name);
  if (invalid.length) throw new Error(`Feature 005 prerequisite contract failed: ${invalid.join(", ")}`);

  const coverage = (await client.query(`
    select count(*)::int as missing_public_prices
    from public.product_variants variant
    join public.variant_packaging_units unit on unit.variant_id=variant.id
    where variant.is_active and variant.archived_at is null
      and unit.is_active and unit.archived_at is null and unit.is_sellable
      and not exists (
        select 1 from jsonb_array_elements(public.pricing_resolve_targets(
          null,
          jsonb_build_array(jsonb_build_object('variantId',variant.id,'sellableUnitId',unit.id)),
          transaction_timestamp()
        )) resolved
        where resolved->>'availability'='priced'
      )
  `)).rows[0];
  if (coverage.missing_public_prices > 0) {
    throw new Error(`Feature 005 prerequisite coverage failed: missing_public_prices=${coverage.missing_public_prices}`);
  }
  return { ...objects, ...contract, ...coverage };
}

try {
  const preflight = await runPreflight();
  console.log(JSON.stringify({ phase: "feature-005-preflight", ...preflight }));

  if (process.argv.includes("--preflight")) {
    console.log("Feature 005 prerequisite preflight passed without writes.");
  } else {
    const migration = await readFile(new URL("../supabase/migrations/005_b2b_checkout_admin.sql", import.meta.url), "utf8");
    const before = (await client.query("select count(*)::int as count, max(created_at) as latest from public.orders")).rows[0];
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended('keepfit-feature-005-migration',0))");
    await client.query(migration);
    await client.query(migration);

    const verification = (await client.query(`
      select
        bool_and(relrowsecurity) as rls_enabled,
        count(*)::int = 5 as relation_count,
        to_regprocedure('public.commerce_confirm_quote(text,uuid,text,uuid,integer)') is not null as has_confirm,
        to_regprocedure('public.commerce_finalize_order(text,uuid,text,uuid,integer,uuid,text,uuid,text)') is not null as has_finalize,
        to_regprocedure('public.commerce_set_quantity_rule(uuid,text,uuid,uuid,uuid,integer,integer,text,uuid)') is not null as has_rule_set,
        to_regprocedure('public.commerce_archive_quantity_rule(uuid,uuid,text,uuid)') is not null as has_rule_archive
      from pg_class
      where oid in (
        'public.commerce_quantity_rules'::regclass,
        'public.quantity_rule_audit_events'::regclass,
        'public.checkout_quotes'::regclass,
        'public.checkout_submissions'::regclass,
        'public.order_domain_events'::regclass
      )
    `)).rows[0];
    if (Object.values(verification).some((valid) => !valid)) {
      throw new Error("Feature 005 schema verification failed.");
    }
    const security = (await client.query(`select
      not has_function_privilege('anon','public.commerce_finalize_order(text,uuid,text,uuid,integer,uuid,text,uuid,text)','EXECUTE') as anon_finalize_denied,
      not has_function_privilege('authenticated','public.commerce_set_quantity_rule(uuid,text,uuid,uuid,uuid,integer,integer,text,uuid)','EXECUTE') as customer_rule_denied,
      has_function_privilege('service_role','public.commerce_finalize_order(text,uuid,text,uuid,integer,uuid,text,uuid,text)','EXECUTE') as service_finalize_allowed,
      has_function_privilege('service_role','public.commerce_set_quantity_rule(uuid,text,uuid,uuid,uuid,integer,integer,text,uuid)','EXECUTE') as service_rule_allowed,
      (select array_to_string(proconfig, ',') like '%search_path=""%' from pg_proc where oid='public.commerce_finalize_order(text,uuid,text,uuid,integer,uuid,text,uuid,text)'::regprocedure) as empty_search_path`)).rows[0];
    console.log(JSON.stringify({ phase: "feature-005-security", ...security }));
    if (Object.values(security).some((valid) => !valid)) throw new Error("Feature 005 function security verification failed.");
    const after = (await client.query("select count(*)::int as count, max(created_at) as latest from public.orders")).rows[0];
    if (before.count !== after.count || String(before.latest) !== String(after.latest)) {
      throw new Error("Feature 005 migration changed legacy Order rows.");
    }
    await client.query("commit");
    console.log(JSON.stringify({ phase: "feature-005-verification", ...verification, ...security, legacy_orders: after.count }));
    console.log("Feature 005 foundation migration applied and convergent reapplication verified.");
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
