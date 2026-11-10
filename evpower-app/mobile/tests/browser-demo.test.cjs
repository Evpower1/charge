const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {webcrypto,randomUUID}=require('node:crypto');
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/browser-demo.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const KEY='evpower.browser-demo.v1';
const DEFER=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
function harness({storage=new Map(),denyStorage=false,crypto=webcrypto}={}){
  const module={exports:{}};let network=0;
  const localStorage={getItem:key=>{if(denyStorage)throw new Error('Denied');return storage.get(key)||null;},setItem:(key,value)=>{if(denyStorage)throw new Error('Denied');storage.set(key,value);},removeItem:key=>{if(denyStorage)throw new Error('Denied');storage.delete(key);}};
  vm.runInNewContext(source,{module,exports:module.exports,localStorage,crypto,TextEncoder,Uint8Array,fetch(){network++;throw new Error('No network is allowed');}});
  const request=module.exports.browserDemoRequest;
  return{request,reset:module.exports.resetBrowserDemo,storage,get network(){return network;},session:()=>request('/v1/demo/session',{method:'POST'})};
}
test('browser demo is isolated, sample-only and never stores plaintext passwords',async()=>{
  const h=harness();const config=await h.request('/v1/config');
  assert.equal(config.isBrowserDemo,true);assert.equal(config.paymentsEnabled,false);assert.equal(config.telemetryConfigured,false);
  const session=await h.session();assert.equal(session.user.role,'customer');assert.equal(session.user.emailVerified,false);
  const me=await h.request('/v1/me',{},session.accessToken);assert.equal(me.email,'demo@evpower.test');assert.equal(me.passwordHash,undefined);
  const serialized=h.storage.get(KEY);assert.ok(serialized&&!serialized.includes('EvpowerDemo2026!'));
  const stored=JSON.parse(serialized);assert.match(stored.users[0].passwordHash,/^[0-9a-f]{64}$/);assert.match(stored.users[0].salt,/^[0-9a-f]{32}$/);
  const stations=(await h.request('/v1/stations')).items;assert.equal(stations.length,2);
  for(const item of stations){assert.equal(item.isDemo,true);assert.equal(item.availableCount,0);assert.equal(item.connectors[0].status,'unknown');assert.equal(item.connectors[0].lastSeenAt,null);}
  await assert.rejects(h.request('/v1/wallet/topups',{method:'POST',body:{amountMinor:50000}},session.accessToken),e=>e.code==='DEMO_PAYMENTS_DISABLED');
  await assert.rejects(h.request('/v1/not-implemented',{},session.accessToken),e=>e.code==='DEMO_ROUTE_UNAVAILABLE');assert.equal(h.network,0);
});
test('demo booking requests are idempotent and advance only through the explicit action',async()=>{
  const h=harness();const session=await h.session();const headers={'Idempotency-Key':randomUUID()};
  const body={city:'Addis Ababa',address:'Test pickup in this browser only',connector:'CCS2',requestedKwh:15};
  const booking=await h.request('/v1/bookings',{method:'POST',body,headers},session.accessToken);
  assert.equal(booking.status,'requested');assert.equal(booking.quoteMinor,null);assert.match(booking.events[0].message,/No charging team/);
  const repeated=await h.request('/v1/bookings',{method:'POST',body,headers},session.accessToken);assert.equal(repeated.id,booking.id);
  await assert.rejects(h.request('/v1/bookings',{method:'POST',body:{...body,requestedKwh:30},headers},session.accessToken),e=>e.code==='IDEMPOTENCY_CONFLICT');
  for(const status of ['confirmed','en_route','arrived','charging','completed']){
    const result=await h.request('/v1/demo/advance',{method:'POST'},session.accessToken);assert.equal(result.status,status);assert.equal(result.quoteMinor,0);
  }
  const wallet=await h.request('/v1/wallet',{},session.accessToken);assert.equal(wallet.balanceMinor,0);assert.equal(wallet.transactions.length,0);assert.equal(h.network,0);
});
test('customer data remains owned and deletion removes only that demo account',async()=>{
  const h=harness();const first=await h.session();
  const second=await h.request('/v1/auth/register',{method:'POST',body:{name:'Another test customer',email:'another@example.test',phone:'+251900000009',password:'PrivateDemoPassword2026!'}});
  const vehicle=(await h.request('/v1/vehicles',{},first.accessToken)).items[0];
  await assert.rejects(h.request('/v1/vehicles/'+vehicle.id,{method:'DELETE'},second.accessToken),e=>e.status===404);
  const address=await h.request('/v1/addresses',{method:'POST',body:{label:'Local test',address:'Sample address for local preview',latitude:null,longitude:null}},second.accessToken);
  assert.ok(address.id);assert.equal((await h.request('/v1/addresses',{},first.accessToken)).items.length,0);
  await h.request('/v1/support',{method:'POST',body:{subject:'Demo enquiry',message:'This support note is saved locally only.'}},second.accessToken);
  assert.ok(!h.storage.get(KEY).includes('PrivateDemoPassword2026!'));
  await h.request('/v1/me',{method:'DELETE',body:{password:'PrivateDemoPassword2026!'}},second.accessToken);
  await assert.rejects(h.request('/v1/me',{},second.accessToken),e=>e.status===401);
  const saved=JSON.parse(h.storage.get(KEY));assert.ok(!saved.users.some(item=>item.email==='another@example.test'));assert.ok(!saved.addresses.some(item=>item.userId===second.user.id));
  assert.equal((await h.request('/v1/me',{},first.accessToken)).email,'demo@evpower.test');
});
test('reset preserves unrelated browser keys and prevents an in-flight account from reappearing',async()=>{
  const entered=DEFER(),release=DEFER();let pause=false;
  const crypto={randomUUID,getRandomValues:array=>webcrypto.getRandomValues(array),subtle:{importKey:(...args)=>webcrypto.subtle.importKey(...args),deriveBits:async(...args)=>{if(pause){entered.resolve();await release.promise;}return webcrypto.subtle.deriveBits(...args);}}};
  const storage=new Map([['unrelated-card-setting','keep']]);const h=harness({storage,crypto});await h.request('/v1/config');
  pause=true;
  const pending=h.request('/v1/auth/register',{method:'POST',body:{name:'Reset race',email:'race@example.test',phone:'+251900000007',password:'PrivateResetPassword2026!'}});
  await entered.promise;h.reset();pause=false;release.resolve();
  await assert.rejects(pending,e=>e.code==='DEMO_RESET');assert.equal(storage.get('unrelated-card-setting'),'keep');
  await h.request('/v1/config');assert.ok(!storage.get(KEY).includes('race@example.test'));
});
test('the preview remains usable in memory when browser storage is unavailable',async()=>{
  const h=harness({denyStorage:true});const session=await h.session();
  assert.equal((await h.request('/v1/me',{},session.accessToken)).email,'demo@evpower.test');
  h.reset();await assert.rejects(h.request('/v1/me',{},session.accessToken),e=>e.status===401);assert.equal(h.network,0);
});
