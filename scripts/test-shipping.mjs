import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(file, dependencies = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require(name) {
    if (!(name in dependencies)) throw new Error(name);
    return dependencies[name];
  } });
  return mod.exports;
}

const policy = compile('src/lib/shipping-policy.ts');
const product = (name, weight = null) => ({ name_ar: name, name_en: name, weight });
for (const name of ['450ml', 'منظف ٤٥٠ مل', '450 ML', '۴۵۰ ml']) {
  assert.equal(policy.is450MlProduct(product(name)), true, name);
}
for (const name of ['1450ml', '0.450 ml', '4500ml', '450kg', '450mls', '1 لتر']) {
  assert.equal(policy.is450MlProduct(product(name)), false, name);
}
assert.equal(policy.is450MlProduct(product('450ml', '1L')), false);
for (const gov of ['أسيوط', 'اسيوط', 'المنيا', 'الأقصر', 'أسوان', 'شمال سيناء', 'جنوب سيناء']) {
  assert.equal(policy.is450MlDestination(gov), false, gov);
}
assert.equal(policy.is450MlDestination('القاهرة'), true);

const small = { id: 'small', ...product('منظف 450 مل') };
const large = { id: 'large', ...product('منظف 1 لتر') };
let requestedIds = [];
let failCatalog = false;
const sb = { from(table) {
  assert.ok(['shipping_rates', 'products'].includes(table));
  return {
    select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ data: { cost: 130 }, error: null }),
    async in(_field, ids) {
      requestedIds = ids;
      return { data: [small, large].filter((p) => ids.includes(p.id)), error: failCatalog ? new Error('Offline') : null };
    },
  };
} };
const orders = compile('src/lib/data/orders.ts', {
  '@/lib/supabase/server': { getSupabaseServiceClient: () => sb },
  '@/lib/data/catalog': {}, '@/lib/pricing': {}, '@/lib/shipping-policy': policy,
});
const quote = (ids, gov = 'القاهرة') => orders.getShippingCostForProducts(gov, 'test', ids);
assert.equal((await quote(['small'])).cost, 80);
assert.equal((await quote(['small', 'small'])).cost, 80);
assert.equal(requestedIds.length, 1);
assert.equal((await quote(['small', 'large'])).cost, 130);
assert.equal((await quote(['large'])).cost, 130);
assert.equal((await quote(['small'], 'أسيوط')).cost, 130);
assert.equal((await quote(['small'], 'شمال سيناء')).cost, 130);
assert.equal((await quote([])).cost, 130);
assert.equal((await quote(['small', null])).cost, 130);
await assert.rejects(quote(['small', 'missing']));
failCatalog = true;
await assert.rejects(quote(['small']));
console.log('Shipping checks passed: sizes, Arabic digits, exclusions, mixed carts, quantities, unknown products, and database failure.');
