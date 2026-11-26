// Yönetim paneli sunucusu: yalnız 127.0.0.1, açılış anahtarı, tek iş. Çalıştırma: node yonet/sunucu.mjs
import http from "node:http";
import {readFileSync,writeFileSync,existsSync,renameSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {exec} from "node:child_process";
import {fileURLToPath} from "node:url";
import {IsYoneticisi,kabukCalistir} from "./is.mjs";
import {PROJELER} from "./projeler.mjs";
import {testIsi,yayinIsi,yedekIsi,sirlarIsi,anahtarIsi,ANAHTARLAR,durumTopla,istanbulBugun} from "./isler.mjs";

const SAYFA=new URL("./sayfa.html",import.meta.url),SON=new URL("./son-is.json",import.meta.url);
const json=(res,kod,v)=>{res.writeHead(kod,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(v));};
const govde=req=>new Promise(r=>{let s="";req.on("data",d=>{s+=d;if(s.length>10000){req.destroy();r({});}});req.on("end",()=>{try{r(s?JSON.parse(s):{});}catch{r({});}});req.on("close",()=>r({}));});
// Son iş kaydı: bozuk ya da yoksa null; yazım geçici dosya + yeniden adlandırma (yarıda kesilirse bozuk kalmaz).
export function sonOku(f){try{return existsSync(f)?JSON.parse(readFileSync(f,"utf8")):null;}catch{return null;}}
export function sonYaz(f,v){const g=`${f}.tmp`;writeFileSync(g,JSON.stringify(v));renameSync(g,f);}

export function sunucuKur({token,yonetici,durumFn,oncekiYarim=null,cikis=()=>process.exit(0)}){
  const s=http.createServer(async(req,res)=>{
    const url=new URL(req.url,"http://127.0.0.1"),kapi=s.address()?.port;
    if(url.pathname==="/"){
      if(url.searchParams.get("t")!==token)return json(res,403,{error:"Yetkisiz."});
      res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
      return res.end(readFileSync(SAYFA,"utf8").replace("__TOKEN__",token));
    }
    if(req.headers.host!==`127.0.0.1:${kapi}`)return json(res,403,{error:"İstek reddedildi."});
    if(!url.pathname.startsWith("/api/"))return json(res,404,{error:"Bulunamadı."});
    if(req.headers["x-yonet"]!==token)return json(res,403,{error:"Yetkisiz."});
    const o=req.headers.origin;if(o&&o!==`http://127.0.0.1:${kapi}`)return json(res,403,{error:"İstek reddedildi."});
    const baslat=(ad,fn,bilinen)=>{try{yonetici.baslat(ad,fn,bilinen);return json(res,202,{ok:true});}catch{return json(res,409,{error:`Şu an çalışan iş var: ${yonetici.durum().ad}`});}};
    if(url.pathname==="/api/projeler"&&req.method==="GET")return json(res,200,{projeler:PROJELER.map(p=>({id:p.id,ad:p.ad,adres:p.adres,yayin:p.yayin.length>0})),anahtarlar:ANAHTARLAR.map(a=>({id:a.id,ad:a.ad})),yarim:oncekiYarim});
    if(url.pathname==="/api/is"&&req.method==="GET")return json(res,200,yonetici.durum());
    if(url.pathname==="/api/kapat"&&req.method==="POST"){const b=await govde(req);if(yonetici.mesgul&&b.zorla!==true)return json(res,409,{error:`İş sürüyor: ${yonetici.durum().ad}. Kapatılırsa yarım kalabilir.`});json(res,200,{ok:true});setTimeout(cikis,100);return;}
    if(url.pathname==="/api/durum"&&req.method==="POST")return baslat("Durum",async()=>({ok:true,ozet:"Durum güncellendi",veri:await durumFn()}));
    if(url.pathname==="/api/is"&&req.method==="POST"){
      const b=await govde(req),ids=PROJELER.map(p=>p.id);
      if(b.tur==="test"){const hedef=b.proje==="hepsi"?ids:[b.proje];if(!hedef.every(i=>ids.includes(i)))return json(res,400,{error:"Bilinmeyen proje."});return baslat(`Test: ${b.proje}`,testIsi(hedef));}
      if(b.tur==="yayin"){if(b.onay!==true)return json(res,400,{error:"Onay gerekli."});if(!ids.includes(b.proje))return json(res,400,{error:"Bilinmeyen proje."});return baslat(`Yayın: ${b.proje}`,yayinIsi(b.proje));}
      if(b.tur==="yedek")return baslat("Yedek",yedekIsi(istanbulBugun()));
      if(b.tur==="sirlar")return baslat("Sırlar",sirlarIsi());
      if(b.tur==="anahtar"){if(b.onay!==true)return json(res,400,{error:"Onay gerekli."});if(!ANAHTARLAR.some(a=>a.id===b.anahtar))return json(res,400,{error:"Bilinmeyen anahtar."});const deger=randomBytes(24).toString("hex");return baslat(`Anahtar: ${b.anahtar}`,anahtarIsi(b.anahtar,deger),[deger]);}
      return json(res,400,{error:"Bilinmeyen iş."});
    }
    return json(res,404,{error:"Bulunamadı."});
  });
  return s;
}

// Doğrudan çalıştırılınca: sunucuyu aç, tarayıcıyı başlat, son işi kaydet.
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const token=randomBytes(32).toString("hex"),yonetici=new IsYoneticisi(kabukCalistir);
  const d={adim:a=>new Promise(r=>{const cikti=[];kabukCalistir(a,s=>cikti.push(s)).then(k=>r({ok:k===0,cikti}));}),fetch};
  const once=sonOku(SON),oncekiYarim=once&&(once.calisiyor||once.yarim)?{ad:once.ad,zaman:once.zaman}:null;
  const s=sunucuKur({token,yonetici,durumFn:()=>durumTopla(d),oncekiYarim});
  let sonImza="";
  setInterval(()=>{const x=yonetici.durum();if(!x.ad)return;const v={ad:x.ad,calisiyor:x.calisiyor,sonuc:x.sonuc?{ok:x.sonuc.ok,ozet:x.sonuc.ozet}:null},i=JSON.stringify(v);if(i!==sonImza){sonImza=i;try{sonYaz(SON,{...v,zaman:new Date().toISOString()});}catch{/* kayıt yazılamazsa panel çalışmaya devam eder */}}},1000);
  const kapat=()=>{try{(IsYoneticisi.aktif)?.kill();}catch{}process.exit(0);};
  process.on("SIGINT",kapat);process.on("SIGTERM",kapat);process.on("SIGHUP",kapat);
  s.listen(0,"127.0.0.1",()=>{
    const adres=`http://127.0.0.1:${s.address().port}/?t=${token}`;
    console.log("Yönetim paneli açık. Bu pencereyi kapatınca panel durur.");
    if(process.env.YONET_ADRES_YAZ)console.log(adres);
    else exec(`start "" "${adres}"`);
  });
}
