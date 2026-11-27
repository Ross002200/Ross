// Diogenes arayüzü: tek sayfa, dört sekme ve Ayarlar. Veri /api/durum'dan; hesaplar sunucuda.
import {tl,kurusa,ayAdi,ozgurlukSuresi,VARSAYILAN_MERDIVEN,BIRIKIM_TURLERI} from "/core.js";

const $=(s,k=document)=>k.querySelector(s);
const h=(tag,attrs={},...kids)=>{
  const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k.startsWith("on"))e.addEventListener(k.slice(2),v);
    else if(v===true)e.setAttribute(k,"");
    else if(v!==false&&v!=null)e.setAttribute(k,v);
  }
  for(const c of kids.flat(Infinity))if(c!=null&&c!==false)e.append(c instanceof Node?c:String(c));
  return e;
};
async function api(yol,{method="GET",govde}={}){
  const r=await fetch(yol,{method,headers:{"Content-Type":"application/json"},body:govde?JSON.stringify(govde):undefined});
  if(r.status===401){location.href="/giris.html";throw new Error("Giriş gerekli.");}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||"Bir şey ters gitti.");
  return j;
}
const sakla={oku:k=>{try{return localStorage.getItem(k)}catch{return null}},yaz:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};
const tlYaz=k=>k==null?"":String(k/100).replace(".",",");

let D=null,sekme="zarflar",ay=null,sihirbazAdim=0;
const kok=$("#kok");
function bildir(m,hata=false){const t=h("div",{class:"bildiri"+(hata?" hata":""),role:"status"},m);document.body.append(t);setTimeout(()=>t.remove(),3500);}
async function yukle(){try{D=await api("/api/durum"+(ay?`?ay=${ay}`:""));ay=D.ay;ciz();}catch(e){bildir(e.message,true);}}
let mesgul=false;
async function is(fn,mesaj){if(mesgul)return;mesgul=true;try{await fn();if(mesaj)bildir(mesaj);await yukle();}catch(e){bildir(e.message,true);}finally{mesgul=false;}}

function ciz(){
  kok.replaceChildren();
  if(!D.kurulum){kok.append(sihirbaz());return;}
  const ekran={zarflar:zarflarEkrani,hedefler:hedeflerEkrani,gecmis:gecmisEkrani,piyasa:piyasaEkrani,ayarlar:ayarlarEkrani}[sekme]();
  kok.append(ust(),ekran,alt());
}
const SEKMELER=[["zarflar","Zarflar"],["hedefler","Hedefler"],["gecmis","Geçmiş"],["piyasa","Piyasa"]];
const ust=()=>h("header",{class:"ust"},h("h1",{},sekme==="ayarlar"?"Ayarlar":"Diogenes"),
  h("button",{class:"ikon","aria-label":sekme==="ayarlar"?"Ayarları kapat":"Ayarlar",onclick:()=>{sekme=sekme==="ayarlar"?"zarflar":"ayarlar";ciz();}},sekme==="ayarlar"?"✕":"⚙︎"));
const alt=()=>h("nav",{class:"alt"},SEKMELER.map(([k,ad])=>h("button",{class:sekme===k?"secili":"",onclick:()=>{sekme=k;ciz();}},ad)));
function ayDegis(n){const [y,m]=ay.split("-").map(Number);ay=new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7);yukle();}
const aySecici=()=>h("div",{class:"ay"},h("button",{class:"ikon","aria-label":"Önceki ay",onclick:()=>ayDegis(-1)},"‹"),h("strong",{},ayAdi(ay)),h("button",{class:"ikon","aria-label":"Sonraki ay",onclick:()=>ayDegis(1)},"›"));

