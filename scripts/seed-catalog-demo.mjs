import pg from "pg";
import { randomUUID } from "node:crypto";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required.");
const catalogEnvironment = (process.env.CATALOG_MEDIA_ENV || "").toLowerCase();
if (process.env.NODE_ENV === "production" || !["development", "staging", "test"].includes(catalogEnvironment)) {
  throw new Error("Demo catalog is restricted to an explicit development, staging, or test environment.");
}

const remove = process.argv.includes("--remove");
const db = new pg.Client({ connectionString: url });
await db.connect();

async function removeDemo() {
  const { rows } = await db.query("select id from public.products where slug like 'feature-003-demo-%'");
  const ids = rows.map((row) => row.id);
  if (!ids.length) return;
  await db.query("delete from public.variant_media where variant_id in (select id from public.product_variants where product_id = any($1::uuid[]))", [ids]);
  await db.query("delete from public.variant_attribute_values where variant_id in (select id from public.product_variants where product_id = any($1::uuid[]))", [ids]);
  await db.query("delete from public.product_variants where product_id = any($1::uuid[])", [ids]);
  await db.query("delete from public.product_media where product_id = any($1::uuid[])", [ids]);
  await db.query("delete from public.product_specifications where product_id = any($1::uuid[])", [ids]);
  await db.query("delete from public.catalog_audit_events where target_id = any($1::uuid[])", [ids]);
  await db.query("delete from public.products where id = any($1::uuid[])", [ids]);
}

