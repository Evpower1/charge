/* Browser preview only. This module never contacts an API, payment provider,
   email service or charger. It must not be used by a production native build. */
type Options={method?:string;body?:unknown;headers?:Record<string,string>};
type Person={id:string;name:string;email:string;phone:string;emailVerified:boolean;createdAt:string;salt:string;passwordHash:string};
type Owned={id:string;userId:string;[key:string]:any};
type DemoState={version:1;users:Person[];vehicles:Owned[];addresses:Owned[];bookings:Owned[];notifications:Owned[];tickets:Owned[];keys:{userId:string;key:string;body:string;bookingId:string}[]};
type DemoSession={userId:string;refreshToken:string};
const STORAGE_KEY='evpower.browser-demo.v1';
const DEMO_EMAIL='demo@evpower.test';
const DEMO_PASSWORD='EvpowerDemo2026!';
const CITIES=['Addis Ababa','Adama'];
const CONNECTORS=['CCS2','Type2','GB/T','CHAdeMO'];
const FLOW=['requested','confirmed','en_route','arrived','charging','completed'];
let state:DemoState|undefined;
let initializing:Promise<DemoState>|null=null;
let generation=0;
const sessions=new Map<string,DemoSession>();

class DemoProblem extends Error {
  constructor(public status:number,public code:string,message:string){super(message);this.name='DemoProblem';}
}
function problem(status:number,code:string,message:string):never{throw new DemoProblem(status,code,message);}
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const now=()=>new Date().toISOString();
function id(){
  if(!globalThis.crypto?.getRandomValues)problem(503,'BROWSER_UNSUPPORTED','Open this preview in an up-to-date browser using HTTPS.');
  if(globalThis.crypto.randomUUID)return globalThis.crypto.randomUUID();
  const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const empty=():DemoState=>({version:1,users:[],vehicles:[],addresses:[],bookings:[],notifications:[],tickets:[],keys:[]});
function stored():DemoState{
  try{
    const raw=globalThis.localStorage?.getItem(STORAGE_KEY);
    if(raw){const parsed=JSON.parse(raw);if(parsed.version===1&&['users','vehicles','addresses','bookings','notifications','tickets','keys'].every(key=>Array.isArray(parsed[key]))&&parsed.users.every((user:Person)=>typeof user.id==='string'&&typeof user.passwordHash==='string'&&typeof user.salt==='string'))return parsed;}
  }catch{/* Private browsing may deny storage; the preview can still run in memory. */}
  return empty();
}
function current(value:DemoState,expected=generation){
  if(value!==state||expected!==generation)problem(409,'DEMO_RESET','The preview was reset. Please try again.');
}
function save(value:DemoState){
  current(value);
  try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify(value));}catch{/* Memory remains usable when storage is denied/full. */}
}
async function passwordDigest(password:string,salt:string){
  if(!globalThis.crypto?.subtle)problem(503,'BROWSER_UNSUPPORTED','This preview needs a current browser with secure Web Crypto support.');
  const material=await globalThis.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bytes=new Uint8Array(salt.match(/../g)!.map(value=>parseInt(value,16)));
  const digest=await globalThis.crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:120000,hash:'SHA-256'},material,256);
  return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}
