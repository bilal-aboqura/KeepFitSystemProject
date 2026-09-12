import pg from "pg";
import { readFile } from "node:fs/promises";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required.");

const sql = await readFile(
  new URL("../supabase/migrations/003_catalog_variants_media.sql", import.meta.url),
  "utf8",
);
const client = new pg.Client({ connectionString: url });

await client.connect();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("Feature 003 catalog migration applied.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
