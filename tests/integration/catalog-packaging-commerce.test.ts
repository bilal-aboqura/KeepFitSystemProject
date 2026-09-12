import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { withTestDatabase } from "../helpers/supabase-test-db";
import { addToCart, clearCart, migrateUnambiguousLegacyCartItem } from "@/lib/cart";

describe("Feature 003 packaging commerce identity", () => {
  it("keeps two Sellable Units of one Variant distinct and migrates only complete legacy identities", () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
    Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent: () => true, addEventListener: () => undefined, removeEventListener: () => undefined } });
    const variantId = randomUUID();
    const base = { variant_id: variantId, product_id: randomUUID(), sku: "PACK-CART", slug: "pack-cart", name_en: "Pack", name_ar: "عبوة", price: 100, image: "/test.webp", stock: 20 };
    const boxId = randomUUID();
    const unitId = randomUUID();
    addToCart({ ...base, id: `${variantId}:${boxId}`, sellable_unit_id: boxId, unit_label_en: "Box", unit_label_ar: "علبة" }, 1, { showPrompt: false });
    addToCart({ ...base, id: `${variantId}:${unitId}`, sellable_unit_id: unitId, unit_label_en: "Ampoule", unit_label_ar: "أمبول", price: 25 }, 3, { showPrompt: false });
    expect(JSON.parse(values.get("cart") ?? "[]")).toMatchObject([{ sellable_unit_id: boxId, quantity: 1 }, { sellable_unit_id: unitId, quantity: 3 }]);

    values.set("cart", JSON.stringify([{ id: base.product_id, product_id: base.product_id, slug: base.slug, name_en: base.name_en, name_ar: base.name_ar, price: base.price, image: base.image, quantity: 2 }]));
    expect(migrateUnambiguousLegacyCartItem(base.product_id, { ...base, id: variantId })).toBe(false);
    expect(migrateUnambiguousLegacyCartItem(base.product_id, { ...base, id: `${variantId}:${boxId}`, sellable_unit_id: boxId })).toBe(true);
    expect(JSON.parse(values.get("cart") ?? "[]")[0]).toMatchObject({ variant_id: variantId, sellable_unit_id: boxId, quantity: 2 });
    clearCart();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it.skipIf(!process.env.DIRECT_URL)("persists authoritative Unit and conversion snapshots", async () => withTestDatabase(async (db) => {
    await db.query(await readFile("supabase/migrations/003_catalog_variants_media.sql", "utf8"));
    await db.query(await readFile("supabase/migrations/003b_catalog_packaging_units.sql", "utf8"));
    const categoryId = randomUUID();
    await db.query("insert into categories(id,slug,name_en,name_ar) values($1,$2,'Pack','عبوات')", [categoryId, `commerce-${categoryId}`]);
    const product = { slug: `commerce-${randomUUID()}`, category_id: categoryId, name_en: "Ampoules", name_ar: "أمبولات", is_active: true, variants: [{ sku: `AMP-${randomUUID()}`, base_price: 100, stock: 20, is_default: true, is_active: true, attributes: [] }], specifications: [] };
    const created = (await db.query("select catalog_create_product($1::jsonb,null) result", [product])).rows[0].result;
    const variantId = created.variant_ids[0];
    const boxId = randomUUID();
    const ampouleId = randomUUID();
    await db.query("select catalog_replace_packaging_units($1,$2::jsonb,null)", [variantId, JSON.stringify([
      { id: boxId, parent_unit_id: null, code: "TEST-BOX-4", label_en: "Box", label_ar: "علبة", quantity_per_parent: { numerator: 1, denominator: 1 }, is_base_unit: false, is_sellable: true, is_default_sale_unit: true, default_price_mode: "explicit", is_active: true },
      { id: ampouleId, parent_unit_id: boxId, code: null, label_en: "Ampoule", label_ar: "أمبول", quantity_per_parent: { numerator: 4, denominator: 1 }, is_base_unit: true, is_sellable: true, is_default_sale_unit: false, default_price_mode: "derived", is_active: true },
    ])]);
    const order = { order_number: `PACK-${randomUUID()}`, customer_name: "Guest", customer_phone: "01012345678", alt_phone: "01112345678", governorate: "Cairo", city: "Nasr City", address: "15 Test Street", items_total: 75, shipping_cost: 0, discount: 0, grand_total: 75, payment_method: "cod", customer_id: null, user_id: null };
    const result = (await db.query("select customer_create_order($1::jsonb,$2::jsonb,$3) result", [order, JSON.stringify([{ variant_id: variantId, sellable_unit_id: ampouleId, price: 25, quantity: 3, image: "/test.webp", base_quantity: 999 }]), "b".repeat(64)])).rows[0].result;
    const line = (await db.query("select sellable_unit_id,unit_label_en,base_quantity_per_unit_num::text base_per_unit,equivalent_base_quantity_num::text equivalent,line_total from order_items where order_id=$1", [result.id])).rows[0];
    expect(line).toMatchObject({ sellable_unit_id: ampouleId, unit_label_en: "Ampoule", base_per_unit: "1", equivalent: "3", line_total: "75.00" });

    await db.query("update variant_packaging_units set label_en='Changed' where id=$1", [ampouleId]);
    expect((await db.query("select unit_label_en from order_items where order_id=$1", [result.id])).rows[0].unit_label_en).toBe("Ampoule");

    await db.query("savepoint referenced_identity");
    await expect(db.query("select catalog_replace_packaging_units($1,$2::jsonb,null)", [variantId, JSON.stringify([
      { id: boxId, parent_unit_id: null, code: "TEST-BOX-4", label_en: "Box", label_ar: "علبة", quantity_per_parent: { numerator: 1, denominator: 1 }, is_base_unit: false, is_sellable: true, is_default_sale_unit: true, default_price_mode: "explicit", is_active: true },
      { id: ampouleId, parent_unit_id: boxId, code: null, label_en: "Ampoule", label_ar: "أمبول", quantity_per_parent: { numerator: 5, denominator: 1 }, is_base_unit: true, is_sellable: true, is_default_sale_unit: false, default_price_mode: "derived", is_active: true },
    ])])).rejects.toBeTruthy();
    await db.query("rollback to referenced_identity");

    const preserved = (await db.query("select to_jsonb(i) item from order_items i where order_id=$1", [result.id])).rows[0].item;
    await db.query("select admin_replace_order_items($1,$2::jsonb,50,0,0,50)", [result.id, JSON.stringify([{ ...preserved, quantity: 2, equivalent_base_quantity_num: 2 }])]);
    expect((await db.query("select sellable_unit_id,unit_label_en,equivalent_base_quantity_num::text equivalent,line_total from order_items where order_id=$1", [result.id])).rows[0]).toMatchObject({ sellable_unit_id: ampouleId, unit_label_en: "Ampoule", equivalent: "2", line_total: "50.00" });

    await db.query("update variant_packaging_units set is_sellable=false where id=$1", [ampouleId]);
    await db.query("savepoint nonsellable");
    await expect(db.query("select customer_create_order($1::jsonb,$2::jsonb,null)", [{ ...order, order_number: `PACK-${randomUUID()}` }, JSON.stringify([{ variant_id: variantId, sellable_unit_id: ampouleId, price: 25, quantity: 1 }])])).rejects.toBeTruthy();
    await db.query("rollback to nonsellable");
  }), 30_000);
});
