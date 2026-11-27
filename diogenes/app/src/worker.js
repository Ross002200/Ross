// Diogenes sunucusu (Cloudflare Worker + D1). Tek kullanıcı: şifreli giriş, imzalı çerez.
// Bütün hesaplar src/core.js'te (saf, testli); burası yalnız HTTP, D1 ve zamanlayıcı.
import {Hata,istanbulGun,durumOlusturucu,bekleyenDus,merdivenDurumu,dagitimOner,gunlukOneriler,uygulaSql,oneriGorunum,listeDogrula,LISTE_SUTUNLARI,harcamaDogrula,gelirDogrula,gecerliGun,tl,metinDogrula} from "./core.js";
import {zarfAdiCoz,zarfBul,esleKelimeleri,planBul,bugunCevabi} from "./dazai.js";

const COOKIE="diogenes_oturum",SESSION_SECONDS=180*24*3600,MAX_GOVDE=64*1024;
const enc=new TextEncoder();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sign(secret,payload){const k=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(await crypto.subtle.sign("HMAC",k,enc.encode(payload)))}
async function safeEqual(a,b){const [x,y]=await Promise.all([a,b].map(v=>crypto.subtle.digest("SHA-256",enc.encode(v))));const l=new Uint8Array(x),r=new Uint8Array(y);let d=0;for(let i=0;i<l.length;i++)d|=l[i]^r[i];return d===0}
async function createSession(secret){const exp=String(Math.floor(Date.now()/1000)+SESSION_SECONDS);return `${exp}.${await sign(secret,exp)}`}
async function verifySession(secret,token){if(!secret||!token)return false;const [exp,sig,...rest]=token.split(".");if(rest.length||!/^\d{1,12}$/.test(exp||"")||!sig)return false;if(Number(exp)*1000<=Date.now())return false;return safeEqual(sig,await sign(secret,exp))}
const cookieOf=(req,name)=>{const m=(req.headers.get("cookie")||"").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));return m?decodeURIComponent(m[1]):undefined};
const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}});
const nowIso=()=>new Date().toISOString();
async function govde(req){const len=Number(req.headers.get("content-length")||0);if(len>MAX_GOVDE)throw new Hata("İstek çok büyük.");const t=await req.text();if(t.length>MAX_GOVDE)throw new Hata("İstek çok büyük.");try{return t?JSON.parse(t):{}}catch{throw new Hata("Geçersiz istek.")}}
function sameOrigin(req){const o=req.headers.get("origin");return !o||o===new URL(req.url).origin}

async function login(req,env){
  if(!sameOrigin(req))return json({error:"İstek reddedildi."},403);
  const ip=req.headers.get("cf-connecting-ip")||"?",since=new Date(Date.now()-15*60000).toISOString();
  await env.DB.prepare("DELETE FROM login_attempts WHERE at<?").bind(new Date(Date.now()-86400000).toISOString()).run();
  // Deneme önce yazılır, sonra sayılır: aynı anda gelen istekler sınırı aşamaz.
  const at=nowIso()+"#"+crypto.randomUUID();
  await env.DB.prepare("INSERT INTO login_attempts(address,at) VALUES(?,?)").bind(ip,at).run();
  const n=await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE address=? AND at>?").bind(ip,since).first();
  if(n&&n.n>8)return json({error:"Çok fazla deneme. 15 dakika sonra tekrar dene."},429);
  let password="";try{password=String((await govde(req)).password||"")}catch{return json({error:"Geçersiz istek."},400)}
  if(!env.AUTH_PASSWORD||!password||!(await safeEqual(password,env.AUTH_PASSWORD)))return json({error:"Şifre yanlış."},401);
  await env.DB.prepare("DELETE FROM login_attempts WHERE address=? AND at=?").bind(ip,at).run();
  return json({ok:true},200,{"Set-Cookie":`${COOKIE}=${await createSession(env.SESSION_SECRET)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`});
}

