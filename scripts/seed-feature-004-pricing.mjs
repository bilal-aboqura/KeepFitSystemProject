import pg from "pg";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required.");
const pricingEnvironment = (process.env.PRICING_FIXTURE_ENV || "").toLowerCase();
if (process.env.NODE_ENV === "production" || !["development", "staging", "test"].includes(pricingEnvironment)) {
  throw new Error("Feature 004 pricing fixtures require an explicit development, staging, or test environment.");
}

const remove = process.argv.includes("--remove");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin");
  const fixtureCodes = ["feature-004-retail", "feature-004-wholesale", "feature-004-gym", "feature-004-direct"];
  await client.query("delete from public.customer_unit_price_overrides where reason like 'Feature 004 fixture:%'");
  await client.query("update public.customers set direct_price_list_id=null where direct_price_list_id in (select id from public.price_lists where code=any($1))", [fixtureCodes]);
  await client.query("delete from public.customer_type_price_list_mappings where price_list_id in (select id from public.price_lists where code=any($1))", [fixtureCodes]);
  await client.query("delete from public.price_list_items where price_list_id in (select id from public.price_lists where code=any($1))", [fixtureCodes]);
  await client.query("delete from public.price_lists where code=any($1)", [fixtureCodes]);
  await client.query(`
    update public.variant_packaging_units parent set is_base_unit=true,base_quantity_num=1,base_quantity_den=1
    where parent.id in (select child.parent_unit_id from public.variant_packaging_units child where child.code like 'feature-004-derived-%')
  `);
  await client.query("delete from public.variant_packaging_units where code like 'feature-004-derived-%'");
  await client.query("delete from public.customers where email='feature-004-pricing@example.invalid'");
  if (remove) {
    await client.query("commit");
    console.log("Feature 004 pricing fixtures removed.");
  } else {
    const targets = (await client.query(`
      select variant.id as variant_id, variant.base_price,
        unit.id as sellable_unit_id, unit.base_quantity_num, unit.base_quantity_den
      from public.product_variants variant
      join public.variant_packaging_units unit on unit.variant_id = variant.id
      where variant.is_active and variant.archived_at is null
        and unit.is_active and unit.archived_at is null
        and unit.is_sellable and unit.is_default_sale_unit
        and unit.is_base_unit and unit.parent_unit_id is null
        and (select count(*) from public.variant_packaging_units sibling
          where sibling.variant_id=variant.id and sibling.is_active and sibling.archived_at is null)=1
      order by variant.created_at limit 2
    `)).rows;
    if (!targets.length) throw new Error("Feature 004 fixtures require an active Variant with a default Sellable Unit.");

    const listRows = (await client.query(`
      insert into public.price_lists(code,name_en,name_ar)
      values
        ('feature-004-retail','Feature 004 Retail','تجزئة - الميزة 004'),
        ('feature-004-wholesale','Feature 004 Wholesale','جملة - الميزة 004'),
        ('feature-004-gym','Feature 004 Gym','جيم - الميزة 004'),
        ('feature-004-direct','Feature 004 Direct','قائمة مباشرة - الميزة 004')
      returning id,code
    `)).rows;
    const lists = Object.fromEntries(listRows.map((row) => [row.code, row.id]));
    const primary = targets[0];
    const secondary = targets[1] ?? primary;
    const baseMinor = Math.max(100, Math.round(Number(primary.base_price) * 100));

    await client.query(`
      insert into public.price_list_items(price_list_id,variant_id,sellable_unit_id,amount_minor)
      values ($1,$2,$3,$4),($5,$2,$3,$6),($7,$2,$3,$8),($9,$10,$11,$12)
    `, [
      lists["feature-004-retail"], primary.variant_id, primary.sellable_unit_id, baseMinor,
      lists["feature-004-wholesale"], Math.max(1, Math.round(baseMinor * 0.82)),
      lists["feature-004-gym"], Math.max(1, Math.round(baseMinor * 0.88)),
      lists["feature-004-direct"], secondary.variant_id, secondary.sellable_unit_id,
      Math.max(1, Math.round(Number(secondary.base_price) * 95)),
    ]);

    await client.query(`
      update public.variant_packaging_units
      set is_base_unit=false,base_quantity_num=4,base_quantity_den=1
      where id=$1
    `, [primary.sellable_unit_id]);
    const derivedUnit = (await client.query(`
      insert into public.variant_packaging_units(
        variant_id,parent_unit_id,code,label_en,label_ar,quantity_per_parent_num,quantity_per_parent_den,
        base_quantity_num,base_quantity_den,is_base_unit,is_sellable,is_default_sale_unit,default_price_mode
      ) values ($1,$2,$3,'Feature 004 piece','قطعة الميزة 004',4,1,1,1,true,true,false,'derived')
      returning id
    `, [primary.variant_id, primary.sellable_unit_id, `feature-004-derived-${primary.variant_id.slice(0, 8)}`])).rows[0];

    await client.query(`
      insert into public.price_list_items(price_list_id,variant_id,sellable_unit_id,amount_minor,valid_from,valid_until)
      values ($1,$2,$3,$4,now() + interval '7 days',now() + interval '30 days')
    `, [lists["feature-004-retail"], primary.variant_id, derivedUnit.id, Math.max(1, Math.round(baseMinor / 4) + 25)]);

    await client.query(`
      insert into public.customer_type_price_list_mappings(customer_type_id,price_list_id)
      select id, case code when 'retail' then $1::uuid when 'wholesale' then $2::uuid else $3::uuid end
      from public.customer_types type
      where code in ('retail','wholesale','gym_owner') and is_active
        and not exists (select 1 from public.customer_type_price_list_mappings mapping
          where mapping.customer_type_id=type.id and mapping.is_active and mapping.archived_at is null)
    `, [lists["feature-004-retail"], lists["feature-004-wholesale"], lists["feature-004-gym"]]);

    const customer = (await client.query(`
      insert into public.customers(full_name,email,phone,customer_type_id,direct_price_list_id)
      select 'Feature 004 Pricing','feature-004-pricing@example.invalid','01000000004',id,$1
      from public.customer_types where code='retail'
      returning id
    `, [lists["feature-004-direct"]])).rows[0];
    if (!customer) throw new Error("Feature 004 fixtures require the Retail customer type.");
    await client.query(`
      insert into public.customer_unit_price_overrides(customer_id,variant_id,sellable_unit_id,amount_minor,reason)
      values ($1,$2,$3,$4,'Feature 004 fixture: customer override')
    `, [customer.id, primary.variant_id, derivedUnit.id, Math.max(1, Math.round(baseMinor / 4) - 25)]);

    await client.query("commit");
    console.log("Feature 004 pricing fixtures seeded: Retail, Wholesale, Gym, direct, override, derived, fallback, and scheduled cases.");
  }
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
