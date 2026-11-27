// Uçtan uca duman testi: `npm run dev` açıkken temiz yerel veritabanına karşı çalışır.
import fs from "node:fs";
import assert from "node:assert/strict";
const TABAN=process.env.DIOGENES_TABAN||"http://127.0.0.1:8787";
const vars=Object.fromEntries(fs.readFileSync(new URL("../.dev.vars",import.meta.url),"utf8").split(/\r?\n/).filter(Boolean).map(l=>l.split(/=(.*)/s).slice(0,2)));
let cerez="";
async function istek(yol,{method="GET",govde}={}){
  const r=await fetch(TABAN+yol,{method,headers:{"Content-Type":"application/json",cookie:cerez},body:govde?JSON.stringify(govde):undefined});
  const sc=r.headers.get("set-cookie");if(sc)cerez=sc.split(";")[0];
  return {status:r.status,j:await r.json().catch(()=>({}))};
}
const tamam=async(yol,o)=>{const r=await istek(yol,o);assert.ok(r.status<300,`${yol} → ${r.status} ${JSON.stringify(r.j)}`);return r.j;};
const zarf=(d,ad)=>d.durum.zarflar.find(z=>z.ad===ad);

assert.equal((await istek("/api/durum")).status,401,"girişsiz durum 401");
assert.equal((await istek("/api/login",{method:"POST",govde:{password:"yanlis"}})).status,401);
await tamam("/api/login",{method:"POST",govde:{password:vars.AUTH_PASSWORD}});
let d=await tamam("/api/durum");assert.equal(d.kurulum,false);

await tamam("/api/liste",{method:"PUT",govde:{tablo:"gelir_plani",satirlar:[{ad:"Aile",tutar:"15.000",gun:1},{ad:"Burs",tutar:"4.000",gun:7},{ad:"Destek",tutar:"16.000",gun:16}]}});
await tamam("/api/liste",{method:"PUT",govde:{tablo:"zarflar",satirlar:[{ad:"Kira",aylik:"10.000"},{ad:"Yemek",aylik:"6.000"}]}});
await tamam("/api/liste",{method:"PUT",govde:{tablo:"merdiven",satirlar:[{ad:"Borçsuzluk",kural:"borc"},{ad:"Acil fon",kural:"acil3"},{ad:"Yatırım"}]}});
await tamam("/api/ayar",{method:"POST",govde:{anahtar:"kurulum",deger:"1"}});

const bozuk=await istek("/api/harcama",{method:"POST",govde:{tutar:"0",aciklama:"x"}});
assert.equal(bozuk.status,400);assert.equal(bozuk.j.error,"Tutar sıfır olamaz.");

await tamam("/api/gelir",{method:"POST",govde:{tutar:"15.000",aciklama:"Deneme geliri"}});
d=await tamam("/api/durum");
assert.equal(d.durum.atanmamis,1500000);
const dag=d.oneriler.find(o=>o.tur==="dagitim");
assert.deepEqual(dag.satirlar.map(s=>[s.ad,s.tutar]),[["Kira",1000000],["Yemek",500000]]);
await tamam("/api/oneri",{method:"POST",govde:{id:dag.id,karar:"onayla"}});
assert.equal((await istek("/api/oneri",{method:"POST",govde:{id:dag.id,karar:"onayla"}})).status,409,"ikinci onay 409");
d=await tamam("/api/durum");
assert.equal(d.durum.atanmamis,0);assert.equal(zarf(d,"Kira").kalan,1000000);

const h={istek_id:"duman-1",tutar:"6.000",aciklama:"Market",zarf_id:zarf(d,"Yemek").id};
await tamam("/api/harcama",{method:"POST",govde:h});
await tamam("/api/harcama",{method:"POST",govde:h});
d=await tamam("/api/durum");
assert.equal(zarf(d,"Yemek").harcanan,600000,"aynı istek_id çoğalmaz");
const kay=d.oneriler.find(o=>o.tur==="kaydirma");assert.ok(kay,"eksi zarf için kaydırma önerisi");
await tamam("/api/oneri",{method:"POST",govde:{id:kay.id,karar:"onayla"}});
d=await tamam("/api/durum");
assert.equal(zarf(d,"Yemek").kalan,0);assert.equal(zarf(d,"Kira").kalan,900000);

