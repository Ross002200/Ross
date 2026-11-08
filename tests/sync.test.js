const test=require("node:test");
const assert=require("node:assert/strict");
const C=require("../zenon-care.js");
const S=require("../zenon-sync.js");

const fakeLs=(init={})=>{const m=new Map(Object.entries(init));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,get length(){return m.size},m};};
const DAY="2026-11-09";

test("eşleme yalnız yeni adreste ve yerelde açık; GitHub Pages'te kapalı", () => {
  assert.equal(S.eslemeAcik("zenon.diyarross.com"),true);assert.equal(S.eslemeAcik("localhost"),true);
  assert.equal(S.eslemeAcik("ross002200.github.io"),false);
});

test("bekleyen: eşitlenmeyen anahtar eklenmez, aynı anahtar bir kez", () => {
  assert.deepEqual(S.bekleyenEkle(["log"],"log"),["log"]);
  assert.deepEqual(S.bekleyenEkle([],"photos"),[]);
  assert.deepEqual(S.bekleyenEkle(["log"],"care.state"),["log","care.state"]);
});

test("paketle: boyut sınırında böler, tek büyük anahtar yine tek başına gider", () => {
  const t={a:"x".repeat(10),b:"x".repeat(10),c:"x".repeat(50)};
  assert.deepEqual(S.paketle(["a","b","c"],k=>t[k],25),["a","b"]);
  assert.deepEqual(S.paketle(["c"],k=>t[k],25),["c"]);
  assert.deepEqual(S.paketle(["yok","a"],k=>t[k]??null,25),["a"]);
});

test("çekilenler: bekleyen ve aynı içerikteki anahtarlar yazılmaz", () => {
  const items=[{key:"log",data:[1]},{key:"plan",data:{a:1}},{key:"care.state",data:{}},{key:"photos",data:{}}];
  const yerel={plan:'{"a":1}'};
  assert.deepEqual(S.cekilenler(items,["log"],k=>yerel[k]??null).map(x=>x.key),["care.state"]);
});

test("gelen: giydim log'a bir kez yazılır ve todo işaretlenir; spor yalnız todo", () => {
  const s={log:[],care:{},todo:{},profile:C.DEFAULT_PROFILE,wx:{},seen:[]};
  const g={tur:"giydim",d:DAY,slot:"gun",key:"f12",title:"Lacivert",occ:"okul",ids:[3,7]};
  const o=S.gelenUygula(s,[{id:"a1",data:g},{id:"a2",data:g},{id:"a3",data:{...g,slot:"spor",key:"spor"}}],C);
  assert.deepEqual(o.log,[{d:DAY,key:"f12",title:"Lacivert",occ:"okul",ids:[3,7],applied:false}],"aynı gün aynı kombin tek kayıt");
  assert.deepEqual(o.todo[DAY],{wear:true,weargym:true});
  assert.deepEqual(o.degisen.sort(),["coach.todo","log"]);assert.deepEqual(o.seen,["a1","a2","a3"]);
});

test("gelen: bakım markRoutine ile, görev ekle/çıkar, görülmüş kayıt tekrar uygulanmaz", () => {
  const s={log:[],care:{done:{}},todo:{},profile:C.DEFAULT_PROFILE,wx:{},seen:["eski"]};
  const o=S.gelenUygula(s,[{id:"b1",data:{tur:"bakim",d:DAY,kind:"am",on:true}},{id:"b2",data:{tur:"gorev",d:DAY,id:"towel",on:true}},{id:"eski",data:{tur:"bakim",d:DAY,kind:"pm",on:true}}],C);
  const gun=C.buildDay(C.DEFAULT_PROFILE,DAY,null,{done:{}});
  assert.deepEqual(o.care.done[DAY].am,gun.am.map(x=>x.id));assert.equal(o.care.done[DAY].amAll,true);
  assert.deepEqual(o.care.done[DAY].pm,[],"görülmüş kayıt atlanır");
  assert.deepEqual(o.care.done[DAY].tasks,["towel"]);
  const o2=S.gelenUygula({...s,care:o.care,seen:[]},[{id:"b3",data:{tur:"gorev",d:DAY,id:"towel",on:false}}],C);
  assert.deepEqual(o2.care.done[DAY].tasks,[]);
  assert.deepEqual(s.care.done,{},"girdi değiştirilmez");
});

