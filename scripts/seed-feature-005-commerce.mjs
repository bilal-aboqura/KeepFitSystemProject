import pg from "pg";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is required.");
const fixtureEnvironment = (process.env.COMMERCE_FIXTURE_ENV || process.env.PRICING_FIXTURE_ENV || "").toLowerCase();
if (process.env.NODE_ENV === "production" || !["development", "staging", "test"].includes(fixtureEnvironment)) {
  throw new Error("Feature 005 commerce fixtures require an explicit development, staging, or test environment.");
}
const remove = process.argv.includes("--remove");
const marker = "Feature 005 fixture:";
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin");
  const fixtureRuleIds = (await client.query("select distinct rule_id from public.quantity_rule_audit_events where reason like $1", [`${marker}%`])).rows.map((row) => row.rule_id);
  await client.query("delete from public.quantity_rule_audit_events where reason like $1", [`${marker}%`]);
  if (fixtureRuleIds.length) await client.query("delete from public.commerce_quantity_rules where id=any($1::uuid[])", [fixtureRuleIds]);
  if (!remove) {
    const targets = (await client.query(`select variant_id,id sellable_unit_id from public.variant_packaging_units where is_active and archived_at is null and is_sellable order by created_at limit 2`)).rows;
    if (!targets.length) throw new Error("Feature 005 fixtures require at least one active Sellable Unit.");
    const contexts = (await client.query("select id,code from public.customer_types where code in ('retail','wholesale','gym_owner') and is_active")).rows;
    const contextByCode = Object.fromEntries(contexts.map((row) => [row.code, row.id]));
    const values = [
      ["public", null, 1, 1],
      ["customer_type", contextByCode.retail, 1, 1],
      ["customer_type", contextByCode.wholesale, 6, 2],
      ["customer_type", contextByCode.gym_owner, 4, 2],
    ].filter(([, customerTypeId]) => customerTypeId !== undefined);
    for (const target of targets) {
      for (const [contextKind, customerTypeId, minimum, increment] of values) {
        const rule = (await client.query(`insert into public.commerce_quantity_rules(context_kind,customer_type_id,variant_id,sellable_unit_id,minimum_quantity,quantity_increment) values($1,$2,$3,$4,$5,$6) returning id`, [contextKind, customerTypeId, target.variant_id, target.sellable_unit_id, minimum, increment])).rows[0];
        await client.query(`insert into public.quantity_rule_audit_events(rule_id,action,context_kind,customer_type_id,variant_id,sellable_unit_id,new_state,reason) values($1,'created',$2,$3,$4,$5,$6,$7)`, [rule.id, contextKind, customerTypeId, target.variant_id, target.sellable_unit_id, { minimumQuantity: minimum, quantityIncrement: increment }, `${marker} removable ${contextKind}`]);
      }
    }
  }
  await client.query("commit");
  console.log(remove ? "Feature 005 commerce fixtures removed." : "Feature 005 public, Retail, Wholesale, and Gym quantity fixtures seeded.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
