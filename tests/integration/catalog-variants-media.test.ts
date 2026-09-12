import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { definingAttributeFingerprint } from "@/lib/catalog/validation";
import { withTestDatabase } from "../helpers/supabase-test-db";

describe("Feature 003 catalog contract", () => {
  it("uses a stable default combination for a single variant", () => {
    expect(definingAttributeFingerprint([])).toBe("__default__");
  });

  it("does not include customer type in catalog identity", () => {
    expect(definingAttributeFingerprint.toString()).not.toMatch(/customer.?type/i);
  });

  it.skipIf(!process.env.DIRECT_URL)("enforces variant, SKU, combination, RLS, order snapshot, and archive invariants", async () => withTestDatabase(async (db) => {
    const migration = await readFile("supabase/migrations/003_catalog_variants_media.sql", "utf8");
    await db.query(migration);
    const categoryId = randomUUID();
    const brandId = randomUUID();
    await db.query("insert into categories(id,slug,name_en,name_ar) values($1,$2,'Test Category','فئة')", [categoryId, `test-${categoryId}`]);
    await db.query("insert into brands(id,slug,name_en,name_ar) values($1,$2,'Test Brand','علامة')", [brandId, `test-${brandId}`]);
    const product = {
      slug: `feature-003-test-${randomUUID()}`, category_id: categoryId, brand_id: brandId,
      name_en: "Protein", name_ar: "بروتين", is_active: true,
      variants: [{ sku: `SKU-${randomUUID()}`, base_price: 100, stock: 5, is_default: true, is_active: true, attributes: [] }],
      specifications: [],
    };
    const created = (await db.query("select catalog_create_product($1::jsonb,null) result", [product])).rows[0].result;
    expect(created.variant_ids).toHaveLength(1);
    const variantId = created.variant_ids[0];

    await db.query("savepoint duplicate_sku");
    await expect(db.query("select catalog_create_variant($1,$2::jsonb,null)", [created.product_id, { ...product.variants[0], is_default: false }])).rejects.toMatchObject({ code: "23505" });
    await db.query("rollback to duplicate_sku");

    await db.query("savepoint duplicate_combination");
    await expect(db.query("select catalog_create_variant($1,$2::jsonb,null)", [created.product_id, { ...product.variants[0], sku: `OTHER-${randomUUID()}`, is_default: false }])).rejects.toMatchObject({ code: "23505" });
    await db.query("rollback to duplicate_combination");

    await db.query("update products set name_en='Protein Renamed' where id=$1", [created.product_id]);
    expect((await db.query("select id from product_variants where product_id=$1", [created.product_id])).rows[0].id).toBe(variantId);

    const firstMediaId = randomUUID();
    const secondMediaId = randomUUID();
    const mediaInput = (mediaId: string, primary: boolean, order: number) => ({ media_id: mediaId, product_id: created.product_id, object_key: `test/catalog/products/${created.product_id}/${mediaId}.webp`, mime_type: "image/webp", byte_size: 100, width: 200, height: 200, alt_en: "", alt_ar: "", sort_order: order, is_primary: primary });
    await db.query("select catalog_confirm_media($1::jsonb,null)", [mediaInput(firstMediaId, false, 0)]);
    await db.query("select catalog_confirm_media($1::jsonb,null)", [mediaInput(secondMediaId, true, 1)]);
    expect((await db.query("select media_id from product_media where product_id=$1 and is_primary and archived_at is null", [created.product_id])).rows[0].media_id).toBe(secondMediaId);
    await db.query("select catalog_archive_media($1,null)", [secondMediaId]);
    expect((await db.query("select media_id from product_media where product_id=$1 and is_primary and archived_at is null", [created.product_id])).rows[0].media_id).toBe(firstMediaId);
    expect((await db.query("select archived_at is not null as archived,cleanup_after is not null as queued from catalog_media where id=$1", [secondMediaId])).rows[0]).toEqual({ archived: true, queued: true });

    const orderNumber = `F003-${randomUUID()}`;
    const order = { order_number: orderNumber, customer_name: "Guest User", customer_phone: "01012345678", alt_phone: "01112345678", governorate: "Cairo", city: "Nasr City", address: "15 Test Street", items_total: 100, shipping_cost: 0, discount: 0, grand_total: 100, payment_method: "cod", customer_id: null, user_id: null };
    const saved = (await db.query("select customer_create_order($1::jsonb,$2::jsonb,$3) result", [order, JSON.stringify([{ variant_id: variantId, price: 100, quantity: 1, image: "/test.webp" }]), "a".repeat(64)])).rows[0].result;
    const snapshot = (await db.query("select variant_id,sku,product_name_en,price from order_items where order_id=$1", [saved.id])).rows[0];
    expect(snapshot.variant_id).toBe(variantId);
    expect(snapshot.product_name_en).toBe("Protein Renamed");

    const definitionId = randomUUID();
    const valueId = randomUUID();
    await db.query("insert into attribute_definitions(id,code,label_en,label_ar,value_type,is_variant_defining) values($1,$2,'Size','الحجم','option',true)", [definitionId, `size_${randomUUID().replaceAll("-", "")}`]);
    await db.query("insert into attribute_values(id,attribute_definition_id,code,label_en,label_ar) values($1,$2,'large','Large','كبير')", [valueId, definitionId]);
    const replacementId = (await db.query("select catalog_create_variant($1,$2::jsonb,null) id", [created.product_id, { sku: `REPLACEMENT-${randomUUID()}`, base_price: 120, stock: 2, is_default: false, is_active: true, attributes: [{ attribute_definition_id: definitionId, attribute_value_id: valueId }] }])).rows[0].id;
    await db.query("select catalog_archive_variant($1,null)", [variantId]);
    await db.query("set constraints all immediate");
    await db.query("set constraints all deferred");
    expect((await db.query("select sku,is_active from product_variants where id=$1", [variantId])).rows[0]).toMatchObject({ sku: product.variants[0].sku.toUpperCase(), is_active: false });
    await db.query("savepoint archived_sku");
    await expect(db.query("select catalog_create_variant($1,$2::jsonb,null)", [created.product_id, { ...product.variants[0], is_default: false, attributes: [{ attribute_definition_id: definitionId, attribute_value_id: valueId }] }])).rejects.toMatchObject({ code: "23505" });
    await db.query("rollback to archived_sku");

    await db.query("savepoint last_variant");
    await db.query("select catalog_archive_variant($1,null)", [replacementId]);
    await expect(db.query("set constraints all immediate")).rejects.toMatchObject({ code: "23514" });
    await db.query("rollback to last_variant");

    await db.query("savepoint customer_write");
    await db.query("set local role authenticated");
    await expect(db.query("insert into product_variants(product_id,sku,base_price,stock,combination_fingerprint) values($1,$2,1,1,'x')", [created.product_id, `DENIED-${randomUUID()}`])).rejects.toBeTruthy();
    await db.query("rollback to customer_write");
  }), 30_000);
});
