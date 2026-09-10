import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(file, dependencies, globals = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: testModule, exports: testModule.exports, require: (name) => { if (name in dependencies) return dependencies[name]; throw new Error(name); }, ...globals });
  return testModule.exports;
}
const statuses = compile('src/lib/mylerz-status.ts', {});
for (const status of ['Out for delivery', 'Delivery failed', 'Undelivered', 'Returned', 'Not delivered']) assert.notEqual(statuses.mylerzStatusKind(status), 'delivered');
assert.equal(statuses.mylerzStatusKind('Received at Destination HUB - Undelivered (Customer refused)'), 'returned');
assert.equal(statuses.mylerzStatusKind('Delivered'), 'delivered');
assert.equal(statuses.mylerzStatusKind('Confirmed Delivered'), 'delivered');
assert.equal(statuses.mylerzStatusKind('تم تأكيد تسليم الشحنة'), 'delivered');
let calls = [];
let payload;
const api = compile('src/lib/mylerz.ts', { 'server-only': {}, '@/lib/mylerz-status': statuses }, {
  process: { env: { MYLERZ_USERNAME: 'test', MYLERZ_PASSWORD: 'test' } }, URLSearchParams, Headers, AbortSignal, Response, Buffer, Uint8Array, TextDecoder,
  fetch: async (url, options = {}) => {
    calls.push(url);
    if (url.endsWith('/token')) return Response.json({access_token:'test', expires_in:300});
    if (url.endsWith('/GetCityZoneList')) return Response.json({Value:[{Code:'CAI',ArName:'القاهرة',Zones:[{Code:'NASR',ArName:'مدينة نصر'}]}]});
    if (url.endsWith('/AddOrders')) { payload=JSON.parse(options.body)[0]; return Response.json({Value:{Packages:[{BarCode:'TEST123',Status:'Uploaded'}]}}); }
    throw new Error('Unexpected request');
  }
});
const order={id:'test',order_number:'XE-TEST',customer_name:'Test',customer_phone:'+201012345678',alt_phone:'',governorate:'القاهرة',city:'مدينة نصر',address:'Test address',notes:null,grand_total:150,payment_method:'cod',payment_status:'pending',fulfillment_status:'pending',bosta:null,mylerz:null,order_items:[{name_en:'Test product',quantity:2}]};
assert.equal((await api.createMylerzShipment(order)).trackingNumber, 'TEST123');
assert.equal(payload.COD_Value,150);assert.equal(payload.City,'CAI');assert.equal(payload.Neighborhood,'NASR');assert.equal(payload.Mobile_No,'01012345678');assert.equal(payload.Reference,'XE-TEST');
await api.createMylerzShipment({...order,payment_method:'card',payment_status:'paid'});assert.equal(payload.COD_Value,0);assert.equal(payload.Payment_Type,'PP');
const before=calls.length;
await assert.rejects(api.createMylerzShipment({...order,mylerz:{trackingNumber:'existing'}}));
await assert.rejects(api.createMylerzShipment({...order,bosta:{trackingNumber:'existing'}}));
await assert.rejects(api.createMylerzShipment({...order,payment_method:'card',payment_status:'pending'}));
await assert.rejects(api.createMylerzShipment({...order,fulfillment_status:'cancelled'}));
assert.equal(calls.length,before);
assert.equal(api.orderStatusForMylerzStatus('Out for delivery','processing'),'shipped');
assert.equal(api.orderStatusForMylerzStatus('Undelivered','shipped'),'returned');
assert.equal(api.orderStatusForMylerzStatus('Received at Destination HUB - Undelivered (Customer refused)','shipped'),'returned');
assert.equal(api.orderStatusForMylerzStatus('Out for delivery','delivered'),'delivered');
console.log('Mylerz checks passed: payload, COD/prepaid, phones, destinations, duplicate guards, unpaid/cancelled orders, and delivery-state mapping.');