async function person(name:string,email:string,phone:string,password:string):Promise<Person>{
  const salt=Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
  return{id:id(),name,email,phone,emailVerified:false,createdAt:now(),salt,passwordHash:await passwordDigest(password,salt)};
}
async function ensureDemoPerson(value:DemoState,expected:number){
  let user=value.users.find(item=>item.email===DEMO_EMAIL);
  if(!user){
    user=await person('Preview Driver',DEMO_EMAIL,'+251900000001',DEMO_PASSWORD);current(value,expected);
    value.users.push(user);
    value.vehicles.push({id:id(),userId:user.id,make:'BYD',model:'Atto 3',plate:'DEMO ONLY',connector:'CCS2',batteryKwh:60});
    save(value);
  }
  return user;
}
async function getState(){
  if(initializing)return initializing;
  if(state)return state;
  const expected=generation;
  const value=stored();state=value;
  const pending=(async()=>{await ensureDemoPerson(value,expected);current(value,expected);return value;})();
  initializing=pending;
  try{return await pending;}finally{if(initializing===pending)initializing=null;}
}
function publicPerson(user:Person){return{id:user.id,name:user.name,email:user.email,phone:user.phone,role:'customer' as const,emailVerified:user.emailVerified,createdAt:user.createdAt};}
function session(value:DemoState,user:Person){
  current(value);
  const accessToken='demo-access-'+id(),refreshToken='demo-refresh-'+id();
  for(const[token,item]of sessions)if(item.userId===user.id)sessions.delete(token);
  sessions.set(accessToken,{userId:user.id,refreshToken});
  return{accessToken,refreshToken,user:publicPerson(user)};
}
function authenticated(value:DemoState,accessToken?:string|null){
  const token=accessToken&&sessions.get(accessToken);
  const user=token&&value.users.find(item=>item.id===token.userId);
  if(!user)problem(401,'UNAUTHENTICATED','Sign in to a local demo account to continue.');
  return user;
}
function body(value:unknown):Record<string,any>{
  if(value===undefined)return{};
  if(!value||typeof value!=='object'||Array.isArray(value))problem(400,'VALIDATION','Check the entered details.');
  return value as Record<string,any>;
}
function fields(value:Record<string,any>,allowed:string[]){if(Object.keys(value).some(key=>!allowed.includes(key)))problem(400,'VALIDATION','This preview request contains unsupported fields.');}
function text(value:unknown,label:string,min=1,max=200){
  if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)problem(400,'VALIDATION',`Enter ${label}${min>1?` (${min}–${max} characters)`:''}.`);
  return value.trim();
}
function email(value:unknown){const result=text(value,'a valid email address',3,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))problem(400,'VALIDATION','Enter a valid email address.');return result;}
function phone(value:unknown){const result=text(value,'a valid phone number',7,24);if(!/^\+?[0-9 ()-]{7,24}$/.test(result))problem(400,'VALIDATION','Enter a valid phone number.');return result;}
function password(value:unknown){if(typeof value!=='string'||value.length<12||value.length>200)problem(400,'VALIDATION','Use a password with 12–200 characters. Use made-up details for this preview.');return value;}
function number(value:unknown,label:string,min:number,max:number){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)problem(400,'VALIDATION',`Enter ${label} between ${min} and ${max}.`);return value;}
function coordinates(data:Record<string,any>){
  const latitude=data.latitude??null,longitude=data.longitude??null;
  if((latitude===null)!==(longitude===null))problem(400,'VALIDATION','Provide both coordinates or leave both empty.');
  return{latitude:latitude===null?null:number(latitude,'latitude',-90,90),longitude:longitude===null?null:number(longitude,'longitude',-180,180)};
}
function resource(item:Owned){const{userId,...visible}=item;return copy(visible);}
function own(items:Owned[],userId:string,resourceId:string,label:string){const result=items.find(item=>item.id===resourceId&&item.userId===userId);if(!result)problem(404,'NOT_FOUND',`${label} was not found in this demo account.`);return result;}
function notify(value:DemoState,userId:string,title:string,message:string){value.notifications.unshift({id:id(),userId,title,message,readAt:null,createdAt:now()});}
function event(booking:Owned,message:string){booking.updatedAt=now();booking.events.push({status:booking.status,message,at:booking.updatedAt});}

function stations(){
  return[
    {id:'demo-addis',name:'Demo · Addis Ababa training bay',city:'Addis Ababa',address:'Sample location only — not a real Evpower station',latitude:9.0108,longitude:38.7613},
    {id:'demo-adama',name:'Demo · Adama training bay',city:'Adama',address:'Sample location only — not a real Evpower station',latitude:8.5406,longitude:39.2686},
  ].map(item=>({...item,verified:true,isDemo:true,connectors:[{id:'demo-1',type:'CCS2',powerKw:60,status:'unknown',lastSeenAt:null}],availableCount:0,totalCount:1,availabilityUpdatedAt:null}));
}

export function resetBrowserDemo():void{
  generation++;state=undefined;initializing=null;sessions.clear();
  try{globalThis.localStorage?.removeItem(STORAGE_KEY);}catch{}
}

