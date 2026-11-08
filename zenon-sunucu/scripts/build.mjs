// Kökteki Zenon dosyalarını public/ içine kopyalar; sw.js önbellek adını her yayında yeniler.
import {cpSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
const kok=new URL("../../",import.meta.url),pub=new URL("../public/",import.meta.url);
export const DOSYALAR=["index.html","zenon.css","zenon-care.js","zenon-sync.js","zenon-plan.js","zenon-coach.js","zenon.js","manifest.webmanifest","icon.svg","icon-180.png","icon-192.png","icon-512.png"];
rmSync(pub,{recursive:true,force:true});mkdirSync(pub,{recursive:true});
for(const f of DOSYALAR)cpSync(new URL(f,kok),new URL(f,pub));
cpSync(new URL("../giris.html",import.meta.url),new URL("giris.html",pub));
const sw=readFileSync(new URL("sw.js",kok),"utf8").replace(/const CACHE="[^"]*";/,`const CACHE="zenon-${Date.now().toString(36)}";`);
writeFileSync(new URL("sw.js",pub),sw);
console.log(`public/: ${DOSYALAR.length+2} dosya`);
