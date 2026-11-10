import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { openDatabase, transaction } from './database.mjs';
import { id, token, digest, hashPassword, passwordMatches, safeUser, issueSession } from './auth.mjs';
import { chapaProvider, smtpMailer, validSignature } from './providers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CITIES = ['Addis Ababa', 'Adama'];
const CONNECTORS = ['CCS2', 'Type2', 'GB/T', 'CHAdeMO'];
const STATES = ['requested', 'confirmed', 'en_route', 'arrived', 'charging', 'completed', 'cancelled'];
const NEXT = { requested:['confirmed','cancelled'], confirmed:['en_route','cancelled'], en_route:['arrived','cancelled'], arrived:['charging','cancelled'], charging:['completed'], completed:[], cancelled:[] };
const text = (min=1,max=200) => z.string().trim().min(min).max(max);
const password = z.string().min(12).max(200);
const email = z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const phone = z.string().trim().regex(/^\+?[0-9 ()-]{7,24}$/, 'Use a valid phone number');
const coordinate = { latitude:z.number().min(-90).max(90).nullish(), longitude:z.number().min(-180).max(180).nullish() };
const paired = v => (v.latitude == null) === (v.longitude == null);
const vehicleSchema = z.object({ make:text(1,80),model:text(1,80),plate:text(1,40),connector:z.enum(CONNECTORS),batteryKwh:z.number().min(1).max(300) }).strict();
const stationSchema = z.object({ name:text(1,120), city:z.enum(CITIES),address:text(5,300),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),verified:z.boolean(),
  connectors:z.array(z.object({id:text(1,80).regex(/^[\w-]+$/),type:z.enum(CONNECTORS),powerKw:z.number().positive().max(1000)}).strict()).min(1).max(50).refine(items=>new Set(items.map(i=>i.id)).size===items.length,'Connector IDs must be unique') }).strict();

class Problem extends Error { constructor(status,code,message){super(message);this.statusCode=status;this.code=code;} }
const fail=(status,code,message)=>{throw new Problem(status,code,message);};
const parse=(schema,value)=>{const r=schema.safeParse(value);if(!r.success){const e=new Problem(400,'VALIDATION','Please check the entered details.');e.fields=r.error.flatten().fieldErrors;throw e;}return r.data;};
const scalar = (db,sql,...params)=>db.prepare(sql).get(...params);
const rows = (db,sql,...params)=>db.prepare(sql).all(...params);
function amountMinor(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if(!match)return null;
  const valueMinor=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
  return Number.isSafeInteger(valueMinor)?valueMinor:null;
}

