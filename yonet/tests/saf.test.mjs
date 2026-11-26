import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {join} from "node:path";
import {gizleyici} from "../gizle.mjs";
import {PROJELER,KOK} from "../projeler.mjs";
import {degerlendir,gunFarki} from "../durum.mjs";

test("gizle: bilinen değer ve 32+ onaltılık dizgi gizlenir, normal metin kalır", () => {
  const g=gizleyici(["gizli-deger-123456"]);
  assert.equal(g("anahtar gizli-deger-123456 yazıldı"),"anahtar •••• yazıldı");
  assert.equal(g("k="+"a1".repeat(24)),"k=••••");
  assert.equal(g("Current Version ID: 1c13ba76-6c11-43cd-8d59-b19fc9d74a8e"),"Current Version ID: 1c13ba76-6c11-43cd-8d59-b19fc9d74a8e");
  assert.equal(gizleyici([""," ","kısa"])("kısa metin"),"kısa metin","8 karakterden kısa değerler gizlenmez (yanlış eşleşme)");
});

test("projeler: altı proje, klasörler var, adresler https, test komutu tanımlı", () => {
  assert.deepEqual(PROJELER.map(p=>p.id),["aurelius","kleanthes","zenon","epiktetos","seneca","diogenes"]);
  for(const p of PROJELER){
    assert.ok(existsSync(join(KOK,p.klasor)),p.id);
    assert.match(p.adres,/^https:\/\//,p.id);
    assert.ok(p.test.length>0,p.id);
    for(const a of [...p.test,...p.yayin])assert.ok(existsSync(join(KOK,a.klasor)),`${p.id} ${a.klasor}`);
    if(p.d1)assert.ok(p.wr&&p.worker,p.id);
  }
  assert.deepEqual(PROJELER.find(p=>p.id==="seneca").yayin,[]);
});

test("gunFarki: tarih ve ISO zaman", () => {
  assert.equal(gunFarki("2026-11-20","2026-11-27"),7);
  assert.equal(gunFarki("2026-11-26T21:00:06.338Z","2026-11-27"),1);
});

test("degerlendir: yeşil, sarı (bayat ya da hiç), kırmızı, gri", () => {
  const p={id:"zenon",ad:"Zenon",taze:{esik:3,oneri:"Zenon'u telefonda aç"},kirmiziOneri:"Site cevap vermiyor"};
  assert.deepEqual(degerlendir(p,{canli:true,son:"2026-11-26"},"2026-11-27"),{renk:"yesil",ozet:"son: 2026-11-26 (1 gün önce)",oneri:""});
  assert.deepEqual(degerlendir(p,{canli:true,son:"2026-11-14T19:59:25.396Z"},"2026-11-27"),{renk:"sari",ozet:"son: 2026-11-14 (13 gün önce)",oneri:"Zenon'u telefonda aç"});
  assert.equal(degerlendir(p,{canli:true,son:null},"2026-11-27").renk,"sari");
  assert.equal(degerlendir(p,{canli:true,son:null},"2026-11-27").ozet,"henüz veri yok");
  assert.deepEqual(degerlendir(p,{canli:false,son:"2026-11-26"},"2026-11-27"),{renk:"kirmizi",ozet:"site cevap vermiyor",oneri:"Site cevap vermiyor"});
  assert.deepEqual(degerlendir(p,{canli:null,son:null},"2026-11-27"),{renk:"gri",ozet:"bağlantı yok",oneri:"İnternet bağlantını kontrol et."});
  const s={id:"seneca",ad:"Seneca"};
  assert.deepEqual(degerlendir(s,{canli:true,son:null},"2026-11-27"),{renk:"yesil",ozet:"çalışıyor",oneri:""});
  assert.equal(degerlendir(p,{canli:true,son:"2026-11-26",bilgi:"bugün 2 bildirim"},"2026-11-27").ozet,"son: 2026-11-26 (1 gün önce) · bugün 2 bildirim");
});
