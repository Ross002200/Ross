# Diogenes Aşama 2 · Dazai bağlantısı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Hedef:** Dazai, Diogenes'e sesle harcama ve gelir yazabilsin, bekleyen önerileri sesle onaylayabilsin, sabah özetinde Diogenes'in bekleyen işlerini ve zarf kalanlarını okuyabilsin.

**Mimari:**
- **Diogenes:** Dazai standardındaki uç noktaları `x-dazai-key` ile sunar: `GET /api/dazai/bugun`, `POST /api/dazai/harcama`, `/gelir` ve `/onayla`. Saf yardımcılar (zarf eşleme, `bugun` cevabı, plan eşleşmesi) `src/dazai.js`'te, testleri `tests/dazai.test.js`'te.
- **Aurelius:**
  - Diogenes'e `DIOGENES` service binding'i ile ulaşır. Diogenes bağlantı listesine (`BAGLANTILAR`) eklendiği için `gunun_isleri`'ne kendiliğinden girer.
  - `para_kaydet`, `DIOGENES_DAZAI_KEY` tanımlıysa Diogenes'e yazar. Tanımlı değilse eskisi gibi Aurelius defterine yazar.
  - Yeni araç: `diogenes_onayla`.

**Teknoloji:** Diogenes (Cloudflare Worker + D1, vanilla JS, `node --test`, wrangler 4.92.0); Aurelius (TypeScript, Vite + Cloudflare, `node scripts/test-jarvis.mjs`).

