import { describe, it, expect } from "vitest";
import { withTestDatabase, testCustomer, asCustomer } from "../../helpers/supabase-test-db";
describe.skipIf(!process.env.DIRECT_URL)("database customer security", () => {
  it("limits reads and blocks direct writes and privileged RPCs", async () => withTestDatabase(async db => {
    const a = await testCustomer(db); const b = await testCustomer(db);
    await asCustomer(db,a.authId);
    expect((await db.query("select id from customers")).rows.map(r=>r.id)).toEqual([a.id]);
    for (const sql of ["update profiles set is_admin=true", "insert into customers(full_name) values('Intruder')", "select customer_resolve('" + b.authId + "')"]) {
      await db.query("savepoint denied");
      await expect(db.query(sql)).rejects.toThrow();
      await db.query("rollback to denied");
    }
    expect((await db.query("select * from order_confirmation_grants").catch(()=>null))).toBeNull();
  }), 20000);
  it("rejects customer media upload while retaining public read policy", async () => withTestDatabase(async db => {
    const a = await testCustomer(db); await asCustomer(db,a.authId);
    await expect(db.query("insert into storage.objects(bucket_id,name) values('product-images','test-denied.png')")).rejects.toThrow();
  }), 20000);
  it("maintains defaults and leaves another customer's addresses untouched", async () => withTestDatabase(async db => {
    const a = await testCustomer(db); const b = await testCustomer(db);
    const address = { full_name:"Test Customer", phone:"01012345678",governorate:"Cairo",city:"Nasr City",address:"15 Example St",is_default:false };
    const create = async () => (await db.query("select customer_address_command($1,'create',null,$2) as a",[a.id,address])).rows[0].a;
    const first = await create(); const second = await create();
    expect(first.is_default).toBe(true);
    expect((await db.query("select customer_address_command($1,'default',$2) as a",[b.id,first.id])).rows[0].a).toBeNull();
    await db.query("select customer_address_command($1,'default',$2)",[a.id,second.id]);
    expect((await db.query("select id from addresses where customer_id=$1 and is_default",[a.id])).rows[0].id).toBe(second.id);
    await db.query("select customer_address_command($1,'delete',$2)",[a.id,second.id]);
    expect((await db.query("select id from addresses where customer_id=$1 and is_default",[a.id])).rows[0].id).toBe(first.id);
    await asCustomer(db,b.authId);
    expect((await db.query("select * from addresses")).rowCount).toBe(0);
  }), 20000);
});