try {
  await db.query("begin");
  await removeDemo();
  if (!remove) {
    const category = (await db.query(`insert into public.categories(slug,name_en,name_ar,is_active,sort_order) values('feature-003-demo-supplements','Feature 003 Demo Supplements','مكملات تجريبية لميزة 003',true,999) on conflict(slug) do update set is_active=true returning id`)).rows[0];
    const brand = (await db.query(`insert into public.brands(slug,name_en,name_ar,is_active) values('feature-003-demo-brand','Feature 003 Demo','علامة تجريبية 003',true) on conflict(slug) do update set is_active=true returning id`)).rows[0];
    const weight = (await db.query(`insert into public.attribute_definitions(code,label_en,label_ar,value_type,unit,is_variant_defining,is_filterable) values('f003_weight','Weight','الوزن','option',null,true,true) on conflict(code) do update set is_active=true returning id`)).rows[0];
    const flavor = (await db.query(`insert into public.attribute_definitions(code,label_en,label_ar,value_type,is_variant_defining,is_filterable) values('f003_flavor','Flavor','النكهة','option',true,true) on conflict(code) do update set is_active=true returning id`)).rows[0];
    const option = async (definitionId, code, en, ar, order) => (await db.query(`insert into public.attribute_values(attribute_definition_id,code,label_en,label_ar,sort_order,is_active) values($1,$2,$3,$4,$5,true) on conflict(attribute_definition_id,code) do update set is_active=true returning id`, [definitionId, code, en, ar, order])).rows[0].id;
    const twoLb = await option(weight.id, "2lb", "2 LB", "2 رطل", 0);
    const fiveLb = await option(weight.id, "5lb", "5 LB", "5 أرطال", 1);
    const chocolate = await option(flavor.id, "chocolate", "Chocolate", "شوكولاتة", 0);
    const vanilla = await option(flavor.id, "vanilla", "Vanilla", "فانيليا", 1);
    const products = [
      { slug: "feature-003-demo-protein", name_en: "Demo Protein Powder", name_ar: "مسحوق بروتين تجريبي", variants: [["2LB-CHOC", 850, twoLb, chocolate], ["2LB-VAN", 850, twoLb, vanilla], ["5LB-CHOC", 1750, fiveLb, chocolate], ["5LB-VAN", 1750, fiveLb, vanilla]].map(([sku, price, weightValue, flavorValue], index) => ({ sku: `F003-DEMO-${sku}`, base_price: price, stock: 12, is_active: true, is_default: index === 0, label_en: String(sku).replace("-", " / "), label_ar: String(sku), attributes: [{ attribute_definition_id: weight.id, attribute_value_id: weightValue }, { attribute_definition_id: flavor.id, attribute_value_id: flavorValue }] })) },
      { slug: "feature-003-demo-creatine", name_en: "Demo Creatine", name_ar: "كرياتين تجريبي", sku: "CREATINE", price: 620 },
      { slug: "feature-003-demo-capsules", name_en: "Demo Capsules", name_ar: "كبسولات تجريبية", sku: "CAPSULES", price: 390 },
      { slug: "feature-003-demo-tablets", name_en: "Demo Tablet Strips", name_ar: "شرائط أقراص تجريبية", sku: "TABLETS", price: 240 },
      { slug: "feature-003-demo-liquid", name_en: "Demo Liquid Supplement", name_ar: "مكمل سائل تجريبي", sku: "LIQUID", price: 310 },
    ];
    const packagingShapes = {
      "feature-003-demo-protein": [["Carton", "كرتونة", null, 1, true, false], ["Box", "علبة", 0, 12, true, false], ["Sachet", "كيس", 1, 30, false, true]],
      "feature-003-demo-creatine": [["Box", "علبة", null, 1, true, false], ["Ampoule", "أمبول", 0, 4, true, true]],
      "feature-003-demo-capsules": [["Bottle", "زجاجة", null, 1, true, false], ["Capsule", "كبسولة", 0, 60, false, true]],
      "feature-003-demo-tablets": [["Box", "علبة", null, 1, true, false], ["Strip", "شريط", 0, 5, true, false], ["Tablet", "قرص", 1, 10, true, true]],
      "feature-003-demo-liquid": [["Bottle", "زجاجة", null, 1, true, false], ["ml", "مل", 0, 500, false, true]],
    };
    for (const product of products) {
      const variants = product.variants ?? [{ sku: `F003-DEMO-${product.sku}`, base_price: product.price, stock: 20, is_active: true, is_default: true, label_en: "Default", label_ar: "افتراضي", attributes: [] }];
      const productId = (await db.query("select public.catalog_create_product($1::jsonb,null) result", [{ slug: product.slug, category_id: category.id, brand_id: brand.id, name_en: product.name_en, name_ar: product.name_ar, short_desc_en: "Feature 003 non-production demo", short_desc_ar: "بيانات تجريبية غير إنتاجية لميزة 003", long_desc_en: "", long_desc_ar: "", is_active: true, is_featured: false, variants, specifications: [] }])).rows[0].result.product_id;
      const variantRows = (await db.query("select id,sku from public.product_variants where product_id=$1 order by created_at", [productId])).rows;
      const shape = packagingShapes[product.slug];
      for (const variant of variantRows) {
        const ids = shape.map(() => randomUUID());
        const units = shape.map(([label_en, label_ar, parentIndex, quantity, sellable, base], index) => ({
          id: ids[index], parent_unit_id: parentIndex === null ? null : ids[parentIndex], code: `${variant.sku}-${String(label_en).toUpperCase()}`,
          barcode: null, label_en, label_ar, quantity_per_parent: { numerator: quantity, denominator: 1 },
          is_base_unit: base, is_sellable: sellable, is_default_sale_unit: index === 0,
          default_price_mode: index === 0 ? "explicit" : "derived", is_active: true,
        }));
        await db.query("select public.catalog_replace_packaging_units($1,$2::jsonb,null)", [variant.id, JSON.stringify(units)]);
      }
    }
  }
  await db.query("commit");
  console.log(remove ? "Feature 003 demo catalog removed." : "Feature 003 five-shape demo catalog seeded.");
} catch (error) {
  await db.query("rollback");
  throw error;
} finally {
  await db.end();
}
