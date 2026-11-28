# Diogenes Piyasa Panosu ve Günlük Özet: Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Hedef:** Diogenes'te Türkiye ve ABD piyasasını, altını, dövizi, faizi ve enflasyonu gösteren bir Piyasa panosu ve reel getiri karnesi kurmak. Ayrıca hafta içi her sabah rakamları, bütçe durumunu ve Claude notunu içeren kısa bir özet ile telefona bildirim göndermek.

**Mimari:**
- **Veri toplama:** GitHub Actions (`diogenes-piyasa.yml`, hafta içi 08:00 TSİ) Python ile Yahoo, TCMB EVDS ve TEFAS verisini toplar. Claude'un günlük notunu ntfy üzerinden alır (`relay.py`). Hepsini `POST /api/piyasa` ile Diogenes'e gönderir.
- **Özet ve bildirim:** Diogenes veriyi D1'e yazar, özeti o anda kurar ve cevapta döner. Görev, özetin bildirim satırını mevcut Diogenes bildirim servisiyle (`scan.notify`) telefona gönderir.
- **Abonelik:** Yeni uygulama push aboneliğini kendi sunucusu üzerinden, `BILDIRIM` service binding'i ile bildirim servisine iletir.

**Teknoloji:** Python 3.12 (yfinance, requests, tefas-crawler, pytest), Cloudflare Worker + D1 (vanilla JS, `node --test`), wrangler 4.92.0.

**Spec:** `D:\Claude\diogenes\docs\superpowers\specs\2026-11-28-diogenes-piyasa-ozet-design.md`

## Genel Kısıtlar

- **Dil ve tavsiye:** Bütün metinler Türkçe olacak. Diogenes veri ve hesap verir, tavsiye vermez. Reel getiri karnesinin altında şu not her zaman durur: "Geçmiş getiri geleceği göstermez; sıralama aydan aya değişiyor. Tavsiye değil, hesap."
- **Veri birimi:** Piyasa fiyatları REAL olarak saklanır, kuruşa çevrilmez. Tarihler `YYYY-AA-GG`, aylar `YYYY-AA` biçimindedir.
- **Eski veri:** Eski veri hiçbir zaman güncel gibi gösterilmez. Durumu `yok` ya da `supheli` olan satırlar "veri yok" / "doğrulanamadı" etiketiyle ve son iyi değerle gösterilir.
- **Şüphe eşikleri (günlük değişim):** Döviz ve altın ±%15, endeks ±%20, hisse ±%35, fon ±%15. Faiz satırları eşik kontrolüne girmez. Sıfır ya da negatif fiyat şüphelidir.
- **Yetki:** `POST /api/piyasa` ve `GET /api/izleme-listesi` uç noktaları `x-piyasa-key` başlığıyla korunur (`PIYASA_KEY`, `safeEqual`). Gövde en çok 64 KB olabilir.
- **İzleme listesi:** En çok 10 BIST, 10 ABD hissesi ve 5 fon. Kod `^[A-Z0-9.]{1,12}$` kuralına uyar ve büyük harfe çevrilir.
- **Onay ve gizli değerler:**
  - Commit, push, deploy, gizli değer girme, Claude rutini kurma ve yeni paket kurma Diyar'ın onayına bağlıdır.
  - `EVDS_KEY` değerini Diyar kendisi girer.
  - Gizli değerler ekrana yazılmaz.
- **Yerel paket kurulumu yok:** Python testleri yerel ağa ve yeni pakete ihtiyaç duymaz. `tefas-crawler` yalnızca CI'da kurulur. Ağ çağrıları testlerde sahte fonksiyonlarla değiştirilir.
- **Hisse taraması:** Mevcut hisse taramasının (`scan.py` ve diğer iş akışları) davranışı değişmez. `relay.py`'ye yalnızca bir hedef eklenir.

## Spec'e göre uygulama kararları

1. **Claude notu ntfy üzerinden gelir.** Spec "rutin depoya commit eder" diyordu. Ancak zamanlanmış Claude oturumları bu depoya push edemiyor (`relay.py` başlığı). Bu yüzden not, mevcut kalıpla ntfy veri konusuna `gunluk_not.json` eki olarak yüklenir. `relay.py` bu dosyayı `diogenes/data/gunluk_not.json` olarak yazar ve piyasa görevi oradan okur.
2. **Özeti Diogenes `POST /api/piyasa` sırasında kurar, bildirimi görev gönderir.** Spec'teki 08:30 Diogenes cron'u ve service binding üzerinden `/gonder` kaldırıldı.
   - **Neden:** Bildirim servisinin `GONDER_TOKEN` değeri kimsede açık değil. Döndürmek ise mevcut iş akışlarının anahtarını da değiştirmeyi gerektirirdi.
   - **Sonuç:** Bildirim ~08:05'te gelir. Görev hiç çalışmazsa bildirim de gelmez; bu kabul edilen bedeldir.
3. **Bildirim servisinde değişiklik yok.**
   - Yeni uygulama aboneliği `POST /api/bildirim/abone` ile kendi sunucusuna yollar. Sunucu bunu `BILDIRIM` binding'i ile servisin `/abone` ucuna iletir.
   - Service worker son bildirimi aynı origin'deki `GET /api/bildirim/son` ucundan (oturumla, servise vekâlet) okur. Böylece CORS sorunu çıkmaz.
   - VAPID açık anahtarı `wrangler.json` `vars` içine yazılır (açık değerdir).
4. **`tip` alanı:** Satırlara spec'te olmayan bir `tip` alanı eklenir: `doviz`/`altin`/`endeks`/`hisse`/`fon`/`faiz`. Şüphe eşikleri gruba değil tipe bağlıdır, çünkü spec endeks ile hisseye farklı eşik veriyor ve ikisi aynı grupta duruyor. `onceki` sütunu tutulmaz; önceki değer, aynı koddaki bir önceki `ok` satırından hesaplanır.
5. **Geçmiş:** Görev her çalışmada her enstrümanın son 30 işlem gününü gönderir (upsert). Bu sayede ilk günden çizgi grafikler oluşur, kaçan günler de dolar. Bunun yanında 13 ay sonu değeri `aylik` olarak gönderilir.
6. **Sabit kodlar:**
   - Döviz ve altın: `USDTRY`, `EURTRY`, `GRAM`, `CEYREK`
   - Endeksler: `XU100`, `SPX`, `NDX`
   - Faiz ve enflasyon: `POLITIKA`, `TUFE_Y`, `MEVDUAT`
   - İzleme listesi: `BIST:<KOD>`, `ABD:<KOD>`, `FON:<KOD>`
   - Aylık seriler: `TUFE` (endeks), `MEVDUAT` (yıllık %), `USDTRY`, `GRAM`, `XU100`, `SPX`, `FON:<KOD>`
7. **EVDS seri kodları:** Kodlar `scan/piyasa_kaynak.json` dosyasındadır. TÜFE için `TP.FG.J0` kullanılır. Politika faizi ve mevduat faizi kodları Görev 5'te Diyar'ın anahtarıyla doğrulanır. Kod yanlışsa o satır `yok` olur, geri kalan çalışır.
8. **Ana ekrandaki şerit:** `/api/durum` cevabına `serit` alanı eklenir. Ayrı bir istek atılmaz.
9. **Hafta sonu:** İş akışı yalnızca hafta içi çalışır. Bayatlık uyarısı iş günüyle hesaplanır, yani hafta sonu uyarı vermez.

## İnceleme Odağı

- **Yahoo bir sembolde bozuk ya da boş veri döner.** Yalnızca o satır `yok` ya da `supheli` olmalı, panonun geri kalanı ve özet çıkmalı (Görev 1 `panoGorunum`, Görev 4 `topla` testleri).
- **EVDS anahtarı yok ya da seri kodu yanlış.** Faiz satırları `yok` olmalı, karnede "—" ya da "Enflasyon verisi henüz yok" görünmeli, özet yine çıkmalı (Görev 1 `karne`, Görev 4 testleri).
- **Diogenes kurulumu yapılmamış.** Özette bütçe satırı olmamalı, hata da çıkmamalı (Görev 1 `ozetMetni` testi).
- **Aynı gün iki kez gönderim (yeniden çalıştırma).** Satırlar çoğalmamalı, özet güncellenmeli (Görev 2 duman testi).
- **Geçersiz izleme kodu ya da limit aşımı** (`"THY AO"`, 11. BIST hissesi). Türkçe 400 hatası dönmeli (Görev 1 `listeDogrula` testi).

---

## Dosya Yapısı

```
diogenes/app/
  migrations/0003_piyasa.sql   piyasa, piyasa_aylik, piyasa_not, ozetler, izleme
  src/piyasa.js                saf: supheliMi, degisim, isGunuFarki, panoGorunum, seritOlustur, ayGeri, reelGetiri, karne, harcamaHizi, ozetMetni, piyasaGovdeDogrula
  src/core.js                  listeDogrula + LISTE_SUTUNLARI'na izleme
  src/worker.js                /api/piyasa, /api/izleme-listesi, /api/bildirim/*, durum.serit, izleme listesi
  tests/piyasa.test.js
  scripts/dev-vars.mjs         eksik anahtarları ekler (PIYASA_KEY)
  scripts/duman.mjs            piyasa bölümü
  public/app.js, index.html, sw.js   Piyasa ekranı, şerit, izleme listesi, bildirim düğmesi, push
  wrangler.json                BILDIRIM binding, VAPID_PUBLIC
diogenes/scan/
  piyasa.py, piyasa_kaynak.json, tests/test_piyasa.py
  relay.py                     gunluk_not.json hedefi
  requirements.txt             tefas-crawler
.github/workflows/diogenes-piyasa.yml
```

---

### Görev 1: Diogenes saf piyasa hesapları, şema ve izleme listesi doğrulaması

**Dosyalar:**
- Oluştur: `diogenes/app/migrations/0003_piyasa.sql`, `diogenes/app/src/piyasa.js`, `diogenes/app/tests/piyasa.test.js`
- Değiştir: `diogenes/app/src/core.js` (`LISTE_SUTUNLARI`, `listeDogrula`), `diogenes/app/package.json` (test komutu)

**Arayüzler:**
- Tüketir: `core.js` → `Hata`, `tl`, `gunEkle`, `gecerliGun`, `ayinSonGunu`, `ayAdi`.
- Üretir (`piyasa.js`):
  - `GRUPLAR`
  - `supheliMi(tip, deger, onceki) → bool`
  - `degisim(d, o) → number|null`
  - `isGunuFarki(a, b) → number`
  - `panoGorunum(satirlar, bugun) → {sonGun, bayat, gruplar:[{grup,ad,kartlar:[{kod,grup,tip,ad,birim,deger,gun,degisim,durum,seri}]}]}`
  - `seritOlustur(satirlar, bugun) → kart[]`
  - `ayGeri(ay, n)`
  - `reelGetiri(aylik, kod, sonAy, n) → number|null`
  - `karne(aylik, kalemler) → {sonAy, satirlar:[{kod,ad,r1,r3,r12}]}`
  - `harcamaHizi(zarf, bugun) → {biter, ort}|null`
  - `ozetMetni({pano, durum, bugun, not}) → {metin, bildirim}`
  - `piyasaGovdeDogrula(b) → {gun, satirlar, aylik, not}`
