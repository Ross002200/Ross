// Panel işleri: her biri ctx ({adim, yaz}) alan bir fonksiyon döner ve {ok, ozet} sonuçlanır.
import {join} from "node:path";
import {homedir} from "node:os";
import {writeFileSync,mkdirSync,readdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {oneriBul} from "./is.mjs";
import {PROJELER,KOK,PYTHON,wrangler,DIOGENES_DAL} from "./projeler.mjs";
import {degerlendir} from "./durum.mjs";

const proje=id=>{const p=PROJELER.find(x=>x.id===id);if(!p)throw new Error(`Bilinmeyen proje: ${id}`);return p;};
export const istanbulBugun=()=>new Date(Date.now()+3*3600e3).toISOString().slice(0,10);
export function ayikla(cikti){const t=cikti.join("\n"),i=t.indexOf("[");if(i<0)return null;try{return JSON.parse(t.slice(i,t.lastIndexOf("]")+1));}catch{return null;}}

export const testIsi=ids=>async ctx=>{
  const sonuc=[];
  for(const id of ids){const p=proje(id);let ok=true;for(const a of p.test){const r=await ctx.adim(a);if(!r.ok){ok=false;break;}}sonuc.push([p.ad,ok]);}
  return {ok:sonuc.every(([,o])=>o),ozet:sonuc.map(([a,o])=>`${a} ${o?"✓":"✗"}`).join(" · ")};
};

export async function canliMi(fetchFn,adres){
  for(let i=0;i<2;i++){try{const r=await fetchFn(adres,{redirect:"manual",signal:AbortSignal.timeout(15000)});if(r.status<500)return true;}catch{/* yeniden */}}
  return false;
}

export const yayinIsi=(id,yokla=adres=>canliMi(fetch,adres))=>async ctx=>{
  const p=proje(id);
  if(!p.yayin.length)throw new Error(`${p.ad} için panelden yayını yok.`);
  for(const a of p.test){const r=await ctx.adim(a);if(!r.ok)return {ok:false,ozet:`${p.ad}: testler geçmedi, yayın yapılmadı.`};}
  for(const a of p.yayin){const r=await ctx.adim({...a,deneme:3});if(!r.ok)return {ok:false,ozet:`${p.ad}: yayın başarısız; canlı sürüm değişmedi.`};}
  return (await yokla(p.adres))?{ok:true,ozet:`${p.ad} yayınlandı, site açılıyor ✓`}:{ok:false,ozet:`${p.ad} yayınlandı ama site cevap vermiyor.`};
};

const yedekGunu=()=>readdirSync(join(KOK,"yedekler")).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).length;
export const yedekIsi=(gun,dosya={mkdir:k=>mkdirSync(k,{recursive:true}),say:yedekGunu})=>async ctx=>{
  const klasor=join(KOK,"yedekler",gun);dosya.mkdir(klasor);const sonuc=[];
  for(const p of PROJELER.filter(x=>x.d1)){
    const r=await ctx.adim({klasor:p.d1Klasor??p.wr,komut:`${wrangler(p.wr)} d1 export ${p.d1} --remote --output "${join(klasor,p.d1+".sql")}"`,deneme:3});
    sonuc.push([p.d1,r.ok]);
  }
  const s=await ctx.adim({klasor:"Seneca",komut:`"${PYTHON}" -c "import sqlite3; s=sqlite3.connect('file:data/seneca.db?mode=ro', uri=True); d=sqlite3.connect(r'${join(klasor,"seneca.db")}'); s.backup(d); d.close()"`});
  sonuc.push(["seneca",s.ok]);
  ctx.yaz(`Yedek klasörü: ${klasor}`);
  ctx.yaz(`Toplam yedek günü: ${dosya.say()} (eski yedekler silinmez)`);
  return {ok:sonuc.every(([,o])=>o),ozet:sonuc.map(([a,o])=>`${a} ${o?"✓":"✗"}`).join(" · ")};
};

export const sirlarIsi=()=>async ctx=>{
  let hepsi=true;
  for(const p of PROJELER.filter(x=>x.worker)){
    const r=await ctx.adim({klasor:p.wr,komut:`${wrangler(p.wr)} secret list --name ${p.worker}`,deneme:2});
    const liste=ayikla(r.cikti);
    if(!r.ok||!Array.isArray(liste))throw new Error(`${p.ad}: sır listesi alınamadı.`);
    const adlar=liste.map(x=>x.name),eksik=p.sirlar.filter(s=>!adlar.includes(s)),fazla=adlar.filter(s=>!p.sirlar.includes(s));
    if(eksik.length)hepsi=false;
    ctx.yaz(`${p.ad}: ${eksik.length?`eksik ✗ ${eksik.join(", ")}`:`tanımlı ✓ (${adlar.length})`}${fazla.length?` · fazladan: ${fazla.join(", ")}`:""}`);
  }
  return {ok:hepsi,ozet:hepsi?"Bütün sırlar tanımlı ✓":"Eksik sır var; listeye bak."};
};

