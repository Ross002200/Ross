// Diogenes çekirdeği (saf; sunucuda ve tarayıcıda çalışır). Tutarlar kuruş (tam sayı), tarihler YYYY-AA-GG (İstanbul).
export class Hata extends Error{constructor(m){super(m);this.name="Hata";}}
export const MAX_KURUS=1_000_000_000;

// "1.250,50" | "15.000" | "1250.5" | 1250.5 → kuruş; okunamazsa NaN.
export function kurusa(v){
  if(typeof v==="number")return Number.isFinite(v)?Math.round(v*100):NaN;
  if(typeof v!=="string")return NaN;
  let s=v.replace(/\s|₺/g,"").replace(/tl$/i,"");
  if(!s)return NaN;
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  if(!/^-?\d+(\.\d{1,2})?$/.test(s))return NaN;
  return Math.round(Number(s)*100);
}
export function tl(k){
  const s=(Math.abs(k)/100).toLocaleString("tr-TR",{minimumFractionDigits:k%100?2:0,maximumFractionDigits:2});
  return (k<0?"−":"")+s+" ₺";
}

export function istanbulGun(date){
  const f=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"});
  const o=Object.fromEntries(f.formatToParts(date).map(p=>[p.type,p.value]));
  return `${o.year}-${o.month}-${o.day}`;
}
export const ayinSonGunu=ay=>{const [y,m]=ay.split("-").map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate();};
export function gunEkle(g,n){const d=new Date(g+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export const gecerliGun=g=>typeof g==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(g)&&!Number.isNaN(Date.parse(g+"T00:00:00Z"))&&gunEkle(g,0)===g;
export const planGunu=(ay,gun)=>`${ay}-${String(Math.min(gun,ayinSonGunu(ay))).padStart(2,"0")}`;
export const oncekiAy=ay=>gunEkle(ay+"-01",-1).slice(0,7);
const AYLAR=["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
export const ayAdi=ay=>`${AYLAR[Number(ay.slice(5,7))-1]} ${ay.slice(0,4)}`;

export function tutarDogrula(v,{sifir=false}={}){
  const k=kurusa(v);
  if(!Number.isInteger(k))throw new Hata("Tutar okunamadı. Örnek: 1.250,50");
  if(k<0)throw new Hata("Tutar negatif olamaz.");
  if(k===0&&!sifir)throw new Hata("Tutar sıfır olamaz.");
  if(k>MAX_KURUS)throw new Hata("Tutar çok büyük (en çok 10.000.000 ₺).");
  return k;
}
export function metinDogrula(v,ad,max){
  const s=String(v??"").trim();
  if(!s)throw new Hata(`${ad} boş olamaz.`);
  if(s.length>max)throw new Hata(`${ad} en çok ${max} karakter olabilir.`);
  return s;
}
export function gunDogrula(v,bugun){
  if(v==null||v==="")return bugun;
  if(!gecerliGun(v))throw new Hata("Tarih YYYY-AA-GG biçiminde olmalı.");
  return v;
}
export function sayiDogrula(v,ad,min,max){
  const n=typeof v==="number"?v:/^-?\d+$/.test(String(v).trim())?Number(String(v).trim()):NaN;
  if(!Number.isInteger(n)||n<min||n>max)throw new Hata(`${ad} ${min} ile ${max} arasında tam sayı olmalı.`);
  return n;
}

const topla=xs=>xs.reduce((t,x)=>t+x.tutar_kurus,0);
const ayi=x=>x.ay||x.tarih.slice(0,7);

// Zarf kalanı aylık; atanmamış kümülatif (o aya kadar gelir − dağıtım − zarfsız harcama − zarfsız aktarım).
// Pasif (silinmiş) zarfların kalanı da atanmamışa katılır: silindikten sonra düzenlenen kayıtlar parayı kaybettirmez.
export function ayDurumu(ay,{zarflar=[],gelirler=[],dagitimlar=[],harcamalar=[],aktarimlar=[]}){
  const kadar=x=>ayi(x)<=ay,bu=x=>ayi(x)===ay;
  const atanmamis=topla(gelirler.filter(kadar))-topla(dagitimlar.filter(kadar))
    -topla(harcamalar.filter(h=>h.zarf_id==null&&kadar(h)))-topla(aktarimlar.filter(a=>a.zarf_id==null&&kadar(a)));
  const pasif=new Set(zarflar.filter(z=>!z.aktif).map(z=>z.id)),pasifte=xs=>topla(xs.filter(x=>pasif.has(x.zarf_id)&&kadar(x)));
  const pasifKalan=pasifte(dagitimlar)-pasifte(harcamalar)-pasifte(aktarimlar);
  const zarfIcin=(xs,id)=>topla(xs.filter(x=>x.zarf_id===id&&bu(x)));
  const liste=zarflar.filter(z=>z.aktif).sort((a,b)=>a.sira-b.sira||a.id-b.id).map(z=>{
    const konan=zarfIcin(dagitimlar,z.id),harcanan=zarfIcin(harcamalar,z.id),aktarilan=zarfIcin(aktarimlar,z.id);
    return {id:z.id,ad:z.ad,aylik:z.aylik_kurus,konan,harcanan,aktarilan,kalan:konan-harcanan-aktarilan,eksik:Math.max(0,z.aylik_kurus-konan)};
  });
  return {ay,gelir:topla(gelirler.filter(bu)),harcanan:topla(harcamalar.filter(bu)),atanmamis:atanmamis+pasifKalan,zarflar:liste};
}
export const sonrakiAy=ay=>gunEkle(ay+"-01",31).slice(0,7);
// Bir ayın kullanılabilir atanmamışı, sonraki aylarda (bugüne kadar) harcanmış olanı içeremez: en düşük kümülatif değerle sınırlanır.
export function durumOlusturucu(veri,sonAy){
  return ay=>{
    const d=ayDurumu(ay,veri);
    for(let m=ay;m<sonAy;){m=sonrakiAy(m);d.atanmamis=Math.min(d.atanmamis,ayDurumu(m,veri).atanmamis);}
    return d;
  };
}
// Bekleyen dağıtım önerilerinin aynı aydaki kalemlerini zarf eksiklerinden düşer (kopya döner).
export function bekleyenDus(durum,bekleyen=[]){
  const d={...durum,zarflar:durum.zarflar.map(z=>({...z}))};
  for(const b of bekleyen)if(b.ay===d.ay)for(const k of b.kalemler||[]){const z=d.zarflar.find(z=>z.id===k.zarf_id);if(z)z.eksik=Math.max(0,z.eksik-k.tutar);}
  return d;
}

export function dagitimOner(tutar,durum){
  let kalan=tutar;const kalemler=[];
  for(const z of durum.zarflar){
    if(kalan<=0)break;
    const t=Math.min(z.eksik,kalan);
    if(t>0){kalemler.push({zarf_id:z.id,tutar:t});kalan-=t;}
  }
  return {kalemler,artan:kalan};
}

export function kaydirmaOner(durum,zarfId){
  const z=durum.zarflar.find(x=>x.id===zarfId);
  if(!z||z.kalan>=0)return null;
  let ihtiyac=-z.kalan;const kaynaklar=[];
  if(durum.atanmamis>0){const t=Math.min(durum.atanmamis,ihtiyac);kaynaklar.push({zarf_id:null,tutar:t});ihtiyac-=t;}
  for(const a of durum.zarflar.filter(x=>x.id!==zarfId&&x.kalan>0).sort((a,b)=>b.kalan-a.kalan)){
    if(ihtiyac<=0)break;
    const t=Math.min(a.kalan,ihtiyac);kaynaklar.push({zarf_id:a.id,tutar:t});ihtiyac-=t;
  }
  return {zarf_id:zarfId,kaynaklar,karsilanamayan:ihtiyac};
}

export const VARSAYILAN_MERDIVEN=[
  {ad:"Borçsuzluk",kural:"borc",hedef_kurus:null},
  {ad:"Acil fon (3 ay)",kural:"acil3",hedef_kurus:null},
  {ad:"Düzenli yatırım",kural:null,hedef_kurus:null},
  {ad:"Ek gelir",kural:null,hedef_kurus:null},
];
export function etkinHedef(b,{aylikToplam,borcToplam}){
  if(b.kural==="acil3")return aylikToplam*3;
  if(b.kural==="borc")return borcToplam;
  return b.hedef_kurus??null;
}
export function merdivenDurumu(merdiven,mctx){
  return [...merdiven].sort((a,b)=>a.sira-b.sira||a.id-b.id).map(b=>{
    const hedef=etkinHedef(b,mctx);
    return {...b,hedef,tamam:hedef!==null&&b.biriken_kurus>=hedef};
  });
}
// Tutarı ilk tamamlanmamış basamaktan başlayarak dağıtır; hedefsiz basamak hepsini alır; artan son basamağa.
export function merdivenDagit(merdiven,tutar,mctx){
  const liste=merdivenDurumu(merdiven,mctx),parcalar=[];let kalan=tutar;
  for(const b of liste){
    if(kalan<=0)break;if(b.tamam)continue;
    const yer=b.hedef===null?kalan:b.hedef-b.biriken_kurus,t=Math.min(yer,kalan);
    if(t>0){parcalar.push({id:b.id,tutar:t});kalan-=t;}
  }
  if(kalan>0&&liste.length){
    const son=liste[liste.length-1],p=parcalar.find(x=>x.id===son.id);
    if(p)p.tutar+=kalan;else parcalar.push({id:son.id,tutar:kalan});
  }
  return parcalar;
}
// Ay kapanışı: eksi zarflar kapanır (önce atanmamış, sonra en dolu zarflar karşılar); kalan merdivene gidecek kaynaklardır.
export function ayKapanisi(durum){
  const kapama=durum.zarflar.filter(z=>z.kalan<0).map(z=>({zarf_id:z.id,tutar:-z.kalan}));
  let acik=kapama.reduce((t,k)=>t+k.tutar,0);
  const havuz=[];
  if(durum.atanmamis>0)havuz.push({zarf_id:null,tutar:durum.atanmamis});
  for(const z of durum.zarflar.filter(z=>z.kalan>0).sort((a,b)=>b.kalan-a.kalan))havuz.push({zarf_id:z.id,tutar:z.kalan});
  const dusum=[],kaynaklar=[];
  for(const h of havuz){
    const kapa=Math.min(acik,h.tutar);acik-=kapa;
    if(kapa>0&&h.zarf_id!==null)dusum.push({zarf_id:h.zarf_id,tutar:kapa});
    if(h.tutar-kapa>0)kaynaklar.push({zarf_id:h.zarf_id,tutar:h.tutar-kapa});
  }
  return {kapama,dusum,kaynaklar,toplam:kaynaklar.reduce((t,k)=>t+k.tutar,0)};
}
// Hesap, tavsiye değil: aylık bileşik getiriyle hedefe kaç ayda ulaşılır (en çok 600 ay).
export function ozgurlukSuresi(birikim,aylikEk,yillikYuzde,hedef){
  const r=Math.pow(1+(Number(yillikYuzde)||0)/100,1/12)-1;let b=birikim;
  for(let ay=0;ay<=600;ay++){if(b>=hedef)return ay;b=b*(1+r)+aylikEk;}
  return null;
}

export const BIRIKIM_TURLERI=[["nakit","Nakit"],["banka","Banka"],["altin","Altın"],["doviz","Döviz"],["fon","Fon"],["diger","Diğer"]];
export const LISTE_SUTUNLARI={
  zarflar:["ad","aylik_kurus","sira"],
  gelir_plani:["ad","tutar_kurus","gun"],
  abonelikler:["ad","tutar_kurus","gun","zarf_id","aktif"],
  borclar:["ad","kalan_kurus","aylik_kurus","kalan_taksit"],
  birikimler:["tur","ad","tutar_kurus"],
  merdiven:["ad","sira","kural","hedef_kurus","biriken_kurus"],
};
const bos=v=>v==null||v==="";
const kimlik=v=>{if(bos(v))return null;const n=Number(v);if(!Number.isInteger(n)||n<=0)throw new Hata("Geçersiz kimlik.");return n;};
const ayGunu=v=>{const n=/^\d+$/.test(String(v).trim())?Number(v):NaN;if(!Number.isInteger(n)||n<1||n>31)throw new Hata("Gün 1 ile 31 arasında tam sayı olmalı.");return n;};
export function listeDogrula(tablo,satirlar){
  if(!(tablo in LISTE_SUTUNLARI))throw new Hata("Bilinmeyen liste.");
  if(!Array.isArray(satirlar)||satirlar.length>50)throw new Hata("Liste en çok 50 satır olabilir.");
  return satirlar.map((r,i)=>{
    r=r||{};const id=kimlik(r.id);
    switch(tablo){
      case "zarflar":return {id,ad:metinDogrula(r.ad,"Zarf adı",40),aylik_kurus:tutarDogrula(r.aylik,{sifir:true}),sira:i+1};
      case "gelir_plani":return {id,ad:metinDogrula(r.ad,"Gelir adı",40),tutar_kurus:tutarDogrula(r.tutar),gun:ayGunu(r.gun)};
      case "abonelikler":return {id,ad:metinDogrula(r.ad,"Abonelik adı",40),tutar_kurus:tutarDogrula(r.tutar),gun:ayGunu(r.gun),zarf_id:kimlik(r.zarf_id),aktif:r.aktif===false||r.aktif===0?0:1};
      case "borclar":return {id,ad:metinDogrula(r.ad,"Borç adı",40),kalan_kurus:tutarDogrula(r.kalan,{sifir:true}),aylik_kurus:tutarDogrula(bos(r.aylik)?"0":r.aylik,{sifir:true}),kalan_taksit:bos(r.kalan_taksit)?null:sayiDogrula(r.kalan_taksit,"Kalan taksit",0,600)};
      case "birikimler":{
        if(!BIRIKIM_TURLERI.some(([v])=>v===r.tur))throw new Hata("Birikim türü geçersiz.");
        return {id,tur:r.tur,ad:metinDogrula(r.ad,"Birikim adı",40),tutar_kurus:tutarDogrula(r.tutar,{sifir:true})};
      }
      case "merdiven":{
        const kural=bos(r.kural)?null:r.kural;
        if(kural!==null&&kural!=="acil3"&&kural!=="borc")throw new Hata("Geçersiz kural.");
        return {id,ad:metinDogrula(r.ad,"Basamak adı",40),sira:i+1,kural,hedef_kurus:bos(r.hedef)?null:tutarDogrula(r.hedef),biriken_kurus:bos(r.biriken)?0:tutarDogrula(r.biriken,{sifir:true})};
      }
    }
  });
}
export function harcamaDogrula(b,bugun){
  b=b||{};
  const istek=bos(b.istek_id)?null:metinDogrula(b.istek_id,"İstek kimliği",80);
  return {istek_id:istek,tutar_kurus:tutarDogrula(b.tutar),aciklama:metinDogrula(b.aciklama,"Açıklama",80),zarf_id:kimlik(b.zarf_id),tarih:gunDogrula(b.tarih,bugun),etiket:bos(b.etiket)?"":metinDogrula(b.etiket,"Etiket",20)};
}
export function gelirDogrula(b,bugun){
  b=b||{};
  return {tutar_kurus:tutarDogrula(b.tutar),aciklama:metinDogrula(b.aciklama,"Açıklama",80),tarih:gunDogrula(b.tarih,bugun)};
}

// Zamanlayıcının önerileri. Kurulumdan (baslangic) önceki günler için öneri üretilmez; aynı anahtar ikinci kez üretilmez.
export function gunlukOneriler(gun,{gelirPlani=[],gelirler=[],abonelikler=[],mevcut=new Set(),bekleyen=[],aksam=false,baslangic,durum}){
  const ay=gun.slice(0,7),cikti=[];
  const ekle=(tur,anahtar,detay)=>{if(!mevcut.has(anahtar)){mevcut.add(anahtar);cikti.push({tur,anahtar,detay});}};
  const uygun=t=>t<=gun&&(!baslangic||t>=baslangic);
  const kapanis=a=>{const k=ayKapanisi(durum(a));if(k.toplam>0||k.kapama.length)ekle("aktarim",`aktarim:${a}`,{ay:a});};
  if(!aksam){
    const calisma=bekleyenDus(durum(ay),bekleyen);
    for(const p of [...gelirPlani].sort((a,b)=>a.gun-b.gun||a.id-b.id)){
      const t=planGunu(ay,p.gun),anahtar=`dagitim:plan:${ay}:${p.id}`;
      if(!uygun(t)||mevcut.has(anahtar))continue;
      if(gelirler.some(g=>g.plan_id===p.id&&g.tarih.slice(0,7)===ay))continue;
      const {kalemler}=dagitimOner(p.tutar_kurus,calisma);
      for(const k of kalemler)calisma.zarflar.find(z=>z.id===k.zarf_id).eksik-=k.tutar;
      ekle("dagitim",anahtar,{ay,tutar:p.tutar_kurus,gelir:{plan_id:p.id,aciklama:p.ad,tarih:t},kalemler});
    }
    for(const a of abonelikler.filter(a=>a.aktif)){
      const t=planGunu(ay,a.gun);
      if(uygun(t))ekle("abonelik",`abonelik:${a.id}:${ay}`,{abonelik_id:a.id,ad:a.ad,tutar:a.tutar_kurus,zarf_id:a.zarf_id,tarih:t});
    }
    const onceki=oncekiAy(ay);
    if(!baslangic||baslangic.slice(0,7)<=onceki)kapanis(onceki);
  }
  if(aksam&&gun===planGunu(ay,31))kapanis(ay);
  return cikti;
}

// Öneriyi uygulayan SQL ifadeleri (tek D1 batch'inde çalışır). Son ifade öneriyi kapatır.
export function uygulaSql(oneri,karar,duzenleme,ctx){
  if(karar!=="onayla"&&karar!=="reddet")throw new Hata("Karar onayla ya da reddet olmalı.");
  const d=oneri.detay,id=oneri.id,ifadeler=[],ekle=(sql,...p)=>ifadeler.push([sql,...p]);
  const dagit=(ay,zarf,tutar)=>ekle("INSERT INTO dagitimlar(ay,zarf_id,tutar_kurus,oneri_id,tarih) VALUES(?,?,?,?,?)",ay,zarf,tutar,id,ctx.bugun);
  if(oneri.tur==="dagitim"){
    if(karar==="onayla"){
      const tutar=duzenleme&&!bos(duzenleme.tutar)?tutarDogrula(duzenleme.tutar):d.tutar;
      const kalemler=duzenleme&&Array.isArray(duzenleme.kalemler)
        ?duzenleme.kalemler.map(k=>({zarf_id:Number(k.zarf_id),tutar:tutarDogrula(k.tutar,{sifir:true})})).filter(k=>k.tutar>0)
        :d.kalemler;
      if(kalemler.some(k=>!ctx.aktifZarf.has(k.zarf_id)))return {eskidi:"Önerideki bir zarf artık yok."};
      if(kalemler.reduce((t,k)=>t+k.tutar,0)>tutar)throw new Hata("Dağıtılan, gelen paradan fazla olamaz.");
      if(d.gelir)ekle("INSERT INTO gelirler(plan_id,tutar_kurus,aciklama,tarih,oneri_id) VALUES(?,?,?,?,?)",d.gelir.plan_id,tutar,d.gelir.aciklama,d.gelir.tarih,id);
      else if(tutar!==d.tutar)ekle("UPDATE gelirler SET tutar_kurus=? WHERE id=?",tutar,d.gelir_id);
      for(const k of kalemler)dagit(d.ay,k.zarf_id,k.tutar);
    }
  }else if(oneri.tur==="abonelik"){
    if(karar==="onayla")ekle("INSERT INTO harcamalar(istek_id,tutar_kurus,aciklama,zarf_id,tarih,kaynak) VALUES(?,?,?,?,?,'el') ON CONFLICT(istek_id) DO NOTHING",
      `abonelik:${d.abonelik_id}:${d.tarih.slice(0,7)}`,d.tutar,d.ad,ctx.aktifZarf.has(d.zarf_id)?d.zarf_id:null,d.tarih);
  }else if(oneri.tur==="kaydirma"){
    if(karar==="onayla"){
      const k=kaydirmaOner(ctx.durum(d.ay),d.zarf_id);
      if(!k||!k.kaynaklar.length)return {eskidi:"Zarf artık eksi değil ya da kaydırılacak para yok."};
      dagit(d.ay,d.zarf_id,k.kaynaklar.reduce((t,x)=>t+x.tutar,0));
      for(const x of k.kaynaklar)if(x.zarf_id!==null)dagit(d.ay,x.zarf_id,-x.tutar);
    }
  }else if(oneri.tur==="aktarim"){
    const k=ayKapanisi(ctx.durum(d.ay));
    let parcalar=[];
    if(karar==="onayla"&&k.toplam>0){parcalar=merdivenDagit(ctx.merdiven,k.toplam,ctx.mctx);if(!parcalar.length)throw new Hata("Önce hedef merdivenini kur.");}
    for(const x of k.kapama)dagit(d.ay,x.zarf_id,x.tutar);
    for(const x of k.dusum)dagit(d.ay,x.zarf_id,-x.tutar);
    if(parcalar.length){
      for(const x of k.kaynaklar)ekle("INSERT INTO aktarimlar(ay,zarf_id,merdiven_id,tutar_kurus,oneri_id,tarih) VALUES(?,?,?,?,?,?)",d.ay,x.zarf_id,parcalar[0].id,x.tutar,id,ctx.bugun);
      for(const p of parcalar)ekle("UPDATE merdiven SET biriken_kurus=biriken_kurus+? WHERE id=?",p.tutar,p.id);
    }else for(const x of k.kaynaklar)if(x.zarf_id!==null)dagit(d.ay,x.zarf_id,-x.tutar);
  }else throw new Hata("Bilinmeyen öneri türü.");
  ekle("UPDATE oneriler SET durum=?,karar=? WHERE id=?",karar==="onayla"?"onaylandi":"reddedildi",ctx.simdi,id);
  return {ifadeler};
}

// Kartta gösterilecek metin ve satırlar. Kaydırma ve kapanış tutarları güncel veriden hesaplanır.
export function oneriGorunum(o,{durum,zarfAd,merdiven,mctx}){
  const d=o.detay,ad=id=>id==null?"Atanmamış":zarfAd.get(id)||"Silinmiş zarf";
  const temel={id:o.id,tur:o.tur,duzenlenebilir:false,aciklama:""};
  const satir=x=>({zarf_id:x.zarf_id,ad:ad(x.zarf_id),tutar:x.tutar});
  if(o.tur==="dagitim"){
    const dag=d.kalemler.reduce((t,k)=>t+k.tutar,0),satirlar=d.kalemler.map(satir);
    if(d.tutar-dag>0)satirlar.push({zarf_id:null,ad:"Atanmamış",tutar:d.tutar-dag});
    return {...temel,baslik:d.gelir?`${d.gelir.aciklama}: ${tl(d.tutar)} geldi mi?`:`${tl(d.tutar)} geldi`,
      aciklama:d.gelir?"Geldiyse şöyle dağıtayım mı? Tutar farklıysa Düzenle'ye bas.":"Şöyle dağıtayım mı?",
      satirlar,toplam:d.tutar,tutar:d.tutar,duzenlenebilir:true};
  }
  if(o.tur==="abonelik")return {...temel,baslik:`${d.ad} ${tl(d.tutar)} çekildi mi?`,aciklama:"Onaylarsan zarftan düşerim.",satirlar:[satir({zarf_id:d.zarf_id,tutar:d.tutar})],toplam:d.tutar};
  if(o.tur==="kaydirma"){
    const k=kaydirmaOner(durum(d.ay),d.zarf_id);
    if(!k)return {...temel,baslik:`${ad(d.zarf_id)} artık eksi değil`,aciklama:"Reddedip kapatabilirsin.",satirlar:[],toplam:0};
    const top=k.kaynaklar.reduce((t,x)=>t+x.tutar,0);
    return {...temel,baslik:`${ad(d.zarf_id)} zarfı ${tl(top+k.karsilanamayan)} eksi`,
      aciklama:k.karsilanamayan>0?`Kaydırılacak para yetmiyor: ${tl(k.karsilanamayan)} açık kalır.`:"Şuradan kaydırayım mı?",
      satirlar:k.kaynaklar.map(satir),toplam:top};
  }
  if(o.tur==="aktarim"){
    const k=ayKapanisi(durum(d.ay)),hedef=merdivenDurumu(merdiven,mctx).find(b=>!b.tamam);
    const eksi=k.kapama.length?` Eksi zarflar (${k.kapama.map(x=>ad(x.zarf_id)).join(", ")}) önce kapatılır.`:"";
    return {...temel,baslik:`${ayAdi(d.ay)} kapanışı: ${tl(k.toplam)} hedefe aktarılsın mı?`,
      aciklama:`${hedef?`Hedef: ${hedef.ad}.`:"Tüm basamaklar tamam; son basamağa eklenir."} Reddedersen kalanlar Atanmamış'a döner.${eksi}`,
      satirlar:k.kaynaklar.map(satir),toplam:k.toplam};
  }
  return {...temel,baslik:"Bilinmeyen öneri",satirlar:[],toplam:0};
}
