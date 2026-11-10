const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/api.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const session=(accessToken='old',refreshToken='refresh-old')=>({accessToken,refreshToken,user:{id:'customer',name:'Test customer'}});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function harness(fetch,storage={value:null},platform='web'){
  const module={exports:{}};
  const secure={WHEN_UNLOCKED_THIS_DEVICE_ONLY:1,async getItemAsync(){return storage.value;},async setItemAsync(_key,value){storage.value=value;},async deleteItemAsync(){storage.value=null;}};
  vm.runInNewContext(source,{module,exports:module.exports,require(name){if(name==='react-native')return{Platform:{OS:platform}};if(name==='expo-secure-store')return secure;if(name==='expo-crypto')return{randomUUID};throw new Error(name);},fetch,AbortController,setTimeout,clearTimeout,process:{env:{}},__DEV__:true});
  return{api:new module.exports.ApiClient('https://api.example.test'),secure,storage};
}
test('parallel expired requests share one refresh and use the rotated credential',async()=>{
  let refreshes=0;
  const gate=deferred();
  const h=harness(async(url,options)=>{
    if(url.endsWith('/auth/refresh')){refreshes++;await gate.promise;return json(session('new','refresh-new'));}
    return options.headers.Authorization==='Bearer new'?json({ok:true}):json({error:{message:'Expired'}},401);
  });
  await h.api.setSession(session());
  const a=h.api.request('/v1/me'),b=h.api.request('/v1/wallet');
  await new Promise(r=>setImmediate(r));gate.resolve();
  assert.equal((await a).ok,true);assert.equal((await b).ok,true);assert.equal(refreshes,1);
});
test('a refresh completing after logout cannot restore the signed-out session',async()=>{
  const gate=deferred();const seen=[];
  const h=harness(async(url)=>{
    if(url.endsWith('/auth/refresh')){await gate.promise;return json(session('new','refresh-new'));}
    if(url.endsWith('/auth/logout'))return json({});
    return json({error:{message:'Expired'}},401);
  });
  h.api.onSession=s=>seen.push(s?.accessToken||null);await h.api.setSession(session());
  const pending=h.api.request('/v1/me');await new Promise(r=>setImmediate(r));
  await h.api.logout();gate.resolve();
  await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');assert.equal(seen.at(-1),null);assert.ok(!seen.includes('new'));
});
test('temporary refresh outages preserve the native credential for retry',async()=>{
  let offline=true;const storage={value:'saved-refresh'};
  const h=harness(async()=>{if(offline)throw new Error('Offline');return json(session('new','rotated'));},storage,'ios');
  await assert.rejects(h.api.restore(),e=>e.code==='NETWORK_ERROR');assert.equal(storage.value,'saved-refresh');
  offline=false;await h.api.restore();assert.equal(storage.value,'rotated');
});
test('native credential writes finish before a later logout deletion',async()=>{
  const h=harness(async()=>json({}),{value:null},'ios');const gate=deferred();const events=[];
  h.secure.setItemAsync=async(_key,value)=>{events.push('write-start');await gate.promise;h.storage.value=value;events.push('write-end');};
  h.secure.deleteItemAsync=async()=>{events.push('delete');h.storage.value=null;};
  const signedIn=h.api.setSession(session());await new Promise(r=>setImmediate(r));
  const signedOut=h.api.clear();gate.resolve();await Promise.all([signedIn,signedOut]);
  assert.deepEqual(events,['write-start','write-end','delete']);assert.equal(h.storage.value,null);
});