- Üretir (`core.js`): `listeDogrula("izleme", satirlar)` şu yapıyı döner: `[{id,tur,kod,sira}]`.

- [ ] **Adım 1: Şemayı ve test komutunu yaz**

`diogenes/app/migrations/0003_piyasa.sql`:
```sql
-- Piyasa panosu ve günlük özet. Fiyatlar REAL (Diyar'ın parası değil, piyasa fiyatı).
CREATE TABLE piyasa (gun TEXT NOT NULL, kod TEXT NOT NULL, grup TEXT NOT NULL, tip TEXT NOT NULL, ad TEXT NOT NULL, deger REAL, birim TEXT NOT NULL DEFAULT '', kaynak TEXT NOT NULL DEFAULT '', durum TEXT NOT NULL, PRIMARY KEY (gun, kod));
CREATE TABLE piyasa_aylik (ay TEXT NOT NULL, kod TEXT NOT NULL, deger REAL NOT NULL, PRIMARY KEY (ay, kod));
CREATE TABLE piyasa_not (gun TEXT PRIMARY KEY, metin TEXT NOT NULL);
CREATE TABLE ozetler (gun TEXT PRIMARY KEY, metin TEXT NOT NULL, bildirim TEXT NOT NULL, olusturma TEXT NOT NULL);
CREATE TABLE izleme (id INTEGER PRIMARY KEY, tur TEXT NOT NULL, kod TEXT NOT NULL, sira INTEGER NOT NULL);
CREATE INDEX piyasa_kod ON piyasa(kod, gun);
```

`diogenes/app/package.json` içindeki `"test"` satırı:
```json
    "test": "node --test tests/core.test.js tests/dazai.test.js tests/piyasa.test.js",
```

- [ ] **Adım 2: Başarısız testi yaz**

`diogenes/app/tests/piyasa.test.js`:
```js
import {test} from "node:test";
import assert from "node:assert/strict";
import * as p from "../src/piyasa.js";
import {listeDogrula} from "../src/core.js";

const s=(gun,kod,deger,ek={})=>({gun,kod,grup:"altin_doviz",tip:"doviz",ad:kod,birim:"₺",kaynak:"yahoo",deger,durum:deger==null?"yok":"ok",...ek});

test("supheliMi ve degisim", () => {
  assert.equal(p.supheliMi("doviz",42,41),false);
  assert.equal(p.supheliMi("doviz",50,41),true,"+%22 dövizde şüpheli");
  assert.equal(p.supheliMi("hisse",50,41),false,"+%22 hissede olağan");
  assert.equal(p.supheliMi("endeks",0,100),true,"sıfır fiyat");
  assert.equal(p.supheliMi("doviz",42,undefined),false,"önceki yoksa yalnız pozitiflik");
  assert.equal(p.supheliMi("faiz",0,40),false,"faizde eşik yok");
  assert.ok(Math.abs(p.degisim(42,40)-0.05)<1e-12);assert.equal(p.degisim(42,null),null);
});

test("isGunuFarki: hafta sonu sayılmaz", () => {
  assert.equal(p.isGunuFarki("2026-11-27","2026-11-30"),1,"cuma → pazartesi");
  assert.equal(p.isGunuFarki("2026-11-26","2026-11-30"),2);
  assert.equal(p.isGunuFarki("2026-11-30","2026-11-30"),0);
});

test("panoGorunum: son iyi değer, değişim, yok/şüpheli etiket, 30 günlük seri, bayatlık", () => {
  const rows=[s("2026-11-26","USDTRY",41.5),s("2026-11-27","USDTRY",41.9),s("2026-11-30","USDTRY",42.1),
    s("2026-11-27","EURTRY",48),s("2026-11-30","EURTRY",70,{durum:"supheli"}),
    s("2026-11-27","XU100",10000,{grup:"tr",tip:"endeks",birim:""}),s("2026-11-30","XU100",null,{grup:"tr",tip:"endeks",birim:""})];
  const v=p.panoGorunum(rows,"2026-11-30");
  assert.equal(v.sonGun,"2026-11-30");assert.equal(v.bayat,false);
  const k=Object.fromEntries(v.gruplar.flatMap(g=>g.kartlar).map(x=>[x.kod,x]));
  assert.equal(k.USDTRY.deger,42.1);assert.ok(Math.abs(k.USDTRY.degisim-(42.1/41.9-1))<1e-12);assert.deepEqual(k.USDTRY.seri,[41.5,41.9,42.1]);
  assert.equal(k.EURTRY.durum,"supheli");assert.equal(k.EURTRY.deger,48,"şüphelide son iyi değer");assert.equal(k.EURTRY.degisim,null);
  assert.equal(k.XU100.durum,"yok");assert.equal(k.XU100.deger,10000);assert.equal(k.XU100.gun,"2026-11-27");
  assert.deepEqual(v.gruplar.map(g=>g.grup),["altin_doviz","tr","abd","faiz"]);
  assert.equal(p.panoGorunum(rows,"2026-12-02").bayat,true,"iki iş günü geride");
  assert.equal(p.panoGorunum([],"2026-11-30").bayat,true,"hiç veri yok");
  assert.deepEqual(p.seritOlustur(rows,"2026-11-30").map(x=>x.kod),["USDTRY","XU100"],"sabit sıra, yalnız değeri olanlar (GRAM yok)");
});

test("reelGetiri ve karne: fiyat ve mevduat, eksik veri", () => {
  const aylik=[];for(let i=0;i<=12;i++){const ay=p.ayGeri("2026-10",i);aylik.push({ay,kod:"TUFE",deger:100*1.02**(12-i)},{ay,kod:"MEVDUAT",deger:48});}
  aylik.push({ay:"2026-10",kod:"GRAM",deger:200},{ay:"2025-10",kod:"GRAM",deger:100},{ay:"2026-09",kod:"GRAM",deger:190});
  assert.equal(p.ayGeri("2026-01",1),"2025-12");assert.equal(p.ayGeri("2026-10",12),"2025-10");
  assert.ok(Math.abs(p.reelGetiri(aylik,"GRAM","2026-10",12)-(2/1.02**12-1))<1e-9);
  assert.ok(Math.abs(p.reelGetiri(aylik,"GRAM","2026-10",1)-((200/190)/1.02-1))<1e-9);
  assert.ok(Math.abs(p.reelGetiri(aylik,"MEVDUAT","2026-10",3)-(1.04**3/1.02**3-1))<1e-9,"aylık %4, bileşik");
  assert.equal(p.reelGetiri(aylik,"GRAM","2026-10",3),null,"3 ay önceki fiyat yok");
  const k=p.karne(aylik,[{kod:"GRAM",ad:"Gram altın"},{kod:"USDTRY",ad:"Dolar"}]);
  assert.equal(k.sonAy,"2026-10");assert.equal(k.satirlar[1].r12,null);
  assert.deepEqual(p.karne([],[{kod:"GRAM",ad:"Gram"}]),{sonAy:null,satirlar:[{kod:"GRAM",ad:"Gram",r1:null,r3:null,r12:null}]});
});

test("harcamaHizi: ilk 3 gün yok, ay içinde biterse gün, bitmezse null", () => {
  assert.equal(p.harcamaHizi({ad:"Yemek",kalan:300000,harcanan:300000},"2026-11-03"),null);
  assert.deepEqual(p.harcamaHizi({ad:"Yemek",kalan:300000,harcanan:300000},"2026-11-10"),{biter:"2026-11-20",ort:30000});
  assert.equal(p.harcamaHizi({ad:"Kira",kalan:900000,harcanan:10000},"2026-11-10"),null);
  assert.equal(p.harcamaHizi({ad:"Yemek",kalan:-5000,harcanan:605000},"2026-11-10").biter,"2026-11-10");
  assert.equal(p.harcamaHizi({ad:"Boş",kalan:1000,harcanan:0},"2026-11-10"),null);
});

test("ozetMetni: piyasa, bütçe, not; kurulum yoksa bütçe yok; bayat veri", () => {
  const rows=[s("2026-11-27","USDTRY",41.9),s("2026-11-30","USDTRY",42.1),s("2026-11-27","GRAM",4000,{tip:"altin"}),s("2026-11-30","GRAM",4220,{tip:"altin"}),
    s("2026-11-27","XU100",10000,{grup:"tr",tip:"endeks",birim:""}),s("2026-11-30","XU100",10080,{grup:"tr",tip:"endeks",birim:""})];
  const pano=p.panoGorunum(rows,"2026-11-30");
  const durum={atanmamis:120000,zarflar:[{id:1,ad:"Kira",kalan:900000,harcanan:100000},{id:2,ad:"Yemek",kalan:120000,harcanan:480000}]};
  const o=p.ozetMetni({pano,durum,bugun:"2026-11-10",not:"Bugün ABD'de enflasyon verisi var."});
  assert.equal(o.metin,"Dolar 42,10 (+%0,5) · gram altın 4.220 (+%5,5) · BIST 100 10.080 (+%0,8)\nYemek: 1.200 ₺ kaldı, bu hızla ayın 12. günü biter.\nBugün ABD'de enflasyon verisi var.");
  assert.equal(o.bildirim,"Dolar 42,10 (+%0,5) · gram altın 4.220 (+%5,5) · BIST 100 10.080 (+%0,8) · Yemek: 1.200 ₺ kaldı, bu hızla ayın 12. günü biter.");
  assert.equal(p.ozetMetni({pano,durum:null,bugun:"2026-11-30",not:null}).metin,"Dolar 42,10 (+%0,5) · gram altın 4.220 (+%5,5) · BIST 100 10.080 (+%0,8)");
  const sakin={atanmamis:120000,zarflar:[{id:1,ad:"Kira",kalan:900000,harcanan:100000}]};
  assert.match(p.ozetMetni({pano,durum:sakin,bugun:"2026-11-30",not:null}).metin,/\nAtanmamış 1\.200 ₺$/);
  assert.match(p.ozetMetni({pano:p.panoGorunum(rows,"2026-12-03"),durum:null,bugun:"2026-12-03",not:null}).metin,/^Piyasa verisi 2026-11-30 tarihinden beri güncellenmedi\.$/);
  assert.equal(p.ozetMetni({pano:p.panoGorunum([],"2026-11-30"),durum:null,bugun:"2026-11-30",not:null}).metin,"Piyasa verisi gelmedi.");
});

test("piyasaGovdeDogrula: biçim, yok satırı, sunucu tarafı şüphe", () => {
  const g=p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[s("2026-11-27","EURTRY",48),s("2026-11-30","EURTRY",70),s("2026-11-30","XU100",null,{grup:"tr",tip:"endeks"})],aylik:[{ay:"2026-10",kod:"TUFE",deger:3100.5}],not:"  Not  "});
  assert.deepEqual(g.satirlar.map(r=>[r.kod,r.gun,r.durum]),[["EURTRY","2026-11-27","ok"],["EURTRY","2026-11-30","supheli"],["XU100","2026-11-30","yok"]]);
  assert.equal(g.not,"Not");assert.equal(g.aylik.length,1);
  assert.throws(()=>p.piyasaGovdeDogrula({gun:"30.11.2026",satirlar:[]}),{message:"Gün geçersiz."});
  assert.throws(()=>p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[s("2026-11-30","US D",1)]}),{message:/Satır geçersiz/});
  assert.throws(()=>p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[s("2026-11-30","USDTRY",1,{grup:"kripto"})]}),{message:/Satır geçersiz/});
  assert.throws(()=>p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[],aylik:[{ay:"2026-13",kod:"TUFE",deger:1}]}),{message:/Aylık satır geçersiz/});
  assert.equal(p.piyasaGovdeDogrula({gun:"2026-11-30",satirlar:[]}).not,null);
});

test("listeDogrula izleme: büyük harf, biçim, tür ve limit", () => {
  assert.deepEqual(listeDogrula("izleme",[{tur:"bist",kod:" thyao "},{tur:"fon",kod:"tte"}]),[{id:null,tur:"bist",kod:"THYAO",sira:1},{id:null,tur:"fon",kod:"TTE",sira:2}]);
  assert.throws(()=>listeDogrula("izleme",[{tur:"bist",kod:"THY AO"}]),{message:"Kod geçersiz: THY AO"});
  assert.throws(()=>listeDogrula("izleme",[{tur:"kripto",kod:"BTC"}]),{message:"İzleme türü BIST, ABD ya da fon olmalı."});
  assert.throws(()=>listeDogrula("izleme",Array.from({length:11},(_,i)=>({tur:"bist",kod:"K"+i}))),{message:"En çok 10 BIST hissesi eklenebilir."});
  assert.throws(()=>listeDogrula("izleme",Array.from({length:6},(_,i)=>({tur:"fon",kod:"F"+i}))),{message:"En çok 5 fon eklenebilir."});
});
```