export async function browserDemoRequest<T>(rawPath:string,options:Options={},accessToken?:string|null):Promise<T>{
  const value=await getState();const expected=generation;
  const method=(options.method||'GET').toUpperCase();
  const path=rawPath.split('?')[0];const data=body(options.body);
  const result=await route();current(value,expected);return copy(result) as T;

  async function route():Promise<any>{
    if(method==='GET'&&path==='/v1/config')return{name:'Evpower',currency:'ETB',serviceCities:CITIES,paymentsEnabled:false,telemetryConfigured:false,emailDeliveryEnabled:false,isDemo:true,isBrowserDemo:true,contact:{phone:'+251911049916',tollFree:'8890',email:'info@evpower.et',whatsapp:'+251911049916'}};
    if(method==='GET'&&path==='/v1/stations')return{items:stations()};
    if(method==='POST'&&path==='/v1/demo/session')return session(value,await ensureDemoPerson(value,expected));
    if(method==='POST'&&path==='/v1/auth/register'){
      fields(data,['name','email','phone','password']);
      const address=email(data.email);if(value.users.some(user=>user.email===address))problem(409,'ACCOUNT_EXISTS','That local demo email already exists. Sign in or reset the preview.');
      const user=await person(text(data.name,'your name',2,100),address,phone(data.phone),password(data.password));current(value,expected);
      if(value.users.some(item=>item.email===address))problem(409,'ACCOUNT_EXISTS','That local demo email already exists.');
      value.users.push(user);save(value);return session(value,user);
    }
    if(method==='POST'&&path==='/v1/auth/login'){
      fields(data,['email','password']);const user=value.users.find(item=>item.email===email(data.email));
      const encoded=user?await passwordDigest(String(data.password||''),user.salt):'';current(value,expected);
      if(!user||user.passwordHash!==encoded)problem(401,'INVALID_CREDENTIALS','The local demo email or password does not match. You can use Try demo account.');
      return session(value,user);
    }
    if(method==='POST'&&path==='/v1/auth/refresh'){
      const found=Array.from(sessions.entries()).find(([,item])=>item.refreshToken===data.refreshToken);
      const user=found&&value.users.find(item=>item.id===found[1].userId);
      if(!found||!user)problem(401,'SESSION_EXPIRED','Sign in to the demo again.');
      sessions.delete(found[0]);return session(value,user);
    }
    if(method==='POST'&&path==='/v1/auth/logout'){
      for(const[token,item]of sessions)if(item.refreshToken===data.refreshToken)sessions.delete(token);
      return{message:'Signed out of this browser demo.'};
    }
    if(method==='POST'&&path==='/v1/auth/password-reset')return{message:'This is a browser-only preview. No reset email was sent. Use Try demo account or reset the preview; no real account is affected.'};
    if(method==='POST'&&['/v1/auth/password-reset/complete','/v1/auth/verify-email','/v1/auth/resend-verification'].includes(path))problem(503,'DEMO_EMAIL_DISABLED','Email delivery is disabled in this browser preview. Use Try demo account or reset the preview.');
    const user=authenticated(value,accessToken);
    if(path==='/v1/me'){
      if(method==='GET')return publicPerson(user);
      if(method==='PATCH'){fields(data,['name','phone']);if(data.name!==undefined)user.name=text(data.name,'your name',2,100);if(data.phone!==undefined)user.phone=phone(data.phone);save(value);return publicPerson(user);}
      if(method==='DELETE'){
        const encoded=await passwordDigest(String(data.password||''),user.salt);current(value,expected);
        if(encoded!==user.passwordHash)problem(401,'INVALID_CREDENTIALS','Enter this local demo account’s password. The sample account uses EvpowerDemo2026!');
        if(value.bookings.some(item=>item.userId===user.id&&['requested','confirmed','en_route','arrived','charging'].includes(item.status)))problem(409,'ACTIVE_SERVICE','Cancel or finish your local demo requests before deleting this demo account.');
        value.users=value.users.filter(item=>item.id!==user.id);
        for(const key of ['vehicles','addresses','bookings','notifications','tickets'] as const)value[key]=value[key].filter(item=>item.userId!==user.id);
        value.keys=value.keys.filter(item=>item.userId!==user.id);
        for(const[token,item]of sessions)if(item.userId===user.id)sessions.delete(token);
        save(value);return{message:'This demo account and its data were deleted from this browser. No real Evpower account was affected.'};
      }
    }
    if(path==='/v1/vehicles'&&method==='GET')return{items:value.vehicles.filter(item=>item.userId===user.id).map(resource)};
    if(path==='/v1/vehicles'&&method==='POST'){
      fields(data,['make','model','plate','connector','batteryKwh']);if(!CONNECTORS.includes(data.connector))problem(400,'VALIDATION','Choose a supported connector.');
      const vehicle={id:id(),userId:user.id,make:text(data.make,'vehicle make',1,80),model:text(data.model,'vehicle model',1,80),plate:text(data.plate,'vehicle plate',1,40),connector:data.connector,batteryKwh:number(data.batteryKwh,'battery capacity',1,300)};
      value.vehicles.push(vehicle);save(value);return resource(vehicle);
    }
    const vehicleMatch=/^\/v1\/vehicles\/([^/]+)$/.exec(path);
    if(vehicleMatch){
      const vehicle=own(value.vehicles,user.id,decodeURIComponent(vehicleMatch[1]),'Vehicle');
      if(method==='DELETE'){value.vehicles=value.vehicles.filter(item=>item!==vehicle);for(const item of value.bookings)if(item.userId===user.id&&item.vehicleId===vehicle.id)item.vehicleId=null;save(value);return{message:'Demo vehicle removed.'};}
      if(method==='PATCH'){
        fields(data,['make','model','plate','connector','batteryKwh']);const next={...vehicle,...data};if(!CONNECTORS.includes(next.connector))problem(400,'VALIDATION','Choose a supported connector.');
        Object.assign(vehicle,{make:text(next.make,'vehicle make',1,80),model:text(next.model,'vehicle model',1,80),plate:text(next.plate,'vehicle plate',1,40),connector:next.connector,batteryKwh:number(next.batteryKwh,'battery capacity',1,300)});save(value);return resource(vehicle);
      }
    }
    if(path==='/v1/addresses'&&method==='GET')return{items:value.addresses.filter(item=>item.userId===user.id).map(resource)};
    if(path==='/v1/addresses'&&method==='POST'){
      fields(data,['label','address','latitude','longitude']);const item={id:id(),userId:user.id,label:text(data.label,'an address label',1,50),address:text(data.address,'an address',5,300),...coordinates(data)};
      value.addresses.push(item);save(value);return resource(item);
    }
    const addressMatch=/^\/v1\/addresses\/([^/]+)$/.exec(path);
    if(addressMatch&&method==='DELETE'){const item=own(value.addresses,user.id,decodeURIComponent(addressMatch[1]),'Address');value.addresses=value.addresses.filter(address=>address!==item);save(value);return{message:'Demo address removed.'};}
    if(path==='/v1/bookings'&&method==='GET')return{items:value.bookings.filter(item=>item.userId===user.id).slice().reverse().map(resource)};
    if(path==='/v1/bookings'&&method==='POST'){
      fields(data,['city','address','latitude','longitude','connector','requestedKwh','scheduledAt','notes','vehicleId']);
      if(!CITIES.includes(data.city)||!CONNECTORS.includes(data.connector))problem(400,'VALIDATION','Choose a listed service city and connector.');
      const key=Object.entries(options.headers||{}).find(([name])=>name.toLowerCase()==='idempotency-key')?.[1];
      if(!key||!/^[0-9a-f-]{36}$/i.test(key))problem(400,'VALIDATION','Please retry the request with a valid request key.');
      const normalized={city:data.city,address:text(data.address,'a pickup address',5,300),...coordinates(data),connector:data.connector,requestedKwh:number(data.requestedKwh,'requested energy',1,200),scheduledAt:data.scheduledAt||null,notes:text(data.notes??'','booking notes',0,1000),vehicleId:data.vehicleId||null};
      if(normalized.vehicleId)own(value.vehicles,user.id,normalized.vehicleId,'Vehicle');
      if(normalized.scheduledAt){const date=Date.parse(normalized.scheduledAt);if(!Number.isFinite(date)||date<Date.now()+60000||date>Date.now()+90*86400000)problem(400,'INVALID_SCHEDULE','Choose a time at least one minute ahead and within 90 days.');}
      const previous=value.keys.find(item=>item.userId===user.id&&item.key===key);const encoded=JSON.stringify(normalized);
      if(previous){if(previous.body!==encoded)problem(409,'IDEMPOTENCY_CONFLICT','This request key was already used for different demo details.');return resource(own(value.bookings,user.id,previous.bookingId,'Booking'));}
      const createdAt=now();const booking={id:id(),userId:user.id,reference:'DEMO-'+id().slice(0,8).toUpperCase(),status:'requested',...normalized,quoteMinor:null,paymentStatus:'unpaid',dispatchName:null,dispatchPhone:null,createdAt,updatedAt:createdAt,events:[{status:'requested',message:'Demo request saved only in this browser. No charging team was contacted.',at:createdAt}]};
      value.bookings.push(booking);value.keys.push({userId:user.id,key,body:encoded,bookingId:booking.id});notify(value,user.id,'Demo request saved','This test request stays in your browser. No real service was requested.');save(value);return resource(booking);
    }
    const bookingMatch=/^\/v1\/bookings\/([^/]+)(?:\/(cancel|pay))?$/.exec(path);
    if(bookingMatch){
      const booking=own(value.bookings,user.id,decodeURIComponent(bookingMatch[1]),'Booking');
      if(method==='GET'&&!bookingMatch[2])return resource(booking);
      if(method==='POST'&&bookingMatch[2]==='cancel'){
        if(booking.status==='cancelled')return resource(booking);
        if(!['requested','confirmed','en_route','arrived'].includes(booking.status))problem(409,'INVALID_TRANSITION','Only a demo request before charging can be cancelled.');
        booking.status='cancelled';if(booking.paymentStatus==='paid')booking.paymentStatus='refunded';event(booking,'Demo request cancelled locally. No real service or money was involved.');notify(value,user.id,'Demo request cancelled','This only changed the local browser preview.');save(value);return resource(booking);
      }
      if(method==='POST'&&bookingMatch[2]==='pay'){
        if(booking.paymentStatus==='paid')return resource(booking);
        if(booking.status!=='confirmed'||booking.quoteMinor===null)problem(409,'QUOTE_REQUIRED','Advance the demo request to confirmation before testing payment.');
        if(booking.quoteMinor!==0)problem(409,'INSUFFICIENT_CREDIT','Real money and service credit are disabled in this demo.');
        booking.paymentStatus='paid';event(booking,'Zero-cost demo quote accepted locally. No payment was taken.');save(value);return resource(booking);
      }
    }
    if(path==='/v1/demo/advance'&&method==='POST'){
      const booking=value.bookings.slice().reverse().find(item=>item.userId===user.id&&FLOW.includes(item.status)&&item.status!=='completed');
      if(!booking)problem(409,'NO_DEMO_BOOKING','Create a demo booking first, then use Advance demo booking.');
      booking.status=FLOW[FLOW.indexOf(booking.status)+1];if(booking.status==='confirmed')booking.quoteMinor=0;
      event(booking,'Manually simulated '+booking.status.replace(/_/g,' ')+' in the browser preview. No real team or charger is connected.');
      notify(value,user.id,'Demo status updated','Simulated '+booking.status.replace(/_/g,' ')+'. No real service was dispatched.');save(value);return resource(booking);
    }
    if(path==='/v1/wallet'&&method==='GET')return{balanceMinor:0,currency:'ETB',paymentsEnabled:false,transactions:[],pendingTopups:[]};
    if(path.startsWith('/v1/wallet/topups')||path.startsWith('/v1/payments/'))problem(503,'DEMO_PAYMENTS_DISABLED','Payments are disabled in this browser preview. No money can be added or charged.');
    if(path==='/v1/notifications'&&method==='GET')return{items:value.notifications.filter(item=>item.userId===user.id).map(resource)};
    const noticeMatch=/^\/v1\/notifications\/([^/]+)\/read$/.exec(path);
    if(noticeMatch&&method==='POST'){const notice=own(value.notifications,user.id,decodeURIComponent(noticeMatch[1]),'Notification');notice.readAt=now();save(value);return resource(notice);}
    if(path==='/v1/support'&&method==='POST'){
      fields(data,['subject','message']);const ticket={id:id(),userId:user.id,subject:text(data.subject,'a subject',3,150),message:text(data.message,'a support message',10,3000),status:'open',createdAt:now()};
      value.tickets.push(ticket);save(value);return{id:ticket.id,status:'open',message:'Demo enquiry saved only in this browser. Evpower has not received a message.'};
    }
    problem(404,'DEMO_ROUTE_UNAVAILABLE','That action is not available in the browser preview. No request was sent to a server.');
  }
}
