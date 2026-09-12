import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { withTestDatabase, testCustomer } from "../../helpers/supabase-test-db";
it("keeps the additive migration identical to the canonical schema feature section", async () => {
  const migration = await readFile("supabase/migrations/001_customer_identity.sql", "utf8");
  const schema = await readFile("supabase/schema.sql", "utf8");
  const normalizedSchema = schema.replaceAll("\r\n", "\n");
  const marker = "-- Feature 001 canonical schema (kept identical to its additive migration).";
  const nextMarker = "-- =====================================================================\n-- Feature 002:";
  const featureSection = normalizedSchema.split(marker)[1].split(nextMarker)[0];
  expect(featureSection.trim().replaceAll("\r\n", "\n")).toBe(migration.trim().replaceAll("\r\n", "\n"));
});
it("keeps the Feature 003b migration identical to its ordered canonical schema section", async () => {
  const migration = (await readFile("supabase/migrations/003b_catalog_packaging_units.sql", "utf8")).replaceAll("\r\n", "\n").trim();
  const schema = (await readFile("supabase/schema.sql", "utf8")).replaceAll("\r\n", "\n");
  const marker = "-- Canonical Feature 003b section, ordered after the Feature 003 base schema.";
  const featureSection = schema.split(marker)[1].split("notify pgrst, 'reload schema';")[0].trim();
  expect(featureSection).toBe(migration);
});
it.skipIf(!process.env.DIRECT_URL)("migration is repeatable, grants are private, identities resolve once, phones can be shared", async () => withTestDatabase(async db => {
  const sql = await readFile("supabase/migrations/001_customer_identity.sql","utf8");
  await db.query(sql); await db.query(sql);
  const a=await testCustomer(db); const b=await testCustomer(db);
  expect((await db.query("select (customer_resolve($1)).id as id",[a.authId])).rows[0].id).toBe(a.id);
  expect(a.id).not.toBe(b.id);
  const rls=await db.query("select relrowsecurity from pg_class where oid='order_confirmation_grants'::regclass");
  expect(rls.rows[0].relrowsecurity).toBe(true);
  const count=await db.query("select count(*)::int as n from customers where id=any($1::uuid[]) and phone='01012345678'",[[a.id,b.id]]);
  expect(count.rows[0].n).toBe(2);
  await expect(db.query("insert into customers(auth_user_id) values($1)",[a.authId])).rejects.toThrow();
}),30000);
