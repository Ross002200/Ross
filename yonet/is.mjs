// Tek seferde bir iş: adımlar sırayla, çıktı gizlenip satır satır biriktirilir; ağ hatasında yeniden denenir.
import {spawn} from "node:child_process";
import {join} from "node:path";
import {gizleyici} from "./gizle.mjs";
import {KOK} from "./projeler.mjs";

const AG=/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|Could not resolve|\b503\b|\b502\b|Service Unavailable|socket hang up/i;
export const agHatasi=cikti=>cikti.some(s=>AG.test(s));
export function oneriBul(cikti){
  const t=cikti.join("\n");
  if(/not authenticated|not logged in|wrangler login|Authentication error|code: 10000/i.test(t))return "Cloudflare girişi gerekli: terminalde `wrangler login` çalıştır.";
  if(agHatasi(cikti))return "Ağ hatası: internet bağlantını kontrol edip yeniden dene.";
  return "";
}

// Gerçek çalıştırıcı: Windows kabuğunda, D:\Claude'a göre klasörde. girdi varsa stdin'e yazılır (sır değerleri).
export function kabukCalistir(adim,satir){
  return new Promise(res=>{
    const c=spawn(adim.komut,{cwd:join(KOK,adim.klasor),shell:true,windowsHide:true,env:{...process.env,FORCE_COLOR:"0",NO_COLOR:"1"}});
    const parca=akis=>{let kalan="";akis.on("data",d=>{const s=(kalan+d.toString("utf8")).split(/\r?\n/);kalan=s.pop()??"";for(const l of s)if(l.trim())satir(l.replace(/\x1b\[[0-9;]*m/g,""));});akis.on("end",()=>{if(kalan.trim())satir(kalan);});};
    parca(c.stdout);parca(c.stderr);
    if(adim.girdi!==undefined){c.stdin.write(adim.girdi);}
    c.stdin.end();
    c.on("error",e=>{satir(`Başlatılamadı: ${e.message}`);res(1);});
    c.on("close",kod=>res(kod??1));
    IsYoneticisi.aktif=c;
  });
}

export class IsYoneticisi{
  static aktif=null;
  constructor(calistir=kabukCalistir){this.calistir=calistir;this.d={calisiyor:false,ad:"",satirlar:[],sonuc:null};}
  get mesgul(){return this.d.calisiyor;}
  durum(){return {...this.d,satirlar:[...this.d.satirlar]};}
  baslat(ad,isFn,bilinen=[]){
    if(this.d.calisiyor)throw new Error("mesgul");
    const gizle=gizleyici(bilinen),tum=[];
    this.d={calisiyor:true,ad,satirlar:[],sonuc:null};
    const yaz=s=>{const g=gizle(s);this.d.satirlar.push(g);if(this.d.satirlar.length>2000)this.d.satirlar.shift();};
    const adim=async a=>{
      const deneme=Math.max(1,a.deneme??1);let cikti=[];
      for(let i=1;i<=deneme;i++){
        cikti=[];yaz(`$ ${a.komut.replace(/"[^"]*node_modules[\\/]wrangler[^"]*"/,"wrangler")}`);
        const kod=await this.calistir(a,s=>{cikti.push(s);tum.push(s);yaz(s);});
        if(kod===0)return {ok:true,cikti};
        if(i<deneme&&agHatasi(cikti)){yaz(`Ağ hatası, yeniden deneniyor (${i+1}/${deneme})…`);await new Promise(r=>setTimeout(r,this.calistir===kabukCalistir?8000:1));continue;}
        break;
      }
      return {ok:false,cikti};
    };
    (async()=>{
      let sonuc;
      try{sonuc=await isFn({adim,yaz});}
      catch(e){sonuc={ok:false,ozet:e instanceof Error?e.message:"Hata"};}
      if(!sonuc.ok){const o=oneriBul(tum);if(o&&!sonuc.ozet.includes(o))sonuc={...sonuc,ozet:`${sonuc.ozet} ${o}`.trim()};}
      this.d.sonuc=sonuc;this.d.calisiyor=false;IsYoneticisi.aktif=null;
    })();
  }
}
