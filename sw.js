// Zenon offline cache: network-first (new versions show on the next open), cache fallback when offline or slow.
const CACHE="zenon-v8";
const SHELL=["./","index.html","zenon.css","zenon-care.js","zenon-plan.js","zenon-coach.js","zenon.js","manifest.webmanifest","icon.svg","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin) return;   // weather, fonts and the Seneca API go to the network
  const key=u.origin+u.pathname+u.search;
  e.respondWith(new Promise(resolve=>{
    let done=false; const finish=r=>{ if(!done&&r){ done=true; resolve(r); } };
    const slow=setTimeout(()=>caches.match(key).then(finish),3500);       // slow network: serve the cached copy
    fetch(key,{cache:"no-cache"}).then(r=>{
      if(r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(key,cp)); }
      clearTimeout(slow); finish(r);
    }).catch(()=>caches.match(key).then(h=>h||caches.match("./")).then(h=>{ clearTimeout(slow); finish(h||Response.error()); }));
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
