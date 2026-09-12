import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { testCustomer } from "../../helpers/supabase-test-db";
import { withPricingTestDatabase } from "../../helpers/pricing-test-db";

describe("customer pricing rules", () => {
  it.skipIf(!process.env.DIRECT_URL)("assigns/removes a direct list and schedules auditable unit overrides", async () => withPricingTestDatabase(async (db) => {
    const actor = randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)", [actor, `${actor}@example.invalid`]);
    await db.query("update public.profiles set is_admin=true where id=$1", [actor]);
    const customer = await testCustomer(db);
    const listId = (await db.query("insert into public.price_lists(code,name_en,name_ar) values($1,'Direct','مباشر') returning id", [`test-${randomUUID()}`])).rows[0].id;
    await db.query("select public.pricing_assign_customer_list($1,$2,$3,'test',$4)", [actor, customer.id, listId, randomUUID()]);
    expect((await db.query("select direct_price_list_id from public.customers where id=$1", [customer.id])).rows[0].direct_price_list_id).toBe(listId);
    await db.query("select public.pricing_assign_customer_list($1,$2,null,'remove',$3)", [actor, customer.id, randomUUID()]);
    expect((await db.query("select direct_price_list_id from public.customers where id=$1", [customer.id])).rows[0].direct_price_list_id).toBeNull();

    const target = (await db.query("select variant_id,id sellable_unit_id from public.variant_packaging_units where is_active and is_sellable limit 1")).rows[0];
    const result = (await db.query("select public.pricing_upsert_customer_override($1,$2,$3::jsonb,$4) result", [actor, customer.id, JSON.stringify({ ...target, amount_minor: "75", valid_from: null, valid_until: "2027-01-01T00:00:00.000Z", reason: "contract" }), randomUUID()])).rows[0].result;
    expect(result.customer_id).toBe(customer.id);
    expect((await db.query("select amount_minor::text from public.customer_unit_price_overrides where customer_id=$1 and is_active", [customer.id])).rows[0].amount_minor).toBe("75");
  }));
});
