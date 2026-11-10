import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp, environmentConfig } from '../src/app.mjs';
import { hashPassword } from '../src/auth.mjs';

const PASSWORD='Correct-demo-password-123';
async function harness(t,overrides={}) {
  const sent=[],payments=new Map();let milliseconds=Date.parse('2026-11-10T08:00:00Z');
  const provider={async initialize(input){payments.set(input.reference,{status:'success',reference:input.reference,amount:(input.amountMinor/100).toFixed(2),currency:'ETB'});return{checkoutUrl:'https://checkout.chapa.co/test/'+input.reference};},async verify(ref){return payments.get(ref);}};
  const app=await buildApp({databasePath:':memory:',env:{},now:()=>milliseconds,config:{telemetryKey:'test-telemetry-key',chapaWebhookSecret:'test-webhook-key'},mailer:{async send(message){sent.push(message);}},paymentProvider:provider,...overrides});
  t.after(()=>app.close());
  const request=async(method,url,payload,session,headers={})=>{const result=await app.inject({method,url,...(payload!==undefined?{payload}:{}),headers:{...(session?{authorization:'Bearer '+session.accessToken}:{}),...headers}});return{status:result.statusCode,body:result.json()};};
  const register=async(email='customer@example.com')=>{const response=await request('POST','/v1/auth/register',{name:'Customer Example',email,phone:'+251911000001',password:PASSWORD});assert.equal(response.status,201,JSON.stringify(response.body));return response.body;};
  const admin=async()=>{const encoded=await hashPassword(PASSWORD),uid=randomUUID();app.db.prepare("INSERT INTO users(id,name,email,phone,password_hash,role,email_verified,created_at) VALUES(?,'Operator','operator@example.com','+251911000002',?,'admin',1,?)").run(uid,encoded,new Date(milliseconds).toISOString());app.db.prepare('INSERT INTO balances(user_id) VALUES(?)').run(uid);return(await request('POST','/v1/auth/login',{email:'operator@example.com',password:PASSWORD})).body;};
  const verify=async(session)=>{const code=sent.findLast(x=>x.to===session.user.email&&x.kind==='verify').actionToken;assert.equal((await request('POST','/v1/auth/verify-email',{token:code})).status,200);};
  const topup=async(session,amountMinor)=>{const response=await request('POST','/v1/wallet/topups',{amountMinor},session);assert.equal(response.status,201,JSON.stringify(response.body));return response.body;};
  return{app,request,register,admin,verify,topup,sent,payments,advance:ms=>milliseconds+=ms};
}

test('secure auth, rotating refresh replay, reset and verification are one-time',async t=>{
  const h=await harness(t);const user=await h.register();
  assert.equal(user.user.role,'customer');assert.equal(user.user.emailVerified,false);
  assert.equal((await h.request('GET','/v1/me',undefined,user)).status,200);
  assert.equal((await h.request('GET','/v1/admin/overview',undefined,user)).status,403);
  assert.equal((await h.request('POST','/v1/auth/register',{name:'Hack',email:'hack@example.com',phone:'+251911000003',password:PASSWORD,role:'admin'})).status,400);
  const verifyToken=h.sent[0].actionToken;
  assert.equal((await h.request('POST','/v1/auth/verify-email',{token:verifyToken})).status,200);
  assert.equal((await h.request('POST','/v1/auth/verify-email',{token:verifyToken})).status,400);
  const rotated=await h.request('POST','/v1/auth/refresh',{refreshToken:user.refreshToken});assert.equal(rotated.status,200);
  assert.notEqual(rotated.body.refreshToken,user.refreshToken);
  assert.equal((await h.request('GET','/v1/me',undefined,user)).status,401);
  assert.equal((await h.request('POST','/v1/auth/refresh',{refreshToken:user.refreshToken})).status,401);
  assert.equal((await h.request('GET','/v1/me',undefined,rotated.body)).status,401,'Replay revokes the whole refresh family');
  const unknown=await h.request('POST','/v1/auth/password-reset',{email:'nobody@example.com'});
  const known=await h.request('POST','/v1/auth/password-reset',{email:user.user.email});assert.deepEqual(known.body,unknown.body);
  assert.ok(!JSON.stringify(known.body).includes('token'));
  const reset=h.sent.findLast(x=>x.kind==='reset').actionToken;
  assert.equal((await h.request('POST','/v1/auth/password-reset/complete',{token:reset,password:'Replacement-password-456'})).status,200);
  assert.equal((await h.request('POST','/v1/auth/password-reset/complete',{token:reset,password:'Another-password-789'})).status,400);
  assert.equal((await h.request('POST','/v1/auth/login',{email:user.user.email,password:PASSWORD})).status,401);
  assert.equal((await h.request('POST','/v1/auth/login',{email:user.user.email,password:'Replacement-password-456'})).status,200);
});