- [ ] **Adım 3: Testi çalıştır ve başarısız olduğunu gör**

Çalıştır: `cd D:\Claude\diogenes\app; npm test`
Beklenen: `tests/piyasa.test.js` dosyası `Cannot find module '…/src/piyasa.js'` hatası verir. Diğer 30 test GEÇER.

- [ ] **Adım 4: `src/piyasa.js`'i yaz**

```js
// Piyasa panosu ve günlük özet hesapları (saf). Fiyatlar REAL; günler YYYY-AA-GG, aylar YYYY-AA. Tavsiye değil, hesap.
import {Hata,tl,gunEkle,gecerliGun,ayinSonGunu} from "./core.js";

export const GRUPLAR=[["altin_doviz","Altın ve döviz"],["tr","Türkiye"],["abd","ABD"],["faiz","Faiz, enflasyon, fon"]];
const GRUP_SET=new Set(GRUPLAR.map(([g])=>g)),TIP_SET=new Set(["doviz","altin","endeks","hisse","fon","faiz"]);
const ESIK={doviz:.15,altin:.15,endeks:.20,hisse:.35,fon:.15};
const KOD=/^[A-Z0-9:._^=-]{1,24}$/;

export function supheliMi(tip,deger,onceki){
  if(tip==="faiz")return !Number.isFinite(deger);
  if(!Number.isFinite(deger)||deger<=0)return true;
  const e=ESIK[tip];
  return !!e&&Number.isFinite(onceki)&&onceki>0&&Math.abs(deger/onceki-1)>e;
}
export const degisim=(d,o)=>Number.isFinite(d)&&Number.isFinite(o)&&o>0?d/o-1:null;
// a'dan b'ye kaç iş günü (cumartesi ve pazar sayılmaz).
export function isGunuFarki(a,b){
  let n=0,g=a;
  while(g<b){g=gunEkle(g,1);const w=new Date(g+"T00:00:00Z").getUTCDay();if(w!==0&&w!==6)n++;}
  return n;
}
function kartlar(satirlar){
  const kodlar=new Map();
  for(const r of [...satirlar].sort((a,b)=>a.gun.localeCompare(b.gun))){if(!kodlar.has(r.kod))kodlar.set(r.kod,[]);kodlar.get(r.kod).push(r);}
  return [...kodlar].map(([kod,xs])=>{
    const iyi=xs.filter(x=>x.durum==="ok"),son=iyi[iyi.length-1],onc=iyi[iyi.length-2],enSon=xs[xs.length-1];
    // Son gelen satır yok/şüpheliyse: son iyi değer gösterilir, değişim gösterilmez, etiket enSon.durum.
    const guncel=enSon.durum==="ok";
    return {kod,grup:enSon.grup,tip:enSon.tip,ad:enSon.ad,birim:enSon.birim,deger:son?son.deger:null,gun:son?son.gun:null,
      degisim:guncel&&onc?degisim(son.deger,onc.deger):null,durum:enSon.durum,seri:iyi.slice(-30).map(x=>x.deger)};
  });
}
export function panoGorunum(satirlar,bugun){
  const k=kartlar(satirlar),gunler=k.filter(x=>x.gun).map(x=>x.gun).sort(),sonGun=gunler[gunler.length-1]||null;
  return {sonGun,bayat:!sonGun||isGunuFarki(sonGun,bugun)>=2,gruplar:GRUPLAR.map(([grup,ad])=>({grup,ad,kartlar:k.filter(x=>x.grup===grup)}))};
}
const SERIT=["USDTRY","GRAM","XU100"];
export const seritOlustur=(satirlar,bugun)=>{const k=panoGorunum(satirlar,bugun).gruplar.flatMap(g=>g.kartlar);return SERIT.map(kod=>k.find(x=>x.kod===kod)).filter(x=>x&&x.deger!=null);};

export const ayGeri=(ay,n)=>{let [y,m]=ay.split("-").map(Number);m-=n;while(m<=0){m+=12;y--;}return `${y}-${String(m).padStart(2,"0")}`;};
// Enflasyondan arındırılmış getiri: (1+nominal)/(1+TÜFE değişimi)−1. MEVDUAT: yıllık % aylığa bölünüp bileşiklenir (yaklaşık, brüt).
export function reelGetiri(aylik,kod,sonAy,n){
  const v=(k,a)=>aylik.find(x=>x.kod===k&&x.ay===a)?.deger,basAy=ayGeri(sonAy,n);
  const t1=v("TUFE",sonAy),t0=v("TUFE",basAy);if(!(t1>0&&t0>0))return null;
  let nominal;
  if(kod==="MEVDUAT"){let c=1;for(let i=0;i<n;i++){const r=v("MEVDUAT",ayGeri(sonAy,i));if(!Number.isFinite(r))return null;c*=1+r/100/12;}nominal=c-1;}
  else{const p1=v(kod,sonAy),p0=v(kod,basAy);if(!(p1>0&&p0>0))return null;nominal=p1/p0-1;}
  return (1+nominal)/(t1/t0)-1;
}
export function karne(aylik,kalemler){
  const aylar=aylik.filter(x=>x.kod==="TUFE").map(x=>x.ay).sort(),sonAy=aylar[aylar.length-1]||null;
  return {sonAy,satirlar:kalemler.map(k=>({...k,r1:sonAy?reelGetiri(aylik,k.kod,sonAy,1):null,r3:sonAy?reelGetiri(aylik,k.kod,sonAy,3):null,r12:sonAy?reelGetiri(aylik,k.kod,sonAy,12):null}))};
}

// Zarfın bu hızla biteceği gün (ay sonundan önceyse). İlk 3 günde ya da harcama yoksa tahmin yok.
export function harcamaHizi(z,bugun){
  const gun=Number(bugun.slice(8,10));
  if(gun<=3||!(z.harcanan>0))return null;
  const ort=z.harcanan/gun;
  if(z.kalan<=0)return {biter:bugun,ort};
  const bitis=gun+Math.floor(z.kalan/ort);
  return bitis<ayinSonGunu(bugun.slice(0,7))?{biter:`${bugun.slice(0,8)}${String(bitis).padStart(2,"0")}`,ort}:null;
}

const yuzde=x=>`${x>=0?"+":"−"}%${Math.abs(x*100).toLocaleString("tr-TR",{minimumFractionDigits:1,maximumFractionDigits:1})}`;
const sayi=x=>x.toLocaleString("tr-TR",x>=1000?{maximumFractionDigits:0}:{minimumFractionDigits:2,maximumFractionDigits:2});
const OZET_KODLAR=[["USDTRY","Dolar"],["GRAM","gram altın"],["XU100","BIST 100"],["SPX","S&P 500"]];
export function ozetMetni({pano,durum,bugun,not}){
  const k=new Map(pano.gruplar.flatMap(g=>g.kartlar).map(x=>[x.kod,x]));
  const parca=OZET_KODLAR.map(([kod,ad])=>{const c=k.get(kod);return c&&c.deger!=null?`${ad} ${sayi(c.deger)}${c.degisim!=null?` (${yuzde(c.degisim)})`:""}`:null;}).filter(Boolean);
  const satir1=pano.bayat&&pano.sonGun?`Piyasa verisi ${pano.sonGun} tarihinden beri güncellenmedi.`:parca.length?parca.join(" · "):"Piyasa verisi gelmedi.";
  let satir2=null;
  if(durum){
    const riskli=durum.zarflar.map(z=>({z,h:harcamaHizi(z,bugun)})).filter(x=>x.h).sort((a,b)=>a.h.biter.localeCompare(b.h.biter))[0];
    satir2=riskli?(riskli.z.kalan<=0?`${riskli.z.ad} zarfı bitti (${tl(riskli.z.kalan)}).`:`${riskli.z.ad}: ${tl(riskli.z.kalan)} kaldı, bu hızla ayın ${Number(riskli.h.biter.slice(8))}. günü biter.`):`Atanmamış ${tl(durum.atanmamis)}`;
  }
  return {metin:[satir1,satir2,not].filter(Boolean).join("\n"),bildirim:[satir1,satir2].filter(Boolean).join(" · ").slice(0,180)};
}

// POST /api/piyasa gövdesi. Şüphe sunucuda da (her kod kendi içinde tarih sırasıyla) yeniden kontrol edilir.
export function piyasaGovdeDogrula(b){
  if(!b||!gecerliGun(b.gun))throw new Hata("Gün geçersiz.");
  if(!Array.isArray(b.satirlar)||b.satirlar.length>2000)throw new Hata("Satırlar geçersiz.");
  const satirlar=b.satirlar.map(r=>{
    const kod=String(r?.kod??"");
    if(!gecerliGun(r?.gun)||!KOD.test(kod)||!GRUP_SET.has(r.grup)||!TIP_SET.has(r.tip))throw new Hata(`Satır geçersiz: ${kod.slice(0,24)}`);
    const deger=r.deger==null?null:Number(r.deger);
    if(deger!==null&&!Number.isFinite(deger))throw new Hata(`Satır geçersiz: ${kod}`);
    return {gun:r.gun,kod,grup:r.grup,tip:r.tip,ad:String(r.ad||kod).slice(0,40),deger,birim:String(r.birim??"").slice(0,8),kaynak:String(r.kaynak??"").slice(0,20),durum:deger===null?"yok":r.durum==="supheli"?"supheli":"ok"};
  });
  const onceki=new Map();
  for(const r of [...satirlar].sort((a,b)=>a.gun.localeCompare(b.gun))){
    if(r.durum==="ok"&&supheliMi(r.tip,r.deger,onceki.get(r.kod)))r.durum="supheli";
    if(r.durum==="ok")onceki.set(r.kod,r.deger);
  }
  const aylik=(Array.isArray(b.aylik)?b.aylik:[]).slice(0,1000).map(a=>{
    const kod=String(a?.kod??""),deger=Number(a?.deger);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(a?.ay))||!KOD.test(kod)||!Number.isFinite(deger))throw new Hata(`Aylık satır geçersiz: ${kod.slice(0,24)}`);
    return {ay:a.ay,kod,deger};
  });
  const not=typeof b.not==="string"&&b.not.trim()?b.not.trim().slice(0,600):null;
  return {gun:b.gun,satirlar,aylik,not};
}
```

