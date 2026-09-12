import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withPricingTestDatabase } from "../../helpers/pricing-test-db";

describe("admin price entry commands", () => {
  it.skipIf(!process.env.DIRECT_URL)("bulk-saves atomically, closes prior periods, and shares audit correlation", async () => withPricingTestDatabase(async (db) => {
    const actor = randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)", [actor, `${actor}@example.invalid`]);
    await db.query("update public.profiles set is_admin=true where id=$1", [actor]);
    const listId = (await db.query("insert into public.price_lists(code,name_en,name_ar) values($1,'Grid','شبكة') returning id", [`test-${randomUUID()}`])).rows[0].id;
    const target = (await db.query("select variant_id,id sellable_unit_id from public.variant_packaging_units where is_active and is_sellable limit 1")).rows[0];
    const correlation = randomUUID();
    const first = [{ ...target, amount_minor: "100", valid_from: "2026-01-01T00:00:00.000Z", valid_until: null }];
    await db.query("select public.pricing_bulk_upsert_items($1,$2,$3::jsonb,$4)", [actor, listId, JSON.stringify(first), correlation]);
    const replacement = [{ ...target, amount_minor: "120", valid_from: "2026-02-01T00:00:00.000Z", valid_until: null, close_prior_at_start: true }];
    await db.query("select public.pricing_bulk_upsert_items($1,$2,$3::jsonb,$4)", [actor, listId, JSON.stringify(replacement), correlation]);
    expect((await db.query("select valid_until::text from public.price_list_items where price_list_id=$1 order by valid_from", [listId])).rows[0].valid_until).toContain("2026-02-01");
    expect((await db.query("select count(*)::int count from public.pricing_audit_events where correlation_id=$1", [correlation])).rows[0].count).toBe(2);

    await db.query("savepoint invalid_bulk");
    await expect(db.query("select public.pricing_bulk_upsert_items($1,$2,$3::jsonb,$4)", [actor, listId, JSON.stringify([{ ...target, amount_minor: "0" }]), randomUUID()])).rejects.toBeTruthy();
    await db.query("rollback to invalid_bulk");
  }));
});