const hepsi=async(env,sql,...p)=>(await env.DB.prepare(sql).bind(...p).all()).results;
async function veriYukle(env){
  const q=s=>hepsi(env,s);
  const [zarflar,gelirler,dagitimlar,harcamalar,aktarimlar,gelirPlani,abonelikler,borclar,birikimler,merdiven,ayarSatir]=await Promise.all([
    q("SELECT * FROM zarflar"),q("SELECT * FROM gelirler"),q("SELECT * FROM dagitimlar"),q("SELECT * FROM harcamalar"),q("SELECT * FROM aktarimlar"),
    q("SELECT * FROM gelir_plani ORDER BY gun,id"),q("SELECT * FROM abonelikler ORDER BY gun,id"),q("SELECT * FROM borclar ORDER BY id"),
    q("SELECT * FROM birikimler ORDER BY id"),q("SELECT * FROM merdiven ORDER BY sira,id"),q("SELECT * FROM ayarlar")]);
  const v={zarflar,gelirler,dagitimlar,harcamalar,aktarimlar,gelirPlani,abonelikler,borclar,birikimler,merdiven,ayarlar:Object.fromEntries(ayarSatir.map(r=>[r.anahtar,r.deger]))};
  v.durum=durumOlusturucu(v,istanbulGun(new Date()).slice(0,7));
  v.bekleyen=(await hepsi(env,"SELECT detay_json FROM oneriler WHERE tur='dagitim' AND durum='bekliyor'")).map(r=>JSON.parse(r.detay_json));
  v.dagitimDurumu=ay=>bekleyenDus(v.durum(ay),v.bekleyen);
  v.mctx={aylikToplam:zarflar.filter(z=>z.aktif).reduce((t,z)=>t+z.aylik_kurus,0),borcToplam:borclar.reduce((t,b)=>t+b.kalan_kurus,0)};
  v.aktifZarf=new Set(zarflar.filter(z=>z.aktif).map(z=>z.id));
  return v;
}
const oneriEkle=(env,tur,anahtar,detay)=>env.DB.prepare("INSERT INTO oneriler(tur,anahtar,detay_json,olusturma) VALUES(?,?,?,?) ON CONFLICT(anahtar) DO NOTHING").bind(tur,anahtar,JSON.stringify(detay),nowIso()).run();