`src/core.js`:
- `LISTE_SUTUNLARI` içindeki `merdiven:[...]` satırının altına `izleme:["tur","kod","sira"],` ekle.
- `listeDogrula` içinde `case "merdiven":{…}` bloğunun kapanışından sonra şunu ekle:
```js
      case "izleme":{
        if(!["bist","abd","fon"].includes(r.tur))throw new Hata("İzleme türü BIST, ABD ya da fon olmalı.");
        const kod=String(r.kod??"").trim().toUpperCase();
        if(!/^[A-Z0-9.]{1,12}$/.test(kod))throw new Hata(`Kod geçersiz: ${kod.slice(0,12)}`);
        return {id,tur:r.tur,kod,sira:i+1};
      }
```
- Aynı fonksiyonda `return satirlar.map(...)` ifadesini, sonucu önce bir değişkende tutacak şekilde değiştir: `const out=satirlar.map(...);`. Ardından `return out;` satırından önce limit kontrolünü ekle:
```js
  if(tablo==="izleme")for(const [tur,ad,max] of [["bist","BIST hissesi",10],["abd","ABD hissesi",10],["fon","fon",5]])
    if(out.filter(r=>r.tur===tur).length>max)throw new Hata(`En çok ${max} ${ad} eklenebilir.`);
  return out;
```

- [ ] **Adım 5: Testi çalıştır ve geçtiğini gör**

Çalıştır: `npm test`
Beklenen: 30 + 8 = 38 test GEÇER.

- [ ] **Adım 6: Yerel şemayı uygula**

Çalıştır: `node node_modules/wrangler/bin/wrangler.js d1 migrations apply diogenes --local`
Beklenen: `0003_piyasa.sql` ✅

- [ ] **Adım 7: Commit**

```bash
git add diogenes/app/migrations/0003_piyasa.sql diogenes/app/src/piyasa.js diogenes/app/src/core.js diogenes/app/tests/piyasa.test.js diogenes/app/package.json
git commit -m "Diogenes: piyasa hesaplari (pano, karne, harcama hizi, ozet) ve izleme listesi"
```

---

### Görev 2: Diogenes piyasa uç noktaları, bildirim vekâleti ve duman testi

**Dosyalar:**
- Değiştir: `diogenes/app/src/worker.js`, `diogenes/app/wrangler.json`, `diogenes/app/scripts/dev-vars.mjs`, `diogenes/app/scripts/duman.mjs`

**Arayüzler:**
- Tüketir: Görev 1'deki fonksiyonlar.
- Üretir (HTTP):
  - `POST /api/piyasa` (`x-piyasa-key`) şunu döner: `{ok,yazilan,supheli,ozet:{metin,bildirim}}`.
  - `GET /api/izleme-listesi` (`x-piyasa-key`) şunu döner: `{izleme:[{tur,kod}]}`.
  - `GET /api/piyasa` (oturum) şunu döner: `{bugun,pano,karne,ozet:{gun,metin}|null}`.
  - `GET /api/bildirim/vapid` (oturum) şunu döner: `{anahtar}`.
  - `POST /api/bildirim/abone` (oturum).
  - `GET /api/bildirim/son` (oturum).
  - `/api/durum` cevabına `serit` ve `izleme` alanları eklenir.
  - `PUT /api/liste {tablo:"izleme"}` desteklenir.

- [ ] **Adım 1: Duman testine piyasa bölümünü ekle (bu testin başarısız olması bekleniyor)**

`scripts/dev-vars.mjs` dosyasının tamamını şununla değiştir. Artık eksik anahtarları var olan dosyaya ekliyor:
```js
// Yerel geliştirme için .dev.vars: eksik test anahtarlarını rastgele değerle ekler (gerçek şifre değildir).
import fs from "node:fs";
import crypto from "node:crypto";
const yol=new URL("../.dev.vars",import.meta.url);
const var_=fs.existsSync(yol)?fs.readFileSync(yol,"utf8"):"";
const eksik=["AUTH_PASSWORD","SESSION_SECRET","DAZAI_KEY","PIYASA_KEY"].filter(k=>!new RegExp(`^${k}=`,"m").test(var_));
if(eksik.length){
  fs.writeFileSync(yol,var_+(var_&&!var_.endsWith("\n")?"\n":"")+eksik.map(k=>`${k}=${crypto.randomBytes(24).toString("hex")}`).join("\n")+"\n");
  console.log(".dev.vars güncellendi:",eksik.join(", "));
}
```

`scripts/duman.mjs`: Son satırı (`console.log("Duman testi GEÇTİ");`) şu blokla değiştir:
```js
// Piyasa panosu: anahtarlı veri gönderimi, pano, karne, özet, şerit, izleme listesi.
const pz=async(yol,govde)=>{const r=await fetch(TABAN+yol,{method:govde?"POST":"GET",headers:{"Content-Type":"application/json","x-piyasa-key":vars.PIYASA_KEY},body:govde?JSON.stringify(govde):undefined});return {status:r.status,j:await r.json().catch(()=>({}))};};
assert.equal((await fetch(TABAN+"/api/piyasa",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).status,401,"anahtarsız piyasa 401");
assert.equal((await fetch(TABAN+"/api/izleme-listesi",{headers:{"x-piyasa-key":"yanlis"}})).status,401);
await tamam("/api/liste",{method:"PUT",govde:{tablo:"izleme",satirlar:[{tur:"bist",kod:"thyao"},{tur:"fon",kod:"TTE"}]}});
assert.deepEqual((await pz("/api/izleme-listesi")).j.izleme,[{tur:"bist",kod:"THYAO"},{tur:"fon",kod:"TTE"}]);
assert.equal((await istek("/api/liste",{method:"PUT",govde:{tablo:"izleme",satirlar:[{tur:"bist",kod:"THY AO"}]}})).status,400,"geçersiz kod");
const bug=d.bugun,dun=new Date(Date.parse(bug+"T00:00:00Z")-86400000).toISOString().slice(0,10);
const ag=(a,n)=>{let [y,m]=a.split("-").map(Number);m-=n;while(m<=0){m+=12;y--;}return `${y}-${String(m).padStart(2,"0")}`;};
const sonAy=ag(bug.slice(0,7),1),aylik=[];
for(let i=0;i<=12;i++)aylik.push({ay:ag(sonAy,i),kod:"TUFE",deger:100*1.02**(12-i)});
aylik.push({ay:sonAy,kod:"GRAM",deger:200},{ay:ag(sonAy,12),kod:"GRAM",deger:100});
const sat=(gun,kod,grup,tip,deger)=>({gun,kod,grup,tip,ad:kod,deger,birim:"",kaynak:"duman"});
const pGovde={gun:bug,not:"Bugün TÜFE açıklanıyor.",aylik,satirlar:[
  sat(dun,"USDTRY","altin_doviz","doviz",41.9),sat(bug,"USDTRY","altin_doviz","doviz",42.1),
  sat(dun,"GRAM","altin_doviz","altin",4000),sat(bug,"GRAM","altin_doviz","altin",4220),
  sat(dun,"EURTRY","altin_doviz","doviz",48),sat(bug,"EURTRY","altin_doviz","doviz",70),
  sat(dun,"XU100","tr","endeks",10000),sat(bug,"XU100","tr","endeks",10080),sat(bug,"POLITIKA","faiz","faiz",null)]};
const pr=await pz("/api/piyasa",pGovde);
assert.equal(pr.status,200,JSON.stringify(pr.j));assert.equal(pr.j.supheli,1,"EURTRY +%46 şüpheli");
assert.match(pr.j.ozet.bildirim,/^Dolar 42,10 \(\+%0,5\) · gram altın 4\.220 \(\+%5,5\) · BIST 100 10\.080 \(\+%0,8\)/);
assert.match(pr.j.ozet.metin,/Bugün TÜFE açıklanıyor\.$/);
assert.equal((await pz("/api/piyasa",pGovde)).status,200,"aynı gün yeniden");
const pv=await tamam("/api/piyasa");
const kk=Object.fromEntries(pv.pano.gruplar.flatMap(g=>g.kartlar).map(x=>[x.kod,x]));
assert.deepEqual(kk.USDTRY.seri,[41.9,42.1],"yeniden gönderim çoğaltmaz");
assert.equal(kk.EURTRY.durum,"supheli");assert.equal(kk.POLITIKA.durum,"yok");assert.equal(pv.pano.bayat,false);
const gram=pv.karne.satirlar.find(x=>x.kod==="GRAM");assert.ok(Math.abs(gram.r12-(2/1.02**12-1))<1e-6,"karne 12 ay");
assert.ok(pv.karne.satirlar.some(x=>x.kod==="FON:TTE"),"izleme fonu karnede");
assert.match(pv.ozet.metin,/^Dolar 42,10/);
assert.deepEqual((await tamam("/api/durum")).serit.map(x=>x.kod),["USDTRY","GRAM","XU100"]);
assert.equal((await pz("/api/piyasa",{gun:bug,satirlar:Array.from({length:900},()=>sat(bug,"USDTRY","altin_doviz","doviz",42.123456789))})).status,400,"64 KB sınırı");
console.log("Duman testi GEÇTİ");
```

- [ ] **Adım 2: Duman testini çalıştır ve başarısız olduğunu gör**

Çalıştır: önce durumu temizle, şemaları uygula, `npm run dev` ile başlat. Ardından `npm run duman`.
Beklenen: `anahtarsız piyasa 401` geçebilir; oturumsuz istek genel 401'e düştüğü için bu normaldir. Başarısızlık `/api/liste` izleme adımında görülür (`Bilinmeyen liste` → 400).

- [ ] **Adım 3: Kodu yaz**

`wrangler.json` dosyasında `"observability"` satırından önce şu iki satırı ekle (VAPID açık anahtarı, `diogenes/bildirim/wrangler.toml` içindeki `VAPID_PUBLIC` değeriyle aynıdır):
```json
  "services": [{"binding": "BILDIRIM","service": "diogenes-bildirim"}],
  "vars": {"VAPID_PUBLIC": "BKW2sc5f0wWmdPe7vWKD0LFa_wYLLlNu_XUuCkx3ONv8YlHHs7ImfoQ7gxDK0WZiItcgheryObDM41_A89gcwMA"},
```

`src/worker.js`:

(a) `import` satırlarının altına şunu ekle:
```js
import {panoGorunum,seritOlustur,karne,ozetMetni,piyasaGovdeDogrula} from "./piyasa.js";
```
Ayrıca `core.js` içe aktarmasına `gunEkle` ekle.

(b) `veriYukle` içinde:
- Sorgu listesinin sonuna `,q("SELECT * FROM izleme ORDER BY sira,id")` ekle. Destructuring listesinin sonuna `,izleme` ekle.
- `v` nesnesine `izleme` alanını ekle: `…merdiven,izleme,ayarlar:…`.

(c) `LISTE_VERI` nesnesine `izleme:"izleme"` ekle.

