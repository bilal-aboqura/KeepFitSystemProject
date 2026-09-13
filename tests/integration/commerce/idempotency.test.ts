import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withCommerceClients, withCommerceTestDatabase } from "../../helpers/commerce-test-db";
import { confirmedQuote } from "../../helpers/commerce-fixtures";

describe("commerce submission idempotency", () => {
  it.skipIf(!process.env.DIRECT_URL)("replays the same Order and rejects changed payload for 24 hours", async () => withCommerceTestDatabase(async (db) => {
    const fixture = await confirmedQuote(db); const submission = randomUUID(); const payloadHash = "c".repeat(64); const grantHash = "d".repeat(64);
    const args = ["guest", null, fixture.guestHash, fixture.quoteId, 1, submission, payloadHash, randomUUID(), grantHash];
    const created = (await db.query("select public.commerce_finalize_order($1,$2,$3,$4,$5,$6,$7,$8,$9) result", args)).rows[0].result;
    const replayed = (await db.query("select public.commerce_finalize_order($1,$2,$3,$4,$5,$6,$7,$8,$9) result", args)).rows[0].result;
    expect(replayed).toMatchObject({ kind: "replayed", orderId: created.orderId });
    await db.query("savepoint changed_payload");
    await expect(db.query("select public.commerce_finalize_order($1,$2,$3,$4,$5,$6,$7,$8,$9)", [...args.slice(0, 6), "e".repeat(64), ...args.slice(7)])).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
    await db.query("rollback to changed_payload");
    expect(Number((await db.query("select extract(epoch from expires_at-first_accepted_at)::int seconds from public.checkout_submissions where submission_key=$1", [submission])).rows[0].seconds)).toBe(86400);
  }), 30_000);

  it.skipIf(!process.env.DIRECT_URL)("isolates the same key across guest scopes", async () => withCommerceTestDatabase(async (db) => {
    const first = await confirmedQuote(db);
    const second = await confirmedQuote(db);
    const submission = randomUUID();
    const invoke = (fixture: Awaited<ReturnType<typeof confirmedQuote>>, grantHash: string) => db.query(
      "select public.commerce_finalize_order('guest',null,$1,$2,1,$3,$4,$5,$6) result",
      [fixture.guestHash, fixture.quoteId, submission, "c".repeat(64), randomUUID(), grantHash],
    );
    const firstResult = (await invoke(first, `${"d".repeat(63)}1`)).rows[0].result;
    const secondResult = (await invoke(second, `${"d".repeat(63)}2`)).rows[0].result;
    expect(secondResult.orderId).not.toBe(firstResult.orderId);
  }), 30_000);

  it.skipIf(!process.env.DIRECT_URL)("serializes two real concurrent connections into one Order", async () => withCommerceClients(2, async ([setup, contender]) => {
    const fixture = await confirmedQuote(setup);
    const submission = randomUUID();
    const correlation = randomUUID();
    const args = [fixture.guestHash, fixture.quoteId, submission, "c".repeat(64), correlation, "d".repeat(64)];
    let orderId: string | undefined;
    try {
      const query = "select public.commerce_finalize_order('guest',null,$1,$2,1,$3,$4,$5,$6) result";
      const [first, second] = await Promise.all([setup.query(query, args), contender.query(query, args)]);
      const results = [first.rows[0].result, second.rows[0].result];
      orderId = results[0].orderId;
      expect(new Set(results.map((result) => result.orderId))).toEqual(new Set([orderId]));
      expect(results.map((result) => result.kind).sort()).toEqual(["created", "replayed"]);
      expect(Number((await setup.query("select count(*)::int count from public.orders where id=$1", [orderId])).rows[0].count)).toBe(1);
    } finally {
      if (orderId) {
        await setup.query("update public.checkout_quotes set state='confirmed',consumed_order_id=null,consumed_at=null where id=$1", [fixture.quoteId]);
        await setup.query("update public.checkout_submissions set order_id=null,state='accepted' where submission_key=$1 and quote_id=$2", [submission, fixture.quoteId]);
        await setup.query("delete from public.order_domain_events where order_id=$1", [orderId]);
        await setup.query("delete from public.order_confirmation_grants where order_id=$1", [orderId]);
        await setup.query("delete from public.order_items where order_id=$1", [orderId]);
        await setup.query("delete from public.orders where id=$1", [orderId]);
      }
      await setup.query("delete from public.checkout_submissions where submission_key=$1 and quote_id=$2", [submission, fixture.quoteId]);
      await setup.query("delete from public.checkout_quotes where id=$1", [fixture.quoteId]);
    }
  }), 30_000);
});
