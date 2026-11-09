/* Offline storage is scoped only to this card app. */
const CACHE='evpower-phone-card-66fc58255b5136';
const FILES=["app.webmanifest", "assets/card.css", "assets/card.js", "assets/evpower-ahmed-kemal.vcf", "assets/evpower-contact-qr.png", "assets/evpower-contact-qr.svg", "assets/icon-180.png", "assets/icon-192.png", "assets/icon-512.png", "assets/logo.png", "index.html"];
const URLs=FILES.map(path=>new URL(path,self.registration.scope).href);
const INDEX=new URL('index.html',self.registration.scope).href;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLs)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('evpower-phone-card-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll()).then(clients=>clients.forEach(client=>client.postMessage({type:'EVPC_CACHE_READY'}))))});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='EVPC_CHECK_READY'){event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(URLs.map(url=>cache.match(url)))).then(results=>{if(results.every(Boolean)&&event.source)event.source.postMessage({type:'EVPC_CACHE_READY'})}))}});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(INDEX,copy));return response}return caches.match(INDEX).then(cached=>cached||response)}).catch(()=>caches.match(INDEX)));
  }else{
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  }
});