const once=(await tamam("/api/durum")).oneriler.length;
for(let i=0;i<2;i++){const r=await fetch(TABAN+"/__scheduled?cron="+encodeURIComponent("0 5 * * *"));assert.equal(r.status,200);}
assert.ok((await tamam("/api/durum")).oneriler.length<=once+3,"zamanlayıcı iki kez çalışınca çift öneri yok");

await tamam("/api/liste",{method:"PUT",govde:{tablo:"zarflar",satirlar:[{id:zarf(d,"Kira").id,ad:"Kira",aylik:"10.000"}]}});
d=await tamam("/api/durum");
assert.equal(d.durum.zarflar.length,1);assert.equal(d.durum.atanmamis,0,"silinen Yemek'in kalanı 0'dı");
const g=await tamam(`/api/gecmis?ay=${d.ay}`);assert.equal(g.harcamalar.length,1);

// K1: silinmiş zarftaki harcama zarfını koruyarak düzenlenebilir; silinince parası atanmamışa döner.
const yemekId=h.zarf_id,market=g.harcamalar[0];
await tamam("/api/harcama/duzenle",{method:"POST",govde:{id:market.id,tutar:"6.000",aciklama:"Market (düzeltildi)",zarf_id:yemekId,tarih:market.tarih}});
await tamam("/api/harcama/sil",{method:"POST",govde:{id:market.id}});
d=await tamam("/api/durum");assert.equal(d.durum.atanmamis,600000,"silinen zarftaki harcama silinince para kaybolmaz");

// Ö4: gelir düzenlenince bekleyen öneri yeni tutarla yenilenir; silinince öneri kalkar.
const ek=await tamam("/api/gelir",{method:"POST",govde:{tutar:"1.000",aciklama:"Ek iş"}});
await tamam("/api/gelir/duzenle",{method:"POST",govde:{id:ek.id,tutar:"500",aciklama:"Ek iş",tarih:d.bugun}});
d=await tamam("/api/durum");
const ekOneri=()=>d.oneriler.filter(o=>o.tur==="dagitim"&&o.baslik.includes("geldi")&&!o.baslik.includes("?"));
assert.deepEqual(ekOneri().map(o=>o.toplam),[50000],"düzenlenen gelirin önerisi yeni tutarla");
await tamam("/api/gelir/sil",{method:"POST",govde:{id:ek.id}});
d=await tamam("/api/durum");assert.equal(ekOneri().length,0,"silinen gelirin önerisi kalkar");

// Ö5: zarfı eksiye düşüren abonelik onayı kaydırma önerisi üretir.
await tamam("/api/liste",{method:"PUT",govde:{tablo:"abonelikler",satirlar:[{ad:"Büyük abonelik",tutar:"10.000",gun:Number(d.bugun.slice(8)),zarf_id:zarf(d,"Kira").id}]}});
await fetch(TABAN+"/__scheduled?cron="+encodeURIComponent("0 5 * * *"));
d=await tamam("/api/durum");
const abo=d.oneriler.find(o=>o.tur==="abonelik");assert.ok(abo,"abonelik önerisi");
await tamam("/api/oneri",{method:"POST",govde:{id:abo.id,karar:"onayla"}});
d=await tamam("/api/durum");assert.ok(zarf(d,"Kira").kalan<0);
assert.ok(d.oneriler.some(o=>o.tur==="kaydirma"),"abonelik sonrası eksi zarf için kaydırma önerisi");

// Ö6: aynı anda gelen yanlış şifreler sınırı aşamaz.
const yanit=await Promise.all(Array.from({length:12},()=>fetch(TABAN+"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:"yanlis"})}).then(r=>r.status)));
assert.ok(yanit.filter(x=>x===401).length<=8,"en çok 8 deneme kontrol edilir: "+yanit.join(","));
console.log("Duman testi GEÇTİ");
