import pg from "pg";
import { randomUUID } from "node:crypto";
export async function withTestDatabase(run: (db: pg.Client) => Promise<void>) {
  if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is required for database tests");
  const db = new pg.Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 10000 });
  await db.connect();
  try { await db.query("begin"); await run(db); }
  finally { await db.query("rollback"); await db.end(); }
}
export async function testCustomer(db: pg.Client) {
  const id = randomUUID();
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [id, id + "@example.invalid", { full_name: "Test Customer" }]);
  const { rows } = await db.query("select (public.customer_resolve($1)).*", [id]);
  await db.query("select public.customer_profile_update($1,$2,$3)", [rows[0].id, "Test Customer", "01012345678"]);
  return { id: rows[0].id as string, authId: id };
}
export async function asCustomer(db: pg.Client, authId: string) {
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [authId]);
}
