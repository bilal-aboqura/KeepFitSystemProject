import pg from "pg";
import { readFile } from "node:fs/promises";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required.");

const migrations = [
  "../supabase/migrations/003_catalog_variants_media.sql",
  "../supabase/migrations/003b_catalog_packaging_units.sql",
];
const sql = (await Promise.all(migrations.map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n\n");
const client = new pg.Client({ connectionString: url });

await client.connect();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("Feature 003 catalog and packaging migrations applied.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