test('owned vehicles/addresses/bookings reject cross-account access and duplicate requests',async t=>{
  const h=await harness(t);const a=await h.register(),b=await h.register('second@example.com');
  const vehicle=(await h.request('POST','/v1/vehicles',{make:'BYD',model:'Atto 3',plate:'ABC123',connector:'CCS2',batteryKwh:60},a)).body;
  assert.equal((await h.request('PATCH','/v1/vehicles/'+vehicle.id,{model:'Atto'},a)).status,200);
  assert.equal((await h.request('PATCH','/v1/vehicles/'+vehicle.id,{model:'Stolen'},b)).status,404);
  const address=(await h.request('POST','/v1/addresses',{label:'Home',address:'Bole, Addis Ababa',latitude:9,longitude:38},a)).body;
  assert.equal((await h.request('DELETE','/v1/addresses/'+address.id,undefined,b)).status,404);
  const data={city:'Addis Ababa',address:'Bole, Addis Ababa',connector:'CCS2',requestedKwh:20,vehicleId:vehicle.id};const key=randomUUID();
  const booked=await h.request('POST','/v1/bookings',data,a,{'idempotency-key':key});assert.equal(booked.status,201,JSON.stringify(booked.body));
  const repeat=await h.request('POST','/v1/bookings',data,a,{'idempotency-key':key});assert.equal(repeat.body.id,booked.body.id);
  assert.equal((await h.request('POST','/v1/bookings',{...data,requestedKwh:30},a,{'idempotency-key':key})).status,409);
  assert.equal((await h.request('POST','/v1/bookings',data,b,{'idempotency-key':randomUUID()})).status,400);
  assert.equal((await h.request('GET','/v1/bookings/'+booked.body.id,undefined,b)).status,404);
  assert.equal((await h.request('POST','/v1/bookings/'+booked.body.id+'/pay',{},a)).status,409);
  assert.equal((await h.request('POST','/v1/bookings',{...data,latitude:9},a,{'idempotency-key':randomUUID()})).status,400);
  assert.equal((await h.request('POST','/v1/bookings',{...data,scheduledAt:'2026-11-09T00:00:00Z'},a,{'idempotency-key':randomUUID()})).status,400);
});

test('verified wallet credits are exact, signed, idempotent and immutable; debit/refund once',async t=>{
  const h=await harness(t);const a=await h.register(),operator=await h.admin();
  assert.equal((await h.request('POST','/v1/wallet/topups',{amountMinor:50000},a)).status,403);
  await h.verify(a);const payment=await h.topup(a,50000);
  assert.equal((await h.request('GET','/v1/wallet',undefined,a)).body.pendingTopups[0].id,payment.id,'Pending checkout survives screen navigation/relaunch');
  h.payments.set(payment.reference,{status:'success',reference:payment.reference,amount:'500.01',currency:'ETB'});
  assert.equal((await h.request('POST','/v1/wallet/topups/'+payment.id+'/verify',{},a)).status,409);
  assert.equal((await h.request('GET','/v1/wallet',undefined,a)).body.balanceMinor,0);
  h.payments.set(payment.reference,{status:'success',reference:payment.reference,amount:'500.00',currency:'ETB'});
  const raw=JSON.stringify({tx_ref:payment.reference});
  assert.equal((await h.request('POST','/v1/payments/chapa/webhook',{tx_ref:payment.reference})).status,401);
  const signature=createHmac('sha256','test-webhook-key').update(raw).digest('hex');
  const webhook=()=>h.request('POST','/v1/payments/chapa/webhook',JSON.parse(raw),null,{'chapa-signature':signature});
  const results=await Promise.all([webhook(),webhook(),h.request('POST','/v1/wallet/topups/'+payment.id+'/verify',{},a)]);
  assert.ok(results.every(x=>x.status===200),JSON.stringify(results));
  let wallet=(await h.request('GET','/v1/wallet',undefined,a)).body;assert.equal(wallet.balanceMinor,50000);assert.equal(wallet.transactions.length,1);
  assert.equal(wallet.pendingTopups.length,0);
  assert.throws(()=>h.app.db.prepare('UPDATE ledger SET amount_minor=1').run(),/append-only/);
  assert.throws(()=>h.app.db.prepare('DELETE FROM ledger').run(),/append-only/);
  const booking=(await h.request('POST','/v1/bookings',{city:'Adama',address:'Adama service pickup point',connector:'CCS2',requestedKwh:20},a,{'idempotency-key':randomUUID()})).body;
  assert.equal((await h.request('PATCH','/v1/admin/bookings/'+booking.id,{status:'charging'},operator)).status,409);
  assert.equal((await h.request('PATCH','/v1/admin/bookings/'+booking.id,{status:'confirmed',quoteMinor:30000},operator)).status,200);
  assert.equal((await h.request('PATCH','/v1/admin/bookings/'+booking.id,{status:'en_route'},operator)).status,409);
  const paid=await Promise.all([h.request('POST','/v1/bookings/'+booking.id+'/pay',{},a),h.request('POST','/v1/bookings/'+booking.id+'/pay',{},a)]);assert.ok(paid.every(x=>x.status===200));
  assert.equal((await h.request('GET','/v1/wallet',undefined,a)).body.balanceMinor,20000);
  assert.equal((await h.request('PATCH','/v1/admin/bookings/'+booking.id,{quoteMinor:1000},operator)).status,409);
  await h.request('POST','/v1/bookings/'+booking.id+'/cancel',{},a);await h.request('POST','/v1/bookings/'+booking.id+'/cancel',{},a);
  wallet=(await h.request('GET','/v1/wallet',undefined,a)).body;assert.equal(wallet.balanceMinor,50000);assert.equal(wallet.transactions.length,3);
  assert.equal((await h.request('DELETE','/v1/me',{password:PASSWORD},a)).status,409,'Account deletion cannot discard credit');
});