export function environmentConfig(env=process.env) {
  const production=env.NODE_ENV==='production';
  const publicUrl=(env.API_PUBLIC_URL||'http://localhost:4100').replace(/\/$/,'');
  if(production && (!env.DATABASE_PATH || !/^https:\/\//.test(publicUrl)))throw new Error('Production requires DATABASE_PATH and an HTTPS API_PUBLIC_URL.');
  if(production && env.DEMO_MODE==='true')throw new Error('DEMO_MODE is forbidden in production.');
  const paymentsEnabled=env.PAYMENTS_ENABLED==='true' && env.DEMO_MODE!=='true';
  if(paymentsEnabled&&(!env.CHAPA_SECRET_KEY||!env.CHAPA_WEBHOOK_SECRET||!/^https:\/\//.test(publicUrl)))throw new Error('Payments require CHAPA_SECRET_KEY, CHAPA_WEBHOOK_SECRET and an HTTPS API_PUBLIC_URL.');
  const trustedProxyIps=(env.TRUSTED_PROXY_IPS||'').split(',').map(value=>value.trim()).filter(Boolean);
  if(trustedProxyIps.some(value=>!isIP(value)||value==='0.0.0.0'||value==='::'))throw new Error('TRUSTED_PROXY_IPS must contain only the exact IP addresses of your reverse proxies.');
  return {production,publicUrl,databasePath:env.DATABASE_PATH||'.data/mobile.sqlite',
    trustedProxyIps,
    allowedOrigins:(env.CORS_ORIGINS||(!production?'http://localhost:8081,http://localhost:19006,http://localhost:8082,http://127.0.0.1:8081':'')).split(',').filter(Boolean),
    chapaSecret:paymentsEnabled?env.CHAPA_SECRET_KEY:'',chapaWebhookSecret:paymentsEnabled?env.CHAPA_WEBHOOK_SECRET:'',
    telemetryKey:env.TELEMETRY_INGEST_KEY||'',smtpUrl:env.SMTP_URL||'',mailFrom:env.MAIL_FROM||'',isDemo:env.DEMO_MODE==='true'};
}

export async function buildApp(options={}) {
  const config={...environmentConfig(options.env||process.env),...(options.config||{})};
  const db=options.db||openDatabase(options.databasePath||config.databasePath);
  const now=options.now||Date.now;
  const iso=()=>new Date(now()).toISOString();
  const payment=Object.hasOwn(options,'paymentProvider')?options.paymentProvider:chapaProvider(config);
  const mailer=Object.hasOwn(options,'mailer')?options.mailer:smtpMailer(config);
  const app=Fastify({logger:false,bodyLimit:64*1024,trustProxy:config.trustedProxyIps.length?config.trustedProxyIps:false,requestTimeout:20000});
  app.decorate('db',db);app.decorate('config',config);
  app.addHook('onClose',async()=>{if(!options.db)db.close();});
  await app.register(cors,{origin:(origin,callback)=>callback(null,!origin||config.allowedOrigins.includes(origin)),allowedHeaders:['Content-Type','Authorization','Idempotency-Key'],methods:['GET','POST','PATCH','DELETE','OPTIONS'],credentials:false});
  await app.register(helmet,{contentSecurityPolicy:{directives:{defaultSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],scriptSrc:["'self'"],imgSrc:["'self'",'data:'],fontSrc:["'self'",'data:'],frameSrc:['https://www.openstreetmap.org'],connectSrc:["'self'"],frameAncestors:["'none'"],formAction:["'self'"],upgradeInsecureRequests:config.production?[]:null}},crossOriginEmbedderPolicy:false});
  // Bound, in-process rate limits are appropriate for this single-instance server.
  const limits=new Map();
  app.addHook('onRequest',async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(config.production && request.headers['x-forwarded-proto'] && request.headers['x-forwarded-proto']!=='https')fail(400,'HTTPS_REQUIRED','Use a secure connection.');
    const authRoute=request.url.startsWith('/v1/auth/');
    const key=request.ip+(authRoute?':auth':':api');
    const current=limits.get(key);const at=now();
    if(limits.size>=10000&&!current){for(const[k,v]of limits)if(v.until<=at)limits.delete(k);if(limits.size>=10000)fail(429,'RATE_LIMIT','The service is busy. Try again shortly.');}
    if(!current||current.until<=at){limits.set(key,{count:1,until:at+60000});}
    else if(++current.count>(authRoute?40:300)){reply.header('Retry-After','60');fail(429,'RATE_LIMIT','Too many requests. Try again shortly.');}
    if(limits.size>10000)for(const[k,v]of limits)if(v.until<=at)limits.delete(k);
  });
  // Retain exact JSON bytes for signed payment webhooks; never log raw bodies.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json',{parseAs:'string'},(request,body,done)=>{
    request.rawBody=body;try{done(null,JSON.parse(body));}catch{done(new Problem(400,'INVALID_JSON','Invalid JSON request.'));}
  });
  app.setErrorHandler((error,request,reply)=>{
    const status=error.statusCode>=400&&error.statusCode<600?error.statusCode:500;
    reply.status(status).send({error:{code:status===500?'INTERNAL':error.code||'REQUEST_FAILED',message:status===500?'The request could not be completed. Please try again.':error.message,...(error.fields?{fields:error.fields}:{})}});
  });
  app.setNotFoundHandler((request,reply)=>reply.code(404).send({error:{code:'NOT_FOUND',message:'Not found.'}}));
  function authenticate(request){
    const header=request.headers.authorization;
    if(typeof header!=='string'||!header.startsWith('Bearer '))fail(401,'UNAUTHENTICATED','Please sign in.');
    const session=scalar(db,'SELECT s.*,u.deleted FROM sessions s JOIN users u ON u.id=s.user_id WHERE access_hash=?',digest(header.slice(7)));
    if(!session||session.revoked||session.used||session.deleted||session.access_expires<=iso())fail(401,'SESSION_EXPIRED','Please sign in again.');
    const user=scalar(db,'SELECT * FROM users WHERE id=?',session.user_id);
    request.user=user;return user;
  }
  const auth=async request=>{authenticate(request);};
  const admin=async request=>{const user=authenticate(request);if(user.role!=='admin')fail(403,'FORBIDDEN','Operator access is required.');};
  function notify(userId,title,message){db.prepare('INSERT INTO notifications(id,user_id,title,message,created_at) VALUES(?,?,?,?,?)').run(id(),userId,title,message,iso());}
  function audit(userId,action,target){db.prepare('INSERT INTO audit(actor_id,action,target_id,created_at) VALUES(?,?,?,?)').run(userId,action,target,iso());}
  async function sendAction(user,kind){
    if(!mailer)return false;
    const actionToken=token();
    db.prepare('UPDATE action_tokens SET used=1 WHERE user_id=? AND kind=?').run(user.id,kind);
    db.prepare('INSERT INTO action_tokens(hash,user_id,kind,expires_at) VALUES(?,?,?,?)').run(digest(actionToken),user.id,kind,new Date(now()+(kind==='reset'?30:1440)*60000).toISOString());
    try {await mailer.send({to:user.email,kind,actionToken});return true;}catch{db.prepare('UPDATE action_tokens SET used=1 WHERE hash=?').run(digest(actionToken));return false;}
  }
  function booking(row){
    return {id:row.id,reference:row.reference,status:row.status,city:row.city,address:row.address,latitude:row.latitude,longitude:row.longitude,connector:row.connector,requestedKwh:row.requested_kwh,
      scheduledAt:row.scheduled_at,notes:row.notes,vehicleId:row.vehicle_id,quoteMinor:row.quote_minor,paymentStatus:row.payment_status,dispatchName:row.dispatch_name,dispatchPhone:row.dispatch_phone,createdAt:row.created_at,updatedAt:row.updated_at,
      events:rows(db,'SELECT status,message,at FROM booking_events WHERE booking_id=? ORDER BY id',row.id)};
  }
  function ownedBooking(request){const row=scalar(db,'SELECT * FROM bookings WHERE id=? AND user_id=?',request.params.id,request.user.id);if(!row)fail(404,'NOT_FOUND','Booking not found.');return row;}
  function event(bookingId,status,message){db.prepare('INSERT INTO booking_events(booking_id,status,message,at) VALUES(?,?,?,?)').run(bookingId,status,message,iso());}
  function ledger(userId,kind,amount,reference){
    const before=scalar(db,'SELECT balance_minor FROM balances WHERE user_id=?',userId)?.balance_minor||0;
    const after=before+amount;
    if(after<0)fail(409,'INSUFFICIENT_FUNDS','Your service credit is too low. Add funds before paying.');
    if(!Number.isSafeInteger(after)||after>1_000_000_000)fail(409,'BALANCE_LIMIT','Service credit limit exceeded. Contact support.');
    db.prepare('INSERT INTO ledger(id,user_id,kind,amount_minor,balance_after_minor,reference,created_at) VALUES(?,?,?,?,?,?,?)').run(id(),userId,kind,amount,after,reference,iso());
    db.prepare('UPDATE balances SET balance_minor=? WHERE user_id=?').run(after,userId);
  }
  function cancel(row,actor){
    if(row.status==='cancelled')return;
    if(!['requested','confirmed','en_route','arrived'].includes(row.status))fail(409,'INVALID_TRANSITION','A charging or completed service cannot be cancelled. Contact support.');
    if(row.payment_status==='paid'&&row.quote_minor>0)ledger(row.user_id,'refund',row.quote_minor,row.id);
    db.prepare('UPDATE bookings SET status=?,payment_status=?,updated_at=? WHERE id=?').run('cancelled',row.payment_status==='paid'?'refunded':row.payment_status,iso(),row.id);
    event(row.id,'cancelled','Booking cancelled. Any paid service credit has been returned.');notify(row.user_id,'Booking cancelled',row.reference+' was cancelled.');audit(actor,'booking.cancel',row.id);
  }
  function station(row){
    const list=rows(db,'SELECT * FROM connectors WHERE station_id=? ORDER BY id',row.id).map(c=>({id:c.id,type:c.type,powerKw:c.power_kw,status:c.last_seen_at&&now()-Date.parse(c.last_seen_at)<=120000&&now()>=Date.parse(c.last_seen_at)-30000?c.status:'unknown',lastSeenAt:c.last_seen_at}));
    return {id:row.id,name:row.name,city:row.city,address:row.address,latitude:row.latitude,longitude:row.longitude,verified:!!row.verified,isDemo:!!row.is_demo,connectors:list,availableCount:list.filter(c=>c.status==='available').length,totalCount:list.length,availabilityUpdatedAt:list.map(c=>c.lastSeenAt).filter(Boolean).sort().at(-1)||null};
  }
  function saveStation(data,stationId,actor){
    const existing=stationId?scalar(db,'SELECT * FROM stations WHERE id=?',stationId):null;
    if(stationId&&!existing)fail(404,'NOT_FOUND','Station not found.');
    const current=existing?station(existing):{};
    const patch=parse(stationSchema.partial(),data);
    const merged={...current,...patch,connectors:patch.connectors||current.connectors?.map(({id,type,powerKw})=>({id,type,powerKw}))};
    const next=parse(stationSchema,Object.fromEntries(['name','city','address','latitude','longitude','verified','connectors'].map(k=>[k,merged[k]])));
    return transaction(db,()=>{
      const sid=stationId||id();
      if(existing)db.prepare('UPDATE stations SET name=?,city=?,address=?,latitude=?,longitude=?,verified=? WHERE id=?').run(next.name,next.city,next.address,next.latitude,next.longitude,Number(next.verified),sid);
      else db.prepare('INSERT INTO stations(id,name,city,address,latitude,longitude,verified,is_demo) VALUES(?,?,?,?,?,?,?,0)').run(sid,next.name,next.city,next.address,next.latitude,next.longitude,Number(next.verified));
      const old=rows(db,'SELECT id FROM connectors WHERE station_id=?',sid);
      for(const c of old)if(!next.connectors.some(n=>n.id===c.id))db.prepare('DELETE FROM connectors WHERE station_id=? AND id=?').run(sid,c.id);
      for(const c of next.connectors)db.prepare('INSERT INTO connectors(id,station_id,type,power_kw) VALUES(?,?,?,?) ON CONFLICT(station_id,id) DO UPDATE SET type=excluded.type,power_kw=excluded.power_kw').run(c.id,sid,c.type,c.powerKw);
      audit(actor,existing?'station.update':'station.create',sid);return station(scalar(db,'SELECT * FROM stations WHERE id=?',sid));
    });
  }

  app.get('/health',async()=>({status:'ok',service:'evpower-mobile-api',version:'1.0.0'}));
  app.get('/v1/config',async()=>({name:'Evpower',currency:'ETB',serviceCities:CITIES,paymentsEnabled:!!payment,telemetryConfigured:!!config.telemetryKey,emailDeliveryEnabled:!!mailer,isDemo:config.isDemo,contact:{phone:'+251911049916',tollFree:'8890',email:'info@evpower.et',whatsapp:'+251911049916'}}));
  app.post('/v1/auth/register',async(request,reply)=>{
    const data=parse(z.object({name:text(2,100),email,phone,password}).strict(),request.body);
    const encoded=await hashPassword(data.password);const uid=id();
    const exists=scalar(db,'SELECT id FROM users WHERE email=?',data.email);if(exists)fail(409,'ACCOUNT_EXISTS','An account already uses this email. Sign in or reset your password.');
    transaction(db,()=>{db.prepare('INSERT INTO users(id,name,email,phone,password_hash,created_at) VALUES(?,?,?,?,?,?)').run(uid,data.name,data.email,data.phone,encoded,iso());db.prepare('INSERT INTO balances(user_id) VALUES(?)').run(uid);});
    const user=scalar(db,'SELECT * FROM users WHERE id=?',uid);await sendAction(user,'verify');reply.code(201);return issueSession(db,user,now);
  });
  const dummyHash=await hashPassword('not-an-account-password');
  app.post('/v1/auth/login',async request=>{
    const data=parse(z.object({email,password:z.string().min(1).max(200)}).strict(),request.body);
    const user=scalar(db,'SELECT * FROM users WHERE email=? AND deleted=0',data.email);
    const matches=await passwordMatches(data.password,user?.password_hash||dummyHash);
    if(!user||!matches)fail(401,'INVALID_CREDENTIALS','Email or password is incorrect.');
    return issueSession(db,user,now);
  });
  app.post('/v1/auth/refresh',async request=>{
    const {refreshToken}=parse(z.object({refreshToken:text(20,200)}).strict(),request.body);
    const row=scalar(db,'SELECT * FROM sessions WHERE refresh_hash=?',digest(refreshToken));
    if(!row)fail(401,'SESSION_EXPIRED','Please sign in again.');
    if(row.used||row.revoked){db.prepare('UPDATE sessions SET revoked=1 WHERE family=?').run(row.family);fail(401,'SESSION_EXPIRED','Please sign in again.');}
    const user=scalar(db,'SELECT * FROM users WHERE id=? AND deleted=0',row.user_id);
    if(!user||row.refresh_expires<=iso())fail(401,'SESSION_EXPIRED','Please sign in again.');
    return transaction(db,()=>{db.prepare('UPDATE sessions SET used=1 WHERE id=?').run(row.id);return issueSession(db,user,now,row.family);});
  });
  app.post('/v1/auth/logout',async request=>{
    const {refreshToken}=parse(z.object({refreshToken:text(20,200)}).strict(),request.body);
    const session=scalar(db,'SELECT family FROM sessions WHERE refresh_hash=?',digest(refreshToken));
    if(session)db.prepare('UPDATE sessions SET revoked=1 WHERE family=?').run(session.family);
    return {message:'Signed out.'};
  });
  app.post('/v1/auth/password-reset',async request=>{
    const data=parse(z.object({email}).strict(),request.body);const user=scalar(db,'SELECT * FROM users WHERE email=? AND deleted=0',data.email);
    if(user)await sendAction(user,'reset');return {message:'If an account uses this email and email delivery is configured, password reset instructions will be sent.'};
  });
  app.post('/v1/auth/password-reset/complete',async request=>{
    const data=parse(z.object({token:text(20,200),password}).strict(),request.body);
    const row=scalar(db,"SELECT * FROM action_tokens WHERE hash=? AND kind='reset' AND used=0",digest(data.token));
    if(!row||row.expires_at<=iso())fail(400,'INVALID_TOKEN','This reset code is invalid or expired.');
    const encoded=await hashPassword(data.password);
    transaction(db,()=>{const changed=db.prepare('UPDATE action_tokens SET used=1 WHERE hash=? AND used=0').run(row.hash);if(!changed.changes)fail(400,'INVALID_TOKEN','This reset code has already been used.');db.prepare('UPDATE users SET password_hash=? WHERE id=? AND deleted=0').run(encoded,row.user_id);db.prepare('UPDATE sessions SET revoked=1 WHERE user_id=?').run(row.user_id);});
    return {message:'Password updated. Sign in with your new password.'};
  });
  app.post('/v1/auth/verify-email',async request=>{
    const data=parse(z.object({token:text(20,200)}).strict(),request.body);const row=scalar(db,"SELECT * FROM action_tokens WHERE hash=? AND kind='verify' AND used=0",digest(data.token));
    if(!row||row.expires_at<=iso())fail(400,'INVALID_TOKEN','This verification code is invalid or expired.');
    transaction(db,()=>{db.prepare('UPDATE action_tokens SET used=1 WHERE hash=?').run(row.hash);db.prepare('UPDATE users SET email_verified=1 WHERE id=? AND deleted=0').run(row.user_id);});return {message:'Email verified.'};
  });
  app.post('/v1/auth/resend-verification',{preHandler:auth},async request=>{
    if(request.user.email_verified)return {message:'Your email is already verified.'};
    if(!await sendAction(request.user,'verify'))fail(503,'EMAIL_UNAVAILABLE','Email delivery is not configured or is unavailable. Contact support.');
    return {message:'A verification code has been sent to your email.'};
  });
  app.get('/v1/me',{preHandler:auth},async request=>safeUser(request.user));
  app.patch('/v1/me',{preHandler:auth},async request=>{
    const data=parse(z.object({name:text(2,100),phone}).partial().strict().refine(v=>Object.keys(v).length>0),request.body);
    db.prepare('UPDATE users SET name=?,phone=? WHERE id=?').run(data.name||request.user.name,data.phone||request.user.phone,request.user.id);return safeUser(scalar(db,'SELECT * FROM users WHERE id=?',request.user.id));
  });
  app.delete('/v1/me',{preHandler:auth},async request=>{
    const data=parse(z.object({password:z.string().min(1).max(200)}).strict(),request.body);
    if(!await passwordMatches(data.password,request.user.password_hash))fail(401,'INVALID_CREDENTIALS','Password is incorrect.');
    transaction(db,()=>{
      if((scalar(db,'SELECT balance_minor FROM balances WHERE user_id=?',request.user.id)?.balance_minor||0)!==0)fail(409,'CREDIT_REMAINING','Contact info@evpower.et to refund remaining service credit before deleting your account.');
      if(scalar(db,"SELECT id FROM topups WHERE user_id=? AND status IN ('pending','manual_review')",request.user.id))fail(409,'PAYMENT_PENDING','A payment is still awaiting verification or refund review. Contact info@evpower.et before deleting your account.');
      if(scalar(db,"SELECT id FROM bookings WHERE user_id=? AND status NOT IN ('completed','cancelled','requested')",request.user.id))fail(409,'ACTIVE_SERVICE','Cancel or complete your active service before deleting your account.');
      for(const row of rows(db,"SELECT * FROM bookings WHERE user_id=? AND status='requested'",request.user.id))cancel(row,request.user.id);
      for(const table of ['vehicles','addresses','notifications','action_tokens'])db.prepare('DELETE FROM '+table+' WHERE user_id=?').run(request.user.id);
      db.prepare('UPDATE bookings SET address=?,latitude=NULL,longitude=NULL,notes=?,vehicle_id=NULL,dispatch_name=NULL,dispatch_phone=NULL WHERE user_id=?').run('[deleted]','',request.user.id);
      db.prepare('UPDATE tickets SET subject=?,message=? WHERE user_id=?').run('[deleted]','[deleted]',request.user.id);
      db.prepare('UPDATE booking_events SET message=? WHERE booking_id IN (SELECT id FROM bookings WHERE user_id=?)').run('Historical status retained after account deletion.',request.user.id);
      db.prepare('UPDATE sessions SET revoked=1 WHERE user_id=?').run(request.user.id);
      db.prepare('UPDATE users SET name=?,email=?,phone=?,password_hash=?,deleted=1 WHERE id=?').run('Deleted account','deleted-'+request.user.id+'@deleted.invalid','',dummyHash,request.user.id);
    });return {message:'Your account has been deleted. Required financial records are retained without your profile details.'};
  });

  const vehicle=row=>({id:row.id,make:row.make,model:row.model,plate:row.plate,connector:row.connector,batteryKwh:row.battery_kwh});
  app.get('/v1/vehicles',{preHandler:auth},async request=>({items:rows(db,'SELECT * FROM vehicles WHERE user_id=?',request.user.id).map(vehicle)}));
  app.post('/v1/vehicles',{preHandler:auth},async(request,reply)=>{const data=parse(vehicleSchema,request.body),vid=id();db.prepare('INSERT INTO vehicles VALUES(?,?,?,?,?,?,?)').run(vid,request.user.id,data.make,data.model,data.plate,data.connector,data.batteryKwh);reply.code(201);return vehicle(scalar(db,'SELECT * FROM vehicles WHERE id=?',vid));});
  app.patch('/v1/vehicles/:id',{preHandler:auth},async request=>{const row=scalar(db,'SELECT * FROM vehicles WHERE id=? AND user_id=?',request.params.id,request.user.id);if(!row)fail(404,'NOT_FOUND','Vehicle not found.');const {id:vid,...current}=vehicle(row);const patch=parse(vehicleSchema.partial(),request.body);const data=parse(vehicleSchema,{...current,...patch});db.prepare('UPDATE vehicles SET make=?,model=?,plate=?,connector=?,battery_kwh=? WHERE id=?').run(data.make,data.model,data.plate,data.connector,data.batteryKwh,row.id);return vehicle(scalar(db,'SELECT * FROM vehicles WHERE id=?',row.id));});
  app.delete('/v1/vehicles/:id',{preHandler:auth},async request=>{const result=db.prepare('DELETE FROM vehicles WHERE id=? AND user_id=?').run(request.params.id,request.user.id);if(!result.changes)fail(404,'NOT_FOUND','Vehicle not found.');return {message:'Vehicle removed.'};});
  app.get('/v1/addresses',{preHandler:auth},async request=>({items:rows(db,'SELECT id,label,address,latitude,longitude FROM addresses WHERE user_id=?',request.user.id)}));
  app.post('/v1/addresses',{preHandler:auth},async(request,reply)=>{const data=parse(z.object({label:text(1,50),address:text(5,300),...coordinate}).strict().refine(paired,'Provide both coordinates or neither'),request.body);const aid=id();db.prepare('INSERT INTO addresses VALUES(?,?,?,?,?,?)').run(aid,request.user.id,data.label,data.address,data.latitude??null,data.longitude??null);reply.code(201);return {id:aid,...data,latitude:data.latitude??null,longitude:data.longitude??null};});
  app.delete('/v1/addresses/:id',{preHandler:auth},async request=>{if(!db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(request.params.id,request.user.id).changes)fail(404,'NOT_FOUND','Address not found.');return {message:'Address removed.'};});

  app.get('/v1/stations',async()=>({items:rows(db,'SELECT * FROM stations WHERE verified=1 AND (is_demo=0 OR ?=1) ORDER BY city,name',Number(config.isDemo)).map(station)}));
  app.get('/v1/bookings',{preHandler:auth},async request=>({items:rows(db,'SELECT * FROM bookings WHERE user_id=? ORDER BY created_at DESC',request.user.id).map(booking)}));
  app.get('/v1/bookings/:id',{preHandler:auth},async request=>booking(ownedBooking(request)));
  app.post('/v1/bookings',{preHandler:auth},async(request,reply)=>{
    const data=parse(z.object({city:z.enum(CITIES),address:text(5,300),...coordinate,connector:z.enum(CONNECTORS),requestedKwh:z.number().min(1).max(200),scheduledAt:z.string().datetime({offset:true}).nullish(),notes:text(0,1000).optional().default(''),vehicleId:z.string().uuid().nullish()}).strict().refine(paired,'Provide both coordinates or neither'),request.body);
    const key=parse(z.string().uuid(),request.headers['idempotency-key']);const hash=digest(JSON.stringify(data));
    const existing=scalar(db,'SELECT * FROM bookings WHERE user_id=? AND idempotency_key=?',request.user.id,key);
    if(existing){if(existing.request_hash!==hash)fail(409,'IDEMPOTENCY_CONFLICT','This request key was used for different details.');return booking(existing);}
    if(data.scheduledAt&&(Date.parse(data.scheduledAt)<now()+60000||Date.parse(data.scheduledAt)>now()+90*86400000))fail(400,'INVALID_SCHEDULE','Choose a time at least one minute ahead and within 90 days.');
    if(data.vehicleId&&!scalar(db,'SELECT id FROM vehicles WHERE id=? AND user_id=?',data.vehicleId,request.user.id))fail(400,'INVALID_VEHICLE','Choose a vehicle from your account.');
    const bid=id();transaction(db,()=>{db.prepare('INSERT INTO bookings(id,reference,user_id,status,city,address,latitude,longitude,connector,requested_kwh,scheduled_at,notes,vehicle_id,created_at,updated_at,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(bid,'EV-'+token().slice(0,8).toUpperCase(),request.user.id,'requested',data.city,data.address,data.latitude??null,data.longitude??null,data.connector,data.requestedKwh,data.scheduledAt||null,data.notes,data.vehicleId||null,iso(),iso(),key,hash);event(bid,'requested','Request received. Evpower will confirm availability and a quote.');notify(request.user.id,'Booking requested','Your mobile charging request has been received.');});reply.code(201);return booking(scalar(db,'SELECT * FROM bookings WHERE id=?',bid));
  });
  app.post('/v1/bookings/:id/cancel',{preHandler:auth},async request=>{transaction(db,()=>cancel(ownedBooking(request),request.user.id));return booking(ownedBooking(request));});
  app.post('/v1/bookings/:id/pay',{preHandler:auth},async request=>transaction(db,()=>{
    const row=ownedBooking(request);if(row.payment_status==='paid')return booking(row);
    if(row.status!=='confirmed'||row.quote_minor==null)fail(409,'QUOTE_REQUIRED','Wait for Evpower to confirm a quote before paying.');
    if(row.quote_minor>0)ledger(request.user.id,'booking_payment',-row.quote_minor,row.id);
    db.prepare('UPDATE bookings SET payment_status=?,updated_at=? WHERE id=?').run('paid',iso(),row.id);event(row.id,row.status,'Quote paid using Evpower service credit.');notify(request.user.id,'Booking paid',row.reference+' is paid.');return booking(scalar(db,'SELECT * FROM bookings WHERE id=?',row.id));
  }));

  app.get('/v1/wallet',{preHandler:auth},async request=>({balanceMinor:scalar(db,'SELECT balance_minor FROM balances WHERE user_id=?',request.user.id)?.balance_minor||0,currency:'ETB',paymentsEnabled:!!payment,transactions:rows(db,'SELECT id,kind,amount_minor AS amountMinor,balance_after_minor AS balanceAfterMinor,reference,created_at AS createdAt FROM ledger WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200',request.user.id),pendingTopups:rows(db,"SELECT id,reference,status,checkout_url AS checkoutUrl,created_at AS createdAt FROM topups WHERE user_id=? AND status IN ('pending','manual_review') ORDER BY created_at DESC",request.user.id)}));
  app.post('/v1/wallet/topups',{preHandler:auth},async(request,reply)=>{
    if(!payment)fail(503,'PAYMENTS_UNAVAILABLE','Online payments are not enabled yet. Contact Evpower.');
    if(!request.user.email_verified)fail(403,'EMAIL_UNVERIFIED','Verify your email before adding service credit.');
    const {amountMinor:amount}=parse(z.object({amountMinor:z.number().int().min(1000).max(10_000_000)}).strict(),request.body);const tid=id(),reference='evpower-'+id();
    db.prepare('INSERT INTO topups(id,user_id,reference,amount_minor,created_at) VALUES(?,?,?,?,?)').run(tid,request.user.id,reference,amount,iso());
    try{const result=await payment.initialize({reference,amountMinor:amount,user:safeUser(request.user)});const checkout=new URL(result.checkoutUrl);if(checkout.protocol!=='https:'||!(checkout.hostname==='chapa.co'||checkout.hostname.endsWith('.chapa.co'))||checkout.username||checkout.password||(checkout.port&&checkout.port!=='443'))throw new Error('Invalid payment URL');db.prepare('UPDATE topups SET checkout_url=? WHERE id=?').run(checkout.href,tid);reply.code(201);return {id:tid,reference,checkoutUrl:checkout.href,status:'pending'};}
    catch{db.prepare("UPDATE topups SET status='failed' WHERE id=?").run(tid);fail(502,'PAYMENT_PROVIDER','Checkout could not be opened. No service credit was added.');}
  });
  async function verifyTopup(row){
    if(row.status==='succeeded')return {status:'succeeded'};
    if(row.status==='manual_review')return {status:'manual_review'};
    if(!payment)fail(503,'PAYMENTS_UNAVAILABLE','Online payments are unavailable.');
    let result;try{result=await payment.verify(row.reference);}catch{fail(502,'PAYMENT_PROVIDER','Payment verification is temporarily unavailable. Please recheck later.');}
    if(['failed','cancelled'].includes(result.status)&&result.reference===row.reference){db.prepare("UPDATE topups SET status='failed' WHERE id=? AND status='pending'").run(row.id);return {status:'failed'};}
    if(result.status!=='success')return {status:'pending'};
    if(result.reference!==row.reference||result.currency!=='ETB'||amountMinor(result.amount)!==row.amount_minor)fail(409,'PAYMENT_MISMATCH','Payment details do not match. Contact support; no credit was added.');
    return transaction(db,()=>{
      const current=scalar(db,'SELECT * FROM topups WHERE id=?',row.id);if(current.status==='succeeded')return {status:'succeeded'};
      const owner=scalar(db,'SELECT deleted FROM users WHERE id=?',current.user_id);
      if(!owner||owner.deleted){
        db.prepare("UPDATE topups SET status='manual_review' WHERE id=?").run(current.id);
        db.prepare('INSERT INTO tickets(id,user_id,subject,message,created_at) VALUES(?,?,?,?,?)').run(id(),current.user_id,'Payment requires refund review','Verified payment '+current.reference+' for ETB '+(current.amount_minor/100).toFixed(2)+' belongs to a deleted account. No service credit was added. Review and refund through the payment provider.',iso());
        audit('payment-provider','payment.manual_review',current.id);
        return {status:'manual_review'};
      }
      ledger(current.user_id,'topup',current.amount_minor,current.reference);db.prepare("UPDATE topups SET status='succeeded' WHERE id=?").run(current.id);notify(current.user_id,'Service credit added','ETB '+(current.amount_minor/100).toFixed(2)+' was added to your Evpower service credit.');return {status:'succeeded'};
    });
  }
  app.post('/v1/wallet/topups/:id/verify',{preHandler:auth},async request=>{const row=scalar(db,'SELECT * FROM topups WHERE id=? AND user_id=?',request.params.id,request.user.id);if(!row)fail(404,'NOT_FOUND','Payment not found.');return verifyTopup(row);});
  app.post('/v1/payments/chapa/webhook',async request=>{
    if(!config.chapaWebhookSecret)fail(503,'WEBHOOK_UNAVAILABLE','Payment webhook is not configured.');
    if(!validSignature(request.rawBody,request.headers['chapa-signature']||request.headers['x-chapa-signature'],config.chapaWebhookSecret))fail(401,'INVALID_SIGNATURE','Invalid webhook signature.');
    const body=parse(z.object({tx_ref:text(1,160)}).passthrough(),request.body);const row=scalar(db,'SELECT * FROM topups WHERE reference=?',body.tx_ref);if(!row)fail(404,'NOT_FOUND','Payment not found.');return verifyTopup(row);
  });
  app.get('/v1/notifications',{preHandler:auth},async request=>({items:rows(db,'SELECT id,title,message,read_at AS readAt,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100',request.user.id)}));
  app.post('/v1/notifications/:id/read',{preHandler:auth},async request=>{if(!db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?').run(iso(),request.params.id,request.user.id).changes)fail(404,'NOT_FOUND','Notification not found.');return {message:'Notification marked as read.'};});
  app.post('/v1/support',{preHandler:auth},async(request,reply)=>{const data=parse(z.object({subject:text(3,150),message:text(10,3000)}).strict(),request.body);const tid=id();db.prepare('INSERT INTO tickets(id,user_id,subject,message,created_at) VALUES(?,?,?,?,?)').run(tid,request.user.id,data.subject,data.message,iso());reply.code(201);return {id:tid,status:'open'};});

  app.get('/v1/admin/overview',{preHandler:admin},async()=>({customers:scalar(db,'SELECT count(*) AS n FROM users WHERE deleted=0 AND role=?','customer').n,activeBookings:scalar(db,"SELECT count(*) AS n FROM bookings WHERE status NOT IN ('completed','cancelled')").n,totalBookings:scalar(db,'SELECT count(*) AS n FROM bookings').n,stations:scalar(db,'SELECT count(*) AS n FROM stations').n,bookings:rows(db,'SELECT * FROM bookings ORDER BY created_at DESC LIMIT 50').map(booking),tickets:rows(db,'SELECT t.id,u.name,u.email,t.subject,t.message,t.status,t.created_at AS createdAt FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC LIMIT 100')}));
  app.get('/v1/admin/bookings',{preHandler:admin},async()=>({items:rows(db,'SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500').map(booking)}));
  app.patch('/v1/admin/bookings/:id',{preHandler:admin},async request=>{
    const data=parse(z.object({status:z.enum(STATES).optional(),quoteMinor:z.number().int().min(0).max(100_000_000).optional(),dispatchName:text(0,100).optional(),dispatchPhone:z.union([phone,z.literal('')]).optional(),note:text(0,500).optional()}).strict().refine(v=>Object.keys(v).length>0),request.body);
    return transaction(db,()=>{
      const row=scalar(db,'SELECT * FROM bookings WHERE id=?',request.params.id);if(!row)fail(404,'NOT_FOUND','Booking not found.');
      if(['completed','cancelled'].includes(row.status))fail(409,'INVALID_TRANSITION','This booking is closed.');
      if(data.quoteMinor!==undefined&&row.payment_status==='paid')fail(409,'PAID_QUOTE','A paid quote cannot be changed.');
      if(data.status&&data.status!==row.status&&!NEXT[row.status].includes(data.status))fail(409,'INVALID_TRANSITION','This booking status change is not allowed.');
      if(data.status==='cancelled'){cancel(row,request.user.id);return booking(scalar(db,'SELECT * FROM bookings WHERE id=?',row.id));}
      const nextStatus=data.status||row.status,quote=data.quoteMinor??row.quote_minor;
      if(nextStatus==='confirmed'&&quote==null)fail(409,'QUOTE_REQUIRED','Set a quote before confirming the request.');
      if(['en_route','arrived','charging','completed'].includes(nextStatus)&&!(row.payment_status==='paid'||quote===0))fail(409,'PAYMENT_REQUIRED','The customer must pay the confirmed quote before dispatch.');
      db.prepare('UPDATE bookings SET status=?,quote_minor=?,dispatch_name=?,dispatch_phone=?,updated_at=? WHERE id=?').run(nextStatus,quote,data.dispatchName??row.dispatch_name,data.dispatchPhone??row.dispatch_phone,iso(),row.id);
      const message=data.note||('Booking '+nextStatus.replaceAll('_',' ')+'.'+(data.quoteMinor!==undefined?' Quote: ETB '+(quote/100).toFixed(2)+'.':''));
      event(row.id,nextStatus,message);notify(row.user_id,'Booking update',row.reference+': '+message);audit(request.user.id,'booking.update',row.id);return booking(scalar(db,'SELECT * FROM bookings WHERE id=?',row.id));
    });
  });
  app.get('/v1/admin/stations',{preHandler:admin},async()=>({items:rows(db,'SELECT * FROM stations ORDER BY city,name').map(station)}));
  app.post('/v1/admin/stations',{preHandler:admin},async(request,reply)=>{reply.code(201);return saveStation(request.body,null,request.user.id);});
  app.patch('/v1/admin/stations/:id',{preHandler:admin},async request=>saveStation(request.body,request.params.id,request.user.id));
  app.post('/v1/integrations/charger-status',async request=>{
    if(!config.telemetryKey)fail(503,'TELEMETRY_UNAVAILABLE','A charger status feed has not been configured.');
    const supplied=request.headers.authorization?.replace(/^Bearer /,'')||'';
    const expected=Buffer.from(digest(config.telemetryKey)),actual=Buffer.from(digest(supplied));
    if(!timingSafeEqual(expected,actual))fail(401,'UNAUTHENTICATED','Invalid integration credentials.');
    const data=parse(z.object({eventId:text(1,160),stationId:z.string().uuid(),connectorId:text(1,80),status:z.enum(['available','charging','faulted','offline','unknown']),observedAt:z.string().datetime({offset:true})}).strict(),request.body);
    const at=Date.parse(data.observedAt);if(at>now()+30000||at<now()-300000)fail(400,'INVALID_TIMESTAMP','Telemetry timestamp is outside the accepted window.');
    return transaction(db,()=>{
      if(scalar(db,'SELECT id FROM telemetry_events WHERE id=?',data.eventId))fail(409,'REPLAY','This telemetry event was already received.');
      const connector=scalar(db,'SELECT * FROM connectors WHERE station_id=? AND id=?',data.stationId,data.connectorId);if(!connector)fail(404,'NOT_FOUND','Unknown station or connector mapping.');
      if(connector.last_seen_at&&at<=Date.parse(connector.last_seen_at))fail(409,'STALE_EVENT','A newer connector status has already been received.');
      db.prepare('INSERT INTO telemetry_events VALUES(?,?)').run(data.eventId,iso());db.prepare('UPDATE connectors SET status=?,last_seen_at=? WHERE station_id=? AND id=?').run(data.status,new Date(at).toISOString(),data.stationId,data.connectorId);return {accepted:true};
    });
  });

  const operatorFiles={'':'index.html','index.html':'index.html','styles.css':'styles.css','app.js':'app.js','assets/logo.png':'assets/logo.png'};
  app.get('/operator',async(request,reply)=>reply.redirect('/operator/'));
  app.get('/operator/*',async(request,reply)=>{
    const file=operatorFiles[request.params['*']];if(!file)fail(404,'NOT_FOUND','Not found.');
    try{const body=await readFile(resolve(HERE,'../../operator',file));reply.type(file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':'text/html');return body;}catch{fail(404,'NOT_FOUND','Operator dashboard files are not installed.');}
  });
  for(const [route,file]of [['/privacy','privacy.html'],['/support','support.html'],['/account-deletion','account-deletion.html'],['/delete-account','account-deletion.html'],['/release-pages.css','styles.css']])app.get(route,async(request,reply)=>{
    try{reply.type(file.endsWith('.css')?'text/css':'text/html');return await readFile(resolve(HERE,'../../docs/public',file));}catch{fail(404,'NOT_FOUND','This release information page has not been configured.');}
  });
  app.get('/app',async(request,reply)=>reply.redirect('/app/'));
  app.get('/app/*',async(request,reply)=>{
    const requested=request.params['*']||'index.html';
    const root=resolve(HERE,'../../mobile/dist');
    const path=resolve(root,requested);
    if(!path.startsWith(root+'/')||requested.includes('\0'))fail(404,'NOT_FOUND','Not found.');
    const ext=path.split('.').at(-1);const types={html:'text/html',js:'application/javascript',css:'text/css',json:'application/json',png:'image/png',svg:'image/svg+xml',ico:'image/x-icon',ttf:'font/ttf',woff:'font/woff',woff2:'font/woff2'};
    try{const body=await readFile(path);reply.type(types[ext]||'application/octet-stream');return body;}catch{fail(404,'NOT_FOUND','The app web preview has not been exported.');}
  });
  app.get('/payment-return',async(request,reply)=>reply.type('text/html').send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Evpower payment</title><h1>Return to Evpower</h1><p>Return to the app and choose Recheck payment. Your service credit is added only after verification.</p></html>'));
  app.get('/account-action',async(request,reply)=>reply.type('text/html').send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Evpower account</title><h1>Open the Evpower app</h1><p>Use the one-time code from your email in Verify email or Reset password. Keep this code private.</p></html>'));
  return app;
}
