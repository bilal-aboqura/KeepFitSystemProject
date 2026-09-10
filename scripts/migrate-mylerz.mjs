import pg from "pg";
import { readFile } from "node:fs/promises";

if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is required");
const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
try {
  await client.connect();
  await client.query(await readFile(new URL("../supabase/mylerz.sql", import.meta.url), "utf8"));
  console.log("Mylerz migration applied.");
} finally {
  await client.end();
}