function sayfa(baslik,icerik,kaydet){
  const arka=h("div",{class:"arka",onclick:e=>{if(e.target===arka)arka.remove();}});
  const form=h("form",{class:"sayfa",onsubmit:async e=>{e.preventDefault();const d=form.querySelector("button[type=submit]");if(d.disabled)return;d.disabled=true;try{await kaydet(new FormData(form));arka.remove();await yukle();}catch(err){bildir(err.message,true);}finally{d.disabled=false;}}},
    h("h2",{},baslik),icerik,h("div",{class:"dugmeler"},h("button",{class:"ana",type:"submit"},"Kaydet"),h("button",{type:"button",onclick:()=>arka.remove()},"Vazgeç")));
  arka.append(form);document.body.append(arka);const ilk=form.querySelector("input");if(ilk)ilk.focus();
  return arka;
}
const alan=(etiket,girdi)=>h("label",{},h("span",{},etiket),girdi);
const zarfSecimi=(ad,secili,pasifOlabilir=false)=>{
  const pasif=pasifOlabilir&&secili!=null&&secili!==""&&!D.durum.zarflar.some(z=>String(z.id)===String(secili))?D.zarflar.find(z=>String(z.id)===String(secili)):null;
  return h("select",{name:ad},h("option",{value:""},"Atanmamış"),D.durum.zarflar.map(z=>h("option",{value:z.id,selected:String(z.id)===String(secili)},z.ad)),
    pasif&&h("option",{value:pasif.id,selected:true},pasif.ad+" (silinmiş)"));
};

