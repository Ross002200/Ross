import {test} from "node:test";
import assert from "node:assert/strict";
import {IsYoneticisi,oneriBul,agHatasi} from "../is.mjs";

// Sahte çalıştırıcı: komut → [çıkış kodu, satırlar] sırası
const sahte=plan=>{const cagri=[];return {cagri,calistir:async(a,satir)=>{cagri.push(a.komut);const [kod,sat]=plan[a.komut].shift();for(const s of sat)satir(s);return kod;}};};
const bitsin=y=>new Promise(r=>{const t=setInterval(()=>{if(!y.durum().calisiyor){clearInterval(t);r(y.durum());}},5);});

test("iş adımları sırayla çalışır, çıktı gizlenir, sonuç kaydedilir", async () => {
  const s=sahte({a:[[0,["merhaba "+"ab".repeat(20)]]],b:[[0,["tamam"]]]});
  const y=new IsYoneticisi(s.calistir);
  y.baslat("deneme",async ctx=>{await ctx.adim({klasor:".",komut:"a"});await ctx.adim({klasor:".",komut:"b"});return {ok:true,ozet:"bitti"};});
  const d=await bitsin(y);
  assert.deepEqual(s.cagri,["a","b"]);
  assert.deepEqual(d.satirlar,["$ a","merhaba ••••","$ b","tamam"]);
  assert.deepEqual(d.sonuc,{ok:true,ozet:"bitti"});
});

test("meşgulken ikinci iş reddedilir; bitince kabul edilir", async () => {
  let birak;const y=new IsYoneticisi(async()=>{await new Promise(r=>(birak=r));return 0;});
  y.baslat("bir",async ctx=>{await ctx.adim({klasor:".",komut:"x"});return {ok:true,ozet:""};});
  assert.throws(()=>y.baslat("iki",async()=>({ok:true,ozet:""})),/mesgul/);
  await new Promise(r=>setTimeout(r,5));birak();await bitsin(y);
  assert.doesNotThrow(()=>y.baslat("uc",async()=>({ok:true,ozet:""})));
});

test("ağ hatasında en çok 3 deneme; kalıcı hatada durur", async () => {
  const s=sahte({d:[[1,["fetch failed"]],[1,["503 Service Unavailable"]],[0,["Deployed"]]],e:[[1,["x"]],[1,["x"]]]});
  const y=new IsYoneticisi(s.calistir);
  y.baslat("yayın",async ctx=>{const r=await ctx.adim({klasor:".",komut:"d",deneme:3});return {ok:r.ok,ozet:""};});
  assert.equal((await bitsin(y)).sonuc.ok,true);assert.equal(s.cagri.length,3);
  const s2=sahte({e:[[1,["SyntaxError"]]]});const y2=new IsYoneticisi(s2.calistir);
  y2.baslat("yayın",async ctx=>{const r=await ctx.adim({klasor:".",komut:"e",deneme:3});return {ok:r.ok,ozet:""};});
  assert.equal((await bitsin(y2)).sonuc.ok,false);assert.equal(s2.cagri.length,1,"ağ hatası değilse yeniden denenmez");
});

test("iş içinde hata atılırsa sonuç başarısız ve öneri eklenir", async () => {
  const s=sahte({w:[[1,["✘ [ERROR] You are not authenticated. Please run `wrangler login`."]]]});
  const y=new IsYoneticisi(s.calistir);
  y.baslat("sırlar",async ctx=>{const r=await ctx.adim({klasor:".",komut:"w"});if(!r.ok)throw new Error("wrangler hata");return {ok:true,ozet:""};});
  const d=await bitsin(y);
  assert.equal(d.sonuc.ok,false);assert.match(d.sonuc.ozet,/wrangler login/);
});

test("öneri ve ağ hatası tanıma", () => {
  assert.match(oneriBul(["Not logged in."]),/wrangler login/);
  assert.equal(oneriBul(["her şey yolunda"]),"");
  assert.equal(agHatasi(["TypeError: fetch failed"]),true);assert.equal(agHatasi(["Could not resolve host"]),true);
  assert.equal(agHatasi(["AssertionError"]),false);
});
