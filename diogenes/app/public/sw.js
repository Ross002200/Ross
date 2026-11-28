// Ağ önce; ağ yoksa son kopya. API hiç önbelleğe alınmaz. Push: içeriksiz gelir, son bildirim kendi sunucumuzdan okunur.
const C="diogenes-v2";
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.startsWith("/api/"))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));}return r;}).catch(()=>caches.match(e.request)));
});
const goster=x=>self.registration.showNotification(x.title||"Diogenes",{body:x.message||"Yeni bildirim var",tag:x.id||"diogenes",icon:"/icon-192.png",badge:"/icon-192.png",data:{url:"/?sekme=piyasa"}});
self.addEventListener("push",e=>{
  e.waitUntil(fetch("/api/bildirim/son",{cache:"no-store"}).then(r=>r.json()).then(d=>goster((d.bildirimler||[])[0]||{})).catch(()=>goster({})));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();const u=e.notification.data?.url||"/";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(ws=>{for(const w of ws)if("focus" in w){w.navigate(u);return w.focus();}return clients.openWindow(u);}));
});
