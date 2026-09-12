import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { withTestDatabase } from "../helpers/supabase-test-db";

describe("Feature 003 packaging persistence", () => {
  it.skipIf(!process.env.DIRECT_URL)("backfills, validates, archives, and protects packaging units", async () => withTestDatabase(async (db) => {
    await db.query(await readFile("supabase/migrations/003_catalog_variants_media.sql", "utf8"));
    await db.query(await readFile("supabase/migrations/003b_catalog_packaging_units.sql", "utf8"));
    const categoryId = randomUUID();
    await db.query("insert into categories(id,slug,name_en,name_ar) values($1,$2,'Pack','عبوات')", [categoryId, `pack-${categoryId}`]);
    const product = { slug: `pack-${randomUUID()}`, category_id: categoryId, name_en: "Medicine", name_ar: "دواء", is_active: true, variants: [{ sku: `PACK-${randomUUID()}`, base_price: 100, stock: 5, is_default: true, is_active: true, attributes: [] }], specifications: [] };
    const created = (await db.query("select catalog_create_product($1::jsonb,null) result", [product])).rows[0].result;
    const variantId = created.variant_ids[0];
    const initial = (await db.query("select * from variant_packaging_units where variant_id=$1 and archived_at is null", [variantId])).rows;
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({ is_base_unit: true, is_sellable: true, is_default_sale_unit: true });

    const boxId = randomUUID();
    const stripId = randomUUID();
    const tabletId = randomUUID();
    const units = [
      { id: boxId, parent_unit_id: null, code: `BOX-${randomUUID()}`, label_en: "Box", label_ar: "علبة", quantity_per_parent: { numerator: 1, denominator: 1 }, is_base_unit: false, is_sellable: true, is_default_sale_unit: true, default_price_mode: "explicit", is_active: true },
      { id: stripId, parent_unit_id: boxId, code: null, label_en: "Strip", label_ar: "شريط", quantity_per_parent: { numerator: 5, denominator: 1 }, is_base_unit: false, is_sellable: true, is_default_sale_unit: false, default_price_mode: "derived", is_active: true },
      { id: tabletId, parent_unit_id: stripId, code: null, label_en: "Tablet", label_ar: "قرص", quantity_per_parent: { numerator: 10, denominator: 1 }, is_base_unit: true, is_sellable: false, is_default_sale_unit: false, default_price_mode: "derived", is_active: true },
    ];
    await db.query("select catalog_replace_packaging_units($1,$2::jsonb,null)", [variantId, JSON.stringify(units)]);
    const saved = (await db.query("select label_en,trunc(base_quantity_num)::text n,trunc(base_quantity_den)::text d from variant_packaging_units where variant_id=$1 and archived_at is null order by base_quantity_num desc", [variantId])).rows;
    expect(saved).toEqual([{ label_en: "Box", n: "50", d: "1" }, { label_en: "Strip", n: "10", d: "1" }, { label_en: "Tablet", n: "1", d: "1" }]);

    await db.query("savepoint invalid_graph");
    await expect(db.query("select catalog_replace_packaging_units($1,$2::jsonb,null)", [variantId, JSON.stringify([{ ...units[0], parent_unit_id: tabletId }, units[1], units[2]])])).rejects.toBeTruthy();
    await db.query("rollback to invalid_graph");
    expect((await db.query("select count(*)::int count from variant_packaging_units where variant_id=$1 and archived_at is null", [variantId])).rows[0].count).toBe(3);

    await db.query("savepoint permanent_code");
    const replacementIds = [randomUUID(), randomUUID(), randomUUID()];
    const replacement = units.map((unit, index) => ({ ...unit, id: replacementIds[index], parent_unit_id: index === 0 ? null : replacementIds[index - 1] }));
    await expect(db.query("select catalog_replace_packaging_units($1,$2::jsonb,null)", [variantId, JSON.stringify(replacement)])).rejects.toBeTruthy();
    await db.query("rollback to permanent_code");

    const otherProduct = { ...product, slug: `other-${randomUUID()}`, variants: [{ ...product.variants[0], sku: `OTHER-${randomUUID()}` }] };
    const otherCreated = (await db.query("select catalog_create_product($1::jsonb,null) result", [otherProduct])).rows[0].result;
    const otherUnitId = (await db.query("select id from variant_packaging_units where variant_id=$1 and is_default_sale_unit", [otherCreated.variant_ids[0]])).rows[0].id;
    await db.query("savepoint cross_variant_parent");
    await db.query("update variant_packaging_units set parent_unit_id=$1 where id=$2", [otherUnitId, stripId]);
    await expect(db.query("set constraints all immediate")).rejects.toBeTruthy();
    await db.query("rollback to cross_variant_parent");

    await db.query("savepoint customer_write");
    await db.query("set local role authenticated");
    await expect(db.query("update variant_packaging_units set is_sellable=false where id=$1", [boxId])).rejects.toBeTruthy();
    await db.query("rollback to customer_write");
  }), 30_000);
});
