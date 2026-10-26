// Diogenes offline cache: pages are fetched network-first (so a new version shows up right away),
// other shell files are served from cache and refreshed in the background.
// v13: shell is installed with cache:"reload" (never from the browser's HTTP cache) and navigations are fetched by URL,
// because fetch(navigateRequest, init) throws in some browsers (iOS Safari) and silently fell back to a stale copy.
const CACHE="diogenes-v21";
const SHELL=["./","index.html","pro.html","klasik.html","manifest.webmanifest","icon.svg","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("diogenes-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// 2026-10-26: uygulama bildirimi — push içeriksiz gelir, en yeni bildirim servisten okunup gösterilir
const PUSH="https://diogenes-bildirim.diyaross.workers.dev";
self.addEventListener("push",e=>{
  e.waitUntil(fetch(PUSH+"/son?n=1",{cache:"no-store"}).then(r=>r.json()).then(d=>{
    const x=(d.bildirimler||[])[0]||{title:"Diogenes",message:"Yeni bildirim var"};
    return self.registration.showNotification(x.title,{body:x.message,tag:x.id||"diogenes",icon:"icon-192.png",badge:"icon-192.png"});
  }).catch(()=>self.registration.showNotification("Diogenes",{body:"Yeni bildirim var",icon:"icon-192.png"})));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(ws=>{
    for(const w of ws){ if("focus" in w) return w.focus(); }
    return clients.openWindow("./");
  }));
});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.includes("/data/")) return;   // fonts and scan data go to the network
  const save=(req,r)=>{ if(r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); } return r; };
  if(e.request.mode==="navigate"||u.pathname.endsWith(".html")||u.pathname.endsWith("/")){
    const key=u.origin+u.pathname;  // ignore ?query so a cache-busting link still finds the offline copy
    e.respondWith(fetch(key,{cache:"no-store",credentials:"same-origin"}).then(r=>save(key,r))
      .catch(()=>caches.match(key).then(h=>h||caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>{
    const net=fetch(e.request).then(r=>save(e.request,r)).catch(()=>hit);
    return hit||net;
  }));
});