const A={ad:"Aurelius / Dazai",wr:"Aurelius",worker:"aurelius"};
export const ANAHTARLAR=[
  {id:"kleanthes",ad:"Kleanthes ↔ Dazai",hedefler:[{ad:"Kleanthes",wr:"Kleanthes\\app",worker:"kleanthes",sir:"DAZAI_KEY"},{...A,sir:"KLEANTHES_DAZAI_KEY"}]},
  {id:"zenon",ad:"Zenon ↔ Dazai",hedefler:[{ad:"Zenon",wr:"Kleanthes\\app",worker:"zenon",sir:"DAZAI_KEY"},{...A,sir:"ZENON_DAZAI_KEY"}]},
  {id:"epiktetos",ad:"Epiktetos ↔ Dazai",hedefler:[{ad:"Epiktetos",wr:"Epiktetos",worker:"epiktetos",sir:"DAZAI_KEY"},{...A,sir:"EPIKTETOS_DAZAI_KEY"}]},
  {id:"uyku",ad:"Uyku Kestirmesi",hedefler:[{ad:"Kleanthes",wr:"Kleanthes\\app",worker:"kleanthes",sir:"UYKU_KEY"}],dosya:"Kleanthes-uyku-anahtari.txt"},
];
// Windows'un gerçek Belgeler klasörü (OneDrive'a taşınmış olabilir); bulunamazsa kullanıcı klasöründeki Documents.
export function belgelerKlasoru(){
  try{const y=execFileSync("powershell",["-NoProfile","-Command","[Environment]::GetFolderPath('MyDocuments')"],{encoding:"utf8",windowsHide:true}).trim();if(y)return y;}catch{/* aşağıda */}
  return join(homedir(),"Documents");
}
export const anahtarIsi=(id,deger,dosyaDeps={yaz:writeFileSync,klasor:belgelerKlasoru})=>async ctx=>{
  const k=ANAHTARLAR.find(x=>x.id===id);if(!k)throw new Error(`Bilinmeyen anahtar: ${id}`);
  // Dosyalı anahtarda (uyku) değer önce dosyaya yazılır: sır değişip değer kaybolmasın.
  if(k.dosya){
    const yol=join(dosyaDeps.klasor(),k.dosya);
    try{dosyaDeps.yaz(yol,`Kleanthes uyku anahtari (yalniz Kestirme icine yapistir, sonra bu dosyayi sil):\r\n${deger}\r\n`);}
    catch{return {ok:false,ozet:`Anahtar dosyası yazılamadı (${yol}); hiçbir şey değişmedi.`};}
    ctx.yaz(`Yeni anahtar dosyada: ${yol}`);
  }
  const tamam=[];
  for(const h of k.hedefler){
    const r=await ctx.adim({klasor:h.wr,komut:`${wrangler(h.wr)} secret put ${h.sir} --name ${h.worker}`,girdi:deger,deneme:3});
    if(!r.ok)return {ok:false,ozet:tamam.length?`Yarım kaldı: ${h.ad} eski anahtarla, ${tamam.join(", ")} yenisiyle. Yeniden dene.`:`${k.ad}: anahtar konamadı; hiçbir şey değişmedi.`};
    tamam.push(h.ad);
  }
  return {ok:true,ozet:`${k.ad} anahtarı yenilendi ✓`};
};

export async function durumTopla(d,bugun=istanbulBugun()){
  let internet=true;
  try{await d.fetch("https://www.google.com/generate_204",{signal:AbortSignal.timeout(8000)});}catch{internet=false;}
  return Promise.all(PROJELER.map(async p=>{
    if(!internet)return {id:p.id,ad:p.ad,adres:p.adres,...degerlendir(p,{canli:null,son:null},bugun)};
    const canli=await canliMi(d.fetch,p.adres);
    let son=null,bilgi;
    if(p.taze?.sorgu){
      const r=await d.adim({klasor:p.d1Klasor??p.wr,komut:`${wrangler(p.wr)} d1 execute ${p.d1} --remote --json --command "${p.taze.sorgu}"`,deneme:2});
      if(!r.ok)return {id:p.id,ad:p.ad,adres:p.adres,renk:canli?"sari":"kirmizi",ozet:"veri okunamadı",oneri:oneriBul(r.cikti)||"Veri okunamadı; Durumu yenile ile yeniden dene."};
      son=ayikla(r.cikti)?.[0]?.results?.[0]?.son??null;
      if(p.taze.bilgiSorgu){const b=await d.adim({klasor:p.d1Klasor??p.wr,komut:`${wrangler(p.wr)} d1 execute ${p.d1} --remote --json --command "${p.taze.bilgiSorgu}"`,deneme:2});const n=ayikla(b.cikti)?.[0]?.results?.[0]?.n;if(n!==undefined)bilgi=`bugün ${n} bildirim`;}
    }else if(p.taze?.git){
      await d.adim({klasor:".",komut:`git fetch -q origin ${p.taze.git}`});
      const r=await d.adim({klasor:".",komut:`git log -1 --format=%cI origin/${p.taze.git}`});
      son=r.cikti.find(s=>/^\d{4}-\d{2}-\d{2}/.test(s))??null;
    }
    return {id:p.id,ad:p.ad,adres:p.adres,...degerlendir(p,{canli,son,bilgi},bugun)};
  }));
}
