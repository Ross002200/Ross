import {test} from "node:test";
import assert from "node:assert/strict";
import ZC from "../../zenon-care.js";
import {zenonBugun,isaretleKaydi} from "../src/dazai.js";

const DAY="2026-11-09";                       // Pazartesi: haftalık "towel" görevi her zaman var
const P=ZC.DEFAULT_PROFILE,G=ZC.buildDay(P,DAY,null,{});
const card={gun:{key:"f12",title:"Lacivert triko",pieces:"Triko, chino, sneaker",ids:[3,7,9],occ:"okul"},spor:{key:"spor",title:"Spor",pieces:"Tişört, şort",ids:[20,21],occ:"spor"}};
const bos={profile:P,care:{},card:null,log:[],todo:{},wx:{}};
const byId=(r,id)=>r.maddeler.find(m=>m.id===id);

test("bugun: kart yokken kombin maddesi yok, bakım ve görevler var", () => {
  const r=zenonBugun(DAY,bos,[]);
  assert.equal(r.app,"zenon");assert.equal(r.day,DAY);
  assert.equal(byId(r,"kombin:gun"),undefined);assert.match(r.ozet,/Zenon bugün kombin hazırlamadı/);
  const s=byId(r,"bakim:sabah");
  assert.deepEqual({...s,ayrinti:undefined},{id:"bakim:sabah",baslik:"Sabah bakımı",tur:"onay",durum:"bekliyor",ilerleme:`0/${G.am.length} adım`,ayrinti:undefined});
  assert.equal(s.ayrinti,G.am.map(x=>x.label).join(", "));
  assert.ok(byId(r,"bakim:aksam"));
  assert.deepEqual(r.maddeler.filter(m=>m.id.startsWith("gorev:")).map(m=>m.id),G.weekly.map(t=>`gorev:${t.id}`));
  assert.ok(G.weekly.some(t=>t.id==="towel"));
});

test("bugun: kart varken kombin ve spor bekliyor; log, todo ya da bekleyen işaret yapıldı yapar", () => {
  const r=zenonBugun(DAY,{...bos,card},[]);
  assert.deepEqual(byId(r,"kombin:gun"),{id:"kombin:gun",baslik:"Günün kombini: Lacivert triko",tur:"onay",durum:"bekliyor",ayrinti:"Triko, chino, sneaker"});
  assert.equal(byId(r,"kombin:spor").durum,"bekliyor");assert.match(r.ozet,/kombin hazır/);
  assert.equal(byId(zenonBugun(DAY,{...bos,card,log:[{d:DAY,key:"f12"}]},[]),"kombin:gun").durum,"yapildi");
  assert.equal(byId(zenonBugun(DAY,{...bos,card,log:[{d:"2026-11-08",key:"f12"}]},[]),"kombin:gun").durum,"bekliyor","başka günün kaydı sayılmaz");
  assert.equal(byId(zenonBugun(DAY,{...bos,card,todo:{[DAY]:{wear:true,weargym:true}}},[]),"kombin:spor").durum,"yapildi");
  assert.equal(byId(zenonBugun(DAY,{...bos,card},[{tur:"giydim",d:DAY,slot:"gun",key:"f12"}]),"kombin:gun").durum,"yapildi");
});

test("bugun: bakım kısmen, bekleyen bakım ve görev işaretleri sayılır", () => {
  const care={done:{[DAY]:{am:[G.am[0].id],pm:[],tasks:[]}}};
  const r=zenonBugun(DAY,{...bos,care},[]);
  if(G.am.length>1)assert.equal(byId(r,"bakim:sabah").durum,"kismen");
  assert.equal(byId(r,"bakim:sabah").ilerleme,`1/${G.am.length} adım`);
  const r2=zenonBugun(DAY,bos,[{tur:"bakim",d:DAY,kind:"pm",on:true},{tur:"gorev",d:DAY,id:"towel",on:true}]);
  assert.equal(byId(r2,"bakim:aksam").durum,"yapildi");assert.equal(byId(r2,"gorev:towel").durum,"yapildi");
  const r3=zenonBugun(DAY,bos,[{tur:"bakim",d:DAY,kind:"pm",on:true},{tur:"bakim",d:DAY,kind:"pm",on:false}]);
  assert.equal(byId(r3,"bakim:aksam").durum,"bekliyor","sırayla uygulanır: son işaret geçerli");
});

test("bugun: bakım profili yoksa bakım maddesi yok", () => {
  const r=zenonBugun(DAY,{...bos,profile:null,card},[]);
  assert.equal(byId(r,"bakim:sabah"),undefined);assert.match(r.ozet,/^Bakım profili yok/);assert.ok(byId(r,"kombin:gun"));
});

test("isaretle: kombin yalnız kart varken ve yalnız giyildi olarak", () => {
  assert.throws(()=>isaretleKaydi(DAY,{id:"kombin:gun",yapildi:true},bos),/kombin kartı yok/);
  assert.throws(()=>isaretleKaydi(DAY,{id:"kombin:gun",yapildi:false},{...bos,card}),/yalnız giyildi/);
  const r=isaretleKaydi(DAY,{id:"kombin:gun",yapildi:true},{...bos,card});
  assert.deepEqual(r.kayit,{tur:"giydim",d:DAY,slot:"gun",key:"f12",title:"Lacivert triko",occ:"okul",ids:[3,7,9]});
  assert.equal(r.mesaj,"Lacivert triko giyildi olarak işaretlendi.");
  assert.equal(isaretleKaydi(DAY,{id:"kombin:spor",yapildi:true},{...bos,card}).kayit.slot,"spor");
});

test("isaretle: bakım, görev ve bilinmeyen madde", () => {
  assert.deepEqual(isaretleKaydi(DAY,{id:"bakim:aksam",yapildi:true},bos).kayit,{tur:"bakim",d:DAY,kind:"pm",on:true});
  assert.equal(isaretleKaydi(DAY,{id:"bakim:sabah",yapildi:false},bos).mesaj,"Sabah bakımı yapılmadı olarak işaretlendi.");
  assert.throws(()=>isaretleKaydi(DAY,{id:"bakim:sabah",yapildi:true},{...bos,profile:null}),/bakım profili yok/);
  assert.deepEqual(isaretleKaydi(DAY,{id:"gorev:towel",yapildi:true},bos).kayit,{tur:"gorev",d:DAY,id:"towel",on:true});
  assert.throws(()=>isaretleKaydi(DAY,{id:"gorev:nails",yapildi:true},bos),/bugün yok/);
  assert.throws(()=>isaretleKaydi(DAY,{id:"yoga",yapildi:true},bos),/^Error: Bilinmeyen madde\.$/);
});
