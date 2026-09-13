import pg from "pg";
import { readFile } from "node:fs/promises";
import { withTestDatabase } from "./supabase-test-db";

const migrationPaths = [
  "supabase/migrations/003b_catalog_packaging_units.sql",
  "supabase/migrations/004_pricing_engine.sql",
  "supabase/migrations/005_b2b_checkout_admin.sql",
];

export async function loadCommerceMigrations() {
  return Promise.all(migrationPaths.map((path) => readFile(path, "utf8")));
}

export async function withCommerceTestDatabase(run: (db: pg.Client) => Promise<void>) {
  return withTestDatabase(async (db) => {
    for (const migration of await loadCommerceMigrations()) await db.query(migration);
    await run(db);
  });
}

export async function withCommerceClients<T>(
  count: number,
  run: (clients: pg.Client[]) => Promise<T>,
) {
  if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is required for database tests");
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    throw new Error("Commerce tests support between one and four database clients");
  }

  const clients = Array.from(
    { length: count },
    () => new pg.Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 10_000 }),
  );

  try {
    await Promise.all(clients.map((client) => client.connect()));
    return await run(clients);
  } finally {
    await Promise.allSettled(clients.map((client) => client.end()));
  }
}
