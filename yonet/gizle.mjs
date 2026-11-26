// Çıktıdaki sırları gizler: bilinen değerler (anahtar yenilemede üretilenler) ve 32+ karakterlik onaltılık dizgiler.
const UZUN_HEX=/(?<![0-9a-f-])[0-9a-f]{32,}(?![0-9a-f-])/gi;
export function gizleyici(bilinen=[]){
  const degerler=bilinen.map(v=>String(v??"").trim()).filter(v=>v.length>=8);
  return metin=>{let s=String(metin);for(const v of degerler)s=s.split(v).join("••••");return s.replace(UZUN_HEX,"••••");};
}
