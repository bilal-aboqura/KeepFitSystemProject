import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withCommerceTestDatabase } from "../../helpers/commerce-test-db";
import { confirmedQuote } from "../../helpers/commerce-fixtures";

describe("atomic commerce finalization", () => {
  it.skipIf(!process.env.DIRECT_URL)("writes one complete immutable v1 snapshot and consumes its quote", async () => withCommerceTestDatabase(async (db) => {
    const fixture = await confirmedQuote(db); const submission = randomUUID();
    const result = (await db.query("select public.commerce_finalize_order('guest',null,$1,$2,1,$3,$4,$5,$6) result", [fixture.guestHash, fixture.quoteId, submission, "c".repeat(64), randomUUID(), "d".repeat(64)])).rows[0].result;
    expect(result.orderNumber).toMatch(/^KF-[A-F0-9]{6}-\d{6}$/);
    const order = (await db.query("select commerce_snapshot_version,checkout_quote_id,checkout_submission_id,commercial_fingerprint,items_total_minor::text,grand_total_minor::text from public.orders where id=$1", [result.orderId])).rows[0];
    expect(order).toMatchObject({ commerce_snapshot_version: 1, checkout_quote_id: fixture.quoteId, items_total_minor: result.grandTotalMinor, grand_total_minor: result.grandTotalMinor });
    const state = (await db.query("select state,consumed_order_id from public.checkout_quotes where id=$1", [fixture.quoteId])).rows[0];
    expect(state).toMatchObject({ state: "consumed", consumed_order_id: result.orderId });
    expect((await db.query("select count(*)::int count from public.order_items where order_id=$1 and minimum_quantity_snapshot=1 and quantity_increment_snapshot=1", [result.orderId])).rows[0].count).toBe(1);
    expect((await db.query("select count(*)::int count from public.order_domain_events where order_id=$1 and event_type='order.created'", [result.orderId])).rows[0].count).toBe(1);
    expect((await db.query("select count(*)::int count from public.order_confirmation_grants where order_id=$1", [result.orderId])).rows[0].count).toBe(1);
  }), 30_000);

  it.skipIf(!process.env.DIRECT_URL)("rolls back line, grant, and event failures without consuming the quote", async () => withCommerceTestDatabase(async (db) => {
    for (const relation of ["order_items", "order_confirmation_grants", "order_domain_events"]) {
      const fixture = await confirmedQuote(db);
      const submission = randomUUID();
      const functionName = `commerce_test_fail_${relation}`;
      const triggerName = `commerce_test_fail_${relation}`;
      await db.query(`create function pg_temp.${functionName}() returns trigger language plpgsql as $$ begin raise exception 'injected ${relation} failure'; end $$`);
      await db.query(`create trigger ${triggerName} before insert on public.${relation} for each row execute function pg_temp.${functionName}()`);
      await db.query("savepoint before_failure");
      await expect(db.query("select public.commerce_finalize_order('guest',null,$1,$2,1,$3,$4,$5,$6)", [fixture.guestHash, fixture.quoteId, submission, "c".repeat(64), randomUUID(), "d".repeat(64)])).rejects.toThrow(`injected ${relation} failure`);
      await db.query("rollback to before_failure");
      expect((await db.query("select state,consumed_order_id from public.checkout_quotes where id=$1", [fixture.quoteId])).rows[0]).toEqual({ state: "confirmed", consumed_order_id: null });
      expect((await db.query("select count(*)::int count from public.checkout_submissions where submission_key=$1", [submission])).rows[0].count).toBe(0);
      await db.query(`drop trigger ${triggerName} on public.${relation}`);
    }
  }), 30_000);

  it.skipIf(!process.env.DIRECT_URL)("preserves the version-1 commercial snapshot after live catalog changes", async () => withCommerceTestDatabase(async (db) => {
    const fixture = await confirmedQuote(db);
    const result = (await db.query("select public.commerce_finalize_order('guest',null,$1,$2,1,$3,$4,$5,$6) result", [fixture.guestHash, fixture.quoteId, randomUUID(), "c".repeat(64), randomUUID(), "d".repeat(64)])).rows[0].result;
    const before = (await db.query("select product_name_en,variant_label_en,sku,unit_label_en,base_quantity_per_unit_num::text,base_quantity_per_unit_den::text,equivalent_base_quantity_num::text,equivalent_base_quantity_den::text,unit_price_minor::text,line_total_minor::text,minimum_quantity_snapshot,quantity_increment_snapshot from public.order_items where order_id=$1", [result.orderId])).rows[0];
    await db.query("update public.products set name_en='Changed live product' where id=(select product_id from public.order_items where order_id=$1 limit 1)", [result.orderId]);
    await db.query("update public.product_variants set label_en='Changed live variant' where id=(select variant_id from public.order_items where order_id=$1 limit 1)", [result.orderId]);
    await db.query("update public.variant_packaging_units set label_en='Changed live unit' where id=(select sellable_unit_id from public.order_items where order_id=$1 limit 1)", [result.orderId]);
    const after = (await db.query("select product_name_en,variant_label_en,sku,unit_label_en,base_quantity_per_unit_num::text,base_quantity_per_unit_den::text,equivalent_base_quantity_num::text,equivalent_base_quantity_den::text,unit_price_minor::text,line_total_minor::text,minimum_quantity_snapshot,quantity_increment_snapshot from public.order_items where order_id=$1", [result.orderId])).rows[0];
    expect(after).toEqual(before);
  }), 30_000);
});