(d) `durumYaniti` dönüşüne iki alan ekle. `aylikToplam:v.mctx.aylikToplam};` ifadesini şununla değiştir:
```js
aylikToplam:v.mctx.aylikToplam,izleme:v.izleme,serit:seritOlustur(await hepsi(env,"SELECT * FROM piyasa WHERE kod IN ('USDTRY','GRAM','XU100') AND gun>=?",gunEkle(bugun,-10)),bugun)};
```

(e) `dazaiApi` fonksiyonundan sonra şu bölümü ekle:
```js
// ---- Piyasa panosu: GitHub Actions veriyi x-piyasa-key ile yollar; özet bu sırada kurulur ve cevapta döner.
const PIYASA_GOVDE=64*1024;
const piyasaYetkili=async(req,env)=>{const k=req.headers.get("x-piyasa-key")||"";return !!env.PIYASA_KEY&&!!k&&await safeEqual(k,env.PIYASA_KEY);};
async function piyasaGorunumu(env,bugun){
  const [satirlar,aylik,iz]=await Promise.all([hepsi(env,"SELECT * FROM piyasa WHERE gun>=?",gunEkle(bugun,-50)),hepsi(env,"SELECT * FROM piyasa_aylik"),hepsi(env,"SELECT tur,kod FROM izleme ORDER BY sira,id")]);
  const kalemler=[{kod:"MEVDUAT",ad:"Mevduat (yaklaşık, brüt)"},{kod:"GRAM",ad:"Gram altın"},{kod:"USDTRY",ad:"Dolar"},{kod:"XU100",ad:"BIST 100"},...iz.filter(i=>i.tur==="fon").map(i=>({kod:`FON:${i.kod}`,ad:i.kod}))];
  return {pano:panoGorunum(satirlar,bugun),karne:karne(aylik,kalemler)};
}
async function piyasaYaz(env,b,bugun){
  const g=piyasaGovdeDogrula(b),st=[];
  for(const r of g.satirlar)st.push(env.DB.prepare("INSERT INTO piyasa(gun,kod,grup,tip,ad,deger,birim,kaynak,durum) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(gun,kod) DO UPDATE SET grup=excluded.grup,tip=excluded.tip,ad=excluded.ad,deger=excluded.deger,birim=excluded.birim,kaynak=excluded.kaynak,durum=excluded.durum").bind(r.gun,r.kod,r.grup,r.tip,r.ad,r.deger,r.birim,r.kaynak,r.durum));
  for(const a of g.aylik)st.push(env.DB.prepare("INSERT INTO piyasa_aylik(ay,kod,deger) VALUES(?,?,?) ON CONFLICT(ay,kod) DO UPDATE SET deger=excluded.deger").bind(a.ay,a.kod,a.deger));
  if(g.not)st.push(env.DB.prepare("INSERT INTO piyasa_not(gun,metin) VALUES(?,?) ON CONFLICT(gun) DO UPDATE SET metin=excluded.metin").bind(g.gun,g.not));
  st.push(env.DB.prepare("DELETE FROM piyasa WHERE gun<?").bind(gunEkle(bugun,-400)));
  for(let i=0;i<st.length;i+=100)await env.DB.batch(st.slice(i,i+100));
  const v=await veriYukle(env),{pano}=await piyasaGorunumu(env,bugun);
  const ozet=ozetMetni({pano,durum:v.ayarlar.kurulum==="1"?v.durum(bugun.slice(0,7)):null,bugun,not:g.not});
  await env.DB.prepare("INSERT INTO ozetler(gun,metin,bildirim,olusturma) VALUES(?,?,?,?) ON CONFLICT(gun) DO UPDATE SET metin=excluded.metin,bildirim=excluded.bildirim,olusturma=excluded.olusturma").bind(g.gun,ozet.metin,ozet.bildirim,nowIso()).run();
  return {ok:true,yazilan:g.satirlar.length,supheli:g.satirlar.filter(r=>r.durum==="supheli").length,ozet};
}
async function piyasaApi(req,env,url,bugun){
  if(!(await piyasaYetkili(req,env)))return json({error:"Yetkisiz."},401);
  try{
    if(url.pathname==="/api/izleme-listesi"&&req.method==="GET")return json({izleme:await hepsi(env,"SELECT tur,kod FROM izleme ORDER BY sira,id")});
    if(url.pathname==="/api/piyasa"&&req.method==="POST"){
      const t=await req.text();if(t.length>PIYASA_GOVDE)throw new Hata("İstek çok büyük (en çok 64 KB).");
      let b;try{b=JSON.parse(t)}catch{throw new Hata("Geçersiz istek.")}
      return json(await piyasaYaz(env,b,bugun));
    }
  }catch(e){if(e instanceof Hata)return json({error:e.message},400);throw e;}
  return json({error:"Bulunamadı."},404);
}
// Bildirim servisine vekâlet (yayında BILDIRIM service binding; yerelde normal adres).
const bildirimFetch=(env,yol,init={})=>{const u=`https://diogenes-bildirim.diyarross.com${yol}`;return env.BILDIRIM?env.BILDIRIM.fetch(new Request(u,init)):fetch(u,init);};
```

(f) `api` fonksiyonunda `if(p.startsWith("/api/dazai/"))…` satırının altına şunu ekle:
```js
  if((p==="/api/piyasa"&&m==="POST")||p==="/api/izleme-listesi")return piyasaApi(req,env,url,bugun);
```
Aynı fonksiyonda `/api/gecmis` bloğundan önce şunu ekle:
```js
    if(p==="/api/piyasa"&&m==="GET"){
      const [g,oz]=await Promise.all([piyasaGorunumu(env,bugun),env.DB.prepare("SELECT gun,metin FROM ozetler ORDER BY gun DESC LIMIT 1").first()]);
      return json({bugun,...g,ozet:oz||null});
    }
    if(p==="/api/bildirim/vapid"&&m==="GET")return json({anahtar:env.VAPID_PUBLIC||""});
    if(p==="/api/bildirim/son"&&m==="GET"){const r=await bildirimFetch(env,"/son?n=1");return json(await r.json().catch(()=>({bildirimler:[]})));}
```
`const b=await govde(req);` satırının altına şunu ekle:
```js
    if(p==="/api/bildirim/abone"&&m==="POST"){
      if(!b||typeof b.endpoint!=="string"||!b.endpoint.startsWith("https://"))throw new Hata("Geçersiz abonelik.");
      const r=await bildirimFetch(env,"/abone",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:b.endpoint,keys:b.keys||null})});
      if(!r.ok)throw new Hata("Bildirim servisi aboneliği kabul etmedi.");
      return json({ok:true});
    }
```

- [ ] **Adım 4: Duman testini çalıştır ve geçtiğini gör**

Çalıştır: `node scripts/dev-vars.mjs` (ekrana anahtar değil, yalnızca anahtar adları yazar). Durumu temizle, şemaları uygula, `npm run dev`, ardından `npm run duman; npm test`.
Beklenen: `Duman testi GEÇTİ` görülür ve 38 test GEÇER.

- [ ] **Adım 5: Commit**

```bash
git add diogenes/app/src/worker.js diogenes/app/wrangler.json diogenes/app/scripts/dev-vars.mjs diogenes/app/scripts/duman.mjs
git commit -m "Diogenes: piyasa uclari, ozet, izleme listesi, bildirim vekaleti"
```

---

### Görev 3: Arayüz (Piyasa ekranı, şerit, izleme listesi, bildirim)

**Dosyalar:**
- Değiştir: `diogenes/app/public/app.js`, `diogenes/app/public/index.html` (stil), `diogenes/app/public/sw.js`

**Arayüzler:**
- Tüketir: Görev 2'deki `GET /api/piyasa`, `D.serit`, `D.izleme`, `/api/bildirim/vapid`, `/api/bildirim/abone` ve `/api/bildirim/son`.

- [ ] **Adım 1: `app.js`'e ekle ve değiştir**

(a) `const piyasaEkrani=()=>…` ifadesinin tamamını (4 satır, `…tavsiyesi değildir.")));` ile biter) şununla değiştir:
```js
const yuzdeYaz=x=>x==null?"—":`${x>=0?"+":"−"}%${Math.abs(x*100).toLocaleString("tr-TR",{minimumFractionDigits:1,maximumFractionDigits:1})}`;
const degerYaz=(x,b)=>x==null?"—":x.toLocaleString("tr-TR",x>=1000?{maximumFractionDigits:0}:{minimumFractionDigits:2,maximumFractionDigits:2})+(b?` ${b}`:"");
const yonSinifi=x=>x==null?"":x>=0?"artis":"azalis";
function cizgi(seri){
  const NS="http://www.w3.org/2000/svg",s=document.createElementNS(NS,"svg");
  s.setAttribute("viewBox","0 0 100 24");s.setAttribute("class","cizgi");s.setAttribute("aria-hidden","true");s.setAttribute("preserveAspectRatio","none");
  if(seri.length>1){
    const mn=Math.min(...seri),mx=Math.max(...seri),r=mx-mn||1,pl=document.createElementNS(NS,"polyline");
    pl.setAttribute("points",seri.map((v,i)=>`${(i/(seri.length-1)*100).toFixed(1)},${(22-(v-mn)/r*20).toFixed(1)}`).join(" "));
    pl.setAttribute("fill","none");pl.setAttribute("stroke","currentColor");pl.setAttribute("stroke-width","1.5");s.append(pl);
  }
  return s;
}
function piyasaKarti(k){
  const etiket=k.durum==="yok"?"veri yok":k.durum==="supheli"?"doğrulanamadı":null;
  return h("div",{class:`pkart ${yonSinifi(k.degisim)}`},
    h("div",{class:"pust"},h("span",{},k.ad),h("b",{},degerYaz(k.deger,k.birim))),
    h("div",{class:"palt"},h("small",{},etiket?`${etiket}${k.gun?` · son: ${k.gun.slice(8)}.${k.gun.slice(5,7)}`:""}`:yuzdeYaz(k.degisim)),cizgi(k.seri)));
}
function piyasaEkrani(){
  const yer=h("p",{},"Yükleniyor…"),ana=h("main",{},yer);
  api("/api/piyasa").then(p=>{
    const parca=[];
    if(p.pano.bayat)parca.push(h("p",{class:"uyari"},p.pano.sonGun?`Veri ${p.pano.sonGun} tarihinden beri güncellenmedi.`:"Henüz piyasa verisi gelmedi. İlk veri hafta içi sabah 08:00'de gelir."));
    if(p.ozet)parca.push(h("section",{class:"kart"},h("h2",{},"Bugünün özeti"),p.ozet.metin.split("\n").map(x=>h("p",{},x)),h("small",{},`${p.ozet.gun} · 08:00 itibarıyla, gecikmeli`)));
    for(const g of p.pano.gruplar)if(g.kartlar.length)parca.push(h("section",{class:"kart"},h("h2",{},g.ad),h("div",{class:"pizgara"},g.kartlar.map(piyasaKarti)),
      g.grup==="altin_doviz"&&h("small",{},"Gram ve çeyrek altın, ons fiyatı ve kurdan hesaplanır; kuyumcu fiyatı değildir.")));
    parca.push(h("section",{class:"kart"},h("h2",{},"Reel getiri"),
      p.karne.sonAy?h("table",{class:"karne"},h("tr",{},h("th",{},""),h("th",{},"1 ay"),h("th",{},"3 ay"),h("th",{},"12 ay")),
        p.karne.satirlar.map(r=>h("tr",{},h("td",{},r.ad),[r.r1,r.r3,r.r12].map(x=>h("td",{class:yonSinifi(x)},yuzdeYaz(x)))))):h("p",{},"Enflasyon verisi henüz yok (TCMB anahtarı gerekli)."),
      h("small",{},`Enflasyondan arındırılmış getiri${p.karne.sonAy?`, ${ayAdi(p.karne.sonAy)} sonuna kadar`:""}. Geçmiş getiri geleceği göstermez; sıralama aydan aya değişiyor. Tavsiye değil, hesap.`)));
    parca.push(h("section",{class:"kart"},h("h2",{},"Hisse taraması"),h("p",{},h("a",{href:"https://ross002200.github.io/Ross/diogenes/",target:"_blank",rel:"noopener"},"Tarama ekranlarını aç ↗"))));
    yer.replaceWith(...parca);
  }).catch(e=>{yer.textContent=e.message;});
  return ana;
}
const piyasaSeridi=()=>D.serit&&D.serit.length?h("button",{type:"button",class:"serit","aria-label":"Piyasa",onclick:()=>{sekme="piyasa";ciz();}},
  D.serit.map(k=>h("span",{},`${k.ad} ${degerYaz(k.deger)} `,h("small",{class:yonSinifi(k.degisim)},yuzdeYaz(k.degisim))))):null;
const b64uBayt=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4)),c=>c.charCodeAt(0));
async function bildirimAc(){
  if(!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error("Bu tarayıcı bildirim desteklemiyor. iPhone'da uygulamayı ana ekrana ekleyip oradan aç.");
  if(await Notification.requestPermission()!=="granted")throw new Error("Bildirim izni verilmedi.");
  const reg=await navigator.serviceWorker.ready,{anahtar}=await api("/api/bildirim/vapid");
  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBayt(anahtar)});
  await api("/api/bildirim/abone",{method:"POST",govde:sub.toJSON()});
}
```