test("istemci: gönderim başarılıysa sıra boşalır; uçuşta değişen anahtar yeni değeriyle yeniden gider", async () => {
  const ls=fakeLs({"zenon9:log":"[1]","zenon9:plan":'{"a":1}'});const giden=[];let n=0;
  const z=S.istemci({ls,C,api:async(p,o)=>{giden.push(JSON.parse(o.body));if(n++===0)ls.setItem("zenon9:plan",'{"a":2}');return {ok:true,reddedilen:[]};}});
  z.kirli("log");z.kirli("plan");z.kirli("photos");
  assert.equal(await z.gonder(),true);
  assert.deepEqual(giden[0].items,[{key:"log",data:[1]},{key:"plan",data:{a:1}}]);
  assert.deepEqual(giden[1].items,[{key:"plan",data:{a:2}}],"eski değer gönderildi sayılıp yeni değer kaybolmaz");
  assert.deepEqual(z.bekleyen(),[]);
});

test("istemci: gönderim hatasında sıra korunur; reddedilen anahtar sırada kalmaz", async () => {
  const ls=fakeLs({"zenon9:log":"[1]"});
  const z=S.istemci({ls,C,api:async()=>{throw new Error("ağ yok");}});
  z.kirli("log");assert.equal(await z.gonder(),false);assert.deepEqual(z.bekleyen(),["log"]);
  assert.equal(ls.getItem("zenon-sync:bekleyen"),'["log"]',"sıra kalıcı");
  const z2=S.istemci({ls,C,api:async()=>({ok:true,reddedilen:[{key:"log",neden:"1 MB sınırını aşıyor."}]})});
  assert.equal(await z2.gonder(),true);assert.deepEqual(z2.bekleyen(),[]);
});

test("istemci: çekme yerelden farklıları yazar ve since ilerler", async () => {
  const ls=fakeLs({"zenon9:plan":'{"a":1}',"zenon-sync:since":"2026-11-01T00:00:00.000Z"});const yollar=[];
  const z=S.istemci({ls,C,api:async p=>{yollar.push(p);return {items:[{key:"plan",data:{a:1},updated_at:"2026-11-09T10:00:00.000Z"},{key:"log",data:[5],updated_at:"2026-11-09T11:00:00.000Z"}]};}});
  assert.equal(await z.cek(),1);
  assert.equal(yollar[0],"docs?since=2026-11-01T00%3A00%3A00.000Z");
  assert.equal(ls.getItem("zenon9:log"),"[5]");assert.equal(ls.getItem("zenon-sync:since"),"2026-11-09T11:00:00.000Z");
  assert.deepEqual(z.bekleyen(),[],"çekilen anahtar yeniden gönderilmez");
});

test("istemci: gelen kutusu uygulanır; gönderim başarısızsa ack yok, başarılıysa ack", async () => {
  const kayit={id:"k1",data:{tur:"giydim",d:DAY,slot:"gun",key:"f12",title:"L",occ:"okul",ids:[3]}};
  const ls=fakeLs({"zenon9:log":"[]"});const cagri=[];
  const z=S.istemci({ls,C,api:async(p,o)=>{cagri.push(p);if(p==="inbox")return {items:[kayit]};if(p==="docs")throw new Error("ağ yok");return {ok:true};}});
  assert.equal(await z.gelen(),2);
  assert.match(ls.getItem("zenon9:log"),/"key":"f12"/);
  assert.equal(cagri.includes("inbox/ack"),false,"buluta yazılamadan onaylanmaz");
  assert.deepEqual(z.bekleyen().sort(),["coach.todo","log"]);
  const cagri2=[];
  const z2=S.istemci({ls,C,api:async(p,o)=>{cagri2.push([p,o&&o.body]);if(p==="inbox")return {items:[kayit]};return {ok:true,reddedilen:[]};}});
  await z2.gelen();
  assert.equal((ls.getItem("zenon9:log").match(/f12/g)||[]).length,1,"görülmüş kayıt ikinci kez yazılmaz");
  assert.deepEqual(cagri2.find(c=>c[0]==="inbox/ack")[1],'{"ids":["k1"]}');
});
