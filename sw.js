// Zenon offline cache: app shell served cache-first, refreshed in the background.
const CACHE="zenon-v2";
const SHELL=["./","index.html","zenon.css","zenon-care.js","zenon.js","manifest.webmanifest","icon.svg","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin) return;   // weather and fonts go to the network
  e.respondWith(caches.match(e.request).then(hit=>{
    const net=fetch(e.request).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); } return r; }).catch(()=>hit);
    return hit||net;
  }));
});
// Web Push: Seneca sunucusundaki Zenon servisi {title, body, tag, url} gönderir.
self.addEventListener("push",e=>{
  let d={}; try{ d=e.data?e.data.json():{}; }catch(err){ d={body:e.data?e.data.text():""}; }
  e.waitUntil(self.registration.showNotification(d.title||"Zenon",{body:d.body||"",tag:d.tag||"zenon",icon:"icon-192.png",badge:"icon-192.png",data:{url:d.url||"./#care"}}));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  const url=new URL((e.notification.data&&e.notification.data.url)||"./#care",self.registration.scope).href;
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(ws=>{
    const w=ws.find(c=>c.url.startsWith(self.registration.scope));
    if(w) return w.navigate(url).then(c=>(c||w).focus()).catch(()=>w.focus());
    return clients.openWindow(url);
  }));
});