**Spec:** `D:\Claude\diogenes\docs\superpowers\specs\2026-11-27-diogenes-finans-asistani-design.md` (Aşama 2: §6, §8, §9'daki `dazai.js` maddesi, §10.2). Bağlantı standardı: `D:\Claude\Aurelius\docs\superpowers\specs\2026-11-06-dazai-gunluk-isler-design.md` §1.

## Genel Kısıtlar

- **Dil:** Bütün metinler Türkçe olacak. Dazai'nin söyleyeceği cümleleri (`mesaj` alanı) Diogenes kurar; Aurelius bu cümleyi değiştirmeden aktarır.
- **Tutar ve tarih:** Tutarlar Diogenes'te kuruş cinsinden tam sayıdır. Tarihler `YYYY-AA-GG` biçiminde ve Europe/Istanbul saatindedir.
- **Yetki ve gövde:** `x-dazai-key` başlığı Diogenes'in `DAZAI_KEY` değeriyle `safeEqual` kullanılarak karşılaştırılır. Yanlışsa ya da yoksa 401 döner. Gövde en çok 2 KB olabilir, aşılırsa 400 döner.
- **Tekrar koruması:** `istek_id` tekrar koruması yapar. Aynı `istek_id` ya da `onceki` (önceki 3 dakikalık pencerenin anahtarı) yeniden gelirse yeni kayıt oluşmaz.
- **Kendiliğinden işlem yok:** Hiçbir para işlemi kendiliğinden uygulanmaz.
  - Doğrudan kayıt sayılan harcama ve gelir bunun dışındadır.
  - Gelir öneriye dönüşür.
  - Öneriler yalnızca `/api/dazai/onayla` ile ya da uygulamanın ekranından uygulanır.
- **Gizli değerler:** Ekrana yazılmaz. Yeni `DAZAI_KEY` dosyaya yazılmadan, iki worker'a pipe ile verilir (Görev 5).
- **Onay gerektirenler:** Commit, push, deploy ve secret girme Diyar'ın onayına bağlıdır. Yürütme başlarken commit için toplu onay istenir. Deploy (Görev 5) ayrıca onaylanır.
- **Dokunulmayanlar:** Hisse taramasına (`diogenes/*.html`, `scan/`, `data/`, `bildirim/`) dokunulmaz. Aurelius Varlık odası ve eski defter kayıtları Aşama 3'e kadar olduğu gibi kalır.
- **Wrangler komutu:** Wrangler `node node_modules/wrangler/bin/wrangler.js` ile çağrılır.

## Spec'e göre uygulama kararları

1. **Eşleme tablosu `zarf_eslemeleri(kelime, zarf_id)`:**
   - Spec "bir eşleme tablosu" diyor ama sütunlarını vermiyor.
   - Tablo, Diyar zarfı söylediğinde öğrenir. Harcamada `zarf` verilirse, katlanmış etiket ve katlanmış açıklama o zarfa eşlenir.
   - Eşleme sırası: önce öğrenilmiş kelime (önce etiket, sonra açıklama), sonra açıklamada ya da etikette zarf adının tam kelime olarak geçmesi.
   - Eşleşme yoksa harcama Atanmamış'a yazılır ve `zarf_sor:true` döner.
2. **Zarf sorusunun cevabı aynı kaydı günceller.**
   - Dazai, zarfı öğrenince `para_kaydet`'i aynı tutar ve açıklamayla, bu kez `zarf` vererek yeniden çağırır.
   - Aurelius `istek_id`'yi zarf **hariç** içerikten üretir, bu yüzden anahtar aynı kalır.
   - Diogenes var olan kayıt Atanmamış'taysa onu verilen zarfa taşır ve eşlemeyi öğrenir. Kayıt zaten bir zarftaysa "Bu kayıt zaten yapılmış." der.
3. **`bugun` maddeleri yalnızca yapılacak işlerdir.** Zarf bakiyeleri madde olmaz, çünkü Dazai'nin günlük "N işin var" sayısını şişirirdi.
   - **Maddeler:**
     - Bekleyen her öneri: `oneri:<id>`.
     - Kaydırma önerisi olmayan her eksi zarf: `zarf:<id>`.
   - **Diğer bilgiler:**
     - Zarf kalanları ve yarınki abonelikler standarda eklenen isteğe bağlı `satirlar: string[]` alanında gelir (en çok 20 satır). Aurelius bu alanı Dazai metnine ve `uygulama_ozeti`'ne ekler.
     - Atanmamış tutar ve yarınki abonelikler `ozet`'te kısaca yer alır.
4. **Plan gelirinin önerisi bekliyorsa yeni gelir yazılmaz.** Örneğin Dazai "bursum geldi" der ve o ay için bekleyen "Burs: … geldi mi?" önerisi vardır. Bu durumda gelir kaydedilmez, Diogenes o öneriyi `oneri_id` ile söyler. Dazai `diogenes_onayla` ile onaylar; tutar farklıysa `tutar` verilir. Böylece aynı para iki kez sayılmaz.
5. **Onayda verilen tutar dağıtımı yeniden hesaplatır.** `onayla` isteğinde `tutar` verilir ve öneri bir dağıtım önerisiyse, kalemler bu tutarla yeniden hesaplanır. Hesap `dagitimOner` ile yapılır ve bu öneri dışındaki bekleyen dağıtımlar düşülür. Diğer öneri türlerinde `tutar` yok sayılır.
6. **Onaylanacak öneri türle bulunur.** `onayla` isteği `oneri_id` yerine `tur` ile gelirse o türde bekleyen tek öneri aranır. Birden fazla varsa 400 döner ve id'ler listelenir.
7. **Aurelius'ta geçiş anahtarı `DIOGENES_DAZAI_KEY`'dir.**
   - Bu gizli değer tanımlı değilse `para_kaydet` eskisi gibi Aurelius defterine yazar, `diogenes_onayla` ise "Diogenes bağlantısı kurulmamış." der.
   - Spec §6'daki "Dazai'nin yönü taşımadan sonra değişir" maddesi şöyle uygulanır: yönü Görev 5'teki secret değiştirir. Görev 5 başlarken Diyar'a ayrıca sorulur. Diyar beklemek isterse kod yayına girer ama secret girilmez.
   - Beklemenin bedeli Diyar'a söylenir. Diogenes `BAGLANTILAR` listesinde olduğu için, anahtar girilmeden sabah ve akşam bildirimlerinde "Ulaşılamayan: Diogenes" yazar. Bu yüzden önerilen yol, secret'ı yayınla birlikte girmektir. Aurelius defterindeki eski kayıtlar Aşama 3'te taşınır; yeni kayıtlar o güne kadar Diogenes'te birikir.
8. **Diogenes özeti iki parçadır.** Aurelius'taki "Diogenes" özeti artık önce bütçe satırlarını (`bugun`) verir, ardından eski hisse/kâğıt hesap satırlarını "Piyasa:" önekiyle ekler. Piyasa satırları okunamazsa bütçe yine gelir.
9. **`DAZAI_KEY` yenilenir.** Aşama 1'de üretilen `DAZAI_KEY` ekrana yazılmadığı için kimse bilmiyor. Görev 5'te yeni bir değer üretilir ve aynı pipe ile hem Diogenes `DAZAI_KEY`'e hem Aurelius `DIOGENES_DAZAI_KEY`'e verilir.

## İnceleme Odağı

- **Zarf sorusunun cevabı:** Dazai zarfı sorduktan sonra aynı harcama zarfla yeniden gelir. Kayıt çoğalmamalı, zarfa taşınmalı ve bir sonraki "market" kendiliğinden o zarfa gitmeli. Bu, Görev 2'deki duman testinde kontrol edilir.
- **3 dakikalık pencere sınırı:** Aynı söyleyiş önceki pencerenin anahtarıyla (`onceki`) gelir. Kayıt çoğalmamalı (Görev 2 duman testi).
- **Bekleyen plan önerisi varken "bursum geldi":** Yeni gelir yazılmamalı, öneri söylenmeli (Görev 1'deki `planEslesmesi` testi).
- **Diogenes'e ulaşılamıyor ya da anahtar yok:** `gunun_isleri` Diogenes için "ulaşılamadı" ya da "bağlantı kurulmamış" demeli, geri kalanı çalışmalı. `para_kaydet` anahtar yoksa Aurelius defterine yazmalı (Görev 3 testleri: `diogenesGonder` ve `bugunTopla`).
- **Onaylarken farklı tutar:** Öneri 2.000 ₺, gelen 1.500 ₺. Dağıtım 1.500 ₺ üzerinden yapılmalı ve "dağıtılan fazla" hatası çıkmamalı (Görev 2 duman testi).

---

## Dosya Yapısı

```
diogenes/app/
  migrations/0002_dazai.sql    gelirler.istek_id (tekil), zarf_eslemeleri
  src/dazai.js                 saf: katla, zarfAdiCoz, zarfBul, esleKelimeleri, planEslesmesi, bugunCevabi
  src/worker.js                /api/dazai/* uçları, gelirEkle(istek), oneriKarar yeniden kullanımı
  tests/dazai.test.js
  scripts/duman.mjs            Dazai bölümü eklenir
  package.json                 test komutu iki dosyayı çalıştırır
Aurelius/
  lib/jarvis/isaretle-govde.ts paraGovdesi, onayGovdesi
  lib/jarvis/baglanti.ts       BAGLANTILAR'a diogenes, diogenesGonder
  lib/jarvis/gunluk.ts         isteğe bağlı satirlar alanı
  lib/jarvis/sources.ts        anahtar, Diogenes özeti (bütçe + piyasa)
  lib/jarvis/tools.ts          para_kaydet yönlendirme, diogenes_onayla
  lib/jarvis/agent-config.ts   araç tanımları
  lib/jarvis/prompt.ts         talimat satırları
  lib/jarvis/app-fetch.ts      HOSTS + DIOGENES binding
  cloudflare-env.d.ts, vite.config.ts
  tests/diogenes.ts (yeni), tests/dazai.ts, tests/jarvis.ts
```

---

### Görev 1: Diogenes saf Dazai yardımcıları ve şema

**Dosyalar:**
- Oluştur: `diogenes/app/migrations/0002_dazai.sql`, `diogenes/app/src/dazai.js`, `diogenes/app/tests/dazai.test.js`
- Değiştir: `diogenes/app/package.json` (`test` komutu)

**Arayüzler:**
- Tüketir: `core.js` → `tl`, `gunEkle`, `planGunu`.
- Üretir:
  - `katla(s) → string` (Türkçe küçük harf, aksansız, tek boşluk)
  - `zarfAdiCoz(ad, zarflar) → zarf|null` (`zarflar` = aktif `{id,ad}` listesi)
  - `zarfBul({aciklama,etiket}, zarflar, eslemeler:[{kelime,zarf_id}]) → zarf|null`
  - `esleKelimeleri({aciklama,etiket}) → string[]`
  - `planEslesmesi(aciklama, bekleyen:[{id,detay}]) → {id,detay}|null`
  - `bugunCevabi({day,durum,oneriler,kaydirmaZarflari,abonelikler,zarfAd}) → {app,day,ozet,maddeler,satirlar}`

- [ ] **Adım 1: Şemayı yaz**

`diogenes/app/migrations/0002_dazai.sql`:
```sql
-- Aşama 2: Dazai gelirlerinde tekrar koruması ve öğrenilen zarf eşlemeleri.
ALTER TABLE gelirler ADD COLUMN istek_id TEXT;
CREATE UNIQUE INDEX gelirler_istek ON gelirler(istek_id);
CREATE TABLE zarf_eslemeleri (kelime TEXT PRIMARY KEY, zarf_id INTEGER NOT NULL, guncelleme TEXT NOT NULL);
```

`diogenes/app/package.json` içindeki `"test"` satırı:
```json
    "test": "node --test tests/core.test.js tests/dazai.test.js",
```

- [ ] **Adım 2: Başarısız testi yaz**

`diogenes/app/tests/dazai.test.js`:
```js
import {test} from "node:test";
import assert from "node:assert/strict";
import * as d from "../src/dazai.js";

const Z=[{id:1,ad:"Kira"},{id:2,ad:"Yemek"},{id:3,ad:"Ulaşım"}];

test("katla: Türkçe harfler ve boşluk", () => {
  assert.equal(d.katla("  İçecek  ŞEKER  "),"icecek seker");
  assert.equal(d.katla(null),"");
});

test("zarfAdiCoz: büyük/küçük harf ve aksan fark etmez, baş harfler yeter", () => {
  assert.equal(d.zarfAdiCoz("kira",Z).id,1);
  assert.equal(d.zarfAdiCoz("ulasim",Z).id,3);
  assert.equal(d.zarfAdiCoz("Yem",Z).id,2);
  assert.equal(d.zarfAdiCoz("Tatil",Z),null);
  assert.equal(d.zarfAdiCoz("",Z),null);
});

test("zarfBul: önce öğrenilmiş etiket, sonra açıklama, sonra zarf adı; pasif zarfa eşleme yok sayılır", () => {
  const es=[{kelime:"market",zarf_id:2},{kelime:"benzin",zarf_id:3},{kelime:"eski",zarf_id:9}];
  assert.equal(d.zarfBul({aciklama:"A101",etiket:"market"},Z,es).id,2);
  assert.equal(d.zarfBul({aciklama:"Benzin",etiket:""},Z,es).id,3);
  assert.equal(d.zarfBul({aciklama:"Yemek siparişi",etiket:""},Z,es).id,2);
  assert.equal(d.zarfBul({aciklama:"eski",etiket:""},Z,es),null,"zarf 9 aktif değil");
  assert.equal(d.zarfBul({aciklama:"Kiralık bisiklet",etiket:""},Z,[]),null,"kelime içinde geçmek yetmez");
  assert.equal(d.zarfBul({aciklama:"Sinema",etiket:"eglence"},Z,es),null);
});

test("esleKelimeleri: etiket ve açıklama, boş ve uzunlar atlanır", () => {
  assert.deepEqual(d.esleKelimeleri({aciklama:"Market",etiket:"market"}),["market"]);
  assert.deepEqual(d.esleKelimeleri({aciklama:"A101 Market",etiket:"market"}),["market","a101 market"]);
  assert.deepEqual(d.esleKelimeleri({aciklama:"x".repeat(41),etiket:""}),[]);
});

test("planEslesmesi: açıklama plan adını içerir ya da tersi", () => {
  const bek=[{id:7,detay:{tutar:400000,gelir:{plan_id:2,aciklama:"Burs",tarih:"2026-12-07"}}},{id:8,detay:{tutar:1,gelir_id:5}}];
  assert.equal(d.planEslesmesi("Bursum geldi",bek),null,"'bursum' 'burs' değildir: kelime sınırı");
  assert.equal(d.planEslesmesi("burs",bek).id,7);
  assert.equal(d.planEslesmesi("KYK burs",bek).id,7);
  assert.equal(d.planEslesmesi("Ek iş",bek),null);
  assert.equal(d.planEslesmesi("",bek),null);
});

test("bugunCevabi: maddeler yalnız yapılacak işler, zarflar satırlarda, yarınki abonelik özette", () => {
  const durum={ay:"2026-12",atanmamis:120000,zarflar:[
    {id:1,ad:"Kira",aylik:1000000,kalan:900000},{id:2,ad:"Yemek",aylik:600000,kalan:-30000},{id:3,ad:"Ulaşım",aylik:100000,kalan:-5000}]};
  const oneriler=[{id:5,tur:"kaydirma",baslik:"Ulaşım zarfı 50 ₺ eksi",satirlar:[{zarf_id:null,ad:"Atanmamış",tutar:5000}]},
    {id:6,tur:"dagitim",baslik:"Burs: 4.000 ₺ geldi mi?",satirlar:[{zarf_id:1,ad:"Kira",tutar:100000},{zarf_id:2,ad:"Yemek",tutar:300000}]}];
  const ab=[{id:1,ad:"Spotify",tutar_kurus:6000,gun:9,zarf_id:2,aktif:1},{id:2,ad:"Pasif",tutar_kurus:1,gun:9,zarf_id:null,aktif:0},{id:3,ad:"Bulut",tutar_kurus:3000,gun:20,zarf_id:null,aktif:1}];
  const c=d.bugunCevabi({day:"2026-12-08",durum,oneriler,kaydirmaZarflari:new Set([3]),abonelikler:ab,zarfAd:new Map([[1,"Kira"],[2,"Yemek"]])});
  assert.equal(c.app,"diogenes");assert.equal(c.day,"2026-12-08");
  assert.deepEqual(c.maddeler.map(m=>m.id),["zarf:2","oneri:5","oneri:6"],"kaydırması olan eksi zarf (3) madde olmaz");
  assert.ok(c.maddeler.every(m=>m.tur==="onay"&&m.durum==="bekliyor"));
  assert.equal(c.maddeler[0].baslik,"Yemek zarfı eksi");
  assert.equal(c.maddeler[2].ayrinti,"Kira 1.000 ₺, Yemek 3.000 ₺");
  assert.equal(c.ozet,"Atanmamış 1.200 ₺ · yarın Spotify 60 ₺");
  assert.deepEqual(c.satirlar,["Kira: 9.000 ₺ kaldı (aylık 10.000 ₺)","Yemek: −300 ₺ kaldı (aylık 6.000 ₺)","Ulaşım: −50 ₺ kaldı (aylık 1.000 ₺)","Yarın çekilecek: Spotify 60 ₺ (Yemek)"]);
  // ayın son günü: yarın bir sonraki ayın 1'i; planGunu kısa ayda son güne kayar
  const s=d.bugunCevabi({day:"2027-02-27",durum:{ay:"2027-02",atanmamis:0,zarflar:[]},abonelikler:[{id:4,ad:"Kira oto",tutar_kurus:100,gun:31,zarf_id:null,aktif:1}]});
  assert.equal(s.ozet,"Atanmamış 0 ₺ · yarın Kira oto 1 ₺");
});
```

- [ ] **Adım 3: Testi çalıştır ve başarısız olduğunu gör**

Çalıştır: `cd D:\Claude\diogenes\app; npm test`
Beklenen: `tests/dazai.test.js` dosyası `Cannot find module '…/src/dazai.js'` hatasıyla BAŞARISIZ olur. `core.test.js` 24 test GEÇER.

- [ ] **Adım 4: `src/dazai.js`'i yaz**

```js
// Diogenes ↔ Dazai: saf yardımcılar (ağ ve D1 yok). Bağlantı standardı Aurelius 2026-11-06 tasarımı §1.
import {tl,gunEkle,planGunu} from "./core.js";

export const katla=s=>String(s??"").toLocaleLowerCase("tr-TR").replace(/ı/g,"i").replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s").replace(/ö/g,"o").replace(/ç/g,"c").replace(/â/g,"a").replace(/\s+/g," ").trim();

// Dazai'nin söylediği zarf adı: önce tam eşleşme, sonra baştan eşleşme (ör. "yem" → Yemek).
export function zarfAdiCoz(ad,zarflar){
  const k=katla(ad);if(!k)return null;
  return zarflar.find(z=>katla(z.ad)===k)||zarflar.find(z=>katla(z.ad).startsWith(k))||null;
}
const kelimeIcinde=(metin,kelime)=>(" "+metin+" ").includes(" "+kelime+" ");
// Zarf verilmemiş harcama: öğrenilmiş eşleme (etiket, sonra açıklama), sonra zarf adının tam kelime olarak geçmesi.
export function zarfBul({aciklama,etiket},zarflar,eslemeler){
  const aktif=new Map(zarflar.map(z=>[z.id,z])),es=new Map(eslemeler.map(e=>[e.kelime,e.zarf_id]));
  for(const k of [katla(etiket),katla(aciklama)])if(k&&es.has(k)&&aktif.has(es.get(k)))return aktif.get(es.get(k));
  const metin=katla(`${aciklama??""} ${etiket??""}`);
  return zarflar.find(z=>{const n=katla(z.ad);return n.length>=3&&kelimeIcinde(metin,n);})||null;
}
// Diyar zarfı söylediğinde öğrenilecek kelimeler.
export const esleKelimeleri=({aciklama,etiket})=>[...new Set([katla(etiket),katla(aciklama)])].filter(k=>k&&k.length<=40);

// "Burs geldi" → bekleyen "Burs" plan önerisi (aynı para iki kez sayılmasın). Kelime sınırıyla karşılaştırılır.
export function planEslesmesi(aciklama,bekleyen){
  const a=katla(aciklama);if(!a)return null;
  return bekleyen.find(o=>{const p=katla(o.detay?.gelir?.aciklama);return !!p&&(kelimeIcinde(a,p)||kelimeIcinde(p,a));})||null;
}

// GET /api/dazai/bugun cevabı. Maddeler yalnız yapılacak işler (bekleyen öneri, kaydırması olmayan eksi zarf);
// zarf kalanları ve yarınki abonelikler satirlar'da (standarda eklenen isteğe bağlı alan), kısa hali ozet'te.
export function bugunCevabi({day,durum,oneriler=[],kaydirmaZarflari=new Set(),abonelikler=[],zarfAd=new Map()}){
  const yarin=gunEkle(day,1);
  const yarinki=abonelikler.filter(a=>a.aktif&&planGunu(yarin.slice(0,7),a.gun)===yarin);
  const maddeler=[
    ...durum.zarflar.filter(z=>z.kalan<0&&!kaydirmaZarflari.has(z.id)).sort((a,b)=>a.kalan-b.kalan)
      .map(z=>({id:`zarf:${z.id}`,baslik:`${z.ad} zarfı eksi`,tur:"onay",durum:"bekliyor",ayrinti:`${tl(z.kalan)}; Diogenes'te başka zarftan kaydır`})),
    ...oneriler.map(o=>({id:`oneri:${o.id}`,baslik:o.baslik,tur:"onay",durum:"bekliyor",ayrinti:o.satirlar.map(s=>`${s.ad} ${tl(s.tutar)}`).join(", ").slice(0,200)})),
  ];
  const ozet=[`Atanmamış ${tl(durum.atanmamis)}`,...yarinki.map(a=>`yarın ${a.ad} ${tl(a.tutar_kurus)}`)].join(" · ").slice(0,120);
  const satirlar=[
    ...durum.zarflar.map(z=>`${z.ad}: ${tl(z.kalan)} kaldı (aylık ${tl(z.aylik)})`),
    ...yarinki.map(a=>`Yarın çekilecek: ${a.ad} ${tl(a.tutar_kurus)}${a.zarf_id?` (${zarfAd.get(a.zarf_id)||"silinmiş zarf"})`:""}`),
  ].slice(0,20);
  return {app:"diogenes",day,ozet,maddeler,satirlar};
}
```

- [ ] **Adım 5: Testi çalıştır ve geçtiğini gör**

Çalıştır: `npm test`
Beklenen: 24 + 7 = 31 test GEÇER, 0 başarısız.

- [ ] **Adım 6: Yerel şemayı uygula**

Çalıştır: `node node_modules/wrangler/bin/wrangler.js d1 migrations apply diogenes --local`
Beklenen: `0002_dazai.sql` ✅

- [ ] **Adım 7: Commit**

```bash
git add diogenes/app/migrations/0002_dazai.sql diogenes/app/src/dazai.js diogenes/app/tests/dazai.test.js diogenes/app/package.json
git commit -m "Diogenes: Dazai yardimcilari (zarf esleme, bugun cevabi) ve sema"
```

---

### Görev 2: Diogenes `/api/dazai/*` uçları ve duman testi

**Dosyalar:**
- Değiştir: `diogenes/app/src/worker.js`, `diogenes/app/scripts/duman.mjs`

**Arayüzler:**
- Tüketir:
  - Görev 1'deki fonksiyonlar.
  - Aşama 1'den: `veriYukle`, `oneriGorunum`, `oneriKarar(env,{id,karar,duzenleme},bugun) → Response`, `eksiKontrol`, `oneriEkle`, `harcamaDogrula`, `gelirDogrula`, `dagitimOner`, `bekleyenDus`, `safeEqual`, `gecerliGun`, `tl`, `metinDogrula`.
- Üretir (HTTP). Yetki `x-dazai-key` başlığıyla yapılır, oturum çerezi aranmaz.
  - `GET /api/dazai/bugun?day=` şunu döner: `{app,day,ozet,maddeler,satirlar}`.
  - `POST /api/dazai/harcama {istek_id, onceki?, tutar, aciklama, zarf?, etiket?, tarih?}` şunu döner: `{ok,id,mesaj,zarf_sor?,zarflar?}`.
  - `POST /api/dazai/gelir {istek_id, onceki?, tutar, aciklama, tarih?}` şunu döner: `{ok,id?,oneri_id,mesaj}`.
  - `POST /api/dazai/onayla {oneri_id|tur, karar, tutar?}` şunu döner: `{ok,mesaj}`. Karar zaten verilmişse ya da öneri eskimişse 409 döner.

- [ ] **Adım 1: Duman testine Dazai bölümünü ekle (bu testin başarısız olması bekleniyor)**

`diogenes/app/scripts/duman.mjs` dosyasındaki son satırı (`console.log("Duman testi GEÇTİ");`) şu blokla değiştir:
```js
// Aşama 2: Dazai uçları (x-dazai-key, oturum çerezi yok).
const dz=async(yol,govde)=>{const r=await fetch(TABAN+"/api/dazai/"+yol,{method:govde?"POST":"GET",headers:{"Content-Type":"application/json","x-dazai-key":vars.DAZAI_KEY},body:govde?JSON.stringify(govde):undefined});return {status:r.status,j:await r.json().catch(()=>({}))};};
assert.equal((await fetch(TABAN+"/api/dazai/bugun")).status,401,"anahtarsız 401");
assert.equal((await fetch(TABAN+"/api/dazai/bugun",{headers:{"x-dazai-key":"yanlis"}})).status,401,"yanlış anahtar 401");
const bg=await dz("bugun");
assert.equal(bg.status,200);assert.equal(bg.j.app,"diogenes");
assert.ok(bg.j.satirlar.some(s=>s.startsWith("Kira:")),"zarf kalanı satırlarda");
assert.ok(bg.j.maddeler.some(m=>m.id.startsWith("oneri:")),"bekleyen öneri madde olarak");
const h1={istek_id:"dz-1",tutar:"200",aciklama:"Kira katkısı",zarf:"kira"};
const r1=await dz("harcama",h1);assert.equal(r1.status,200,JSON.stringify(r1.j));assert.match(r1.j.mesaj,/Kira zarfına/);
assert.match((await dz("harcama",h1)).j.mesaj,/zaten/,"aynı istek_id çoğalmaz");
assert.match((await dz("harcama",{...h1,istek_id:"dz-1b",onceki:"dz-1"})).j.mesaj,/zaten/,"önceki pencerenin anahtarı");
const m1=await dz("harcama",{istek_id:"dz-2",tutar:"150",aciklama:"Market",etiket:"market"});
assert.equal(m1.j.zarf_sor,true);assert.deepEqual(m1.j.zarflar,["Kira"]);
assert.match((await dz("harcama",{istek_id:"dz-2",tutar:"150",aciklama:"Market",etiket:"market",zarf:"Kira"})).j.mesaj,/taşındı/,"zarf sorusunun cevabı aynı kaydı taşır");
const m2=await dz("harcama",{istek_id:"dz-3",tutar:"80",aciklama:"Market",etiket:"market"});
assert.ok(!m2.j.zarf_sor,"öğrenilen eşleme");assert.match(m2.j.mesaj,/Kira zarfına/);
const gec=await tamam(`/api/gecmis?ay=${d.ay}`);
assert.equal(gec.harcamalar.filter(x=>x.aciklama==="Market").length,2,"Market iki kez, çoğalma yok");
assert.equal((await dz("harcama",{istek_id:"dz-4",tutar:"10",aciklama:"x",zarf:"Tatil"})).status,400,"bilinmeyen zarf");
assert.equal((await dz("harcama",{istek_id:"dz-5",tutar:"0",aciklama:"x"})).status,400,"sıfır tutar");
assert.equal((await dz("harcama",{istek_id:"dz-6",tutar:"10",aciklama:"x".repeat(3000)})).status,400,"2 KB sınırı");
const gl=await dz("gelir",{istek_id:"dz-g1",tutar:"2.000",aciklama:"Ek iş"});
assert.equal(gl.status,200,JSON.stringify(gl.j));assert.ok(gl.j.oneri_id);assert.match(gl.j.mesaj,/Onaylayayım mı/);
assert.match((await dz("gelir",{istek_id:"dz-g1",tutar:"2.000",aciklama:"Ek iş"})).j.mesaj,/zaten/,"aynı gelir çoğalmaz");
const on=await dz("onayla",{oneri_id:gl.j.oneri_id,karar:"onayla",tutar:"1.500"});
assert.equal(on.status,200,JSON.stringify(on.j));assert.match(on.j.mesaj,/Onaylandı/);
assert.equal((await dz("onayla",{oneri_id:gl.j.oneri_id,karar:"onayla"})).status,409,"ikinci onay 409");
const gec2=await tamam(`/api/gecmis?ay=${d.ay}`);
assert.equal(gec2.gelirler.find(x=>x.aciklama==="Ek iş").tutar_kurus,150000,"onayda söylenen tutar geçerli");
const kr=await dz("onayla",{tur:"kaydirma",karar:"reddet"});
assert.equal(kr.status,200,JSON.stringify(kr.j));assert.match(kr.j.mesaj,/Reddedildi/);
assert.equal((await dz("onayla",{tur:"kaydirma",karar:"reddet"})).status,400,"bu türde bekleyen yok");
console.log("Duman testi GEÇTİ");
```

- [ ] **Adım 2: Duman testini çalıştır ve başarısız olduğunu gör**

Çalıştır (iki terminal):
1. `cd D:\Claude\diogenes\app; Remove-Item -Recurse -Force .wrangler\state -ErrorAction SilentlyContinue; node node_modules/wrangler/bin/wrangler.js d1 migrations apply diogenes --local; npm run dev`
2. `cd D:\Claude\diogenes\app; npm run duman`

Beklenen: `anahtarsız 401` kontrolü BAŞARISIZ olur. `/api/dazai/bugun` yolu henüz yok; oturumsuz istek genel 401'e düştüğü için bu ilk kontrol geçebilir. O durumda başarısızlık `yanlış anahtar 401` ya da `bg.status` 200 kontrolünde görülür.

- [ ] **Adım 3: `src/worker.js`'i değiştir**

(a) İçe aktarmaya `gecerliGun`, `tl`, `metinDogrula` ve `dazai.js` eklenir. İlk `import` satırını şununla değiştir:
```js
import {Hata,istanbulGun,durumOlusturucu,bekleyenDus,merdivenDurumu,dagitimOner,gunlukOneriler,uygulaSql,oneriGorunum,listeDogrula,LISTE_SUTUNLARI,harcamaDogrula,gelirDogrula,gecerliGun,tl,metinDogrula} from "./core.js";
import {zarfAdiCoz,zarfBul,esleKelimeleri,planEslesmesi,bugunCevabi} from "./dazai.js";
```

(b) `gelirEkle` artık isteğe bağlı bir `istek_id` alır ve oluşan öneriyi de döner. Fonksiyonun tamamını şununla değiştir:
```js
async function gelirEkle(env,b,bugun,istek=null){
  const g=gelirDogrula(b,bugun);
  const r=await env.DB.prepare("INSERT INTO gelirler(tutar_kurus,aciklama,tarih,istek_id) VALUES(?,?,?,?)").bind(g.tutar_kurus,g.aciklama,g.tarih,istek).run();
  const id=r.meta.last_row_id,ay=g.tarih.slice(0,7),v=await veriYukle(env),anahtar=`dagitim:gelir:${id}`;
  await oneriEkle(env,"dagitim",anahtar,{ay,tutar:g.tutar_kurus,gelir_id:id,kalemler:dagitimOner(g.tutar_kurus,v.dagitimDurumu(ay)).kalemler});
  const o=await env.DB.prepare("SELECT id,detay_json FROM oneriler WHERE anahtar=?").bind(anahtar).first();
  return {ok:true,id,oneri:o?{id:o.id,detay:JSON.parse(o.detay_json)}:null};
}
```
Bu fonksiyon `/api/gelir`'den de çağrılır. Oradaki cevap `{ok,id,oneri}` olur; arayüz yalnızca `ok`'a baktığı için etkilenmez.

(c) `oneriKarar` fonksiyonundan hemen sonra Dazai bölümünü ekle:
```js
// ---- Dazai (Aurelius) uçları: x-dazai-key ile, oturumsuz. Cümleleri Dazai aynen söyler.
const DAZAI_GOVDE=2048;
async function dazaiGovde(req){
  const t=await req.text();if(t.length>DAZAI_GOVDE)throw new Hata("İstek çok büyük (en çok 2 KB).");
  try{return t?JSON.parse(t):{}}catch{throw new Hata("Geçersiz istek.")}
}
const istekAl=b=>({istek:metinDogrula(b.istek_id,"İstek kimliği",80),onceki:b.onceki?String(b.onceki).slice(0,80):null});
async function zarfKalani(env,ay,zarfId){const v=await veriYukle(env);return v.durum(ay).zarflar.find(z=>z.id===zarfId)?.kalan??0;}
async function esle(env,b,zarfId,bugun){
  const st=esleKelimeleri(b).map(k=>env.DB.prepare("INSERT INTO zarf_eslemeleri(kelime,zarf_id,guncelleme) VALUES(?,?,?) ON CONFLICT(kelime) DO UPDATE SET zarf_id=excluded.zarf_id,guncelleme=excluded.guncelleme").bind(k,zarfId,bugun));
  if(st.length)await env.DB.batch(st);
}
const zarfCumlesi=(ad,kalan)=>`${ad} kalan ${tl(kalan)}.${kalan<0?" Zarf eksiye düştü; kaydırma önerisi hazır.":""}`;
async function dazaiBugun(env,url,bugun){
  const q=url.searchParams.get("day")||"",day=gecerliGun(q)?q:bugun;
  const v=await veriYukle(env),zarfAd=new Map(v.zarflar.map(z=>[z.id,z.ad]));
  const oneriler=(await hepsi(env,"SELECT * FROM oneriler WHERE durum='bekliyor' ORDER BY id")).map(r=>({id:r.id,tur:r.tur,detay:JSON.parse(r.detay_json)}));
  return bugunCevabi({day,durum:v.durum(day.slice(0,7)),zarfAd,abonelikler:v.abonelikler,
    oneriler:oneriler.map(o=>oneriGorunum(o,{durum:v.durum,zarfAd,merdiven:v.merdiven,mctx:v.mctx})),
    kaydirmaZarflari:new Set(oneriler.filter(o=>o.tur==="kaydirma").map(o=>o.detay.zarf_id))});
}
async function dazaiHarcama(env,b,bugun){
  const {istek,onceki}=istekAl(b),v=await veriYukle(env),aktif=v.zarflar.filter(z=>z.aktif);
  let zarf=null;
  if(b.zarf!=null&&String(b.zarf).trim()){zarf=zarfAdiCoz(b.zarf,aktif);if(!zarf)throw new Hata(`"${String(b.zarf).slice(0,40)}" adında zarf yok. Zarflar: ${aktif.map(z=>z.ad).join(", ")||"henüz yok"}.`);}
  const eski=await env.DB.prepare("SELECT id,zarf_id,tarih FROM harcamalar WHERE istek_id IN (?,?)").bind(istek,onceki||istek).first();
  if(eski){
    if(!zarf||eski.zarf_id!=null)return {ok:true,id:eski.id,mesaj:"Bu kayıt zaten yapılmış."};
    await env.DB.prepare("UPDATE harcamalar SET zarf_id=? WHERE id=? AND zarf_id IS NULL").bind(zarf.id,eski.id).run();
    await esle(env,b,zarf.id,bugun);await eksiKontrol(env,eski.tarih.slice(0,7),zarf.id,eski.id);
    return {ok:true,id:eski.id,mesaj:`${zarf.ad} zarfına taşındı. ${zarfCumlesi(zarf.ad,await zarfKalani(env,eski.tarih.slice(0,7),zarf.id))}`};
  }
  const h=harcamaDogrula({...b,istek_id:istek,zarf_id:null},bugun);
  const eslemeler=await hepsi(env,"SELECT kelime,zarf_id FROM zarf_eslemeleri");
  const hedef=zarf||zarfBul(h,aktif,eslemeler);
  await env.DB.prepare("INSERT INTO harcamalar(istek_id,tutar_kurus,aciklama,zarf_id,tarih,kaynak,etiket) VALUES(?,?,?,?,?,'dazai',?) ON CONFLICT(istek_id) DO NOTHING").bind(istek,h.tutar_kurus,h.aciklama,hedef?hedef.id:null,h.tarih,h.etiket).run();
  const row=await env.DB.prepare("SELECT id FROM harcamalar WHERE istek_id=?").bind(istek).first();
  if(zarf)await esle(env,b,zarf.id,bugun);
  if(!hedef)return {ok:true,id:row.id,zarf_sor:true,zarflar:aktif.map(z=>z.ad),mesaj:`${tl(h.tutar_kurus)} ${h.aciklama} şimdilik Atanmamış'a yazıldı. Hangi zarfa yazayım? Zarflar: ${aktif.map(z=>z.ad).join(", ")||"henüz yok"}.`};
  await eksiKontrol(env,h.tarih.slice(0,7),hedef.id,row.id);
  return {ok:true,id:row.id,mesaj:`${tl(h.tutar_kurus)} ${h.aciklama} ${hedef.ad} zarfına yazıldı. ${zarfCumlesi(hedef.ad,await zarfKalani(env,h.tarih.slice(0,7),hedef.id))}`};
}
async function dazaiGelir(env,b,bugun){
  const {istek,onceki}=istekAl(b);
  const eski=await env.DB.prepare("SELECT id FROM gelirler WHERE istek_id IN (?,?)").bind(istek,onceki||istek).first();
  if(eski)return {ok:true,id:eski.id,mesaj:"Bu gelir zaten kaydedilmiş."};
  const g=gelirDogrula(b,bugun),ay=g.tarih.slice(0,7);
  const plan=(await hepsi(env,"SELECT id,detay_json FROM oneriler WHERE durum='bekliyor' AND anahtar LIKE ?",`dagitim:plan:${ay}:%`)).map(r=>({id:r.id,detay:JSON.parse(r.detay_json)}));
  const es=planEslesmesi(g.aciklama,plan);
  if(es)return {ok:true,oneri_id:es.id,mesaj:`${es.detay.gelir.aciklama} için bekleyen öneri var (${tl(es.detay.tutar)}). Onaylarsan gelir kaydedilir ve dağıtılır${g.tutar_kurus!==es.detay.tutar?`; gelen tutar ${tl(g.tutar_kurus)} ise onaylarken bu tutarı ver`:""}. Onaylayayım mı?`};
  const r=await gelirEkle(env,b,bugun,istek),v=await veriYukle(env),ad=new Map(v.zarflar.map(z=>[z.id,z.ad]));
  const kalem=r.oneri?r.oneri.detay.kalemler.map(k=>`${ad.get(k.zarf_id)} ${tl(k.tutar)}`).join(", "):"";
  return {ok:true,id:r.id,oneri_id:r.oneri?.id,mesaj:`${tl(g.tutar_kurus)} gelir kaydedildi. ${kalem?`Dağıtım önerisi: ${kalem}.`:"Dolduracak zarf yok; Atanmamış'ta kalır."} Onaylayayım mı?`};
}
async function dazaiOnayla(env,b,bugun){
  const karar=b.karar;if(karar!=="onayla"&&karar!=="reddet")throw new Hata("Karar onayla ya da reddet olmalı.");
  let id=Number(String(b.oneri_id??"").replace(/^oneri:/,""));
  if(!Number.isInteger(id)||id<=0){
    if(!b.tur)throw new Hata("Hangi öneri? oneri_id ya da tur gerekli.");
    const rows=await hepsi(env,"SELECT id FROM oneriler WHERE durum='bekliyor' AND tur=? ORDER BY id",String(b.tur));
    if(!rows.length)throw new Hata("Bu türde bekleyen öneri yok.");
    if(rows.length>1)throw new Hata(`Bu türde ${rows.length} bekleyen öneri var; hangisi? id: ${rows.map(r=>r.id).join(", ")}.`);
    id=rows[0].id;
  }
  const row=await env.DB.prepare("SELECT * FROM oneriler WHERE id=?").bind(id).first();
  if(!row)throw new Hata("Öneri bulunamadı.");
  const v=await veriYukle(env),detay=JSON.parse(row.detay_json),zarfAd=new Map(v.zarflar.map(z=>[z.id,z.ad]));
  const baslik=oneriGorunum({id,tur:row.tur,detay},{durum:v.durum,zarfAd,merdiven:v.merdiven,mctx:v.mctx}).baslik;
  let duzenleme=null;
  if(karar==="onayla"&&row.tur==="dagitim"&&b.tutar!=null&&String(b.tutar).trim()!==""){
    const diger=(await hepsi(env,"SELECT detay_json FROM oneriler WHERE durum='bekliyor' AND tur='dagitim' AND id<>?",id)).map(r=>JSON.parse(r.detay_json));
    const tutar=harcamaDogrula({tutar:b.tutar,aciklama:"-"},bugun).tutar_kurus;
    duzenleme={tutar:tl(tutar).replace(/[^\d.,]/g,""),kalemler:dagitimOner(tutar,bekleyenDus(v.durum(detay.ay),diger)).kalemler.map(k=>({zarf_id:k.zarf_id,tutar:(k.tutar/100).toFixed(2)}))};
  }
  const r=await oneriKarar(env,{id,karar,duzenleme},bugun);
  if(r.status!==200)return r;
  return json({ok:true,mesaj:`${karar==="onayla"?"Onaylandı":"Reddedildi"}: ${baslik}`});
}
async function dazaiApi(req,env,url,bugun){
  const key=req.headers.get("x-dazai-key")||"";
  if(!env.DAZAI_KEY||!key||!(await safeEqual(key,env.DAZAI_KEY)))return json({error:"Yetkisiz."},401);
  const p=url.pathname,m=req.method;
  try{
    if(p==="/api/dazai/bugun"&&m==="GET")return json(await dazaiBugun(env,url,bugun));
    if(m==="POST"){
      const b=await dazaiGovde(req);
      if(p==="/api/dazai/harcama")return json(await dazaiHarcama(env,b,bugun));
      if(p==="/api/dazai/gelir")return json(await dazaiGelir(env,b,bugun));
      if(p==="/api/dazai/onayla")return await dazaiOnayla(env,b,bugun);
    }
  }catch(e){if(e instanceof Hata)return json({error:e.message},400);throw e;}
  return json({error:"Bulunamadı."},404);
}
```

(d) `api` fonksiyonunda `/api/login` satırından hemen sonra şu satırı ekle:
```js
  if(p.startsWith("/api/dazai/"))return dazaiApi(req,env,url,bugun);
```

Not: `duzenleme.tutar` ve `kalemler` değerleri `uygulaSql` içinde `tutarDogrula` ile yeniden okunur. Bu yüzden TL metni olarak verilir: `tl()` çıktısındaki "₺" ve "−" ayıklanır, kalemler `"1000.00"` biçiminde yazılır.

- [ ] **Adım 4: Duman testini çalıştır ve geçtiğini gör**

Önce 2. adımdaki 1. terminal komutunu yeniden çalıştır (durumu temizle, şemaları uygula, `npm run dev`). Ardından:
Çalıştır: `npm run duman; npm test`
Beklenen: `Duman testi GEÇTİ` görülür ve 31 test GEÇER.

- [ ] **Adım 5: Commit**

```bash
git add diogenes/app/src/worker.js diogenes/app/scripts/duman.mjs
git commit -m "Diogenes: /api/dazai uclari (bugun, harcama, gelir, onayla)"
```

---

### Görev 3: Aurelius saf parçalar (gövdeler, bağlantı, satırlar) ve testler

**Dosyalar:**
- Değiştir: `D:\Claude\Aurelius\lib\jarvis\isaretle-govde.ts` (sonuna ekle), `lib/jarvis/baglanti.ts`, `lib/jarvis/gunluk.ts`, `tests/dazai.ts:153`, `tests/jarvis.ts`
- Oluştur: `tests/diogenes.ts`

**Arayüzler:**
- Tüketir: `dedupeKey`, `parseAmount`, `parseDay` (`lib/jarvis/tool-helpers`).
- Üretir:
  - `paraGovdesi(a, today, nowMs) → {yol:"gelir"|"harcama"; body} | string`
  - `onayGovdesi(a) → Record<string,unknown> | string`
  - `diogenesGonder(yol:"harcama"|"gelir"|"onayla", body, deps) → Promise<string>`
  - `BAGLANTILAR` artık `diogenes` girdisini de içerir.
  - `UygulamaSonucu` (ok dalı) isteğe bağlı `satirlar?: string[]` alanını taşır.

- [ ] **Adım 1: Başarısız testleri yaz**

`D:\Claude\Aurelius\tests\diogenes.ts`:
```ts
import assert from 'node:assert/strict';
export async function diogenesTests(){
const {paraGovdesi,onayGovdesi}=await import('../lib/jarvis/isaretle-govde');
// harcama: etiket ve zarf geçer; istek_id zarf hariç içerikten (zarf sorusunun cevabı aynı anahtarı üretir)
const p1=paraGovdesi({tutar:'200',aciklama:'Market',tur:'ihtiyaç',etiket:'market'},'2026-12-08',0) as {yol:string;body:Record<string,unknown>};
assert.equal(p1.yol,'harcama');assert.equal(p1.body.tutar,200);assert.equal(p1.body.etiket,'market');assert.equal(p1.body.tarih,'2026-12-08');
assert.match(String(p1.body.istek_id),/^dazai-para-2026-12-08-/);assert.ok(p1.body.onceki);assert.equal(p1.body.zarf,undefined);
const p2=paraGovdesi({tutar:'200',aciklama:'Market',tur:'ihtiyaç',etiket:'market',zarf:'Yemek'},'2026-12-08',0) as {yol:string;body:Record<string,unknown>};
assert.equal(p2.body.istek_id,p1.body.istek_id,'zarf anahtarı değiştirmez');assert.equal(p2.body.zarf,'Yemek');
// gelir: etiket ve zarf gönderilmez
const p3=paraGovdesi({tutar:'4.000',aciklama:'Burs',tur:'gelir',zarf:'Kira'},'2026-12-08',0) as {yol:string;body:Record<string,unknown>};
assert.equal(p3.yol,'gelir');assert.equal(p3.body.tutar,4000);assert.equal(p3.body.zarf,undefined);
assert.equal(paraGovdesi({tutar:'abc',aciklama:'x'},'2026-12-08',0),'Tutarı anlayamadım: "abc".');
assert.equal(paraGovdesi({tutar:'5',aciklama:'x',tarih:'saçma'},'2026-12-08',0),'Tarihi anlayamadım: "saçma".');
assert.equal(paraGovdesi({tutar:'5',aciklama:'x',tur:'hediye'},'2026-12-08',0),'Tür ihtiyaç, istek, yatırım ya da gelir olmalı.');
assert.equal((paraGovdesi({tutar:'5',etiket:'kahve'},'2026-12-08',0) as {body:Record<string,unknown>}).body.aciklama,'kahve','açıklama yoksa etiket');
// onay: "oneri:5" ya da 5; tür ile; farklı tutar
assert.deepEqual(onayGovdesi({oneri:'oneri:5',karar:'Onayla'}),{karar:'onayla',oneri_id:5});
assert.deepEqual(onayGovdesi({oneri:7,karar:'reddet'}),{karar:'reddet',oneri_id:7});
assert.deepEqual(onayGovdesi({tur:'aktarim',karar:'onayla',tutar:'1.500'}),{karar:'onayla',tur:'aktarim',tutar:1500});
assert.equal(onayGovdesi({oneri:5,karar:'belki'}),'Onaylayayım mı, reddedeyim mi?');
assert.equal(onayGovdesi({karar:'onayla'}),"Hangi öneri? gunun_isleri listesindeki oneri id'sini ver.");
// bağlantı: yol, başlık, cümle aynen; anahtar yok; 401; ulaşılamadı; hata cümlesi
const {diogenesGonder,BAGLANTILAR}=await import('../lib/jarvis/baglanti');
assert.ok(BAGLANTILAR.some(b=>b.app==='diogenes'&&b.url==='https://diogenes.diyarross.com'));
const cevap=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const giden:{url:string;init:RequestInit}[]=[];
assert.equal(await diogenesGonder('harcama',{tutar:1},{fetch:async(url,init)=>{giden.push({url,init});return cevap(200,{mesaj:'200 ₺ Market Yemek zarfına yazıldı.'});},anahtar:()=>'k'}),'200 ₺ Market Yemek zarfına yazıldı.');
assert.equal(giden[0].url,'https://diogenes.diyarross.com/api/dazai/harcama');
assert.equal((giden[0].init.headers as Record<string,string>)['x-dazai-key'],'k');
assert.equal(await diogenesGonder('gelir',{},{fetch:async()=>{throw new Error('çağrılmamalı');},anahtar:()=>undefined}),'Diogenes bağlantısı kurulmamış.');
assert.equal(await diogenesGonder('onayla',{},{fetch:async()=>cevap(401,{error:'Yetkisiz.'}),anahtar:()=>'k'}),'Diogenes bağlantısı kurulmamış.');
assert.equal(await diogenesGonder('onayla',{},{fetch:async()=>cevap(409,{error:'Bu öneri için zaten karar verilmiş.'}),anahtar:()=>'k'}),'Bu öneri için zaten karar verilmiş.');
assert.equal(await diogenesGonder('harcama',{},{fetch:async()=>{throw new Error('ağ');},anahtar:()=>'k'}),"Diogenes'e şu an ulaşılamadı.");
// satirlar: parseBugun taşır, uygulama özetinde ve Dazai metninde görünür
const {parseBugun,uygulamaSatirlari,birlestir,gunlukMetin}=await import('../lib/jarvis/gunluk');
const dg=parseBugun('diogenes','Diogenes',{ozet:'Atanmamış 1.200 ₺',satirlar:['Kira: 9.000 ₺ kaldı (aylık 10.000 ₺)',5,'x'.repeat(300)],maddeler:[{id:'oneri:6',baslik:'Burs: 4.000 ₺ geldi mi?',tur:'onay',durum:'bekliyor',ayrinti:'Kira 1.000 ₺'}]});
assert.ok(dg.ok);
if(dg.ok){assert.deepEqual(dg.satirlar,['Kira: 9.000 ₺ kaldı (aylık 10.000 ₺)','x'.repeat(200)],'metin olmayan atılır, uzun kısalır');}
assert.deepEqual(uygulamaSatirlari(dg),['Atanmamış 1.200 ₺','Kira: 9.000 ₺ kaldı (aylık 10.000 ₺)','x'.repeat(200),'Burs: 4.000 ₺ geldi mi? (Kira 1.000 ₺): bekliyor']);
assert.match(gunlukMetin(birlestir([dg],[],[])),/## Diogenes · Atanmamış 1\.200 ₺\n- \[bekliyor\] Burs: 4\.000 ₺ geldi mi\?: Kira 1\.000 ₺ · id oneri:6\nKira: 9\.000 ₺ kaldı/);
const bos=parseBugun('kleanthes','Kleanthes',{ozet:'',maddeler:[]});
assert.ok(bos.ok&&bos.satirlar===undefined,'satirlar yoksa alan da yok (eski cevaplar aynı kalır)');
}
```

`tests/dazai.ts:153` satırındaki beklenen listeyi şununla değiştir:
```ts
assert.deepEqual(BAGLANTILAR.map(b=>b.app),['kleanthes','zenon','epiktetos','diogenes']);
```

`tests/jarvis.ts` dosyasında `import {dazaiTests,healthTests,gunlukTests} from './dazai';` satırının altına şunu ekle:
```ts
import {diogenesTests} from './diogenes';
```
Aynı dosyada `await gunlukTests();` satırının altına şunu ekle:
```ts
await diogenesTests();
```

- [ ] **Adım 2: Testleri çalıştır ve başarısız olduğunu gör**

Çalıştır: `cd D:\Claude\Aurelius; node scripts/test-jarvis.mjs`
Beklenen: Test BAŞARISIZ olur. Derleme `paraGovdesi`/`diogenesGonder`'in dışa aktarılmadığını söyler ya da `BAGLANTILAR` beklentisi tutmaz.

- [ ] **Adım 3: Kodu yaz**

`lib/jarvis/isaretle-govde.ts`:
- İlk satırdaki içe aktarmayı şununla değiştir: `import {dedupeKey,parseAmount,parseDay} from "@/lib/jarvis/tool-helpers";`
- Dosyanın sonuna şunu ekle:
```ts
const metin=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):typeof v==="number"?String(v):"";
const PARA_TURLERI=new Set(["ihtiyaç","ihtiyac","istek","yatırım","yatirim","gelir"]);
// para_kaydet → Diogenes. Gelir /gelir'e, diğerleri /harcama'ya. istek_id zarf HARİÇ içerikten üretilir:
// Diogenes "hangi zarf" diye sorduğunda aynı söyleyiş zarfla yeniden gelir ve aynı kayıt zarfa taşınır.
export function paraGovdesi(a:Record<string,unknown>,today:string,nowMs:number):{yol:"gelir"|"harcama";body:Record<string,unknown>}|string{
  const tur=metin(a.tur,20).toLocaleLowerCase("tr-TR"),gelir=tur==="gelir";
  if(tur&&!PARA_TURLERI.has(tur))return "Tür ihtiyaç, istek, yatırım ya da gelir olmalı.";
  const tutar=parseAmount(a.tutar);if(tutar===null)return `Tutarı anlayamadım: "${metin(a.tutar,40)}".`;
  const tarih=metin(a.tarih,40),day=parseDay(tarih,today);if(!day)return `Tarihi anlayamadım: "${tarih}".`;
  const etiket=metin(a.etiket,20).toLocaleLowerCase("tr-TR"),aciklama=metin(a.aciklama,80)||etiket||(gelir?"Gelir":"Harcama");
  const icerik={tutar,aciklama,gelir};
  const body:Record<string,unknown>={istek_id:dedupeKey("para",day,icerik,nowMs),onceki:dedupeKey("para",day,icerik,nowMs,-1),tutar,aciklama,tarih:day};
  if(!gelir){if(etiket)body.etiket=etiket;const zarf=metin(a.zarf,40);if(zarf)body.zarf=zarf;}
  return {yol:gelir?"gelir":"harcama",body};
}
// diogenes_onayla → Diogenes /onayla. oneri "oneri:5" ya da 5; yoksa tür (o türde tek bekleyen öneri).
export function onayGovdesi(a:Record<string,unknown>):Record<string,unknown>|string{
  const karar=metin(a.karar,10).toLocaleLowerCase("tr-TR");
  if(karar!=="onayla"&&karar!=="reddet")return "Onaylayayım mı, reddedeyim mi?";
  const ham=metin(a.oneri,20).replace(/^oneri:/,""),tur=metin(a.tur,20);
  if(!/^\d+$/.test(ham)&&!tur)return "Hangi öneri? gunun_isleri listesindeki oneri id'sini ver.";
  const body:Record<string,unknown>={karar};
  if(/^\d+$/.test(ham))body.oneri_id=Number(ham);else body.tur=tur;
  if(a.tutar!==undefined&&a.tutar!==null&&a.tutar!==""){const t=parseAmount(a.tutar);if(t===null)return `Tutarı anlayamadım: "${metin(a.tutar,40)}".`;body.tutar=t;}
  return body;
}
```

`lib/jarvis/baglanti.ts`:
- `BAGLANTILAR` satırını şununla değiştir:
```ts
export const BAGLANTILAR=[{app:"kleanthes",ad:"Kleanthes",url:"https://kleanthes.diyarross.com"},{app:"zenon",ad:"Zenon",url:"https://zenon.diyarross.com"},{app:"epiktetos",ad:"Epiktetos",url:"https://epiktetos.diyarross.com"},{app:"diogenes",ad:"Diogenes",url:"https://diogenes.diyarross.com"}];
```
- Dosyanın sonuna şunu ekle:
```ts
// Diogenes'in kendi uçları (harcama, gelir, onayla). Cümleyi Diogenes kurar; Dazai aynen söyler.
export async function diogenesGonder(yol:"harcama"|"gelir"|"onayla",body:Record<string,unknown>,deps:BaglantiDeps):Promise<string>{
  const key=deps.anahtar("diogenes");if(!key)return "Diogenes bağlantısı kurulmamış.";
  try{
    const r=await deps.fetch(`https://diogenes.diyarross.com/api/dazai/${yol}`,{method:"POST",headers:{"x-dazai-key":key,"Content-Type":"application/json"},body:JSON.stringify(body),signal:zaman(deps,2000)});
    const d=await r.json().catch(()=>({})) as {mesaj?:string;error?:string};
    if(r.status===401)return "Diogenes bağlantısı kurulmamış.";
    return r.ok?d.mesaj||"Diogenes'e kaydedildi.":d.error||`Diogenes'e yazılamadı (${r.status}).`;
  }catch{return "Diogenes'e şu an ulaşılamadı.";}
}
```

`lib/jarvis/gunluk.ts`:
- `UygulamaSonucu` tipini şununla değiştir:
```ts
export type UygulamaSonucu={app:string;ad:string;ok:true;ozet:string;maddeler:Madde[];satirlar?:string[]}|{app:string;ad:string;ok:false;neden:string};
```
- `parseBugun`'un `return` satırını şununla değiştir:
```ts
  const satirlar=Array.isArray((j as {satirlar?:unknown}).satirlar)?((j as {satirlar:unknown[]}).satirlar).map(s=>str(s,200)).filter((s):s is string=>!!s).slice(0,20):[];
  return {app,ad,ok:true,ozet:str(j.ozet,120)||"",maddeler:j.maddeler.map(madde).filter((m):m is Madde=>!!m).slice(0,40),...(satirlar.length?{satirlar}:{})};
```
- `gunlukMetin` içindeki uygulama satırını (`parts.push(\`## ${s.ad}...`) şununla değiştir:
```ts
    parts.push(`## ${s.ad}${s.ozet?` · ${s.ozet}`:""}\n${s.maddeler.map(m=>`- [${DURUM_TR[m.durum]}] ${etiket(m)}${m.ayrinti?`: ${m.ayrinti}`:""} · id ${m.id}`).join("\n")||"Madde yok."}${s.satirlar?.length?`\n${s.satirlar.join("\n")}`:""}`);
```
- `uygulamaSatirlari`'nın `return` satırını şununla değiştir:
```ts
  return [...(s.ozet?[s.ozet]:[]),...(s.satirlar??[]),...s.maddeler.map(m=>`${m.baslik}${m.ayrinti?` (${m.ayrinti})`:""}: ${durum(m)}`)];
```

- [ ] **Adım 4: Testleri çalıştır ve geçtiğini gör**

Çalıştır: `node scripts/test-jarvis.mjs`
Beklenen: `Jarvis tests passed.`

- [ ] **Adım 5: Commit** (Aurelius deposunda)

```bash
cd D:\Claude\Aurelius
git add lib/jarvis/isaretle-govde.ts lib/jarvis/baglanti.ts lib/jarvis/gunluk.ts tests/diogenes.ts tests/dazai.ts tests/jarvis.ts
git commit -m "Dazai: Diogenes govdeleri, baglanti ve satirlar alani"
```

---

### Görev 4: Aurelius bağlantısı (araçlar, özet, talimat, binding)

**Dosyalar:**
- Değiştir: `lib/jarvis/tools.ts` (`para_kaydet`, yeni `diogenes_onayla`), `lib/jarvis/agent-config.ts`, `lib/jarvis/prompt.ts`, `lib/jarvis/sources.ts`, `lib/jarvis/app-fetch.ts`, `cloudflare-env.d.ts`, `vite.config.ts`, `tests/diogenes.ts`

**Arayüzler:**
- Tüketir: Görev 3'teki `paraGovdesi`, `onayGovdesi`, `diogenesGonder` ve `baglantiDeps().anahtar("diogenes")`.
- Üretir: `diogenes_onayla` aracı `{oneri?, tur?, karar, tutar?}` alır. `para_kaydet` aracına `zarf` alanı eklenir.

- [ ] **Adım 1: Başarısız testi ekle** (`tests/diogenes.ts`, `diogenesTests` fonksiyonunun kapanış `}` satırından önce)

```ts
const {TOOL_SPECS}=await import('../lib/jarvis/agent-config');
const spec=(n:string)=>TOOL_SPECS.find(t=>t.name===n);
assert.ok(spec('diogenes_onayla'),'diogenes_onayla aracı tanımlı');
assert.deepEqual(spec('diogenes_onayla')!.required,['karar']);
assert.ok(spec('para_kaydet')!.props.zarf,'para_kaydet zarf alır');
assert.match(spec('para_kaydet')!.description,/Diogenes/);
assert.match(spec('gunun_isleri')!.description,/Diogenes/);
const {jarvisPrompt}=await import('../lib/jarvis/prompt');
assert.match(jarvisPrompt(),/hangi zarf/i,'zarf sorusu talimatta');
assert.match(jarvisPrompt(),/diogenes_onayla/,'onay aracı talimatta');
const {HOSTS_TEST}=await import('../lib/jarvis/app-fetch-hosts');
assert.equal(HOSTS_TEST['diogenes.diyarross.com'],'DIOGENES');
```

`app-fetch.ts`, `cloudflare:workers` modülünü içe aktardığı için Node testinde yüklenemez. Bu yüzden host listesi saf bir dosyaya taşınır: `lib/jarvis/app-fetch-hosts.ts`.

- [ ] **Adım 2: Testi çalıştır ve başarısız olduğunu gör**

Çalıştır: `node scripts/test-jarvis.mjs`
Beklenen: BAŞARISIZ. `diogenes_onayla aracı tanımlı` kontrolü tutmaz ya da `app-fetch-hosts` modülü bulunamaz.

- [ ] **Adım 3: Kodu yaz**

`lib/jarvis/app-fetch-hosts.ts` (yeni dosya):
```ts
// Alan adı → service binding adı (saf; testte de yüklenir).
export type Binding="KLEANTHES"|"EPIKTETOS"|"SENECA"|"ZENON"|"DIOGENES";
export const HOSTS_TEST:Record<string,Binding>={"zenon.diyarross.com":"ZENON","kleanthes.diyarross.com":"KLEANTHES","epiktetos.diyarross.com":"EPIKTETOS","seneca.diyarross.com":"SENECA","diogenes.diyarross.com":"DIOGENES","kleanthes.diyaross.workers.dev":"KLEANTHES","epiktetos.diyaross.workers.dev":"EPIKTETOS","seneca.diyaross.workers.dev":"SENECA","diogenes.diyaross.workers.dev":"DIOGENES"};
```

`lib/jarvis/app-fetch.ts`: `type Binding=…` ve `const HOSTS…` satırlarını şu iki satırla değiştir:
```ts
import {HOSTS_TEST as HOSTS} from "@/lib/jarvis/app-fetch-hosts";
// (Diogenes de service binding ile: DIOGENES.)
```
Açıklama yorumundaki "Kleanthes, Epiktetos ve Seneca'ya" ifadesini "Kleanthes, Epiktetos, Seneca, Zenon ve Diogenes'e" yap.

`cloudflare-env.d.ts`:
- `KLEANTHES_DAZAI_KEY?:string;` ifadesinin yanına `DIOGENES_DAZAI_KEY?:string;` ekle.
- `ZENON?:Fetcher;` ifadesinin yanına `DIOGENES?:Fetcher;` ekle.

`vite.config.ts`: `services` listesine `{ binding: "ZENON", service: "zenon" },` satırının altına şunu ekle:
```ts
          { binding: "DIOGENES", service: "diogenes" },
```

`lib/jarvis/sources.ts`:
- `baglantiDeps` içindeki `keys` nesnesine `diogenes:env.DIOGENES_DAZAI_KEY` ekle:
```ts
  const keys:Record<string,string|undefined>={kleanthes:env.KLEANTHES_DAZAI_KEY,zenon:env.ZENON_DAZAI_KEY,epiktetos:env.EPIKTETOS_DAZAI_KEY,diogenes:env.DIOGENES_DAZAI_KEY};
```
- `titles` içindeki `diogenes:"Diogenes (hisse, kâğıt hesap)"` değerini `diogenes:"Diogenes (bütçe ve piyasa)"` yap.
- `appSummary` içindeki `diogenes,` girdisini şununla değiştir:
```ts
    diogenes:async()=>{
      const [[b],piyasa]=await Promise.all([bugunTopla(day,baglantiDeps(),["diogenes"]),diogenes().catch(()=>["Piyasa verisi okunamadı."])]);
      return [...uygulamaSatirlari(b),...piyasa.map(s=>`Piyasa: ${s}`)];
    },
```

`lib/jarvis/tools.ts`:
- İçe aktarmalar:
  - `import {bugunTopla,isaretleGonder} from "@/lib/jarvis/baglanti";` satırını `import {bugunTopla,diogenesGonder,isaretleGonder} from "@/lib/jarvis/baglanti";` yap.
  - `isaretle-govde` içe aktarmasına `onayGovdesi,paraGovdesi` ekle.
- `async para_kaydet(owner,a,today){` satırının hemen altına şunu ekle:
```ts
    // Diogenes bağlıysa para Diogenes'e yazılır (zarf bütçesi). Bağlı değilse eski Aurelius defteri.
    if(baglantiDeps().anahtar("diogenes")){const g=paraGovdesi(a,today,Date.now());return typeof g==="string"?g:diogenesGonder(g.yol,g.body,baglantiDeps());}
```
- `async gunun_isleri(` satırından önce şu aracı ekle:
```ts
  async diogenes_onayla(_owner,a){
    const body=onayGovdesi(a);
    return typeof body==="string"?body:diogenesGonder("onayla",body,baglantiDeps());
  },
```

`lib/jarvis/agent-config.ts`:
- `para_kaydet` satırını şununla değiştir:
```ts
  {name:"para_kaydet",description:"Harcamayı ya da geliri Diogenes'e (zarf bütçesi) yazar (ör. '200 liralık market'). Diogenes 'hangi zarf' diye sorarsa kullanıcıya sor, sonra aynı tutar ve açıklamayla zarf vererek yeniden çağır. Gelir bir dağıtım önerisi olur; onay için diogenes_onayla.",props:{tutar:s("Tutar, TL (ör. 200 ya da 1.250,50)"),aciklama:s("Ne için (ör. Market)"),tur:s("Tür",{enum:["ihtiyaç","istek","yatırım","gelir"]}),etiket:s("Alt kategori",{enum:["market","yemek","ulasim","giyim","bakim","fatura","kira","saglik","egitim","spor","eglence","dijital","taksit","diger"]}),zarf:s("Zarf adı (kullanıcı söylediyse ya da Diogenes sorduysa)"),tarih:s("Tarih; boşsa bugün")},required:["tutar","aciklama"]},
```
- `gunun_isleri` satırının üstüne şunu ekle:
```ts
  {name:"diogenes_onayla",description:"Diogenes'te bekleyen bir öneriyi (gelir dağıtımı, abonelik, kaydırma, ay kapanışı) onaylar ya da reddeder. oneri: gunun_isleri'ndeki id (ör. oneri:5). Gelen para önerideki tutardan farklıysa tutar ver.",props:{oneri:s("Öneri id'si (ör. oneri:5)"),tur:s("oneri yoksa tür",{enum:["dagitim","abonelik","kaydirma","aktarim"]}),karar:s("Karar",{enum:["onayla","reddet"]}),tutar:s("Gelen tutar, TL (yalnız gelir önerisinde, farklıysa)")},required:["karar"]},
```
- `gunun_isleri` açıklamasında `Epiktetos: soru, tekrar kartları, okuma, ders çalışma)` ifadesini `Epiktetos: soru, tekrar kartları, okuma, ders çalışma; Diogenes: bekleyen bütçe önerileri, eksi zarflar, zarf kalanları)` yap.

`lib/jarvis/prompt.ts`:
- Para satırını (`- Para: "200 liralık market aldım" → para_kaydet …`) şununla değiştir:
```
- Para: "200 liralık market aldım" → para_kaydet (tutar 200, açıklama Market, tür ihtiyaç, etiket market). Kahve, dışarıda yemek, eğlence gibi keyfi harcamalar "istek"; maaş, burs, harçlık "gelir". Diogenes "hangi zarf" diye sorarsa zarfları say, kullanıcının seçtiği zarfla para_kaydet'i aynı tutar ve açıklamayla yeniden çağır. Gelir bir dağıtım önerisi olur: öneriyi söyle, kullanıcı "onayla" derse diogenes_onayla; gelen tutar farklıysa tutar ver. Bekleyen Diogenes önerilerini (gunun_isleri'nde oneri:<id>) kullanıcı onaylamadan onaylama.
```
- `Seneca (bahis) ve Diogenes (hisse) için dürüst ol` ifadesini `Seneca (bahis) ve Diogenes'in Piyasa bölümü (hisse) için dürüst ol` yap.

- [ ] **Adım 4: Testleri ve derlemeyi çalıştır**

Çalıştır: `node scripts/test-jarvis.mjs; node scripts/run-framework.mjs build`
Beklenen: `Jarvis tests passed.` ve derleme hatasız biter. `dist/server/wrangler.json` dosyasında `DIOGENES` servisi yalnızca `AURELIUS_WORKER_NAME` ile derlenince görünür. Bu durum yerelde normaldir.

- [ ] **Adım 5: Commit** (Aurelius deposunda)

```bash
git add lib/jarvis/tools.ts lib/jarvis/agent-config.ts lib/jarvis/prompt.ts lib/jarvis/sources.ts lib/jarvis/app-fetch.ts lib/jarvis/app-fetch-hosts.ts cloudflare-env.d.ts vite.config.ts tests/diogenes.ts
git commit -m "Dazai: Diogenes baglantisi (para_kaydet yonlendirme, diogenes_onayla, ozet, binding)"
```

---

### Görev 5: Yayına alma ve anahtar (Diyar'ın onayıyla)

**Dosyalar:**
- Değiştir: `diogenes/docs/superpowers/specs/2026-11-27-diogenes-finans-asistani-design.md` (§12'ye Aşama 2 notları)

- [ ] **Adım 1: Onay al.** Diyar'a şunları söyle ve "evet" demeden devam etme:
  - Diogenes uzak veritabanına `0002_dazai.sql` uygulanacak ve Diogenes yeniden yayına alınacak.
  - Aurelius yeniden yayına alınacak. `DIOGENES` binding'i eklenecek.
  - Yeni bir `DAZAI_KEY` üretilip iki worker'a verilecek. Bundan sonra Dazai'nin para kayıtları Aurelius defterine değil Diogenes'e gidecek (karar 7). Diyar beklemek isterse 4. adım atlanır.

- [ ] **Adım 2: Diogenes şemasını ve kodunu yayınla**

Çalıştır: `cd D:\Claude\diogenes\app; node node_modules/wrangler/bin/wrangler.js d1 migrations apply diogenes --remote; npm run deploy`
Beklenen: `0002_dazai.sql` ✅ ve `Uploaded diogenes`.

- [ ] **Adım 3: Aurelius'u yayınla**

Çalıştır: `cd D:\Claude\Aurelius; node scripts/deploy.mjs`
Beklenen: Yükleme başarılı olur ve bağlamalar arasında `env.DIOGENES (diogenes)` görünür.

- [ ] **Adım 4: Anahtarı üret ve iki worker'a ver** (değer ekrana yazılmaz, dosyaya yazılmaz)

```bash
cd /d/Claude/diogenes/app
K=$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))")
printf %s "$K" | node node_modules/wrangler/bin/wrangler.js secret put DAZAI_KEY
cd /d/Claude/Aurelius && printf %s "$K" | node node_modules/wrangler/bin/wrangler.js secret put DIOGENES_DAZAI_KEY --name aurelius
unset K
```
Beklenen: İki `Success! Uploaded secret` satırı görülür.

- [ ] **Adım 5: Canlı ortamda kontrol et**

Çalıştır: `curl -s -o /dev/null -w "%{http_code}" https://diogenes.diyarross.com/api/dazai/bugun`
Beklenen: `401`.

Ardından Diyar'dan şunları iste:
- Dazai ekranında Ayarlar → "Dazai'yi güncelle"ye bassın. Araç sayısı bir artmış olmalı (`diogenes_onayla`).
- Dazai'ye "bugün ne var" desin. Diogenes bölümünde zarf kalanları ve bekleyen öneriler okunmalı.
- Dazai'ye "50 liralık market aldım" desin. Dazai zarfı sormalı ya da eşleşen zarfa yazmalı. Kayıt Diogenes'in Geçmiş ekranında görünmeli.

- [ ] **Adım 6: Belgeleri güncelle ve commit et**

Spec §12'nin sonuna bu planın "Spec'e göre uygulama kararları" bölümündeki 9 maddeyi "Aşama 2" alt başlığıyla ekle.
```bash
git add diogenes/docs/superpowers/specs/2026-11-27-diogenes-finans-asistani-design.md
git commit -m "Diogenes: Asama 2 uygulama notlari"
```
Push ayrıca onaya bağlıdır.
