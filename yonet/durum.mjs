// Durum kuralları (saf): canlı yoklama ve veri tazeliğinden renk, özet ve tek cümlelik öneri.
export function gunFarki(a,b){
  const g=s=>Date.parse(String(s).slice(0,10)+"T00:00:00Z");
  return Math.round((g(b)-g(a))/864e5);
}
export function degerlendir(p,g,bugun){
  if(g.canli===null)return {renk:"gri",ozet:"bağlantı yok",oneri:"İnternet bağlantını kontrol et."};
  if(g.canli===false)return {renk:"kirmizi",ozet:"site cevap vermiyor",oneri:p.kirmiziOneri||"Site cevap vermiyor; panelden yeniden yayınla ya da Claude'a haber ver."};
  const ek=g.bilgi?` · ${g.bilgi}`:"";
  if(!p.taze)return {renk:"yesil",ozet:"çalışıyor"+ek,oneri:""};
  if(!g.son)return {renk:"sari",ozet:"henüz veri yok"+ek,oneri:p.taze.oneri};
  const n=gunFarki(g.son,bugun),ozet=`son: ${String(g.son).slice(0,10)} (${n} gün önce)${ek}`;
  return n>=p.taze.esik?{renk:"sari",ozet,oneri:p.taze.oneri}:{renk:"yesil",ozet,oneri:""};
}
