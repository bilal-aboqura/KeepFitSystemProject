import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { testCustomer, withTestDatabase } from "../../helpers/supabase-test-db";

describe("Feature 004 transaction pricing resolver", () => {
  it.skipIf(!process.env.DIRECT_URL)("resolves public, type, direct, override, scheduled, derived, and batched prices", async () => withTestDatabase(async (db) => {
    await db.query(await readFile("supabase/migrations/003b_catalog_packaging_units.sql", "utf8"));
    await db.query(await readFile("supabase/migrations/004_pricing_engine.sql", "utf8"));

    const suffix = randomUUID().replaceAll("-", "");
    const categoryId = randomUUID();
    await db.query("insert into public.categories(id,slug,name_en,name_ar) values($1,$2,'Commerce','تجارة')", [categoryId, `commerce-${suffix}`]);
    const product = {
      slug: `contextual-pricing-${suffix}`,
      category_id: categoryId,
      name_en: "Contextual Price",
      name_ar: "سعر سياقي",
      is_active: true,
      variants: [{ sku: `CTX-${suffix}`, base_price: 100, stock: 100, is_default: true, is_active: true, attributes: [] }],
      specifications: [],
    };
    const created = (await db.query("select public.catalog_create_product($1::jsonb,null) result", [product])).rows[0].result;
    const variantId = created.variant_ids[0] as string;
    const boxId = randomUUID();
    const ampouleId = randomUUID();
    await db.query("select public.catalog_replace_packaging_units($1,$2::jsonb,null)", [variantId, JSON.stringify([
      { id: boxId, parent_unit_id: null, code: `BOX-${suffix}`, label_en: "Box", label_ar: "علبة", quantity_per_parent: { numerator: 1, denominator: 1 }, is_base_unit: false, is_sellable: true, is_default_sale_unit: true, default_price_mode: "explicit", is_active: true },
      { id: ampouleId, parent_unit_id: boxId, code: `AMP-${suffix}`, label_en: "Ampoule", label_ar: "أمبول", quantity_per_parent: { numerator: 4, denominator: 1 }, is_base_unit: true, is_sellable: true, is_default_sale_unit: false, default_price_mode: "derived", is_active: true },
    ])]);

    const defaultListId = (await db.query("select default_price_list_id from public.pricing_configuration where singleton")).rows[0].default_price_list_id;
    await db.query("insert into public.price_list_items(price_list_id,variant_id,sellable_unit_id,amount_minor) values($1,$2,$3,10000)", [defaultListId, variantId, boxId]);

    const contexts = [];
    for (const [index, name] of ["retail", "wholesale", "gym"].entries()) {
      const typeId = randomUUID();
      const listId = randomUUID();
      await db.query("insert into public.customer_types(id,code,name_en,name_ar) values($1,$2,$3,$4)", [typeId, `${name}_${suffix}`, name, name]);
      await db.query("insert into public.price_lists(id,code,name_en,name_ar) values($1,$2,$3,$4)", [listId, `${name}-${suffix}`, name, name]);
      await db.query(`
        insert into public.price_list_items(price_list_id,variant_id,sellable_unit_id,amount_minor,valid_from,valid_until)
        values($1,$2,$3,$4,'2026-01-01T00:00:00Z','2027-01-01T00:00:00Z')
      `, [listId, variantId, boxId, 9000 - index * 1000]);
      await db.query("insert into public.customer_type_price_list_mappings(customer_type_id,price_list_id) values($1,$2)", [typeId, listId]);
      const customer = await testCustomer(db);
      await db.query("update public.customers set customer_type_id=$1 where id=$2", [typeId, customer.id]);
      contexts.push({ ...customer, typeId, listId });
    }

    const resolve = async (customerId: string | null, targets = [{ variantId, sellableUnitId: boxId }]) => (
      await db.query("select public.pricing_resolve_targets($1,$2::jsonb,$3::timestamptz) result", [customerId, JSON.stringify(targets), "2026-09-13T00:00:00Z"])
    ).rows[0].result;

    expect((await resolve(null))[0]).toMatchObject({ source: "default_price_list", amountMinor: "10000", resolutionKind: "explicit" });
    expect((await resolve(contexts[0].id))[0]).toMatchObject({ source: "customer_type_price_list", amountMinor: "9000" });
    expect((await resolve(contexts[1].id))[0]).toMatchObject({ source: "customer_type_price_list", amountMinor: "8000" });
    expect((await resolve(contexts[2].id))[0]).toMatchObject({ source: "customer_type_price_list", amountMinor: "7000" });

    const directListId = randomUUID();
    await db.query("insert into public.price_lists(id,code,name_en,name_ar) values($1,$2,'Direct','مباشر')", [directListId, `direct-${suffix}`]);
    await db.query("insert into public.price_list_items(price_list_id,variant_id,sellable_unit_id,amount_minor) values($1,$2,$3,6000)", [directListId, variantId, boxId]);
    await db.query("update public.customers set direct_price_list_id=$1 where id=$2", [directListId, contexts[1].id]);
    expect((await resolve(contexts[1].id))[0]).toMatchObject({ source: "direct_price_list", amountMinor: "6000" });

    await db.query(`
      insert into public.customer_unit_price_overrides(customer_id,variant_id,sellable_unit_id,amount_minor,reason)
      values($1,$2,$3,5000,'Commerce prerequisite test')
    `, [contexts[2].id, variantId, boxId]);
    expect((await resolve(contexts[2].id))[0]).toMatchObject({ source: "customer_override", amountMinor: "5000" });

    const publicBatch = await resolve(null, [
      { variantId, sellableUnitId: boxId },
      { variantId, sellableUnitId: ampouleId },
      { variantId, sellableUnitId: ampouleId },
    ]);
    expect(publicBatch).toHaveLength(2);
    expect(publicBatch[1]).toMatchObject({ amountMinor: "2500", resolutionKind: "derived", derivedFromUnitId: boxId });
  }), 30_000);
});
