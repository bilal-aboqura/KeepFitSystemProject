import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cartQuoteInputSchema, checkoutQuoteInputSchema, orderSubmissionInputSchema } from "@/lib/commerce/validation";
import { hashGuestCheckoutSecret } from "@/lib/commerce/context";
import { redactCommerceMetadata } from "@/lib/commerce/diagnostics";
import { withCommerceTestDatabase } from "../../helpers/commerce-test-db";
import { confirmedQuote } from "../../helpers/commerce-fixtures";

const line = { variantId: "10000000-0000-4000-8000-000000000005", sellableUnitId: "20000000-0000-4000-8000-000000000005", quantity: 1 };

describe("commerce tampering boundaries", () => {
  it("rejects client money, conversion, context, and extra delivery authority", () => {
    for (const injected of [{ price: 1 }, { total: 1 }, { conversion: 999 }, { customerType: "wholesale" }]) {
      expect(cartQuoteInputSchema.safeParse({ lines: [{ ...line, ...injected }] }).success).toBe(false);
    }
    expect(checkoutQuoteInputSchema.safeParse({
      lines: [line], paymentMethod: "cod", contact: null,
      delivery: { address: { fullName: "Test User", phone: "01012345678", altPhone: "", governorate: "Cairo", city: "Nasr City", address: "15 Test Street", shipping: 0 } },
    }).success).toBe(false);
    expect(orderSubmissionInputSchema.safeParse({ quoteId: line.variantId, quoteRevision: 1, submissionId: randomUUID(), grandTotal: 1 }).success).toBe(false);
  });

  it("stores only a one-way guest hash and strips sensitive diagnostics", () => {
    const secret = "sensitive-cookie-secret";
    const hash = hashGuestCheckoutSecret(secret);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(secret);
    expect(redactCommerceMetadata({ phone: "01012345678", address: "secret", token: "secret", quoteId: "safe", count: 2, nested: {} })).toEqual({ quoteId: "safe", count: 2 });
  });

  it("configures the guest cookie as HttpOnly, scoped, same-site, and production-secure", async () => {
    const source = await readFile("src/lib/commerce/context.ts", "utf8");
    expect(source).toContain("httpOnly: true");
    expect(source).toContain('sameSite: "lax"');
    expect(source).toContain('secure: process.env.NODE_ENV === "production"');
    expect(source).toContain('path: "/"');
  });

  it.skipIf(!process.env.DIRECT_URL)("returns safe not-found for a quote owned by another guest scope", async () => withCommerceTestDatabase(async (db) => {
    const fixture = await confirmedQuote(db);
    await db.query("savepoint wrong_scope");
    await expect(db.query("select public.commerce_finalize_order('guest',null,$1,$2,1,$3,$4,$5,$6)", ["b".repeat(64), fixture.quoteId, randomUUID(), "c".repeat(64), randomUUID(), "d".repeat(64)])).rejects.toThrow(/QUOTE_NOT_FOUND/);
    await db.query("rollback to wrong_scope");
    expect((await db.query("select count(*)::int count from public.orders where checkout_quote_id=$1", [fixture.quoteId])).rows[0].count).toBe(0);
  }), 30_000);
});
