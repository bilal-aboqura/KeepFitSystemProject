import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withPricingTestDatabase } from "../../helpers/pricing-test-db";

async function admin(db: import("pg").default.Client) {
  const id = randomUUID();
  await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${id}@example.invalid`]);
  await db.query("update public.profiles set is_admin=true where id=$1", [id]);
  return id;
}

describe("admin price lists", () => {
  it.skipIf(!process.env.DIRECT_URL)("creates lists, replaces one default, maps a type, and protects the default", async () => withPricingTestDatabase(async (db) => {
    const actor = await admin(db);
    const list = (await db.query("insert into public.price_lists(code,name_en,name_ar,created_by,updated_by) values($1,'Wholesale','جملة',$2,$2) returning id", [`test-${randomUUID()}`, actor])).rows[0];
    const changed = (await db.query("select public.pricing_set_default($1,$2,null,'test',$3) result", [actor, list.id, randomUUID()])).rows[0].result;
    expect(changed.default_price_list_id).toBe(list.id);
    await db.query("savepoint protect_default");
    await expect(db.query("update public.price_lists set is_active=false,archived_at=now() where id=$1", [list.id])).rejects.toBeTruthy();
    await db.query("rollback to protect_default");

    const typeId = (await db.query("select id from public.customer_types where code='wholesale'")).rows[0].id;
    await db.query("select public.pricing_set_customer_type_mapping($1,$2,$3,'test',$4)", [actor, typeId, list.id, randomUUID()]);
    expect((await db.query("select price_list_id from public.customer_type_price_list_mappings where customer_type_id=$1 and is_active", [typeId])).rows[0].price_list_id).toBe(list.id);
  }));
});
