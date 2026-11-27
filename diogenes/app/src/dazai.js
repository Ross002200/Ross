// Diogenes ↔ Dazai: saf yardımcılar (ağ ve D1 yok). Bağlantı standardı Aurelius 2026-11-06 tasarımı §1.
import {tl,gunEkle,planGunu} from "./core.js";

export const katla=s=>String(s??"").toLocaleLowerCase("tr-TR").replace(/ı/g,"i").replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s").replace(/ö/g,"o").replace(/ç/g,"c").replace(/â/g,"a").replace(/\s+/g," ").trim();

// Dazai'nin söylediği zarf adı: önce tam eşleşme, sonra baştan eşleşme (ör. "yem" → Yemek).
export function zarfAdiCoz(ad,zarflar){
  const k=katla(ad);if(!k)return null;
  return zarflar.find(z=>katla(z.ad)===k)||zarflar.find(z=>katla(z.ad).startsWith(k))||null;
}
const kelimeIcinde=(metin,kelime)=>(" "+metin+" ").includes(" "+kelime+" ");
// Zarf verilmemiş harcama: öğrenilmiş eşleme (etiket, sonra açıklama), sonra zarf adının tam kelime olarak geçmesi.
export function zarfBul({aciklama,etiket},zarflar,eslemeler){
  const aktif=new Map(zarflar.map(z=>[z.id,z])),es=new Map(eslemeler.map(e=>[e.kelime,e.zarf_id]));
  for(const k of [katla(etiket),katla(aciklama)])if(k&&es.has(k)&&aktif.has(es.get(k)))return aktif.get(es.get(k));
  const metin=katla(`${aciklama??""} ${etiket??""}`);
  return zarflar.find(z=>{const n=katla(z.ad);return n.length>=3&&kelimeIcinde(metin,n);})||null;
}
// Diyar zarfı söylediğinde öğrenilecek kelimeler.
export const esleKelimeleri=({aciklama,etiket})=>[...new Set([katla(etiket),katla(aciklama)])].filter(k=>k&&k.length<=40);

// "Bursum geldi" → plan "Burs": plan adının her kelimesi (3+ harf) söylenen bir kelimenin başında geçer (Türkçe ekler).
export function planBul(aciklama,plan){
  const kel=katla(aciklama).split(" ").filter(Boolean);if(!kel.length)return null;
  return plan.find(p=>{const ad=katla(p.ad).split(" ").filter(w=>w.length>=3);return ad.length>0&&ad.every(w=>kel.some(k=>k.startsWith(w)));})||null;
}

// GET /api/dazai/bugun cevabı. Maddeler yalnız yapılacak işler (bekleyen öneri, kaydırması olmayan eksi zarf);
// zarf kalanları ve yarınki abonelikler satirlar'da (standarda eklenen isteğe bağlı alan), kısa hali ozet'te.
export function bugunCevabi({day,durum,oneriler=[],kaydirmaZarflari=new Set(),abonelikler=[],zarfAd=new Map()}){
  const yarin=gunEkle(day,1);
  const yarinki=abonelikler.filter(a=>a.aktif&&planGunu(yarin.slice(0,7),a.gun)===yarin);
  const maddeler=[
    ...durum.zarflar.filter(z=>z.kalan<0&&!kaydirmaZarflari.has(z.id)).sort((a,b)=>a.kalan-b.kalan)
      .map(z=>({id:`zarf:${z.id}`,baslik:`${z.ad} zarfı eksi`,tur:"onay",durum:"bekliyor",ayrinti:`${tl(z.kalan)}; Diogenes'te başka zarftan kaydır`})),
    ...oneriler.map(o=>({id:`oneri:${o.id}`,baslik:o.baslik,tur:"onay",durum:"bekliyor",ayrinti:o.satirlar.map(s=>`${s.ad} ${tl(s.tutar)}`).join(", ").slice(0,200)})),
  ];
  const ozet=[`Atanmamış ${tl(durum.atanmamis)}`,...yarinki.map(a=>`yarın ${a.ad} ${tl(a.tutar_kurus)}`)].join(" · ").slice(0,120);
  const satirlar=[
    ...durum.zarflar.map(z=>`${z.ad}: ${tl(z.kalan)} kaldı (aylık ${tl(z.aylik)})`),
    ...yarinki.map(a=>`Yarın çekilecek: ${a.ad} ${tl(a.tutar_kurus)}${a.zarf_id?` (${zarfAd.get(a.zarf_id)||"silinmiş zarf"})`:""}`),
  ].slice(0,20);
  return {app:"diogenes",day,ozet,maddeler,satirlar};
}
