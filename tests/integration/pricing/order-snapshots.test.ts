import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withPricingTestDatabase } from "../../helpers/pricing-test-db";

describe("authoritative order snapshots", () => {
  it.skipIf(!process.env.DIRECT_URL)("writes complete multi-line snapshots atomically and preserves history", async () => withPricingTestDatabase(async (db) => {
    const rows = (await db.query(`
      select variant.id variant_id, unit.id sellable_unit_id, item.id price_list_item_id, item.amount_minor::text
      from public.price_list_items item
      join public.product_variants variant on variant.id=item.variant_id
      join public.variant_packaging_units unit on unit.id=item.sellable_unit_id
      join public.pricing_configuration configuration on configuration.default_price_list_id=item.price_list_id
      where item.is_active and item.archived_at is null limit 2
    `)).rows;
    expect(rows.length).toBeGreaterThan(0);
    const chosen = rows.length === 1 ? [rows[0], rows[0]] : rows;
    const orderNumber = `PRICE-${randomUUID()}`;
    const items = chosen.map((row, index) => ({
      variant_id: row.variant_id, sellable_unit_id: row.sellable_unit_id, quantity: index + 1,
      unit_amount_minor: row.amount_minor, line_total_minor: (BigInt(row.amount_minor) * BigInt(index + 1)).toString(),
      currency: "EGP", pricing_source: "default_price_list", pricing_reference_id: row.price_list_item_id, price_is_derived: false,
    }));
    const itemsTotal = items.reduce((sum, item) => sum + BigInt(item.line_total_minor), BigInt(0));
    const result = (await db.query("select public.pricing_create_order($1::jsonb,$2::jsonb,$3) result", [{ order_number: orderNumber, customer_name: "Guest", customer_phone: "01012345678", alt_phone: "01112345678", governorate: "Cairo", city: "Nasr City", address: "15 Test Street", payment_method: "cod", items_total_minor: itemsTotal.toString(), shipping_cost_minor: "0", discount_minor: "0", grand_total_minor: itemsTotal.toString() }, JSON.stringify(items), "a".repeat(64)])).rows[0].result;
    const snapshots = (await db.query("select unit_price_minor::text,line_total_minor::text,price_currency,pricing_source,pricing_reference_id,price_is_derived from public.order_items where order_id=$1", [result.id])).rows;
    expect(snapshots).toHaveLength(2);
    expect(snapshots.every((line) => line.price_currency === "EGP" && line.pricing_source === "default_price_list" && line.pricing_reference_id)).toBe(true);

    await db.query("update public.price_list_items set amount_minor=amount_minor+100 where id=$1", [rows[0].price_list_item_id]);
    expect((await db.query("select unit_price_minor::text from public.order_items where order_id=$1 limit 1", [result.id])).rows[0].unit_price_minor).toBe(items[0].unit_amount_minor);

    const failedNumber = `PRICE-${randomUUID()}`;
    await db.query("savepoint invalid_order");
    await expect(db.query("select public.pricing_create_order($1::jsonb,$2::jsonb,$3)", [{ order_number: failedNumber, customer_name: "Guest", customer_phone: "01012345678", alt_phone: "01112345678", governorate: "Cairo", city: "Nasr City", address: "15 Test Street", payment_method: "cod", items_total_minor: "1", shipping_cost_minor: "0", discount_minor: "0", grand_total_minor: "1" }, JSON.stringify([{ ...items[0], line_total_minor: "1" }]), "b".repeat(64)])).rejects.toBeTruthy();
    await db.query("rollback to invalid_order");
    expect((await db.query("select count(*)::int count from public.orders where order_number=$1", [failedNumber])).rows[0].count).toBe(0);
  }));
});