test('insufficient balance never debits; valid dispatch and completion flow records events',async t=>{
  const h=await harness(t);const a=await h.register(),operator=await h.admin();
  const booking=(await h.request('POST','/v1/bookings',{city:'Addis Ababa',address:'A real pickup address',connector:'Type2',requestedKwh:10},a,{'idempotency-key':randomUUID()})).body;
  await h.request('PATCH','/v1/admin/bookings/'+booking.id,{status:'confirmed',quoteMinor:40000},operator);
  assert.equal((await h.request('POST','/v1/bookings/'+booking.id+'/pay',{},a)).status,409);assert.equal((await h.request('GET','/v1/wallet',undefined,a)).body.transactions.length,0);
  await h.request('PATCH','/v1/admin/bookings/'+booking.id,{quoteMinor:0},operator);
  for(const status of ['en_route','arrived','charging','completed'])assert.equal((await h.request('PATCH','/v1/admin/bookings/'+booking.id,{status,dispatchName:'Driver One',dispatchPhone:'+251911000004'},operator)).status,200);
  assert.equal((await h.request('POST','/v1/bookings/'+booking.id+'/cancel',{},a)).status,409);
  assert.equal((await h.request('GET','/v1/bookings/'+booking.id,undefined,a)).body.events.at(-1).status,'completed');
  const notes=(await h.request('GET','/v1/notifications',undefined,a)).body.items;assert.ok(notes.length>=5);
  assert.equal((await h.request('POST','/v1/notifications/'+notes[0].id+'/read',{},a)).status,200);
  assert.equal((await h.request('DELETE','/v1/me',{password:PASSWORD},a)).status,200);
  assert.equal((await h.request('GET','/v1/me',undefined,a)).status,401);
  const retained=h.app.db.prepare('SELECT address,notes FROM bookings WHERE id=?').get(booking.id);assert.equal(retained.address,'[deleted]');
});

test('pending payments block deletion and late verified payments never credit deleted accounts',async t=>{
  const h=await harness(t);const a=await h.register();await h.verify(a);const payment=await h.topup(a,10000);
  assert.equal((await h.request('DELETE','/v1/me',{password:PASSWORD},a)).body.error.code,'PAYMENT_PENDING');
  // Simulate a legacy/out-of-band deletion; the webhook must route funds to review.
  h.app.db.prepare('UPDATE users SET deleted=1 WHERE id=?').run(a.user.id);
  const raw=JSON.stringify({tx_ref:payment.reference});const signature=createHmac('sha256','test-webhook-key').update(raw).digest('hex');
  const response=await h.request('POST','/v1/payments/chapa/webhook',JSON.parse(raw),null,{'chapa-signature':signature});
  assert.equal(response.status,200);assert.equal(response.body.status,'manual_review');
  assert.equal(h.app.db.prepare('SELECT count(*) AS n FROM ledger').get().n,0);
  assert.equal(h.app.db.prepare('SELECT balance_minor FROM balances WHERE user_id=?').get(a.user.id).balance_minor,0);
  assert.equal(h.app.db.prepare('SELECT status FROM topups WHERE id=?').get(payment.id).status,'manual_review');
  await h.request('POST','/v1/payments/chapa/webhook',JSON.parse(raw),null,{'chapa-signature':signature});
  assert.equal(h.app.db.prepare('SELECT count(*) AS n FROM tickets').get().n,1);
});