function zarflarEkrani(){
  const d=D.durum;
  return h("main",{},aySecici(),
    D.oneriler.map(oneriKarti),
    h("section",{},d.zarflar.map(zarfSatiri),
      h("div",{class:"zarf"+(d.atanmamis<0?" eksi":"")},h("div",{class:"zarf-ust"},h("span",{},"Atanmamış"),h("b",{},tl(d.atanmamis))))),
    h("div",{class:"islemler"},h("button",{onclick:()=>gelirFormu()},"+ Gelir")),
    h("button",{class:"fab","aria-label":"Harcama ekle",onclick:()=>harcamaFormu()},"+"));
}
function zarfSatiri(z){
  const oran=z.konan>0?Math.max(0,Math.min(100,Math.round(z.kalan/z.konan*100))):0;
  return h("div",{class:"zarf"+(z.kalan<0?" eksi":"")},
    h("div",{class:"zarf-ust"},h("span",{},z.ad),h("b",{},tl(z.kalan))),
    h("div",{class:"cubuk"},h("i",{style:`width:${oran}%`})),
    h("small",{},`Konan ${tl(z.konan)} / ${tl(z.aylik)} · Harcanan ${tl(z.harcanan)}`));
}
function oneriKarti(o){
  const karar=k=>is(()=>api("/api/oneri",{method:"POST",govde:{id:o.id,karar:k}}),k==="onayla"?"Uygulandı.":"Reddedildi.");
  return h("article",{class:"oneri"},h("h3",{},o.baslik),o.aciklama&&h("p",{},o.aciklama),
    h("ul",{},o.satirlar.map(s=>h("li",{},h("span",{},s.ad),h("b",{},tl(s.tutar))))),
    h("div",{class:"dugmeler"},h("button",{class:"ana",onclick:()=>karar("onayla")},"Onayla"),
      o.duzenlenebilir&&h("button",{onclick:()=>dagitimDuzenle(o)},"Düzenle"),
      h("button",{onclick:()=>karar("reddet")},"Reddet")));
}
function dagitimDuzenle(o){
  const bilgi=h("p",{class:"sayac"});
  const tutarG=h("input",{name:"tutar",inputmode:"decimal",value:tlYaz(o.tutar)});
  const girdiler=D.durum.zarflar.map(z=>{const s=o.satirlar.find(x=>x.zarf_id===z.id);return [z,h("input",{inputmode:"decimal",value:s?tlYaz(s.tutar):""})];});
  const say=()=>{const top=girdiler.reduce((t,[,g])=>t+(kurusa(g.value)||0),0),gelen=kurusa(tutarG.value)||0;bilgi.textContent=`Atanmamış kalacak: ${tl(gelen-top)}`;bilgi.classList.toggle("eksi",top>gelen);};
  for(const g of [tutarG,...girdiler.map(x=>x[1])])g.addEventListener("input",say);
  say();
  sayfa("Dağıtımı düzenle",[alan("Gelen tutar (₺)",tutarG),...girdiler.map(([z,g])=>alan(`${z.ad} (eksik ${tl(z.eksik)})`,g)),bilgi],async()=>{
    await api("/api/oneri",{method:"POST",govde:{id:o.id,karar:"onayla",duzenleme:{tutar:tutarG.value,kalemler:girdiler.filter(([,g])=>g.value.trim()).map(([z,g])=>({zarf_id:z.id,tutar:g.value}))}}});
    bildir("Uygulandı.");
  });
}
function harcamaFormu(k=null){
  const sonZarf=sakla.oku("sonZarf"),istekId=crypto.randomUUID();
  let arka;
  arka=sayfa(k?"Harcamayı düzenle":"Harcama ekle",[
    alan("Tutar (₺)",h("input",{name:"tutar",inputmode:"decimal",required:true,value:k?tlYaz(k.tutar_kurus):""})),
    alan("Zarf",zarfSecimi("zarf_id",k?k.zarf_id:sonZarf,!!k)),
    alan("Açıklama",h("input",{name:"aciklama",required:true,maxlength:80,value:k?k.aciklama:""})),
    alan("Tarih",h("input",{name:"tarih",type:"date",value:k?k.tarih:D.bugun})),
    k&&h("button",{type:"button",class:"tehlike",onclick:()=>{if(confirm("Bu harcama silinsin mi?")){arka.remove();is(()=>api("/api/harcama/sil",{method:"POST",govde:{id:k.id}}),"Silindi.");}}},"Sil"),
  ],async f=>{
    const g={tutar:f.get("tutar"),zarf_id:f.get("zarf_id")||null,aciklama:f.get("aciklama"),tarih:f.get("tarih")};
    if(k)await api("/api/harcama/duzenle",{method:"POST",govde:{id:k.id,...g}});
    else{await api("/api/harcama",{method:"POST",govde:{istek_id:istekId,...g}});sakla.yaz("sonZarf",g.zarf_id||"");}
    bildir("Kaydedildi.");
  });
}
function gelirFormu(k=null){
  let arka;
  arka=sayfa(k?"Geliri düzenle":"Gelir ekle",[
    alan("Tutar (₺)",h("input",{name:"tutar",inputmode:"decimal",required:true,value:k?tlYaz(k.tutar_kurus):""})),
    alan("Açıklama",h("input",{name:"aciklama",required:true,maxlength:80,value:k?k.aciklama:""})),
    alan("Tarih",h("input",{name:"tarih",type:"date",value:k?k.tarih:D.bugun})),
    k&&h("button",{type:"button",class:"tehlike",onclick:()=>{if(confirm("Bu gelir silinsin mi? Dağıtılmış para Atanmamış'ı eksiye düşürebilir.")){arka.remove();is(()=>api("/api/gelir/sil",{method:"POST",govde:{id:k.id}}),"Silindi.");}}},"Sil"),
  ],async f=>{
    const g={tutar:f.get("tutar"),aciklama:f.get("aciklama"),tarih:f.get("tarih")};
    await api(k?"/api/gelir/duzenle":"/api/gelir",{method:"POST",govde:k?{id:k.id,...g}:g});
    bildir(k?"Kaydedildi.":"Gelir eklendi; dağıtım önerisi hazır.");
  });
}
// Görev 8 ve 9 bu satırın üstüne ekler.
const LISTELER={
  gelir_plani:{baslik:"Gelir planı",yeni:{ad:"",tutar:"",gun:""},alanlar:[["ad","Ad"],["tutar","Tutar (₺)","para"],["gun","Gün","sayi"]],
    kaynak:()=>D.gelirPlani,donustur:r=>({id:r.id,ad:r.ad,tutar:tlYaz(r.tutar_kurus),gun:String(r.gun)}),
    ilk:()=>[{ad:"Ayın 1'i",tutar:"15000",gun:"1"},{ad:"Ayın 7'si",tutar:"4000",gun:"7"},{ad:"Ayın 16'sı",tutar:"16000",gun:"16"}]},
  zarflar:{baslik:"Zarflar",yeni:{ad:"",aylik:""},alanlar:[["ad","Zarf adı"],["aylik","Aylık (₺)","para"]],sirali:true,
    kaynak:()=>D.zarflar.filter(z=>z.aktif).sort((a,b)=>a.sira-b.sira||a.id-b.id),donustur:r=>({id:r.id,ad:r.ad,aylik:tlYaz(r.aylik_kurus)})},
  abonelikler:{baslik:"Abonelikler",yeni:{ad:"",tutar:"",gun:"",zarf_id:null},alanlar:[["ad","Ad"],["tutar","Tutar (₺)","para"],["gun","Gün","sayi"],["zarf_id","Zarf","zarf"]],
    kaynak:()=>D.abonelikler,donustur:r=>({id:r.id,ad:r.ad,tutar:tlYaz(r.tutar_kurus),gun:String(r.gun),zarf_id:r.zarf_id,aktif:r.aktif})},
  borclar:{baslik:"Borçlar",yeni:{ad:"",kalan:"",aylik:"",kalan_taksit:""},alanlar:[["ad","Ad"],["kalan","Kalan (₺)","para"],["aylik","Aylık ödeme (₺)","para"],["kalan_taksit","Kalan taksit","sayi"]],
    kaynak:()=>D.borclar,donustur:r=>({id:r.id,ad:r.ad,kalan:tlYaz(r.kalan_kurus),aylik:tlYaz(r.aylik_kurus),kalan_taksit:r.kalan_taksit==null?"":String(r.kalan_taksit)})},
  birikimler:{baslik:"Birikimler",yeni:{tur:"nakit",ad:"",tutar:""},alanlar:[["tur","Tür","tur"],["ad","Ad"],["tutar","Tutar (₺)","para"]],
    kaynak:()=>D.birikimler,donustur:r=>({id:r.id,tur:r.tur,ad:r.ad,tutar:tlYaz(r.tutar_kurus)})},
  merdiven:{baslik:"Hedef merdiveni",yeni:{ad:"",hedef:"",biriken:"",kural:null},alanlar:[["ad","Basamak"],["hedef","Hedef (₺)","para"],["biriken","Biriken (₺)","para"]],sirali:true,
    kaynak:()=>D.merdiven,donustur:r=>({id:r.id,ad:r.ad,kural:r.kural,hedef:r.kural?"":tlYaz(r.hedef_kurus),biriken:tlYaz(r.biriken_kurus)}),
    ilk:()=>VARSAYILAN_MERDIVEN.map(b=>({ad:b.ad,kural:b.kural,hedef:"",biriken:""}))},
};
function listeEditoru(anahtar,ekBilgi){
  const L=LISTELER[anahtar];
  let satirlar=L.kaynak().map(L.donustur);
  if(!satirlar.length)satirlar=L.ilk?L.ilk():[{...L.yeni}];
  const kutu=h("div",{class:"liste"});
  const bildirEk=()=>{if(ekBilgi)ekBilgi(satirlar);};
  function girdi(r,[k,etiket,tur]){
    const degis=e=>{r[k]=e.target.value===""&&tur==="zarf"?null:e.target.value;bildirEk();};
    if(tur==="zarf")return h("select",{"aria-label":etiket,onchange:degis},h("option",{value:""},"Atanmamış"),D.zarflar.filter(z=>z.aktif).map(z=>h("option",{value:z.id,selected:String(z.id)===String(r[k])},z.ad)));
    if(tur==="tur")return h("select",{"aria-label":etiket,onchange:degis},BIRIKIM_TURLERI.map(([v,a])=>h("option",{value:v,selected:v===r[k]},a)));
    const kurallı=k==="hedef"&&r.kural;
    return h("input",{"aria-label":etiket,placeholder:kurallı?"Otomatik":etiket,disabled:!!kurallı,value:r[k]??"",inputmode:tur==="para"?"decimal":tur==="sayi"?"numeric":"text",oninput:degis});
  }
  function yeniden(){
    kutu.replaceChildren(...satirlar.map((r,i)=>h("div",{class:"satir",style:`grid-template-columns:repeat(${L.alanlar.length},1fr) auto`},
      L.alanlar.map(a=>girdi(r,a)),
      h("div",{class:"satir-dugme"},
        L.sirali&&h("button",{type:"button",class:"ikon","aria-label":"Yukarı taşı",disabled:i===0,onclick:()=>{[satirlar[i-1],satirlar[i]]=[satirlar[i],satirlar[i-1]];yeniden();}},"↑"),
        h("button",{type:"button",class:"ikon","aria-label":"Satırı sil",onclick:()=>{satirlar.splice(i,1);yeniden();}},"✕")))),
      h("button",{type:"button",onclick:()=>{satirlar.push({...L.yeni});yeniden();}},"+ Ekle"));
    bildirEk();
  }
  yeniden();
  const temiz=()=>satirlar.filter(r=>L.alanlar.some(([k,,t])=>t!=="tur"&&t!=="zarf"&&String(r[k]??"").trim()));
  return {el:kutu,kaydet:()=>api("/api/liste",{method:"PUT",govde:{tablo:anahtar,satirlar:temiz()}})};
}

