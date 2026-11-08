// Zenon belge doğrulaması (saf): localStorage anahtarları docs tablosuna yazılmadan önce.
export const MAX_DOC=1024*1024,MAX_ITEMS=200;
export const SKIP=new Set(["photos","care.push","aurelius"]);
const KEY=/^[A-Za-z0-9_.:\-]{1,80}$/;
export const gecerliAnahtar=k=>typeof k==="string"&&KEY.test(k)&&!SKIP.has(k);
// Tek bozuk anahtar tüm isteği düşürmez: geçerliler yazılır, diğerleri nedeniyle döner (istemci onları sıradan çıkarır).
export function belgeleriAyikla(body){
  if(!body||!Array.isArray(body.items))throw new Error("items gerekli.");
  if(body.items.length>MAX_ITEMS)throw new Error("Bir seferde en çok 200 anahtar.");
  const gecerli=[],reddedilen=[];
  for(const it of body.items){
    const key=it&&it.key;
    if(!gecerliAnahtar(key)){reddedilen.push({key:String(key),neden:"Geçersiz ya da eşitlenmeyen anahtar."});continue;}
    if(it.data===undefined){reddedilen.push({key,neden:"Veri yok."});continue;}
    const text=JSON.stringify(it.data);
    if(text.length>MAX_DOC){reddedilen.push({key,neden:"1 MB sınırını aşıyor."});continue;}
    gecerli.push({key,text});
  }
  return {gecerli,reddedilen};
}
