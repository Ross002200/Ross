// Piyasa panosu ve günlük özet hesapları (saf). Fiyatlar REAL; günler YYYY-AA-GG, aylar YYYY-AA. Tavsiye değil, hesap.
import {Hata,tl,gunEkle,gecerliGun,ayinSonGunu} from "./core.js";

export const GRUPLAR=[["altin_doviz","Altın ve döviz"],["tr","Türkiye"],["abd","ABD"],["faiz","Faiz, enflasyon, fon"]];
const GRUP_SET=new Set(GRUPLAR.map(([g])=>g)),TIP_SET=new Set(["doviz","altin","endeks","hisse","fon","faiz"]);
const ESIK={doviz:.15,altin:.15,endeks:.20,hisse:.35,fon:.15};
const KOD=/^[A-Z0-9:._^=-]{1,24}$/;

export function supheliMi(tip,deger,onceki){
  if(tip==="faiz")return !Number.isFinite(deger);
  if(!Number.isFinite(deger)||deger<=0)return true;
  const e=ESIK[tip];
  return !!e&&Number.isFinite(onceki)&&onceki>0&&Math.abs(deger/onceki-1)>e;
}
export const degisim=(d,o)=>Number.isFinite(d)&&Number.isFinite(o)&&o>0?d/o-1:null;
// a'dan b'ye kaç iş günü (cumartesi ve pazar sayılmaz).
export function isGunuFarki(a,b){
  let n=0,g=a;
  while(g<b){g=gunEkle(g,1);const w=new Date(g+"T00:00:00Z").getUTCDay();if(w!==0&&w!==6)n++;}
  return n;
}
function kartlar(satirlar){
  const kodlar=new Map();
  for(const r of [...satirlar].sort((a,b)=>a.gun.localeCompare(b.gun))){if(!kodlar.has(r.kod))kodlar.set(r.kod,[]);kodlar.get(r.kod).push(r);}
  return [...kodlar].map(([kod,xs])=>{
    const iyi=xs.filter(x=>x.durum==="ok"),son=iyi[iyi.length-1],onc=iyi[iyi.length-2],enSon=xs[xs.length-1];
    // Son gelen satır yok/şüpheliyse: son iyi değer gösterilir, değişim gösterilmez, etiket enSon.durum.
    const guncel=enSon.durum==="ok";
    return {kod,grup:enSon.grup,tip:enSon.tip,ad:enSon.ad,birim:enSon.birim,deger:son?son.deger:null,gun:son?son.gun:null,
      degisim:guncel&&onc?degisim(son.deger,onc.deger):null,durum:enSon.durum,seri:iyi.slice(-30).map(x=>x.deger)};
  });
}
export function panoGorunum(satirlar,bugun){
  // Tazelik faiz dışı kartlardan ölçülür (faiz satırları hep bugünün tarihiyle gelir). Panonun son gününden
  // iki iş günü geride kalan kart "eski" olur: değeri gösterilir ama güncel sayılmaz, değişimi gösterilmez.
  const k=kartlar(satirlar),gunler=k.filter(x=>x.gun&&x.tip!=="faiz").map(x=>x.gun).sort(),sonGun=gunler[gunler.length-1]||null;
  for(const x of k)if(sonGun&&x.durum==="ok"&&x.gun&&x.tip!=="faiz"&&isGunuFarki(x.gun,sonGun)>=2){x.durum="eski";x.degisim=null;}
  return {sonGun,bayat:!sonGun||isGunuFarki(sonGun,bugun)>=2,gruplar:GRUPLAR.map(([grup,ad])=>({grup,ad,kartlar:k.filter(x=>x.grup===grup)}))};
}
const SERIT=["USDTRY","GRAM","XU100"];
export const seritOlustur=(satirlar,bugun)=>{const k=panoGorunum(satirlar,bugun).gruplar.flatMap(g=>g.kartlar);return SERIT.map(kod=>k.find(x=>x.kod===kod)).filter(x=>x&&x.durum==="ok");};

export const ayGeri=(ay,n)=>{let [y,m]=ay.split("-").map(Number);m-=n;while(m<=0){m+=12;y--;}return `${y}-${String(m).padStart(2,"0")}`;};
// Enflasyondan arındırılmış getiri: (1+nominal)/(1+TÜFE değişimi)−1. MEVDUAT: yıllık % aylığa bölünüp bileşiklenir (yaklaşık, brüt).
export function reelGetiri(aylik,kod,sonAy,n){
  const v=(k,a)=>aylik.find(x=>x.kod===k&&x.ay===a)?.deger,basAy=ayGeri(sonAy,n);
  const t1=v("TUFE",sonAy),t0=v("TUFE",basAy);if(!(t1>0&&t0>0))return null;
  let nominal;
  if(kod==="MEVDUAT"){let c=1;for(let i=0;i<n;i++){const r=v("MEVDUAT",ayGeri(sonAy,i));if(!Number.isFinite(r))return null;c*=1+r/100/12;}nominal=c-1;}
  else{const p1=v(kod,sonAy),p0=v(kod,basAy);if(!(p1>0&&p0>0))return null;nominal=p1/p0-1;}
  return (1+nominal)/(t1/t0)-1;
}
// Kartın 1, 3 ve 12 aylık nominal değişimi (ay sonu kapanışlarından; kodun son ayına göre).
export function uzunDegisim(aylik,kod){
  const xs=aylik.filter(x=>x.kod===kod),son=xs.map(x=>x.ay).sort().pop(),v=a=>xs.find(x=>x.ay===a)?.deger;
  const r=n=>{if(!son)return null;const p1=v(son),p0=v(ayGeri(son,n));return p1>0&&p0>0?p1/p0-1:null;};
  return {r1:r(1),r3:r(3),r12:r(12)};
}
export function karne(aylik,kalemler){
  const aylar=aylik.filter(x=>x.kod==="TUFE").map(x=>x.ay).sort(),sonAy=aylar[aylar.length-1]||null;
  return {sonAy,satirlar:kalemler.map(k=>({...k,r1:sonAy?reelGetiri(aylik,k.kod,sonAy,1):null,r3:sonAy?reelGetiri(aylik,k.kod,sonAy,3):null,r12:sonAy?reelGetiri(aylik,k.kod,sonAy,12):null}))};
}