const ADIMLAR=[
  ["gelir_plani","Gelirin","Para hangi gün ne kadar geliyor? Kontrol et, gerekirse düzelt."],
  ["birikimler","Şu anki birikimin","Nakit, banka, altın, döviz, fon: her birini toplam tutar olarak yaz. Yoksa satırı sil."],
  ["borclar","Borçların","Kredi kartı, KYK, taksit: kalan tutar ve aylık ödeme. Yoksa satırı sil."],
  ["zarflar","Zarfların","Paranı hangi zarflara ayıracaksın? Üstteki zarf, para gelince önce dolar."],
  ["merdiven","Hedef merdivenin","Ay sonunda kalan para, tamamlanmamış ilk basamağa gider. Kurallı basamakların hedefi kendiliğinden hesaplanır."],
];
function sihirbaz(){
  const [anahtar,baslik,aciklama]=ADIMLAR[sihirbazAdim],son=sihirbazAdim===ADIMLAR.length-1;
  const bilgi=h("p",{class:"sayac"}),plan=D.gelirPlani.reduce((t,g)=>t+g.tutar_kurus,0);
  const ed=listeEditoru(anahtar,anahtar==="zarflar"?s=>{
    const top=s.reduce((t,r)=>t+(kurusa(r.aylik)||0),0);
    bilgi.textContent=`Dağıtılan ${tl(top)} / Gelir ${tl(plan)} · ${tl(plan-top)} atanmamış`;bilgi.classList.toggle("eksi",top>plan);
  }:null);
  return h("main",{class:"sihirbaz"},h("small",{},`Adım ${sihirbazAdim+1}/${ADIMLAR.length}`),h("h1",{},baslik),h("p",{},aciklama),ed.el,bilgi,
    h("div",{class:"dugmeler"},
      sihirbazAdim>0&&h("button",{onclick:()=>{sihirbazAdim--;ciz();}},"Geri"),
      h("button",{class:"ana",onclick:()=>is(async()=>{await ed.kaydet();if(son)await api("/api/ayar",{method:"POST",govde:{anahtar:"kurulum",deger:"1"}});else sihirbazAdim++;},son?"Kurulum tamam.":null)},son?"Bitir":"İleri")));
}
function ayarlarEkrani(){
  const bolum=anahtar=>{const ed=listeEditoru(anahtar);return h("details",{class:"kart"},h("summary",{},LISTELER[anahtar].baslik),ed.el,h("div",{class:"dugmeler"},h("button",{class:"ana",onclick:()=>is(ed.kaydet,"Kaydedildi.")},"Kaydet")));};
  const getiri=h("input",{inputmode:"decimal",value:String(D.getiri)});
  return h("main",{},["zarflar","gelir_plani","abonelikler","borclar","birikimler","merdiven"].map(bolum),
    h("section",{class:"kart"},h("h2",{},"Projeksiyon"),alan("Yıllık getiri varsayımı (%)",getiri),
      h("button",{onclick:()=>is(()=>api("/api/ayar",{method:"POST",govde:{anahtar:"getiri",deger:getiri.value}}),"Kaydedildi.")},"Kaydet")),
    h("button",{class:"tehlike",onclick:()=>is(async()=>{await api("/api/logout",{method:"POST"});location.href="/giris.html";})},"Çıkış yap"));
}
function hedeflerEkrani(){
  const birikim=D.birikimler.reduce((t,b)=>t+b.tutar_kurus,0)+D.merdiven.reduce((t,b)=>t+b.biriken_kurus,0);
  const yillik=D.aylikToplam*12,hedef=yillik*25,oran=yillik?Math.min(100,Math.round(birikim*0.04/yillik*1000)/10):0;
  const planGelir=D.gelirPlani.reduce((t,g)=>t+g.tutar_kurus,0);
  const ekG=h("input",{inputmode:"decimal",value:tlYaz(Math.max(0,planGelir-D.aylikToplam))});
  const sonuc=h("p",{class:"sayac"});
  const hesapla=()=>{
    const ek=kurusa(ekG.value)||0,s=ozgurlukSuresi(birikim,ek,D.getiri,hedef);
    sonuc.textContent=!yillik?"Önce zarflarını kur."
      :s===null?"Bu tempoyla 50 yılda ulaşılmıyor."
      :`Ayda ${tl(ek)} ile yaklaşık ${Math.floor(s/12)} yıl ${s%12} ay. Yıllık getiri varsayımı %${D.getiri} (Ayarlar'dan değişir). Tavsiye değil, hesap.`;
  };
  ekG.addEventListener("input",hesapla);hesapla();
  return h("main",{},
    h("section",{class:"kart"},h("h2",{},"Finansal özgürlük"),h("div",{class:"buyuk"},`%${oran}`),h("div",{class:"cubuk"},h("i",{style:`width:${oran}%`})),
      h("small",{},`Birikim ${tl(birikim)} · Hedef ${tl(hedef)} (yıllık zarf giderinin 25 katı, %4 kuralı)`)),
    h("section",{class:"kart"},h("h2",{},"Hedef merdiveni"),h("ol",{class:"merdiven"},D.merdiven.map(b=>{
      const o=b.hedef?Math.min(100,Math.round(b.biriken_kurus/b.hedef*100)):0;
      return h("li",{class:b.tamam?"tamam":""},
        h("div",{class:"zarf-ust"},h("span",{},(b.tamam?"✓ ":"")+b.ad),h("b",{},b.hedef===null?tl(b.biriken_kurus):`${tl(b.biriken_kurus)} / ${tl(b.hedef)}`)),
        b.hedef!==null&&b.hedef>0&&h("div",{class:"cubuk"},h("i",{style:`width:${o}%`})));
    }))),
    h("section",{class:"kart"},h("h2",{},"Projeksiyon"),alan("Aylık ek birikim (₺)",ekG),sonuc));
}
function gecmisEkrani(){
  const yer=h("p",{},"Yükleniyor…"),ana=h("main",{},aySecici(),yer);
  api(`/api/gecmis?ay=${ay}`).then(g=>{
    const ad=new Map(g.zarflar.map(z=>[z.id,z.ad])),zad=id=>id==null?"Atanmamış":ad.get(id)||"Silinmiş zarf";
    const secim=h("select",{"aria-label":"Zarfa göre süz"},h("option",{value:""},"Tüm zarflar"),g.zarflar.map(z=>h("option",{value:z.id},z.ad)));
    const liste=h("ul",{class:"gecmis"});
    const listeCiz=()=>{const f=secim.value;const xs=g.harcamalar.filter(x=>!f||String(x.zarf_id)===f);
      liste.replaceChildren(...(xs.length?xs.map(x=>h("li",{onclick:()=>harcamaFormu(x)},h("span",{},`${x.tarih.slice(8)} · ${x.aciklama}`,h("small",{},zad(x.zarf_id))),h("b",{},"−"+tl(x.tutar_kurus)))):[h("li",{},"Bu ay harcama yok.")]));};
    secim.addEventListener("change",listeCiz);listeCiz();
    const aktarilan=g.aktarimlar.reduce((t,a)=>t+a.tutar_kurus,0),toplam=new Map();
    for(const x of g.harcamalar)toplam.set(x.zarf_id,(toplam.get(x.zarf_id)||0)+x.tutar_kurus);
    const enCok=[...toplam].sort((a,b)=>b[1]-a[1])[0];
    yer.replaceWith(
      h("section",{class:"kart"},h("h2",{},"Ay özeti"),h("p",{},`Hedefe aktarılan: ${tl(aktarilan)}`),enCok&&h("p",{},`En çok harcanan: ${zad(enCok[0])} (${tl(enCok[1])})`)),
      h("section",{class:"kart"},h("h2",{},"Gelirler"),h("ul",{class:"gecmis"},g.gelirler.length?g.gelirler.map(x=>h("li",{onclick:()=>gelirFormu(x)},h("span",{},`${x.tarih.slice(8)} · ${x.aciklama}`),h("b",{},"+"+tl(x.tutar_kurus)))):h("li",{},"Bu ay gelir yok."))),
      h("section",{class:"kart"},h("h2",{},"Harcamalar"),secim,liste));
  }).catch(e=>{yer.textContent=e.message;});
  return ana;
}
const piyasaEkrani=()=>h("main",{},h("section",{class:"kart"},h("h2",{},"Piyasa"),
  h("p",{},"Hisse taraması ayrı çalışıyor; ekranları eskisi gibi orada."),
  h("p",{},h("a",{href:"https://ross002200.github.io/Ross/diogenes/",target:"_blank",rel:"noopener"},"Tarama ekranlarını aç ↗")),
  h("small",{},"Öğrenme amaçlıdır, yatırım tavsiyesi değildir.")));
yukle();