(b) `zarflarEkrani` içindeki `return h("main",{},aySecici(),` ifadesini `return h("main",{},piyasaSeridi(),aySecici(),` yap.

(c) `LISTELER` nesnesinde `merdiven:{…},` girdisinin sonundaki `ilk:()=>VARSAYILAN_MERDIVEN.map(…)},` satırının altına şunu ekle:
```js
  izleme:{baslik:"İzleme listesi (piyasa)",yeni:{tur:"bist",kod:""},alanlar:[["tur","Tür","izleme"],["kod","Kod (ör. THYAO, AAPL, TTE)"]],
    kaynak:()=>D.izleme||[],donustur:r=>({id:r.id,tur:r.tur,kod:r.kod})},
```
`listeEditoru` içindeki `if(tur==="tur")…` satırının altına şunu ekle:
```js
    if(tur==="izleme")return h("select",{"aria-label":etiket,onchange:degis},[["bist","BIST"],["abd","ABD"],["fon","Fon"]].map(([v,a])=>h("option",{value:v,selected:v===r[k]},a)));
```
Not: İzleme listesi boşsa `listeEditoru` `L.yeni` ile tek bir boş satır açar. Kod boş kalırsa kaydetmek "Kod geçersiz" hatası verir; bunu önlemek için listeyi kaydetmeden önce satırı silmek yeterli. Bu davranış diğer listelerle aynıdır.

(d) `ayarlarEkrani` içindeki `["zarflar","gelir_plani","abonelikler","borclar","birikimler","merdiven"].map(bolum),` ifadesini şununla değiştir:
```js
["zarflar","gelir_plani","abonelikler","borclar","birikimler","merdiven","izleme"].map(bolum),
    h("section",{class:"kart"},h("h2",{},"Bildirimler"),h("p",{},"Hafta içi sabah piyasa ve bütçe özeti telefona gelir. iPhone'da önce uygulamayı ana ekrana ekle, oradan aç."),
      h("button",{onclick:()=>is(bildirimAc,"Bildirimler açıldı.")},"Bildirimleri aç")),
```

(e) Dosyanın sonundaki `yukle();` satırının hemen üstüne şunu ekle:
```js
{const q=new URLSearchParams(location.search).get("sekme");if(q&&SEKMELER.some(([k])=>k===q))sekme=q;}
```

`public/index.html` içinde `</style>` satırının hemen üstüne şunu ekle:
```css
.artis{color:#4ade80}.azalis{color:var(--eksi)}
.pizgara{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.pkart{background:var(--kart2);border:1px solid var(--cizgi);border-radius:10px;padding:8px;min-width:0}
.pust{display:flex;justify-content:space-between;gap:6px;font-size:14px}.pust span{color:var(--soluk);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.palt{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px}.palt small{min-width:0;overflow-wrap:anywhere}
.cizgi{flex:1 1 48px;height:24px;min-width:48px}.pkart .cizgi{color:var(--soluk)}.pkart.artis .cizgi{color:#4ade80}.pkart.azalis .cizgi{color:var(--eksi)}
.pkart.artis,.pkart.azalis{color:var(--yazi)}
table.karne{width:100%;border-collapse:collapse;font-size:14px}table.karne th,table.karne td{padding:4px 2px;text-align:right}table.karne td:first-child,table.karne th:first-child{text-align:left}
.uyari{color:var(--uyari)}
.serit{display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;width:100%;background:none;border:0;padding:4px 0;color:var(--yazi);font-size:13px;white-space:nowrap}
```

`public/sw.js` dosyasının tamamını şununla değiştir:
```js
// Ağ önce; ağ yoksa son kopya. API hiç önbelleğe alınmaz. Push: içeriksiz gelir, son bildirim kendi sunucumuzdan okunur.
const C="diogenes-v2";
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.startsWith("/api/"))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));}return r;}).catch(()=>caches.match(e.request)));
});
const goster=x=>self.registration.showNotification(x.title||"Diogenes",{body:x.message||"Yeni bildirim var",tag:x.id||"diogenes",icon:"/icon-192.png",badge:"/icon-192.png",data:{url:"/?sekme=piyasa"}});
self.addEventListener("push",e=>{
  e.waitUntil(fetch("/api/bildirim/son",{cache:"no-store"}).then(r=>r.json()).then(d=>goster((d.bildirimler||[])[0]||{})).catch(()=>goster({})));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();const u=e.notification.data?.url||"/";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(ws=>{for(const w of ws)if("focus" in w){w.navigate(u);return w.focus();}return clients.openWindow(u);}));
});
```

- [ ] **Adım 2: Tarayıcıda kontrol et**

Çalıştır: Durumu temizle, şemaları uygula, `npm run dev` ve `npm run duman`. Ardından yerleşik tarayıcıda `http://127.0.0.1:8787` adresini mobil boyutta (375×812) aç ve `.dev.vars` içindeki test şifresiyle giriş yap.

Beklenen:
- Zarflar ekranının üstünde Dolar · Gram · BIST şeridi görünür. Şeride dokununca Piyasa sekmesi açılır.
- Piyasa sekmesinde şunlar görünür:
  - "Bugünün özeti" ve not satırı.
  - Dört grup kart. EURTRY kartında "doğrulanamadı", Politika faizi kartında "veri yok" yazar.
  - Reel getiri tablosunda Gram altın 12 ay "+%57,7" gösterir, diğer hücrelerde "—" görünür. Altında "Tavsiye değil, hesap." notu durur.
- Ayarlar'da "İzleme listesi" açılır: THYAO ve TTE görünür. "Bildirimler" bölümü görünür. Yerelde "Bildirimleri aç" düğmesi tarayıcı izni ister; push servisi yerelde yoksa Türkçe bir hata göstermesi yeterlidir.
- 320 px genişlikte yatay kaydırma olmaz (şerit kendi içinde kayar).
- Konsolda yeni hata yoktur. Service worker hatası daha önce bilinen bir ortam sorunudur.

- [ ] **Adım 3: Testleri çalıştır ve commit et**

Çalıştır: `npm test`
Beklenen: 38 test GEÇER.
```bash
git add diogenes/app/public/app.js diogenes/app/public/index.html diogenes/app/public/sw.js
git commit -m "Diogenes: Piyasa ekrani, serit, izleme listesi, bildirim aboneligi"
```

---

### Görev 4: Python veri toplayıcı, ntfy notu ve iş akışı

**Dosyalar:**
- Oluştur: `diogenes/scan/piyasa.py`, `diogenes/scan/piyasa_kaynak.json`, `diogenes/scan/tests/test_piyasa.py`, `.github/workflows/diogenes-piyasa.yml`
- Değiştir: `diogenes/scan/relay.py` (`TARGETS`, `REQUIRED`), `diogenes/scan/requirements.txt`

**Arayüzler:**
- Tüketir: Görev 2'deki `GET /api/izleme-listesi` ve `POST /api/piyasa`; ayrıca `scan.notify(title, message, tags, priority)`.
- Üretir: `piyasa.topla(izleme, evds_key, bugun, yahoo_fn, evds_fn, tefas_fn) → {gun, satirlar, aylik}` ve `piyasa.gunluk_not(bugun) → str|None`.

- [ ] **Adım 1: Başarısız testi yaz**

