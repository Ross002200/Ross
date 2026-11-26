import {test} from "node:test";
import assert from "node:assert/strict";
import {testIsi,yayinIsi,sirlarIsi,anahtarIsi,ANAHTARLAR,durumTopla,ayikla} from "../isler.mjs";

// Sahte ctx: komut deseni → {ok, cikti}
const ctx=kurallar=>{const cagri=[],yazilan=[];return {cagri,yazilan,adim:async a=>{cagri.push(a);for(const [d,r] of kurallar)if(d.test(a.komut))return typeof r==="function"?r(a):r;return {ok:true,cikti:[]};},yaz:s=>yazilan.push(s)};};

test("test işi: projelerin test adımları sırayla, özet sayımı", async () => {
  const c=ctx([[/vitest/,{ok:false,cikti:["Tests  1 failed"]}]]);
  const r=await testIsi(["kleanthes","epiktetos"])(c);
  assert.deepEqual(c.cagri.map(a=>a.komut),["npm test","npx tsc --noEmit","npx vitest run"]);
  assert.equal(r.ok,false);assert.equal(r.ozet,"Kleanthes ✓ · Epiktetos ✗");
});

test("yayın işi: önce testler, başarısızsa yayın yok; başarılıysa yayın ve yoklama", async () => {
  const kotu=ctx([[/npm test/,{ok:false,cikti:[]}]]);
  const r1=await yayinIsi("kleanthes",async()=>true)(kotu);
  assert.equal(r1.ok,false);assert.ok(!kotu.cagri.some(a=>/deploy/.test(a.komut)));assert.match(r1.ozet,/testler geçmedi/);
  const iyi=ctx([]);
  const r2=await yayinIsi("kleanthes",async()=>true)(iyi);
  assert.deepEqual(iyi.cagri.map(a=>[a.komut,a.deneme??1]),[["npm test",1],["npm run deploy",3]]);
  assert.deepEqual(r2,{ok:true,ozet:"Kleanthes yayınlandı, site açılıyor ✓"});
  const r3=await yayinIsi("kleanthes",async()=>false)(ctx([]));
  assert.equal(r3.ok,false);assert.match(r3.ozet,/site cevap vermiyor/);
  await assert.rejects(()=>yayinIsi("seneca",async()=>true)(ctx([])),/yayını yok/);
});

test("sırlar işi: tanımlı, eksik, fazladan", async () => {
  const c=ctx([[/--name aurelius/,{ok:true,cikti:['[','{"name": "AUTH_PASSWORD","type":"secret_text"},','{"name": "YENI","type":"secret_text"}',']']}],[/secret list/,{ok:true,cikti:["[]"]}]]);
  const r=await sirlarIsi()(c);
  assert.equal(r.ok,false);
  assert.ok(c.yazilan.some(s=>/Aurelius \/ Dazai: eksik .*CRON_SECRET/.test(s)));
  assert.ok(c.yazilan.some(s=>/fazladan: YENI/.test(s)));
});

test("anahtar yenile: iki tarafa stdin ile; ikinci taraf düşerse yarım kaldı; değer komutta yok", async () => {
  assert.deepEqual(ANAHTARLAR.map(a=>a.id),["kleanthes","zenon","epiktetos","uyku"]);
  const deger="d".repeat(48);
  const c=ctx([]);
  const r=await anahtarIsi("zenon",deger)(c);
  assert.equal(r.ok,true);
  assert.deepEqual(c.cagri.map(a=>a.komut.replace(/^node "[^"]+"/,"W")),["W secret put DAZAI_KEY --name zenon","W secret put ZENON_DAZAI_KEY --name aurelius"]);
  assert.ok(c.cagri.every(a=>a.girdi===deger&&!a.komut.includes(deger)));
  const c2=ctx([[/--name aurelius/,{ok:false,cikti:["fetch failed"]}]]);
  const r2=await anahtarIsi("zenon",deger)(c2);
  assert.equal(r2.ok,false);assert.match(r2.ozet,/Yarım kaldı: Aurelius \/ Dazai eski anahtarla/);
});

test("durum topla: internet yoksa hepsi gri; site düşükse kırmızı; tazelik sorgusu", async () => {
  const yok=await durumTopla({fetch:async()=>{throw new Error("ağ");},adim:async()=>({ok:false,cikti:[]})},"2026-11-27");
  assert.ok(yok.every(x=>x.renk==="gri"));
  const fetch=async u=>{if(/google/.test(u)||!/seneca/.test(u))return {status:200};throw new Error("kapalı");};
  const adim=async a=>/zenon/.test(a.komut)?{ok:true,cikti:['[{"results":[{"son":"2026-11-14T19:59:25.396Z"}]}]']}:/git /.test(a.komut)?{ok:true,cikti:["2026-11-27T04:19:50+00:00"]}:{ok:true,cikti:['[{"results":[{"son":"2026-11-26","n":2}]}]']};
  const r=await durumTopla({fetch,adim},"2026-11-27");
  const bul=id=>r.find(x=>x.id===id);
  assert.equal(bul("zenon").renk,"sari");assert.match(bul("zenon").oneri,/telefonda aç/);
  assert.equal(bul("seneca").renk,"kirmizi");assert.match(bul("seneca").oneri,/baslat\.cmd/);
  assert.equal(bul("diogenes").renk,"yesil");
});

test("ayıkla: wrangler çıktısındaki JSON", () => {
  assert.deepEqual(ayikla(["⛅️ wrangler 4","[","  {\"results\": [{\"son\": \"x\"}]}","]"]),[{results:[{son:"x"}]}]);
  assert.equal(ayikla(["hata"]),null);
});