// Zarfın bu hızla biteceği gün (ay sonundan önceyse). İlk 3 günde ya da harcama yoksa tahmin yok.
export function harcamaHizi(z,bugun){
  const gun=Number(bugun.slice(8,10));
  if(gun<=3||!(z.harcanan>0))return null;
  const ort=z.harcanan/gun;
  if(z.kalan<=0)return {biter:bugun,ort};
  const bitis=gun+Math.floor(z.kalan/ort);
  return bitis<ayinSonGunu(bugun.slice(0,7))?{biter:`${bugun.slice(0,8)}${String(bitis).padStart(2,"0")}`,ort}:null;
}

const yuzde=x=>`${x>=0?"+":"−"}%${Math.abs(x*100).toLocaleString("tr-TR",{minimumFractionDigits:1,maximumFractionDigits:1})}`;
const sayi=x=>x.toLocaleString("tr-TR",x>=1000?{maximumFractionDigits:0}:{minimumFractionDigits:2,maximumFractionDigits:2});
const OZET_KODLAR=[["USDTRY","Dolar"],["GRAM","gram altın"],["XU100","BIST 100"],["SPX","S&P 500"]];
export function ozetMetni({pano,durum,bugun,not}){
  const k=new Map(pano.gruplar.flatMap(g=>g.kartlar).map(x=>[x.kod,x]));
  const parca=OZET_KODLAR.map(([kod,ad])=>{const c=k.get(kod);return c&&c.durum==="ok"?`${ad} ${sayi(c.deger)}${c.degisim!=null?` (${yuzde(c.degisim)})`:""}`:null;}).filter(Boolean);
  const satir1=pano.bayat&&pano.sonGun?`Piyasa verisi ${pano.sonGun} tarihinden beri güncellenmedi.`:parca.length?parca.join(" · "):"Piyasa verisi gelmedi.";
  let satir2=null;
  if(durum){
    const riskli=durum.zarflar.map(z=>({z,h:harcamaHizi(z,bugun)})).filter(x=>x.h).sort((a,b)=>a.h.biter.localeCompare(b.h.biter))[0];
    satir2=riskli?(riskli.z.kalan<=0?`${riskli.z.ad} zarfı bitti (${tl(riskli.z.kalan)}).`:`${riskli.z.ad}: ${tl(riskli.z.kalan)} kaldı, bu hızla ayın ${Number(riskli.h.biter.slice(8))}. günü biter.`):`Atanmamış ${tl(durum.atanmamis)}`;
  }
  // Bildirim servisinin son bildirimleri herkese açık okunur: bildirime kişisel tutar yazılmaz.
  return {metin:[satir1,satir2,not].filter(Boolean).join("\n"),bildirim:[satir1,satir2&&"Bütçe ayrıntısı Diogenes'te."].filter(Boolean).join(" · ").slice(0,180)};
}

// POST /api/piyasa gövdesi. Şüphe sunucuda da (her kod kendi içinde tarih sırasıyla) yeniden kontrol edilir.
export function piyasaGovdeDogrula(b){
  if(!b||!gecerliGun(b.gun))throw new Hata("Gün geçersiz.");
  if(!Array.isArray(b.satirlar)||b.satirlar.length>2000)throw new Hata("Satırlar geçersiz.");
  const satirlar=b.satirlar.map(r=>{
    const kod=String(r?.kod??"");
    if(!gecerliGun(r?.gun)||!KOD.test(kod)||!GRUP_SET.has(r.grup)||!TIP_SET.has(r.tip))throw new Hata(`Satır geçersiz: ${kod.slice(0,24)}`);
    const deger=r.deger==null?null:Number(r.deger);
    if(deger!==null&&!Number.isFinite(deger))throw new Hata(`Satır geçersiz: ${kod}`);
    return {gun:r.gun,kod,grup:r.grup,tip:r.tip,ad:String(r.ad||kod).slice(0,40),deger,birim:String(r.birim??"").slice(0,8),kaynak:String(r.kaynak??"").slice(0,20),durum:deger===null?"yok":r.durum==="supheli"?"supheli":"ok"};
  });
  const onceki=new Map();
  for(const r of [...satirlar].sort((a,b)=>a.gun.localeCompare(b.gun))){
    if(r.durum==="ok"&&supheliMi(r.tip,r.deger,onceki.get(r.kod)))r.durum="supheli";
    if(r.durum==="ok")onceki.set(r.kod,r.deger);
  }
  const aylik=(Array.isArray(b.aylik)?b.aylik:[]).slice(0,1000).map(a=>{
    const kod=String(a?.kod??""),deger=Number(a?.deger);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(a?.ay))||!KOD.test(kod)||!Number.isFinite(deger))throw new Hata(`Aylık satır geçersiz: ${kod.slice(0,24)}`);
    return {ay:a.ay,kod,deger};
  });
  const not=typeof b.not==="string"&&b.not.trim()?b.not.trim().slice(0,600):null;
  return {gun:b.gun,satirlar,aylik,not};
}
