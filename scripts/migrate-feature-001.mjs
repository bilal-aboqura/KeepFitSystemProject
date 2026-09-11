import pg from "pg";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required.");
const sql = await readFile(new URL("../supabase/migrations/001_customer_identity.sql", import.meta.url), "utf8");
const db = new pg.Client({ connectionString:url,connectionTimeoutMillis:10000 });
await db.connect();
try {
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(1001001)");
  await db.query("set local lock_timeout='10s'");
  for(const name of ["profiles","addresses","orders","order_items"]) {
    const {rows}=await db.query("select to_regclass($1) as table_name",["public."+name]);
    if(!rows[0].table_name)throw new Error("Base schema missing: "+name);
  }
  const tables=["customers","addresses","orders","order_items","order_confirmation_grants","customer_audit"];
  const backup={created_at:new Date().toISOString(),tables:{},policies:[]};
  for(const name of tables) {
    const {rows}=await db.query("select to_regclass($1) as table_name",["public."+name]);
    if(rows[0].table_name)backup.tables[name]=(await db.query('select * from public.'+name)).rows;
  }
  backup.policies=(await db.query("select * from pg_policies where schemaname in ('public','storage')")).rows;
  const dir=new URL("../backups/",import.meta.url);await mkdir(dir,{recursive:true});
  await writeFile(new URL("feature-001-"+Date.now()+".json",dir),JSON.stringify(backup),{mode:0o600});
  const before=(await db.query("select count(*)::int as n from orders")).rows[0].n;
  await db.query(sql);
  const after=(await db.query("select count(*)::int as n from orders")).rows[0].n;
  if(before!==after)throw new Error("Order count changed");
  const {rows}=await db.query("select relrowsecurity from pg_class where oid='public.order_confirmation_grants'::regclass");
  if(!rows[0]?.relrowsecurity)throw new Error("Grant RLS missing");
  await db.query("commit");
  console.log("Feature 001 applied; backup saved locally; order count preserved; private grant RLS verified.");
} catch(error) {
  await db.query("rollback");
  console.error("Feature 001 rolled back:",error.message);
  process.exitCode=1;
} finally { await db.end(); }
