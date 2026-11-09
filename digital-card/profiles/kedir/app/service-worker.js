/* Each card owns only its exact page and precached assets. */
const SCOPE=new URL(self.registration.scope);
const PREFIX='evpower-card-v2:'+encodeURIComponent(SCOPE.href)+':';
const CACHE=PREFIX+'d8ff04841dc39b';
const FILES=["app.webmanifest", "assets/card.css", "assets/card.js", "assets/emblem.png", "assets/evpower-contact-qr.png", "assets/evpower-contact-qr.svg", "assets/evpower-kedir-kemal.vcf", "assets/icon-180.png", "assets/icon-192.png", "assets/icon-512.png", "assets/logo.png", "assets/preloader.css", "index.html"];
const URLs=FILES.map(path=>new URL(path,self.registration.scope).href);
const ALLOWED=new Set(URLs);
const INDEX=new URL('index.html',self.registration.scope).href;
const INDEX_PATH=new URL(INDEX).pathname;
const READY={type:'EVPC_CACHE_READY',scope:self.registration.scope};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLs)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll()).then(clients=>clients.forEach(client=>client.postMessage(READY))))});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='EVPC_CHECK_READY'){event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(URLs.map(url=>cache.match(url)))).then(results=>{if(results.every(Boolean)&&event.source)event.source.postMessage(READY)}))}});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==SCOPE.origin)return;
  if(event.request.mode==='navigate'){
    if(url.pathname!==SCOPE.pathname&&url.pathname!==INDEX_PATH)return;
    const fallback=()=>caches.open(CACHE).then(cache=>cache.match(INDEX)).then(cached=>cached||new Response('Open this card online once to prepare offline access.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}}));
    event.respondWith(fetch(event.request).then(response=>{if(!response.ok)return fallback();const copy=response.clone();return caches.open(CACHE).then(cache=>cache.put(INDEX,copy)).then(()=>response)}).catch(fallback));
  }else{
    if(!ALLOWED.has(url.href))return;
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request)));
  }
});