test('real status ingestion is authenticated and monotonic; no telemetry or stale telemetry is unknown',async t=>{
  const h=await harness(t);const operator=await h.admin();
  assert.deepEqual((await h.request('GET','/v1/stations')).body.items,[],'No fabricated production stations');
  const data={name:'Verified testing station',city:'Addis Ababa',address:'Operator-verified location',latitude:9.01,longitude:38.76,verified:false,connectors:[{id:'one',type:'CCS2',powerKw:60}]};
  const station=await h.request('POST','/v1/admin/stations',data,operator);assert.equal(station.status,201,JSON.stringify(station.body));
  assert.equal((await h.request('GET','/v1/stations')).body.items.length,0);
  assert.equal((await h.request('GET','/v1/admin/stations',undefined,operator)).body.items.length,1);
  await h.request('PATCH','/v1/admin/stations/'+station.body.id,{verified:true},operator);
  assert.equal((await h.request('GET','/v1/stations')).body.items[0].connectors[0].status,'unknown');
  const event={eventId:randomUUID(),stationId:station.body.id,connectorId:'one',status:'available',observedAt:'2026-11-10T08:00:00Z'};
  assert.equal((await h.request('POST','/v1/integrations/charger-status',event)).status,401);
  const ingest=e=>h.request('POST','/v1/integrations/charger-status',e,null,{authorization:'Bearer test-telemetry-key'});
  assert.equal((await ingest(event)).status,200);
  assert.equal((await h.request('GET','/v1/stations')).body.items[0].availableCount,1);
  assert.equal((await ingest(event)).status,409);
  assert.equal((await ingest({...event,eventId:randomUUID(),observedAt:'2026-11-10T07:59:59Z'})).status,409);
  assert.equal((await ingest({...event,eventId:randomUUID(),observedAt:'2026-11-10T08:01:00Z'})).status,400);
  h.advance(121000);const stale=(await h.request('GET','/v1/stations')).body.items[0];assert.equal(stale.availableCount,0);assert.equal(stale.connectors[0].status,'unknown');
});

test('disabled integrations and durable sessions remain safe by default',async t=>{
  assert.equal(environmentConfig({CHAPA_SECRET_KEY:'inherited-secret-not-used'}).chapaSecret,'');
  assert.throws(()=>environmentConfig({NODE_ENV:'production'}),/requires/);
  assert.throws(()=>environmentConfig({PAYMENTS_ENABLED:'true',CHAPA_SECRET_KEY:'placeholder'}),/Payments require/);
  assert.throws(()=>environmentConfig({TRUSTED_PROXY_IPS:'*'}),/exact IP/);
  assert.deepEqual(environmentConfig({TRUSTED_PROXY_IPS:'127.0.0.1,::1'}).trustedProxyIps,['127.0.0.1','::1']);
  const dir=await mkdtemp(join(tmpdir(),'evpower-api-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'db.sqlite');
  const first=await buildApp({databasePath:path,env:{},paymentProvider:null,mailer:null});
  const response=await first.inject({method:'POST',url:'/v1/auth/register',payload:{name:'Durable Customer',email:'durable@example.com',phone:'+251911000001',password:PASSWORD}});const session=response.json();await first.close();
  const second=await buildApp({databasePath:path,env:{},paymentProvider:null,mailer:null});t.after(()=>second.close());
  assert.equal((await second.inject({url:'/v1/me',headers:{authorization:'Bearer '+session.accessToken}})).statusCode,200);
  assert.equal((await second.inject({method:'POST',url:'/v1/wallet/topups',headers:{authorization:'Bearer '+session.accessToken},payload:{amountMinor:10000}})).statusCode,503);
  assert.equal((await second.inject({method:'POST',url:'/v1/integrations/charger-status',payload:{}})).statusCode,503);
});
