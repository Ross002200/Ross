// Diogenes offline cache: pages are fetched network-first (so a new version shows up right away),
// other shell files are served from cache and refreshed in the background.
const CACHE="diogenes-v10";
const SHELL=["./","index.html","pro.html","manifest.webmanifest","icon.svg","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("diogenes-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.includes("/data/")) return;   // fonts and scan data go to the network
  const save=r=>{ if(r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); } return r; };
  if(e.request.mode==="navigate"||u.pathname.endsWith(".html")||u.pathname.endsWith("/")){
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(save).catch(()=>caches.match(e.request).then(h=>h||caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>{
    const net=fetch(e.request).then(save).catch(()=>hit);
    return hit||net;
  }));
});