async function durumYaniti(env,ay,bugun){
  const v=await veriYukle(env),zarfAd=new Map(v.zarflar.map(z=>[z.id,z.ad]));
  const bekleyen=await hepsi(env,"SELECT * FROM oneriler WHERE durum='bekliyor' ORDER BY id");
  return {bugun,ay,kurulum:v.ayarlar.kurulum==="1",getiri:Number(v.ayarlar.getiri||"0"),durum:v.durum(ay),
    oneriler:bekleyen.map(r=>oneriGorunum({id:r.id,tur:r.tur,detay:JSON.parse(r.detay_json)},{durum:v.durum,zarfAd,merdiven:v.merdiven,mctx:v.mctx})),
    merdiven:merdivenDurumu(v.merdiven,v.mctx),zarflar:v.zarflar,gelirPlani:v.gelirPlani,abonelikler:v.abonelikler,borclar:v.borclar,birikimler:v.birikimler,aylikToplam:v.mctx.aylikToplam};
}
async function zarfKontrol(env,zarfId){
  if(zarfId==null)return;
  const z=await env.DB.prepare("SELECT aktif FROM zarflar WHERE id=?").bind(zarfId).first();
  if(!z||!z.aktif)throw new Hata("Zarf bulunamadı.");
}
async function eksiKontrol(env,ay,zarfId,ref){
  if(zarfId==null)return;
  const v=await veriYukle(env),z=v.durum(ay).zarflar.find(z=>z.id===zarfId);
  if(!z||z.kalan>=0)return;
  const var_=await env.DB.prepare("SELECT 1 AS x FROM oneriler WHERE durum='bekliyor' AND anahtar LIKE ?").bind(`kaydirma:${ay}:${zarfId}:%`).first();
  if(!var_)await oneriEkle(env,"kaydirma",`kaydirma:${ay}:${zarfId}:${ref}`,{ay,zarf_id:zarfId});
}
async function harcamaEkle(env,b,bugun){
  const h=harcamaDogrula(b,bugun);await zarfKontrol(env,h.zarf_id);
  const istek=h.istek_id||crypto.randomUUID();
  await env.DB.prepare("INSERT INTO harcamalar(istek_id,tutar_kurus,aciklama,zarf_id,tarih,kaynak,etiket) VALUES(?,?,?,?,?,'el',?) ON CONFLICT(istek_id) DO NOTHING").bind(istek,h.tutar_kurus,h.aciklama,h.zarf_id,h.tarih,h.etiket).run();
  const row=await env.DB.prepare("SELECT id,zarf_id,tarih FROM harcamalar WHERE istek_id=?").bind(istek).first();
  await eksiKontrol(env,row.tarih.slice(0,7),row.zarf_id,row.id);
  return {ok:true,id:row.id};
}
async function harcamaDuzenle(env,b,bugun){
  const id=Number(b.id),h=harcamaDogrula({...b,istek_id:null},bugun);
  const eski=await env.DB.prepare("SELECT zarf_id FROM harcamalar WHERE id=?").bind(id).first();
  if(!eski)throw new Hata("Harcama bulunamadı.");
  if(h.zarf_id!==eski.zarf_id)await zarfKontrol(env,h.zarf_id);
  const r=await env.DB.prepare("UPDATE harcamalar SET tutar_kurus=?,aciklama=?,zarf_id=?,tarih=? WHERE id=?").bind(h.tutar_kurus,h.aciklama,h.zarf_id,h.tarih,id).run();
  if(!r.meta.changes)throw new Hata("Harcama bulunamadı.");
  await eksiKontrol(env,h.tarih.slice(0,7),h.zarf_id,id);
  return {ok:true};
}
async function gelirEkle(env,b,bugun,istek=null,planId=null){
  const g=gelirDogrula(b,bugun);
  const r=await env.DB.prepare("INSERT INTO gelirler(tutar_kurus,aciklama,tarih,istek_id,plan_id) VALUES(?,?,?,?,?)").bind(g.tutar_kurus,g.aciklama,g.tarih,istek,planId).run();
  const id=r.meta.last_row_id,ay=g.tarih.slice(0,7),v=await veriYukle(env),anahtar=`dagitim:gelir:${id}`;
  await oneriEkle(env,"dagitim",anahtar,{ay,tutar:g.tutar_kurus,gelir_id:id,kalemler:dagitimOner(g.tutar_kurus,v.dagitimDurumu(ay)).kalemler});
  const o=await env.DB.prepare("SELECT id,detay_json FROM oneriler WHERE anahtar=?").bind(anahtar).first();
  return {ok:true,id,oneri:o?{id:o.id,detay:JSON.parse(o.detay_json)}:null};
}
// Ö4: gelir düzenlenince ya da silinince bekleyen dağıtım önerisi eskir; düzenlemede yeni tutarla yeniden üretilir.
async function gelirOnerisiYenile(env,id,g){
  const anahtar=`dagitim:gelir:${id}`;
  await env.DB.prepare("UPDATE oneriler SET durum='eskidi',anahtar=anahtar||':eski:'||id,karar=? WHERE anahtar=? AND durum='bekliyor'").bind(nowIso(),anahtar).run();
  const kalan=await env.DB.prepare("SELECT 1 AS x FROM oneriler WHERE anahtar=?").bind(anahtar).first();
  if(!g||kalan)return;
  const ay=g.tarih.slice(0,7),v=await veriYukle(env);
  await oneriEkle(env,"dagitim",anahtar,{ay,tutar:g.tutar_kurus,gelir_id:id,kalemler:dagitimOner(g.tutar_kurus,v.dagitimDurumu(ay)).kalemler});
}
async function oneriKarar(env,b,bugun){
  const id=Number(b.id);if(!Number.isInteger(id))throw new Hata("Öneri bulunamadı.");
  const row=await env.DB.prepare("SELECT * FROM oneriler WHERE id=?").bind(id).first();
  if(!row)throw new Hata("Öneri bulunamadı.");
  if(row.durum!=="bekliyor")return json({error:"Bu öneri için zaten karar verilmiş."},409);
  const v=await veriYukle(env),oneri={id,tur:row.tur,detay:JSON.parse(row.detay_json)};
  const r=uygulaSql(oneri,b.karar,b.duzenleme||null,{durum:v.durum,merdiven:v.merdiven,mctx:v.mctx,aktifZarf:v.aktifZarf,simdi:nowIso(),bugun});
  const al=await env.DB.prepare("UPDATE oneriler SET durum='isleniyor' WHERE id=? AND durum='bekliyor'").bind(id).run();
  if(!al.meta.changes)return json({error:"Bu öneri için zaten karar verilmiş."},409);
  if(r.eskidi){
    await env.DB.prepare("UPDATE oneriler SET durum='eskidi',anahtar=anahtar||':eski:'||id,karar=? WHERE id=?").bind(nowIso(),id).run();
    if(oneri.tur==="dagitim"){const v2=await veriYukle(env);await oneriEkle(env,"dagitim",row.anahtar,{...oneri.detay,kalemler:dagitimOner(oneri.detay.tutar,v2.dagitimDurumu(oneri.detay.ay)).kalemler});}
    return json({error:`${r.eskidi} Öneri yenilendi, tekrar bak.`},409);
  }
  try{await env.DB.batch(r.ifadeler.map(([sql,...p])=>env.DB.prepare(sql).bind(...p)));}
  catch(e){await env.DB.prepare("UPDATE oneriler SET durum='bekliyor' WHERE id=? AND durum='isleniyor'").bind(id).run();throw e;}
  if(oneri.tur==="abonelik"&&b.karar==="onayla"&&v.aktifZarf.has(oneri.detay.zarf_id))await eksiKontrol(env,oneri.detay.tarih.slice(0,7),oneri.detay.zarf_id,"abonelik"+id);
  return json({ok:true});
}
// ---- Dazai (Aurelius) uçları: x-dazai-key ile, oturumsuz. Cümleleri Dazai aynen söyler.
const DAZAI_GOVDE=2048;
async function dazaiGovde(req){
  const t=await req.text();if(t.length>DAZAI_GOVDE)throw new Hata("İstek çok büyük (en çok 2 KB).");
  try{return t?JSON.parse(t):{}}catch{throw new Hata("Geçersiz istek.")}
}
const istekAl=b=>({istek:metinDogrula(b.istek_id,"İstek kimliği",80),onceki:b.onceki?String(b.onceki).slice(0,80):null});
async function zarfKalani(env,ay,zarfId){const v=await veriYukle(env);return v.durum(ay).zarflar.find(z=>z.id===zarfId)?.kalan??0;}
async function esle(env,b,zarfId,bugun){
  const st=esleKelimeleri(b).map(k=>env.DB.prepare("INSERT INTO zarf_eslemeleri(kelime,zarf_id,guncelleme) VALUES(?,?,?) ON CONFLICT(kelime) DO UPDATE SET zarf_id=excluded.zarf_id,guncelleme=excluded.guncelleme").bind(k,zarfId,bugun));
  if(st.length)await env.DB.batch(st);
}
const zarfCumlesi=(ad,kalan)=>`${ad} kalan ${tl(kalan)}.${kalan<0?" Zarf eksiye düştü; kaydırma önerisi hazır.":""}`;
async function dazaiBugun(env,url,bugun){
  const q=url.searchParams.get("day")||"",day=gecerliGun(q)?q:bugun;
  const v=await veriYukle(env),zarfAd=new Map(v.zarflar.map(z=>[z.id,z.ad]));
  const oneriler=(await hepsi(env,"SELECT * FROM oneriler WHERE durum='bekliyor' ORDER BY id")).map(r=>({id:r.id,tur:r.tur,detay:JSON.parse(r.detay_json)}));
  return bugunCevabi({day,durum:v.durum(day.slice(0,7)),zarfAd,abonelikler:v.abonelikler,
    oneriler:oneriler.map(o=>oneriGorunum(o,{durum:v.durum,zarfAd,merdiven:v.merdiven,mctx:v.mctx})),
    kaydirmaZarflari:new Set(oneriler.filter(o=>o.tur==="kaydirma").map(o=>o.detay.zarf_id))});
}
async function dazaiHarcama(env,b,bugun){
  const {istek,onceki}=istekAl(b),v=await veriYukle(env),aktif=v.zarflar.filter(z=>z.aktif);
  let zarf=null;
  if(b.zarf!=null&&String(b.zarf).trim()){zarf=zarfAdiCoz(b.zarf,aktif);if(!zarf)throw new Hata(`"${String(b.zarf).slice(0,40)}" adında zarf yok. Zarflar: ${aktif.map(z=>z.ad).join(", ")||"henüz yok"}.`);}
  let eski=await env.DB.prepare("SELECT id,zarf_id,tarih FROM harcamalar WHERE istek_id IN (?,?)").bind(istek,onceki||istek).first();
  if(!eski&&zarf){
    // Zarf sorusunun cevabı farklı anahtarla (geç ya da başka açıklamayla) gelebilir: en son Dazai harcaması zarfsız,
    // aynı tutar ve gündeyse o kayıt taşınır, ikinci kayıt yazılmaz.
    const t=harcamaDogrula({...b,istek_id:istek,zarf_id:null},bugun);
    const son=await env.DB.prepare("SELECT id,zarf_id,tarih,tutar_kurus FROM harcamalar WHERE kaynak='dazai' ORDER BY id DESC LIMIT 1").first();
    if(son&&son.zarf_id==null&&son.tutar_kurus===t.tutar_kurus&&son.tarih===t.tarih)eski=son;
  }
  if(eski){
    if(!zarf||eski.zarf_id!=null)return {ok:true,id:eski.id,mesaj:"Bu kayıt zaten yapılmış."};
    await env.DB.prepare("UPDATE harcamalar SET zarf_id=? WHERE id=? AND zarf_id IS NULL").bind(zarf.id,eski.id).run();
    await esle(env,b,zarf.id,bugun);await eksiKontrol(env,eski.tarih.slice(0,7),zarf.id,eski.id);
    return {ok:true,id:eski.id,mesaj:`${zarf.ad} zarfına taşındı. ${zarfCumlesi(zarf.ad,await zarfKalani(env,eski.tarih.slice(0,7),zarf.id))}`};
  }
  const h=harcamaDogrula({...b,istek_id:istek,zarf_id:null},bugun);
  const eslemeler=await hepsi(env,"SELECT kelime,zarf_id FROM zarf_eslemeleri");
  const hedef=zarf||zarfBul(h,aktif,eslemeler);
  await env.DB.prepare("INSERT INTO harcamalar(istek_id,tutar_kurus,aciklama,zarf_id,tarih,kaynak,etiket) VALUES(?,?,?,?,?,'dazai',?) ON CONFLICT(istek_id) DO NOTHING").bind(istek,h.tutar_kurus,h.aciklama,hedef?hedef.id:null,h.tarih,h.etiket).run();
  const row=await env.DB.prepare("SELECT id FROM harcamalar WHERE istek_id=?").bind(istek).first();
  if(zarf)await esle(env,b,zarf.id,bugun);
  if(!hedef)return {ok:true,id:row.id,zarf_sor:true,zarflar:aktif.map(z=>z.ad),mesaj:`${tl(h.tutar_kurus)} ${h.aciklama} şimdilik Atanmamış'a yazıldı. Hangi zarfa yazayım? Zarflar: ${aktif.map(z=>z.ad).join(", ")||"henüz yok"}.`};
  await eksiKontrol(env,h.tarih.slice(0,7),hedef.id,row.id);
  return {ok:true,id:row.id,mesaj:`${tl(h.tutar_kurus)} ${h.aciklama} ${hedef.ad} zarfına yazıldı. ${zarfCumlesi(hedef.ad,await zarfKalani(env,h.tarih.slice(0,7),hedef.id))}`};
}
async function dazaiGelir(env,b,bugun){
  const {istek,onceki}=istekAl(b);
  const eski=await env.DB.prepare("SELECT id FROM gelirler WHERE istek_id IN (?,?)").bind(istek,onceki||istek).first();
  if(eski)return {ok:true,id:eski.id,mesaj:"Bu gelir zaten kaydedilmiş."};
  const g=gelirDogrula(b,bugun),ay=g.tarih.slice(0,7);
  const p=planBul(g.aciklama,await hepsi(env,"SELECT id,ad FROM gelir_plani"));
  if(p){
    const bek=await env.DB.prepare("SELECT id,detay_json FROM oneriler WHERE durum='bekliyor' AND anahtar=?").bind(`dagitim:plan:${ay}:${p.id}`).first();
    if(bek){const det=JSON.parse(bek.detay_json);return {ok:true,oneri_id:bek.id,mesaj:`${p.ad} için bekleyen öneri var (${tl(det.tutar)}). Onaylarsan gelir kaydedilir ve dağıtılır${g.tutar_kurus!==det.tutar?`; gelen tutar ${tl(g.tutar_kurus)} ise onaylarken bu tutarı ver`:""}. Onaylayayım mı? (oneri:${bek.id})`};}
    if(await env.DB.prepare("SELECT 1 AS x FROM gelirler WHERE plan_id=? AND substr(tarih,1,7)=?").bind(p.id,ay).first())return {ok:true,mesaj:`${p.ad} bu ay zaten kaydedilmiş.`};
  }
  const r=await gelirEkle(env,b,bugun,istek,p?p.id:null),v=await veriYukle(env),ad=new Map(v.zarflar.map(z=>[z.id,z.ad]));
  const kalem=r.oneri?r.oneri.detay.kalemler.map(k=>`${ad.get(k.zarf_id)} ${tl(k.tutar)}`).join(", "):"";
  return {ok:true,id:r.id,oneri_id:r.oneri?.id,mesaj:`${tl(g.tutar_kurus)} gelir kaydedildi. ${kalem?`Dağıtım önerisi: ${kalem}.`:"Dolduracak zarf yok; Atanmamış'ta kalır."} Onaylayayım mı?${r.oneri?` (oneri:${r.oneri.id})`:""}`};
}
async function dazaiOnayla(env,b,bugun){
  const karar=b.karar;if(karar!=="onayla"&&karar!=="reddet")throw new Hata("Karar onayla ya da reddet olmalı.");
  let id=Number(String(b.oneri_id??"").replace(/^oneri:/,""));
  if(!Number.isInteger(id)||id<=0){
    if(!b.tur)throw new Hata("Hangi öneri? oneri_id ya da tur gerekli.");
    const rows=await hepsi(env,"SELECT id FROM oneriler WHERE durum='bekliyor' AND tur=? ORDER BY id",String(b.tur));
    if(!rows.length)throw new Hata("Bu türde bekleyen öneri yok.");
    if(rows.length>1){
      const v=await veriYukle(env),zarfAd=new Map(v.zarflar.map(z=>[z.id,z.ad]));
      const liste=await Promise.all(rows.map(async r=>{const o=await env.DB.prepare("SELECT tur,detay_json FROM oneriler WHERE id=?").bind(r.id).first();return `oneri:${r.id} ${oneriGorunum({id:r.id,tur:o.tur,detay:JSON.parse(o.detay_json)},{durum:v.durum,zarfAd,merdiven:v.merdiven,mctx:v.mctx}).baslik}`;}));
      throw new Hata(`Bu türde ${rows.length} bekleyen öneri var; hangisi? ${liste.join("; ")}.`);
    }
    id=rows[0].id;
  }
  const row=await env.DB.prepare("SELECT * FROM oneriler WHERE id=?").bind(id).first();
  if(!row)throw new Hata("Öneri bulunamadı.");
  const v=await veriYukle(env),detay=JSON.parse(row.detay_json),zarfAd=new Map(v.zarflar.map(z=>[z.id,z.ad]));
  const baslik=oneriGorunum({id,tur:row.tur,detay},{durum:v.durum,zarfAd,merdiven:v.merdiven,mctx:v.mctx}).baslik;
  let duzenleme=null;
  if(karar==="onayla"&&row.tur==="dagitim"&&b.tutar!=null&&String(b.tutar).trim()!==""){
    const diger=(await hepsi(env,"SELECT detay_json FROM oneriler WHERE durum='bekliyor' AND tur='dagitim' AND id<>?",id)).map(r=>JSON.parse(r.detay_json));
    const tutar=harcamaDogrula({tutar:b.tutar,aciklama:"-"},bugun).tutar_kurus;
    duzenleme={tutar:tl(tutar).replace(/[^\d.,]/g,""),kalemler:dagitimOner(tutar,bekleyenDus(v.durum(detay.ay),diger)).kalemler.map(k=>({zarf_id:k.zarf_id,tutar:(k.tutar/100).toFixed(2)}))};
  }
  const r=await oneriKarar(env,{id,karar,duzenleme},bugun);
  if(r.status!==200)return r;
  return json({ok:true,mesaj:`${karar==="onayla"?"Onaylandı":"Reddedildi"}: ${baslik}`});
}
async function dazaiApi(req,env,url,bugun){
  const key=req.headers.get("x-dazai-key")||"";
  if(!env.DAZAI_KEY||!key||!(await safeEqual(key,env.DAZAI_KEY)))return json({error:"Yetkisiz."},401);
  const p=url.pathname,m=req.method;
  try{
    if(p==="/api/dazai/bugun"&&m==="GET")return json(await dazaiBugun(env,url,bugun));
    if(m==="POST"){
      const b=await dazaiGovde(req);
      if(p==="/api/dazai/harcama")return json(await dazaiHarcama(env,b,bugun));
      if(p==="/api/dazai/gelir")return json(await dazaiGelir(env,b,bugun));
      if(p==="/api/dazai/onayla")return await dazaiOnayla(env,b,bugun);
    }
  }catch(e){if(e instanceof Hata)return json({error:e.message},400);throw e;}
  return json({error:"Bulunamadı."},404);
}
const LISTE_VERI={zarflar:"zarflar",gelir_plani:"gelirPlani",abonelikler:"abonelikler",borclar:"borclar",birikimler:"birikimler",merdiven:"merdiven"};
async function listeKaydet(env,b,bugun){
  const tablo=b.tablo,rows=listeDogrula(tablo,b.satirlar),cols=LISTE_SUTUNLARI[tablo],v=await veriYukle(env);
  const eski=v[LISTE_VERI[tablo]].filter(r=>tablo!=="zarflar"||r.aktif),mevcut=new Set(eski.map(r=>r.id)),tut=new Set(rows.filter(r=>r.id).map(r=>r.id));
  for(const r of rows)if(r.id&&!mevcut.has(r.id))throw new Hata("Liste bu arada değişti; sayfayı yenile.");
  if(tablo==="abonelikler")for(const r of rows)if(r.zarf_id!=null&&!v.aktifZarf.has(r.zarf_id))throw new Hata("Abonelikteki zarf bulunamadı.");
  const st=[],ay=bugun.slice(0,7),durum=v.durum(ay);
  for(const r of rows){
    if(r.id)st.push(env.DB.prepare(`UPDATE ${tablo} SET ${cols.map(c=>c+"=?").join(",")} WHERE id=?`).bind(...cols.map(c=>r[c]),r.id));
    else if(tablo==="zarflar")st.push(env.DB.prepare("INSERT INTO zarflar(ad,aylik_kurus,sira,aktif,olusturma) VALUES(?,?,?,1,?)").bind(r.ad,r.aylik_kurus,r.sira,bugun));
    else st.push(env.DB.prepare(`INSERT INTO ${tablo}(${cols.join(",")}) VALUES(${cols.map(()=>"?").join(",")})`).bind(...cols.map(c=>r[c])));
  }
  for(const id of mevcut)if(!tut.has(id)){
    if(tablo==="zarflar"){
      st.push(env.DB.prepare("UPDATE zarflar SET aktif=0 WHERE id=?").bind(id));
      const z=durum.zarflar.find(z=>z.id===id);
      if(z&&z.kalan!==0)st.push(env.DB.prepare("INSERT INTO dagitimlar(ay,zarf_id,tutar_kurus,tarih) VALUES(?,?,?,?)").bind(ay,id,-z.kalan,bugun));
    }else st.push(env.DB.prepare(`DELETE FROM ${tablo} WHERE id=?`).bind(id));
  }
  if(st.length)await env.DB.batch(st);
  return {ok:true};
}
async function ayarKaydet(env,b,bugun){
  if(b.anahtar==="kurulum"){
    await env.DB.batch([
      env.DB.prepare("INSERT INTO ayarlar(anahtar,deger) VALUES('kurulum','1') ON CONFLICT(anahtar) DO UPDATE SET deger='1'"),
      env.DB.prepare("INSERT INTO ayarlar(anahtar,deger) VALUES('baslangic',?) ON CONFLICT(anahtar) DO NOTHING").bind(bugun)]);
    return {ok:true};
  }
  if(b.anahtar==="getiri"){
    const n=Number(String(b.deger).replace(",","."));
    if(!Number.isFinite(n)||n<0||n>100)throw new Hata("Getiri 0 ile 100 arasında olmalı.");
    await env.DB.prepare("INSERT INTO ayarlar(anahtar,deger) VALUES('getiri',?) ON CONFLICT(anahtar) DO UPDATE SET deger=excluded.deger").bind(String(n)).run();
    return {ok:true};
  }
  throw new Hata("Bilinmeyen ayar.");
}
const ayParam=(url,bugun)=>{const a=url.searchParams.get("ay")||"";return /^\d{4}-(0[1-9]|1[0-2])$/.test(a)?a:bugun.slice(0,7)};

