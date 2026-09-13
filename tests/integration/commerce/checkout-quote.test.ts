import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withCommerceTestDatabase } from "../../helpers/commerce-test-db";

describe("checkout quote lifecycle", () => {
  it.skipIf(!process.env.DIRECT_URL)("enforces scope, expiry, revision, and explicit confirmation", async () => withCommerceTestDatabase(async (db) => {
    const id = randomUUID(); const hash = "a".repeat(64);
    await db.query(`insert into public.checkout_quotes(id,scope_kind,guest_context_hash,commercial_document,safe_projection,commercial_fingerprint,expires_at) values($1,'guest',$2,'{}',$3,$4,transaction_timestamp()+interval '30 minutes')`, [id, hash, { validationState: "valid" }, "b".repeat(64)]);
    await db.query("savepoint wrong_scope");
    await expect(db.query("select public.commerce_confirm_quote('guest',null,$1,$2,1)", ["c".repeat(64), id])).rejects.toMatchObject({ code: "P0002" });
    await db.query("rollback to wrong_scope");
    await db.query("savepoint wrong_revision");
    await expect(db.query("select public.commerce_confirm_quote('guest',null,$1,$2,2)", [hash, id])).rejects.toMatchObject({ code: "40001" });
    await db.query("rollback to wrong_revision");
    expect((await db.query("select public.commerce_confirm_quote('guest',null,$1,$2,1) result", [hash, id])).rows[0].result.state).toBe("confirmed");
    await db.query("update public.checkout_quotes set created_at=transaction_timestamp()-interval '2 hours',expires_at=transaction_timestamp()-interval '1 hour' where id=$1", [id]);
    await db.query("savepoint expired");
    await expect(db.query("select public.commerce_confirm_quote('guest',null,$1,$2,1)", [hash, id])).rejects.toThrow(/QUOTE_EXPIRED/);
    await db.query("rollback to expired");
  }), 30_000);
});