`diogenes/scan/tests/test_piyasa.py`:
```python
import json

import piyasa as P


def test_gram_ve_supheli():
    assert round(P.gram(2000, 31.1034768), 6) == 2000.0
    assert P.supheli("doviz", 50, 41) is True
    assert P.supheli("hisse", 50, 41) is False
    assert P.supheli("endeks", 0, 100) is True
    assert P.supheli("faiz", 0, 40) is False
    assert P.supheli("doviz", 42, None) is False


def test_seri_satirlari_son_30_ve_supheli():
    seri = [(f"2026-10-{d:02d}", 40.0) for d in range(1, 32)] + [("2026-11-02", 60.0), ("2026-11-03", 40.2)]
    out = P.seri_satirlari("USDTRY", "altin_doviz", "doviz", "Dolar/TL", "₺", "yahoo", seri)
    assert len(out) == 30
    assert [r["durum"] for r in out[-2:]] == ["supheli", "ok"]
    assert out[-1] == dict(gun="2026-11-03", kod="USDTRY", grup="altin_doviz", tip="doviz", ad="Dolar/TL", deger=40.2, birim="₺", kaynak="yahoo", durum="ok")


def test_ay_sonlari():
    seri = [("2026-09-29", 1.0), ("2026-09-30", 2.0), ("2026-10-31", 3.0), ("2026-11-03", 4.0)]
    assert P.ay_sonlari(seri, 2) == [dict(ay="2026-10", deger=3.0), dict(ay="2026-11", deger=4.0)]


def _yahoo(semboller):
    gun = [("2026-11-27", 1.0), ("2026-11-30", 1.0)]
    veri = {"USDTRY=X": [("2026-11-27", 41.9), ("2026-11-30", 42.1)], "GC=F": [("2026-11-27", 2000.0), ("2026-11-30", 2010.0)],
            "XU100.IS": [("2026-11-27", 10000.0), ("2026-11-30", 10080.0)], "THYAO.IS": gun}
    return {s: veri.get(s, []) for s in semboller}


def test_topla_kaynak_dusunce_yok_satiri_ve_izleme():
    iz = [{"tur": "bist", "kod": "THYAO"}, {"tur": "abd", "kod": "AAPL"}, {"tur": "fon", "kod": "TTE"}]
    def tefas_bozuk(kod, bas, son):
        raise RuntimeError("tefas kapalı")
    g = P.topla(iz, None, "2026-11-30", yahoo_fn=_yahoo, evds_fn=None, tefas_fn=tefas_bozuk)
    k = {}
    for r in g["satirlar"]:
        k.setdefault(r["kod"], []).append(r)
    assert k["USDTRY"][-1]["deger"] == 42.1
    assert round(k["GRAM"][-1]["deger"], 2) == round(2010 * 42.1 / 31.1034768, 2)
    assert round(k["CEYREK"][-1]["deger"], 2) == round(k["GRAM"][-1]["deger"] * 1.6038, 2)
    assert k["EURTRY"] == [dict(gun="2026-11-30", kod="EURTRY", grup="altin_doviz", tip="doviz", ad="Euro/TL", deger=None, birim="₺", kaynak="yahoo", durum="yok")]
    assert k["BIST:THYAO"][-1]["grup"] == "tr" and k["BIST:THYAO"][-1]["tip"] == "hisse"
    assert k["ABD:AAPL"][-1]["durum"] == "yok"
    assert k["FON:TTE"][-1]["durum"] == "yok" and k["FON:TTE"][-1]["grup"] == "faiz"
    for kod in ("POLITIKA", "TUFE_Y", "MEVDUAT"):
        assert k[kod][-1]["durum"] == "yok", "EVDS anahtarı yok"
    aylik = {(a["kod"], a["ay"]) for a in g["aylik"]}
    assert ("USDTRY", "2026-11") in aylik and ("GRAM", "2026-11") in aylik
    json.dumps(g)  # gövde JSON'a çevrilebilir


def test_topla_yahoo_tamamen_duserse():
    def kapali(semboller):
        raise RuntimeError("yahoo kapalı")
    g = P.topla([], None, "2026-11-30", yahoo_fn=kapali, evds_fn=None, tefas_fn=None)
    assert all(r["durum"] == "yok" for r in g["satirlar"])
    assert {r["kod"] for r in g["satirlar"]} >= {"USDTRY", "GRAM", "XU100", "SPX", "NDX"}


def test_topla_evds():
    def evds(anahtar, seri, bas, son):
        if seri == P.KAYNAK["evds"]["TUFE"]:
            return [(f"{2025 + (m >= 12)}-{(m % 12) + 1:02d}", 100 * 1.02 ** i) for i, m in enumerate(range(10, 23))]
        if seri == P.KAYNAK["evds"]["POLITIKA"]:
            return [("2026-11-28", 38.0)]
        return [("2026-10", 45.0), ("2026-11", 44.0)]
    g = P.topla([], "anahtar", "2026-11-30", yahoo_fn=_yahoo, evds_fn=evds, tefas_fn=None)
    k = {r["kod"]: r for r in g["satirlar"] if r["kod"] in ("POLITIKA", "TUFE_Y", "MEVDUAT")}
    assert k["POLITIKA"]["deger"] == 38.0 and k["MEVDUAT"]["deger"] == 44.0
    assert round(k["TUFE_Y"]["deger"], 4) == round((1.02 ** 12 - 1) * 100, 4)
    assert sum(1 for a in g["aylik"] if a["kod"] == "TUFE") == 13


def test_evds_ayristir():
    items = [{"Tarih": "2025-10", "TP_FG_J0": "3100.5"}, {"Tarih": "28-11-2026", "TP_FG_J0": None}, {"Tarih": "27-11-2026", "TP_FG_J0": "3120"}]
    assert P.evds_ayristir(items, "TP.FG.J0") == [("2025-10", 3100.5), ("2026-11-27", 3120.0)]


def test_gunluk_not(tmp_path, monkeypatch):
    monkeypatch.setattr(P, "NOT", tmp_path / "gunluk_not.json")
    assert P.gunluk_not("2026-11-30") is None
    (tmp_path / "gunluk_not.json").write_text(json.dumps({"date": "2026-11-29", "text": "eski"}), encoding="utf-8")
    assert P.gunluk_not("2026-11-30") is None
    (tmp_path / "gunluk_not.json").write_text(json.dumps({"date": "2026-11-30", "text": " Bugün TÜFE açıklanıyor. "}), encoding="utf-8")
    assert P.gunluk_not("2026-11-30") == "Bugün TÜFE açıklanıyor."
```

- [ ] **Adım 2: Testi çalıştır ve başarısız olduğunu gör**

Çalıştır: `cd D:\Claude\diogenes\scan; python -m pytest tests/test_piyasa.py -q`
Beklenen: `ModuleNotFoundError: No module named 'piyasa'` hatasıyla BAŞARISIZ.

- [ ] **Adım 3: Kodu yaz**

`diogenes/scan/piyasa_kaynak.json`:
```json
{
  "not": "TCMB EVDS seri kodları. TUFE = TÜFE (2003=100) endeksi. POLITIKA ve MEVDUAT kodları Diyar'ın anahtarıyla Görev 5'te doğrulanır; yanlışsa o satır 'yok' olur.",
  "evds": {"TUFE": "TP.FG.J0", "POLITIKA": "TP.APIFON4", "MEVDUAT": "TP.TRY.MT02"}
}
```

`diogenes/scan/piyasa.py`:
```python
"""Diogenes piyasa panosu: hafta içi sabah fiyat, faiz ve enflasyonu toplar, Diogenes'e yollar, özeti bildirir.

Kaynaklar: Yahoo (yfinance), TCMB EVDS (EVDS_KEY), TEFAS (tefas-crawler). Biri düşerse yalnız onun satırları
durum='yok' olur. Claude'un günlük notu relay.py ile data/gunluk_not.json'a gelir. Tavsiye değil, veri.
"""
import datetime as dt
import json
import os
import sys
from pathlib import Path

import requests

HERE = Path(__file__).parent
NOT = HERE.parent / "data" / "gunluk_not.json"
KAYNAK = json.loads((HERE / "piyasa_kaynak.json").read_text(encoding="utf-8"))
TABAN = os.environ.get("DIOGENES_URL", "https://diogenes.diyarross.com")
ONS_GRAM = 31.1034768
CEYREK_GRAM = 1.6038
ESIK = {"doviz": .15, "altin": .15, "endeks": .20, "hisse": .35, "fon": .15}
# kod, grup, tip, ad, birim, yahoo sembolü
SABIT = [("USDTRY", "altin_doviz", "doviz", "Dolar/TL", "₺", "USDTRY=X"), ("EURTRY", "altin_doviz", "doviz", "Euro/TL", "₺", "EURTRY=X"),
         ("XU100", "tr", "endeks", "BIST 100", "", "XU100.IS"), ("SPX", "abd", "endeks", "S&P 500", "", "^GSPC"),
         ("NDX", "abd", "endeks", "Nasdaq", "", "^IXIC")]
AYLIK_KODLAR = ("USDTRY", "XU100", "SPX")


def gram(ons_usd, usdtry):
    return ons_usd * usdtry / ONS_GRAM


def supheli(tip, deger, onceki):
    if tip == "faiz":
        return deger is None
    if deger is None or deger <= 0:
        return True
    e = ESIK.get(tip)
    return bool(e and onceki and onceki > 0 and abs(deger / onceki - 1) > e)


def seri_satirlari(kod, grup, tip, ad, birim, kaynak, seri):
    """Son 30 işlem günü; şüpheli değer bir sonrakinin 'önceki'si olmaz."""
    out, onceki = [], None
    for gun, deger in seri[-31:]:
        durum = "supheli" if supheli(tip, deger, onceki) else "ok"
        out.append(dict(gun=gun, kod=kod, grup=grup, tip=tip, ad=ad, deger=round(float(deger), 4), birim=birim, kaynak=kaynak, durum=durum))
        if durum == "ok":
            onceki = deger
    return out[-30:]


def yok_satiri(kod, grup, tip, ad, birim, kaynak, gun):
    return dict(gun=gun, kod=kod, grup=grup, tip=tip, ad=ad, deger=None, birim=birim, kaynak=kaynak, durum="yok")


def ay_sonlari(seri, n=13):
    son = {}
    for gun, deger in seri:
        son[gun[:7]] = deger
    return [dict(ay=a, deger=round(float(v), 4)) for a, v in sorted(son.items())[-n:]]


def evds_ayristir(items, seri):
    alan = seri.replace(".", "_")
    out = []
    for it in items:
        v, t = it.get(alan), str(it.get("Tarih") or "")
        if v in (None, ""):
            continue
        if len(t) == 10 and t[2] == "-":
            t = f"{t[6:10]}-{t[3:5]}-{t[0:2]}"
        elif "-" in t and len(t) <= 7:
            y, m = t.split("-")
            t = f"{y}-{int(m):02d}"
        out.append((t, float(v)))
    return sorted(out)


def evds(anahtar, seri, bas, son):
    r = requests.get(f"https://evds2.tcmb.gov.tr/service/evds/series={seri}&startDate={bas:%d-%m-%Y}&endDate={son:%d-%m-%Y}&type=json",
                     headers={"key": anahtar}, timeout=30)
    r.raise_for_status()
    return evds_ayristir(r.json().get("items", []), seri)


def yahoo(semboller):
    import yfinance as yf
    df = yf.download(list(semboller), period="14mo", interval="1d", auto_adjust=False, progress=False, group_by="ticker", threads=True)
    out = {}
    for s in semboller:
        try:
            c = df[s]["Close"].dropna()
            out[s] = [(i.strftime("%Y-%m-%d"), float(v)) for i, v in c.items()]
        except Exception:
            out[s] = []
    return out


def tefas(kod, bas, son):
    from tefas import Crawler
    df = Crawler().fetch(start=bas.isoformat(), end=son.isoformat(), name=kod, columns=["date", "price"])
    return sorted((str(d)[:10], float(p)) for d, p in zip(df["date"], df["price"]))


def topla(izleme, evds_key, bugun, yahoo_fn=yahoo, evds_fn=evds, tefas_fn=tefas):
    satirlar, aylik = [], []
    meta = {k: (g, t, a, b, y) for k, g, t, a, b, y in SABIT}
    for i in izleme:
        if i["tur"] == "bist":
            meta[f"BIST:{i['kod']}"] = ("tr", "hisse", i["kod"], "₺", f"{i['kod']}.IS")
        elif i["tur"] == "abd":
            meta[f"ABD:{i['kod']}"] = ("abd", "hisse", i["kod"], "$", i["kod"])
    try:
        ham = yahoo_fn(sorted({m[4] for m in meta.values()} | {"GC=F"}))
    except Exception as e:
        print(f"yahoo: {e}", file=sys.stderr)
        ham = {}
    for kod, (g, t, a, b, y) in meta.items():
        seri = ham.get(y) or []
        satirlar += seri_satirlari(kod, g, t, a, b, "yahoo", seri) if seri else [yok_satiri(kod, g, t, a, b, "yahoo", bugun)]
        if seri and kod in AYLIK_KODLAR:
            aylik += [dict(ay=x["ay"], kod=kod, deger=x["deger"]) for x in ay_sonlari(seri)]
    ons, kur = dict(ham.get("GC=F") or []), dict(ham.get("USDTRY=X") or [])
    gs = [(g, gram(ons[g], kur[g])) for g in sorted(set(ons) & set(kur))]
    for kod, ad, carpan in (("GRAM", "Gram altın", 1.0), ("CEYREK", "Çeyrek altın", CEYREK_GRAM)):
        satirlar += seri_satirlari(kod, "altin_doviz", "altin", ad, "₺", "hesap", [(g, v * carpan) for g, v in gs]) if gs else [yok_satiri(kod, "altin_doviz", "altin", ad, "₺", "hesap", bugun)]
    if gs:
        aylik += [dict(ay=x["ay"], kod="GRAM", deger=x["deger"]) for x in ay_sonlari(gs)]
    son = dt.date.fromisoformat(bugun)
    bas = son - dt.timedelta(days=430)
    faiz = {"POLITIKA": ("Politika faizi", None), "TUFE_Y": ("Yıllık TÜFE", None), "MEVDUAT": ("Mevduat faizi", None)}
    if evds_key and evds_fn:
        ev = KAYNAK["evds"]
        try:
            tufe = evds_fn(evds_key, ev["TUFE"], bas, son)
            aylik += [dict(ay=a[:7], kod="TUFE", deger=v) for a, v in tufe[-13:]]
            if len(tufe) >= 13:
                faiz["TUFE_Y"] = ("Yıllık TÜFE", (tufe[-1][1] / tufe[-13][1] - 1) * 100)
        except Exception as e:
            print(f"evds TUFE: {e}", file=sys.stderr)
        try:
            p = evds_fn(evds_key, ev["POLITIKA"], son - dt.timedelta(days=40), son)
            if p:
                faiz["POLITIKA"] = ("Politika faizi", p[-1][1])
        except Exception as e:
            print(f"evds POLITIKA: {e}", file=sys.stderr)
        try:
            m = evds_fn(evds_key, ev["MEVDUAT"], bas, son)
            aylik += [dict(ay=a[:7], kod="MEVDUAT", deger=v) for a, v in m[-13:]]
            if m:
                faiz["MEVDUAT"] = ("Mevduat faizi", m[-1][1])
        except Exception as e:
            print(f"evds MEVDUAT: {e}", file=sys.stderr)
    for kod, (ad, deger) in faiz.items():
        satirlar.append(dict(gun=bugun, kod=kod, grup="faiz", tip="faiz", ad=ad, deger=None if deger is None else round(deger, 4),
                             birim="%", kaynak="tcmb", durum="yok" if deger is None else "ok"))
    for i in izleme:
        if i["tur"] != "fon":
            continue
        kod = f"FON:{i['kod']}"
        try:
            seri = tefas_fn(i["kod"], son - dt.timedelta(days=400), son) if tefas_fn else []
        except Exception as e:
            print(f"tefas {i['kod']}: {e}", file=sys.stderr)
            seri = []
        satirlar += seri_satirlari(kod, "faiz", "fon", i["kod"], "₺", "tefas", seri) if seri else [yok_satiri(kod, "faiz", "fon", i["kod"], "₺", "tefas", bugun)]
        if seri:
            aylik += [dict(ay=x["ay"], kod=kod, deger=x["deger"]) for x in ay_sonlari(seri)]
    return dict(gun=bugun, satirlar=satirlar, aylik=aylik)


def gunluk_not(bugun):
    try:
        j = json.loads(NOT.read_text(encoding="utf-8"))
    except Exception:
        return None
    metin = str(j.get("text") or "").strip()
    return metin[:600] if j.get("date") == bugun and metin else None


def main():
    anahtar = os.environ["PIYASA_KEY"]
    bugun = dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).date().isoformat()
    h = {"x-piyasa-key": anahtar}
    izleme = requests.get(f"{TABAN}/api/izleme-listesi", headers=h, timeout=20).json().get("izleme", [])
    govde = topla(izleme, os.environ.get("EVDS_KEY"), bugun)
    govde["not"] = gunluk_not(bugun)
    r = requests.post(f"{TABAN}/api/piyasa", headers=h, json=govde, timeout=60)
    print(r.status_code, r.text[:300])
    r.raise_for_status()
    ozet = r.json().get("ozet") or {}
    if ozet.get("bildirim"):
        import scan
        scan.notify("Diogenes · günün özeti", ozet["bildirim"], tags=["chart_with_upwards_trend"], priority=3)


if __name__ == "__main__":
    main()
```