async function api(req,env,url){
  const p=url.pathname,m=req.method,bugun=istanbulGun(new Date());
  if(p==="/api/login"&&m==="POST")return login(req,env);
  if(p.startsWith("/api/dazai/"))return dazaiApi(req,env,url,bugun);
  if(!(await verifySession(env.SESSION_SECRET,cookieOf(req,COOKIE))))return json({error:"Giriş yapman gerekiyor."},401);
  if(m!=="GET"&&!sameOrigin(req))return json({error:"İstek reddedildi."},403);
  try{
    if(p==="/api/logout"&&m==="POST")return json({ok:true},200,{"Set-Cookie":`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
    if(p==="/api/durum"&&m==="GET")return json(await durumYaniti(env,ayParam(url,bugun),bugun));
    if(p==="/api/gecmis"&&m==="GET"){
      const ay=ayParam(url,bugun);
      const [harcamalar,gelirler,aktarimlar,zarflar]=await Promise.all([
        hepsi(env,"SELECT * FROM harcamalar WHERE substr(tarih,1,7)=? ORDER BY tarih DESC,id DESC",ay),
        hepsi(env,"SELECT * FROM gelirler WHERE substr(tarih,1,7)=? ORDER BY tarih DESC,id DESC",ay),
        hepsi(env,"SELECT * FROM aktarimlar WHERE ay=?",ay),hepsi(env,"SELECT id,ad,aktif FROM zarflar ORDER BY sira,id")]);
      return json({ay,harcamalar,gelirler,aktarimlar,zarflar});
    }
    const b=await govde(req);
    if(p==="/api/harcama"&&m==="POST")return json(await harcamaEkle(env,b,bugun));
    if(p==="/api/harcama/duzenle"&&m==="POST")return json(await harcamaDuzenle(env,b,bugun));
    if(p==="/api/harcama/sil"&&m==="POST"){await env.DB.prepare("DELETE FROM harcamalar WHERE id=?").bind(Number(b.id)).run();return json({ok:true});}
    if(p==="/api/gelir"&&m==="POST")return json(await gelirEkle(env,b,bugun));
    if(p==="/api/gelir/duzenle"&&m==="POST"){const g=gelirDogrula(b,bugun);const r=await env.DB.prepare("UPDATE gelirler SET tutar_kurus=?,aciklama=?,tarih=? WHERE id=?").bind(g.tutar_kurus,g.aciklama,g.tarih,Number(b.id)).run();if(!r.meta.changes)throw new Hata("Gelir bulunamadı.");await gelirOnerisiYenile(env,Number(b.id),g);return json({ok:true});}
    if(p==="/api/gelir/sil"&&m==="POST"){await env.DB.prepare("DELETE FROM gelirler WHERE id=?").bind(Number(b.id)).run();await gelirOnerisiYenile(env,Number(b.id),null);return json({ok:true});}
    if(p==="/api/oneri"&&m==="POST")return await oneriKarar(env,b,bugun);
    if(p==="/api/liste"&&m==="PUT")return json(await listeKaydet(env,b,bugun));
    if(p==="/api/ayar"&&m==="POST")return json(await ayarKaydet(env,b,bugun));
  }catch(e){if(e instanceof Hata)return json({error:e.message},400);throw e;}
  return json({error:"Bulunamadı."},404);
}

async function zamanli(env,cron,simdi){
  const gun=istanbulGun(simdi),v=await veriYukle(env);
  if(v.ayarlar.kurulum!=="1")return;
  const mevcut=new Set((await hepsi(env,"SELECT anahtar FROM oneriler")).map(r=>r.anahtar));
  const yeni=gunlukOneriler(gun,{gelirPlani:v.gelirPlani,gelirler:v.gelirler,abonelikler:v.abonelikler,mevcut,bekleyen:v.bekleyen,aksam:cron==="30 20 * * *",baslangic:v.ayarlar.baslangic,durum:v.durum});
  for(const o of yeni)await oneriEkle(env,o.tur,o.anahtar,o.detay);
  console.log(gun,cron,"öneri",yeni.length);
}

const PUBLIC=new Set(["/giris.html","/manifest.webmanifest","/sw.js","/icon.svg","/icon-180.png","/icon-192.png","/icon-512.png"]);
export default {
  async fetch(req,env){
    const url=new URL(req.url);
    // Oturum çerezi Secure: http ya da sonu noktalı adres çerezi tutamaz, tek doğru adrese yönlendir.
    // Karar Cloudflare'in x-forwarded-proto başlığıyla verilir (wrangler dev yerelde de alan adıyla http iletir, başlık koymaz).
    if(req.headers.get("x-forwarded-proto")==="http"||url.hostname.endsWith(".")){url.protocol="https:";url.hostname=url.hostname.replace(/\.+$/,"");return Response.redirect(url.toString(),308);}
    try{
      if(url.pathname.startsWith("/api/"))return await api(req,env,url);
      if(PUBLIC.has(url.pathname))return env.ASSETS.fetch(req);
      if(!(await verifySession(env.SESSION_SECRET,cookieOf(req,COOKIE))))return env.ASSETS.fetch(new Request(new URL("/giris.html",url),req));
      if(url.pathname==="/")return env.ASSETS.fetch(new Request(new URL("/index.html",url),req));
      return env.ASSETS.fetch(req);
    }catch(e){console.error("istek hatası",e&&e.message);return json({error:"Sunucu hatası."},500)}
  },
  async scheduled(event,env,ctx){ctx.waitUntil(zamanli(env,event.cron,new Date(event.scheduledTime)))}
};
