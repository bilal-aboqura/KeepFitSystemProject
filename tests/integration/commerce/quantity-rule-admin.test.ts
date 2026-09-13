import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withCommerceTestDatabase } from "../../helpers/commerce-test-db";

describe("quantity rule admin commands", () => {
  it.skipIf(!process.env.DIRECT_URL)("atomically replaces, archives, and audits rules", async () => withCommerceTestDatabase(async (db) => {
    const actor = randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)", [actor, `${actor}@example.invalid`]);
    await db.query("update public.profiles set is_admin=true where id=$1", [actor]);
    const target = (await db.query(`select unit.variant_id,unit.id unit_id from public.variant_packaging_units unit where unit.is_active and unit.archived_at is null and unit.is_sellable limit 1`)).rows[0];
    expect(target).toBeTruthy();
    const first = (await db.query("select public.commerce_set_quantity_rule($1,'public',null,$2,$3,2,2,'test first',$4) result", [actor, target.variant_id, target.unit_id, randomUUID()])).rows[0].result;
    const second = (await db.query("select public.commerce_set_quantity_rule($1,'public',null,$2,$3,6,4,'test replace',$4) result", [actor, target.variant_id, target.unit_id, randomUUID()])).rows[0].result;
    expect(second.replacedRuleId).toBe(first.id);
    expect((await db.query("select count(*)::int count from public.commerce_quantity_rules where variant_id=$1 and sellable_unit_id=$2 and is_active", [target.variant_id, target.unit_id])).rows[0].count).toBe(1);
    await db.query("select public.commerce_archive_quantity_rule($1,$2,'test archive',$3)", [actor, second.id, randomUUID()]);
    expect((await db.query("select count(*)::int count from public.quantity_rule_audit_events where rule_id in ($1,$2)", [first.id, second.id])).rows[0].count).toBe(4);
  }), 30_000);
});