`diogenes/scan/relay.py`:
- `TARGETS` sözlüğüne `"gunluk_not.json": DATA / "gunluk_not.json"` ekle.
- `REQUIRED` sözlüğüne `"gunluk_not.json": ("date", "text")` ekle.

`diogenes/scan/requirements.txt` dosyasının sonuna `tefas-crawler` satırını ekle.

`.github/workflows/diogenes-piyasa.yml`:
```yaml
name: Diogenes piyasa panosu

# Hafta içi 05:00 UTC (Türkiye 08:00): Claude'un günlük notunu ntfy'den alır (relay), Yahoo/TCMB/TEFAS verisini toplar,
# Diogenes'e (diogenes.diyarross.com/api/piyasa) yollar ve dönen özeti telefona bildirir.
on:
  schedule:
    - cron: "0 5 * * 1-5"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: diogenes-data
  cancel-in-progress: false

jobs:
  piyasa:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          ref: claude/daily-increases-site-gumybo
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: diogenes/scan/requirements.txt
      - run: pip install -r diogenes/scan/requirements.txt
      - run: python diogenes/scan/relay.py
      - run: python diogenes/scan/piyasa.py
        env:
          PIYASA_KEY: ${{ secrets.PIYASA_KEY }}
          EVDS_KEY: ${{ secrets.EVDS_KEY }}
          NTFY_TOPIC: ${{ secrets.NTFY_TOPIC }}
          DIOGENES_PUSH_TOKEN: ${{ secrets.DIOGENES_PUSH_TOKEN }}
      - name: Notu kaydet
        run: |
          git config user.name "diogenes-bot"
          git config user.email "diogenes-bot@users.noreply.github.com"
          git add diogenes/data/gunluk_not.json 2>/dev/null || true
          git diff --cached --quiet || git commit -m "Diogenes gunluk not $(date -u +%Y-%m-%d)"
          git pull --rebase -X theirs origin claude/daily-increases-site-gumybo || true
          git push || true
```

- [ ] **Adım 4: Testi çalıştır ve geçtiğini gör**

Çalıştır: `python -m pytest tests/test_piyasa.py -q; python -m pytest tests -q -x`
Beklenen: `test_piyasa.py` testlerinin hepsi geçer. Mevcut testler de önceki durumuyla aynı kalır; çalıştırmadan önceki sayı not edilir.

- [ ] **Adım 5: Commit**

```bash
git add diogenes/scan/piyasa.py diogenes/scan/piyasa_kaynak.json diogenes/scan/tests/test_piyasa.py diogenes/scan/relay.py diogenes/scan/requirements.txt .github/workflows/diogenes-piyasa.yml
git commit -m "Diogenes: piyasa veri toplayici, gunluk not ve is akisi"
```

---

### Görev 5: Yayın, anahtarlar, Claude rutini (Diyar'ın onayıyla)

- [ ] **Adım 1: Onay al.** Diyar'a şunları söyle ve "evet" demeden devam etme:
  - Diogenes uzak veritabanına `0003_piyasa.sql` uygulanacak ve Diogenes yayına alınacak.
  - Yeni bir `PIYASA_KEY` üretilip hem Cloudflare'e hem GitHub'a (`gh secret set`) ekrana yazılmadan verilecek.
  - Yerel dal `origin` ile birleştirilip push edilecek. Yerel dal önde ve geride; `git pull --rebase` yapılır, iş akışı dosyası GitHub'a ancak push ile gider.
  - İş akışı bir kez elle çalıştırılacak (`gh workflow run`).
  - Hafta içi 07:30'da çalışan bir Claude rutini kurulacak.

- [ ] **Adım 2: Diogenes'i yayına al**

Çalıştır: `cd D:\Claude\diogenes\app; node node_modules/wrangler/bin/wrangler.js d1 migrations apply diogenes --remote; npm run deploy`
Beklenen: `0003_piyasa.sql` ✅, `Uploaded diogenes`, bağlamalarda `env.BILDIRIM (diogenes-bildirim)`.

- [ ] **Adım 3: Anahtarı ver**

```bash
cd /d/Claude/diogenes/app
K=$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))")
printf %s "$K" | node node_modules/wrangler/bin/wrangler.js secret put PIYASA_KEY
printf %s "$K" | gh secret set PIYASA_KEY --repo Ross002200/Ross
unset K
```

- [ ] **Adım 4: Push ve deneme çalıştırması**

```bash
cd /d/Claude && git pull --rebase --autostash origin claude/daily-increases-site-gumybo && git push origin claude/daily-increases-site-gumybo
gh workflow run diogenes-piyasa.yml --repo Ross002200/Ross --ref claude/daily-increases-site-gumybo
```
Çalışma bitince `gh run view --log` ile çıktı okunur.
Beklenen:
- `200 {"ok":true,…}` satırı görülür.
- Telefona özet bildirimi gelir; abone olan cihazlara.
- Diogenes Piyasa sekmesinde pano dolu görünür.
- EVDS anahtarı yoksa faiz satırlarında "veri yok" yazar.

- [ ] **Adım 5: EVDS anahtarı (Diyar)**

Diyar'a adımları yaz:
1. evds2.tcmb.gov.tr → Giriş Yap / Üye Ol.
2. Profil → API Anahtarı → kopyala.
3. PowerShell'de `gh secret set EVDS_KEY --repo Ross002200/Ross` komutunu çalıştır ve anahtarı yapıştır.

Sonra iş akışını yeniden çalıştır. Günlükte "evds POLITIKA" ya da "evds MEVDUAT" hatası çıkarsa:
- EVDS kategori sayfasından doğru seri kodunu bul (politika faizi: "Bir hafta vadeli repo ihale faiz oranı"; mevduat: "TL mevduat faizi, ağırlıklı ortalama").
- `piyasa_kaynak.json` dosyasını düzelt, commit et ve onayla push et.

- [ ] **Adım 6: Claude rutini (Diyar onaylarsa)**

`schedule` skill'i ile hafta içi 04:30 UTC'de çalışan bir rutin kur. Rutin şu talimatla çalışır:
"Bugün (Türkiye saatiyle) Türkiye ve ABD piyasaları için önemli olayları ara: veri açıklamaları (TÜFE, faiz kararı, ABD istihdam ve enflasyon), büyük şirket haberleri, jeopolitik gelişmeler.
- Tavsiye verme, al/sat deme.
- En çok 3 kısa Türkçe cümle yaz.
- Rakam yazacaksan kaynağını kontrol et.
- Sonucu `{"date":"YYYY-AA-GG","text":"..."}` biçiminde `gunluk_not.json` dosyasına yaz.
- Dosyayı `curl -T gunluk_not.json -H "Filename: gunluk_not.json" https://ntfy.sh/diogenes-05ba7a13cae4-data` ile yükle."

- [ ] **Adım 7: Belgeler**

Spec'in sonuna "## 12. Uygulama notları" bölümünü ekle. Bu bölüme bu planın "Spec'e göre uygulama kararları" kısmındaki 9 madde girer. Ardından commit et.
