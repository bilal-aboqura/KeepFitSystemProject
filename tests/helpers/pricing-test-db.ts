import pg from "pg";
import { readFile } from "node:fs/promises";
import { withTestDatabase } from "./supabase-test-db";

export async function loadPricingMigration() {
  return readFile("supabase/migrations/004_pricing_engine.sql", "utf8");
}

export async function withPricingTestDatabase(run: (db: pg.Client) => Promise<void>) {
  return withTestDatabase(async (db) => {
    await db.query(await loadPricingMigration());
    await run(db);
  });
}
