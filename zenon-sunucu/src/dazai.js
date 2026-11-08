// Dazai bağlantı standardı, Zenon tarafı (saf). Sözleşme: Aurelius docs/superpowers/specs/2026-11-06-dazai-gunluk-isler-design.md
// Bakım adımları zenon-care.js ile sunucuda hesaplanır; kombin, Zenon'un yazdığı card:<gün> belgesinden gelir.
import ZC from "../../zenon-care.js";

const kombin=(id,ad,k,yapildi)=>({id,baslik:`${ad}: ${k.title}`,tur:"onay",durum:yapildi?"yapildi":"bekliyor",ayrinti:k.pieces});
function rutin(id,ad,adimlar,yapilan){
  const n=adimlar.filter(s=>yapilan.includes(s.id)).length;
  return {id,baslik:ad,tur:"onay",durum:n===adimlar.length?"yapildi":n?"kismen":"bekliyor",ilerleme:`${n}/${adimlar.length} adım`,ayrinti:adimlar.map(s=>s.label).join(", ")};
}

export function zenonBugun(day,d,bekleyen){
  const maddeler=[],ozet=[],todo=(d.todo&&d.todo[day])||{},card=d.card,log=Array.isArray(d.log)?d.log:[];
  const giydi=slot=>bekleyen.some(e=>e.tur==="giydim"&&e.slot===slot);
  if(card&&card.gun){
    maddeler.push(kombin("kombin:gun","Günün kombini",card.gun,!!todo.wear||log.some(l=>l.d===day&&l.key===card.gun.key)||giydi("gun")));
    if(card.spor)maddeler.push(kombin("kombin:spor","Spor kombini",card.spor,!!todo.weargym||giydi("spor")));
    ozet.push("kombin hazır");
  }else ozet.push("Zenon bugün kombin hazırlamadı");
  if(d.profile){
    const care=d.care||{},gun=ZC.buildDay(d.profile,day,(d.wx||{})[day]||null,care);
    let done=(care.done||{})[day]||{am:[],pm:[],tasks:[]};
    let tasks=[...(done.tasks||[])];
    for(const e of bekleyen){
      if(e.tur==="bakim")done=ZC.markRoutine(gun,done,e.kind,e.on);
      if(e.tur==="gorev"){tasks=tasks.filter(t=>t!==e.id);if(e.on)tasks.push(e.id);}
    }
    maddeler.push(rutin("bakim:sabah","Sabah bakımı",gun.am,done.am||[]));
    maddeler.push(rutin("bakim:aksam",gun.active==="retinoid"?"Akşam bakımı, retinoid gecesi":gun.active==="bha"?"Akşam bakımı, BHA gecesi":"Akşam bakımı",gun.pm,done.pm||[]));
    for(const t of gun.weekly)maddeler.push({id:`gorev:${t.id}`,baslik:t.label,tur:"onay",durum:tasks.includes(t.id)?"yapildi":"bekliyor"});
  }else ozet.unshift("Bakım profili yok");
  return {app:"zenon",day,ozet:ozet.join(" · "),maddeler};
}

export function isaretleKaydi(day,b,d){
  const id=String(b.id||""),on=b.yapildi!==false;
  if(id==="kombin:gun"||id==="kombin:spor"){
    const slot=id.slice(7),k=d.card&&d.card[slot];
    if(b.yapildi!==true)throw new Error("Kombini yalnız giyildi olarak işaretleyebilirim; geri almak için Zenon'u kullan.");
    if(!k)throw new Error("Bugün için kombin kartı yok; Zenon'u açınca hazırlanır.");
    return {kayit:{tur:"giydim",d:day,slot,key:k.key,title:k.title,occ:k.occ||"",ids:Array.isArray(k.ids)?k.ids:[]},mesaj:`${k.title} giyildi olarak işaretlendi.`};
  }
  if(id==="bakim:sabah"||id==="bakim:aksam"){
    if(!d.profile)throw new Error("Zenon'da bakım profili yok.");
    return {kayit:{tur:"bakim",d:day,kind:id==="bakim:sabah"?"am":"pm",on},mesaj:`${id==="bakim:sabah"?"Sabah":"Akşam"} bakımı ${on?"yapıldı":"yapılmadı"} olarak işaretlendi.`};
  }
  if(id.startsWith("gorev:")){
    if(!d.profile)throw new Error("Zenon'da bakım profili yok.");
    const gid=id.slice(6),t=ZC.buildDay(d.profile,day,null,d.care||{}).weekly.find(x=>x.id===gid);
    if(!t)throw new Error("Bu görev bugün yok.");
    return {kayit:{tur:"gorev",d:day,id:gid,on},mesaj:`${t.label}: ${on?"yapıldı":"yapılmadı"}.`};
  }
  throw new Error("Bilinmeyen madde.");
}
