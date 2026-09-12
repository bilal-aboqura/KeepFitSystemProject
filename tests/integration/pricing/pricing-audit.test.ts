import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withPricingTestDatabase } from "../../helpers/pricing-test-db";

describe("pricing audit history", () => {
  it.skipIf(!process.env.DIRECT_URL)("records actor, action, redacted state, and correlation", async () => withPricingTestDatabase(async (db) => {
    const actor = randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)", [actor, `${actor}@example.invalid`]);
    await db.query("update public.profiles set is_admin=true where id=$1", [actor]);
    const list = (await db.query("insert into public.price_lists(code,name_en,name_ar) values($1,'Audit','تدقيق') returning id", [`test-${randomUUID()}`])).rows[0];
    const correlation = randomUUID();
    await db.query("select public.pricing_set_default($1,$2,null,'audit test',$3)", [actor, list.id, correlation]);
    const event = (await db.query("select action,actor_id,correlation_id,previous_state,new_state from public.pricing_audit_events where correlation_id=$1", [correlation])).rows[0];
    expect(event).toMatchObject({ action: "DEFAULT_PRICE_LIST_CHANGED", actor_id: actor, correlation_id: correlation });
    expect(event.previous_state).toHaveProperty("default_price_list_id");
    expect(JSON.stringify(event)).not.toMatch(/amount_minor/);
  }));
});
