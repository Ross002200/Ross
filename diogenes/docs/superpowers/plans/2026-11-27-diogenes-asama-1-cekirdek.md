# Diogenes Aşama 1 · Çekirdek — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Hedef:** Diyar'ın zarf bütçesini yöneten Diogenes'i (Worker + D1 + PWA) kurup elle kullanılabilir hale getirmek. Bu aşamada Dazai bağlantısı ve Aurelius'tan taşıma yok.

**Mimari:** Uygulama tek bir Cloudflare Worker'dan oluşur (`diogenes/app/`), Kleanthes ile aynı düzende.
- Bütün hesaplar `src/core.js` içinde saf fonksiyonlardır ve `node --test` ile test edilir. Aynı dosya tarayıcıya da kopyalanır.
- `src/worker.js` yalnızca HTTP, D1 ve zamanlayıcıyla ilgilenir.
- Arayüz `public/` altında, derleme adımı olmayan vanilla JS ile yazılır.

**Teknoloji:** Cloudflare Workers, D1 (SQLite), wrangler 4.92.0, Node 22+ (`node --test`), vanilla JS ES modülleri.

**Spec:** `D:\Claude\diogenes\docs\superpowers\specs\2026-11-27-diogenes-finans-asistani-design.md` (Aşama 1 = §2–§5, §8–§9 ve §10'un 1. maddesi)

## Genel Kısıtlar

- Bütün metinler Türkçe olacak. Kullanıcıya gösterilen hata mesajları Türkçe ve açık olacak.
- Tutarlar D1'de **kuruş cinsinden tam sayı** olarak saklanır. API, kullanıcıdan TL alır (`"1.250,50"`, `1250.5`, `"15.000"`) ve `*_kurus` alanları döner.
- Tarihler `YYYY-AA-GG` biçiminde, Europe/Istanbul saatine göre tutulur.
- Diogenes kişiye özel al-sat ya da dağılım tavsiyesi vermez. Projeksiyonların yanında "tavsiye değil, hesap" notu bulunur.
- Hiçbir para işlemi kendiliğinden uygulanmaz. Her işlem bir öneri olarak bekler ve Diyar'ın onayıyla uygulanır. Doğrudan girilen harcama ve gelir kayıtları bunun dışındadır.
- Bağımlılık olarak yalnızca `wrangler` (devDependency) kullanılır. Çalışma zamanında hiçbir bağımlılık yoktur.
- Wrangler PowerShell'de `npx` ile değil, `node node_modules/wrangler/bin/wrangler.js` şeklinde çağrılır.
- **Commit, push, deploy ve secret girme işlemleri Diyar'ın onayına bağlıdır.** Commit adımları için plan yürütülmeden önce toplu onay istenir. Deploy (Görev 10) her zaman ayrıca onaylanır. Gerçek şifreyi Diyar kendisi girer.
- Mevcut hisse taramasına (`diogenes/*.html`, `scan/`, `data/`, `bildirim/`, `.github/workflows/diogenes-*.yml`) dokunulmaz.

## Spec'e göre uygulama kararları

Bu kararlar spec'in açık bıraktığı noktaları kapatır ve spec'in sonuna "Uygulama notları" olarak eklenir.

1. **Piyasa sekmesi:** Eski ekranlar GitHub Pages'te (`https://ross002200.github.io/Ross/diogenes/`) Actions verisiyle çalışmaya devam eder. Piyasa sekmesi yalnızca bu adrese bağlantı verir. Dosyalar taşınmaz, çünkü taşınırlarsa veri akışı bozulur.
2. **`aktarimlar` tablosu:** Ay sonunda merdivene yapılan aktarımlar bu tabloda kayıt altına alınır.
3. **Merdivende `tamam` alanı tutulmaz.** Bir basamak, `biriken >= etkin hedef` olduğunda tamam sayılır ve bu her seferinde hesaplanır. Kurallı basamakların hedefi de hesaplanır: `kural='borc'` için toplam kalan borç, `kural='acil3'` için aylık zarf toplamının 3 katı.
4. **Atanmamış tutar kümülatiftir.** Hesap: o aya kadarki tüm gelirler − dağıtımlar − zarfsız harcamalar − zarfsız aktarımlar.
5. **Zarf kalanı aylıktır.** Hesap: o ayın dağıtımları − harcamaları − aktarımları.
6. **Ay kapanışı aktarım önerisiyle yapılır.**
   - Önce eksi zarflar kapatılır. Bunun için para önce Atanmamış'tan, yetmezse en dolu zarflardan alınır.
   - **Onayla:** Kalan para merdivene gider.
   - **Reddet:** Zarflarda kalan para Atanmamış'a döner. Para kaybolmaz.
7. **Zamanlayıcı iki kez çalışır.**
   - `0 5 * * *` (İstanbul saatiyle 08:00): gelir ve abonelik önerilerini hazırlar. Kaçmış bir önceki ay kapanışı varsa onu da hazırlar.
   - `30 20 * * *` (İstanbul saatiyle 23:30): o gün ayın son günüyse ay kapanışı önerisini hazırlar.
8. **Kurulumdan önceki tarihler için öneri üretilmez.** Kurulum günü `ayarlar.baslangic` olarak kaydedilir ve bu tarihten önceki gelir, abonelik ve ay kapanışı önerileri atlanır.
9. **Zarf silinince pasif yapılır.** Geçmiş korunur. Zarfta o ay kalan para Atanmamış'a döner.
10. **Bildirimler Aşama 1'de yok.** Dazai (Aşama 2) sabah özetinde önerileri söyleyecek.
11. **Öneri onayı yarışa karşı korunur.** Onay önce `UPDATE … SET durum='isleniyor' WHERE durum='bekliyor'` ile öneriyi sahiplenir, sonra yazmaları tek bir D1 batch'i (transaction) ile yapar. Batch hata verirse öneri yeniden `bekliyor` durumuna döner.

## İnceleme Odağı

- **Aynı ayda iki gelir önerisinin aynı eksiği doldurmaya çalışması:** Kurulum günü birden fazla plan günü geçmiş olabilir. `gunlukOneriler`, ardışık önerilerin zarf eksiklerini birbirinden düşmelidir (Görev 5'teki test).
- **Merdiven boşken ay kapanışını onaylamak:** Kullanıcı "Önce hedef merdivenini kur." mesajını görmeli, öneri `bekliyor` durumunda kalmalı (Görev 5'teki test).
- **Bozuk tutar girişi** (`"12,345"`, `"abc"`, `"0"`, `"-5"`, 10 milyon TL üstü): Türkçe bir hata mesajıyla 400 dönmeli, kayıt oluşmamalı (Görev 1 testleri ve Görev 6'daki duman testi).
- **Aynı `istek_id` ile ikinci harcama** (çift dokunma): Kayıt çoğalmamalı (Görev 6'daki duman testi).
- **Ayın 31'inde gelen bir plan:** Şubat'ta ayın son gününe kaymalı (Görev 1'de `planGunu` testi).

---

## Dosya Yapısı

```
diogenes/app/
  package.json            test/build/dev/deploy komutları
  wrangler.json           worker, assets, D1, cron
  .gitignore              node_modules, .wrangler, .dev.vars
  migrations/0001_init.sql
  src/core.js             saf: para, tarih, doğrulama, ay durumu, dağıtım, kaydırma, merdiven, kapanış, öneriler, öneri SQL'i, görünüm
  src/worker.js           HTTP + oturum + D1 + zamanlayıcı
  scripts/build.mjs       src/core.js → public/core.js
  scripts/dev-vars.mjs    .dev.vars'a rastgele test şifresi/anahtar yazar (yoksa)
  scripts/duman.mjs       wrangler dev'e karşı uçtan uca duman testi
  tests/core.test.js
  public/index.html       kabuk + stil
  public/app.js           arayüz
  public/giris.html
  public/manifest.webmanifest, public/sw.js, public/icon*.{svg,png}
```

---

### Görev 1: İskelet, veritabanı şeması, para/tarih/doğrulama

**Dosyalar:**
- Oluştur: `diogenes/app/package.json`, `diogenes/app/wrangler.json`, `diogenes/app/.gitignore`, `diogenes/app/migrations/0001_init.sql`, `diogenes/app/src/core.js`, `diogenes/app/tests/core.test.js`

**Arayüzler:**
- Üretir: `Hata` (Error alt sınıfı), `MAX_KURUS`, `kurusa(v)→number|NaN`, `tl(kurus)→string`, `istanbulGun(Date)→"YYYY-AA-GG"`, `ayinSonGunu("YYYY-AA")→number`, `gunEkle(gun,n)`, `gecerliGun(v)→bool`, `planGunu(ay,gun)→"YYYY-AA-GG"`, `oncekiAy(ay)`, `ayAdi(ay)`, `tutarDogrula(v,{sifir?})→kurus`, `metinDogrula(v,ad,max)`, `gunDogrula(v,bugun)`, `sayiDogrula(v,ad,min,max)`

- [ ] **Adım 1: İskelet dosyalarını yaz**

`diogenes/app/package.json`:
```json
{
  "name": "diogenes",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/core.test.js",
    "build": "node scripts/build.mjs",
    "dev": "node scripts/build.mjs && node scripts/dev-vars.mjs && node node_modules/wrangler/bin/wrangler.js dev --test-scheduled",
    "duman": "node scripts/duman.mjs",
    "deploy": "node scripts/build.mjs && node node_modules/wrangler/bin/wrangler.js deploy"
  },
  "devDependencies": {
    "wrangler": "4.92.0"
  }
}
```

`diogenes/app/wrangler.json`. Buradaki `database_id` yerel geliştirme için geçici bir değerdir; Görev 10'da gerçek kimlikle değiştirilir.
```json
{
  "name": "diogenes",
  "main": "src/worker.js",
  "compatibility_date": "2026-05-15",
  "workers_dev": true,
  "assets": {"directory": "public","binding": "ASSETS","run_worker_first": true,"html_handling": "none","not_found_handling": "none"},
  "d1_databases": [{"binding": "DB","database_name": "diogenes","database_id": "00000000-0000-0000-0000-000000000000","migrations_dir": "migrations"}],
  "triggers": {"crons": ["0 5 * * *","30 20 * * *"]},
  "observability": {"enabled": true}
}
```

`diogenes/app/.gitignore`:
```
node_modules/
.wrangler/
.dev.vars
public/core.js
```

`diogenes/app/migrations/0001_init.sql`:
```sql
-- Diogenes: zarf bütçesi. Tutarlar kuruş (tam sayı), tarihler YYYY-AA-GG (İstanbul).
CREATE TABLE zarflar (id INTEGER PRIMARY KEY, ad TEXT NOT NULL, aylik_kurus INTEGER NOT NULL, sira INTEGER NOT NULL DEFAULT 0, aktif INTEGER NOT NULL DEFAULT 1, olusturma TEXT NOT NULL);
CREATE TABLE gelir_plani (id INTEGER PRIMARY KEY, ad TEXT NOT NULL, tutar_kurus INTEGER NOT NULL, gun INTEGER NOT NULL);
CREATE TABLE gelirler (id INTEGER PRIMARY KEY, plan_id INTEGER, tutar_kurus INTEGER NOT NULL, aciklama TEXT NOT NULL, tarih TEXT NOT NULL, oneri_id INTEGER);
CREATE TABLE dagitimlar (id INTEGER PRIMARY KEY, ay TEXT NOT NULL, zarf_id INTEGER NOT NULL, tutar_kurus INTEGER NOT NULL, oneri_id INTEGER, tarih TEXT NOT NULL);
CREATE TABLE harcamalar (id INTEGER PRIMARY KEY, istek_id TEXT NOT NULL UNIQUE, tutar_kurus INTEGER NOT NULL, aciklama TEXT NOT NULL, zarf_id INTEGER, tarih TEXT NOT NULL, kaynak TEXT NOT NULL, etiket TEXT NOT NULL DEFAULT '');
CREATE TABLE aktarimlar (id INTEGER PRIMARY KEY, ay TEXT NOT NULL, zarf_id INTEGER, merdiven_id INTEGER NOT NULL, tutar_kurus INTEGER NOT NULL, oneri_id INTEGER, tarih TEXT NOT NULL);
CREATE TABLE abonelikler (id INTEGER PRIMARY KEY, ad TEXT NOT NULL, tutar_kurus INTEGER NOT NULL, gun INTEGER NOT NULL, zarf_id INTEGER, aktif INTEGER NOT NULL DEFAULT 1);
CREATE TABLE borclar (id INTEGER PRIMARY KEY, ad TEXT NOT NULL, kalan_kurus INTEGER NOT NULL, aylik_kurus INTEGER NOT NULL, kalan_taksit INTEGER);
CREATE TABLE birikimler (id INTEGER PRIMARY KEY, tur TEXT NOT NULL, ad TEXT NOT NULL, tutar_kurus INTEGER NOT NULL);
CREATE TABLE merdiven (id INTEGER PRIMARY KEY, sira INTEGER NOT NULL, ad TEXT NOT NULL, kural TEXT, hedef_kurus INTEGER, biriken_kurus INTEGER NOT NULL DEFAULT 0);
CREATE TABLE oneriler (id INTEGER PRIMARY KEY, tur TEXT NOT NULL, anahtar TEXT NOT NULL UNIQUE, detay_json TEXT NOT NULL, durum TEXT NOT NULL DEFAULT 'bekliyor', olusturma TEXT NOT NULL, karar TEXT);
CREATE TABLE ayarlar (anahtar TEXT PRIMARY KEY, deger TEXT NOT NULL);
CREATE TABLE login_attempts (address TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX harcamalar_tarih ON harcamalar(tarih);
CREATE INDEX oneriler_durum ON oneriler(durum);
```

- [ ] **Adım 2: Başarısız testi yaz**

`diogenes/app/tests/core.test.js`:
```js
import {test} from "node:test";
import assert from "node:assert/strict";
import * as c from "../src/core.js";

test("kurusa: Türkçe ve sayısal tutarlar", () => {
  assert.equal(c.kurusa("1.250,50"),125050);
  assert.equal(c.kurusa("15.000"),1500000);
  assert.equal(c.kurusa("15000"),1500000);
  assert.equal(c.kurusa("1250.5"),125050);
  assert.equal(c.kurusa(1250.5),125050);
  assert.equal(c.kurusa("1.5"),150);
  assert.equal(c.kurusa(" 640 ₺ "),64000);
  assert.ok(Number.isNaN(c.kurusa("12,345")));
  assert.ok(Number.isNaN(c.kurusa("abc")));
  assert.ok(Number.isNaN(c.kurusa("")));
  assert.ok(Number.isNaN(c.kurusa(null)));
});

test("tl: biçim", () => {
  assert.equal(c.tl(125050),"1.250,50 ₺");
  assert.equal(c.tl(3500000),"35.000 ₺");
  assert.equal(c.tl(-30000),"−300 ₺");
  assert.equal(c.tl(0),"0 ₺");
});

test("tarih yardımcıları", () => {
  assert.equal(c.istanbulGun(new Date("2026-11-30T21:30:00Z")),"2026-12-01");
  assert.equal(c.ayinSonGunu("2026-02"),28);
  assert.equal(c.ayinSonGunu("2028-02"),29);
  assert.equal(c.gunEkle("2026-11-30",1),"2026-12-01");
  assert.equal(c.gecerliGun("2026-02-30"),false);
  assert.equal(c.gecerliGun("2026-02-28"),true);
  assert.equal(c.planGunu("2026-02",31),"2026-02-28");
  assert.equal(c.planGunu("2026-11",7),"2026-11-07");
  assert.equal(c.oncekiAy("2026-01"),"2025-12");
  assert.equal(c.ayAdi("2026-11"),"Kasım 2026");
});

test("tutarDogrula: geçersizler Türkçe hata verir", () => {
  assert.equal(c.tutarDogrula("640"),64000);
  assert.equal(c.tutarDogrula("0",{sifir:true}),0);
  assert.throws(()=>c.tutarDogrula("0"),{name:"Hata",message:"Tutar sıfır olamaz."});
  assert.throws(()=>c.tutarDogrula("-5"),{message:"Tutar negatif olamaz."});
  assert.throws(()=>c.tutarDogrula("abc"),{message:"Tutar okunamadı. Örnek: 1.250,50"});
  assert.throws(()=>c.tutarDogrula("10.000.001"),{message:"Tutar çok büyük (en çok 10.000.000 ₺)."});
});

test("metin, gün ve sayı doğrulama", () => {
  assert.equal(c.metinDogrula("  Market ","Açıklama",80),"Market");
  assert.throws(()=>c.metinDogrula("  ","Açıklama",80),{message:"Açıklama boş olamaz."});
  assert.throws(()=>c.metinDogrula("x".repeat(81),"Açıklama",80),{message:"Açıklama en çok 80 karakter olabilir."});
  assert.equal(c.gunDogrula("","2026-11-27"),"2026-11-27");
  assert.equal(c.gunDogrula("2026-11-20","2026-11-27"),"2026-11-20");
  assert.throws(()=>c.gunDogrula("20.11.2026","2026-11-27"),{message:"Tarih YYYY-AA-GG biçiminde olmalı."});
  assert.equal(c.sayiDogrula("12","Kalan taksit",0,600),12);
  assert.throws(()=>c.sayiDogrula("1,5","Kalan taksit",0,600),{message:"Kalan taksit 0 ile 600 arasında tam sayı olmalı."});
});
```

- [ ] **Adım 3: Testi çalıştır ve başarısız olduğunu gör**

Çalıştır: `cd D:\Claude\diogenes\app; node --test tests/core.test.js`
Beklenen: BAŞARISIZ, `Cannot find module '…/src/core.js'`

- [ ] **Adım 4: `src/core.js`'in ilk bölümünü yaz**

```js
// Diogenes çekirdeği (saf; sunucuda ve tarayıcıda çalışır). Tutarlar kuruş (tam sayı), tarihler YYYY-AA-GG (İstanbul).
export class Hata extends Error{constructor(m){super(m);this.name="Hata";}}
export const MAX_KURUS=1_000_000_000;

// "1.250,50" | "15.000" | "1250.5" | 1250.5 → kuruş; okunamazsa NaN.
export function kurusa(v){
  if(typeof v==="number")return Number.isFinite(v)?Math.round(v*100):NaN;
  if(typeof v!=="string")return NaN;
  let s=v.replace(/\s|₺/g,"").replace(/tl$/i,"");
  if(!s)return NaN;
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  if(!/^-?\d+(\.\d{1,2})?$/.test(s))return NaN;
  return Math.round(Number(s)*100);
}
export function tl(k){
  const s=(Math.abs(k)/100).toLocaleString("tr-TR",{minimumFractionDigits:k%100?2:0,maximumFractionDigits:2});
  return (k<0?"−":"")+s+" ₺";
}

export function istanbulGun(date){
  const f=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"});
  const o=Object.fromEntries(f.formatToParts(date).map(p=>[p.type,p.value]));
  return `${o.year}-${o.month}-${o.day}`;
}
export const ayinSonGunu=ay=>{const [y,m]=ay.split("-").map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate();};
export function gunEkle(g,n){const d=new Date(g+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export const gecerliGun=g=>typeof g==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(g)&&!Number.isNaN(Date.parse(g+"T00:00:00Z"))&&gunEkle(g,0)===g;
export const planGunu=(ay,gun)=>`${ay}-${String(Math.min(gun,ayinSonGunu(ay))).padStart(2,"0")}`;
export const oncekiAy=ay=>gunEkle(ay+"-01",-1).slice(0,7);
const AYLAR=["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
export const ayAdi=ay=>`${AYLAR[Number(ay.slice(5,7))-1]} ${ay.slice(0,4)}`;

export function tutarDogrula(v,{sifir=false}={}){
  const k=kurusa(v);
  if(!Number.isInteger(k))throw new Hata("Tutar okunamadı. Örnek: 1.250,50");
  if(k<0)throw new Hata("Tutar negatif olamaz.");
  if(k===0&&!sifir)throw new Hata("Tutar sıfır olamaz.");
  if(k>MAX_KURUS)throw new Hata("Tutar çok büyük (en çok 10.000.000 ₺).");
  return k;
}
export function metinDogrula(v,ad,max){
  const s=String(v??"").trim();
  if(!s)throw new Hata(`${ad} boş olamaz.`);
  if(s.length>max)throw new Hata(`${ad} en çok ${max} karakter olabilir.`);
  return s;
}
export function gunDogrula(v,bugun){
  if(v==null||v==="")return bugun;
  if(!gecerliGun(v))throw new Hata("Tarih YYYY-AA-GG biçiminde olmalı.");
  return v;
}
export function sayiDogrula(v,ad,min,max){
  const n=typeof v==="number"?v:/^-?\d+$/.test(String(v).trim())?Number(String(v).trim()):NaN;
  if(!Number.isInteger(n)||n<min||n>max)throw new Hata(`${ad} ${min} ile ${max} arasında tam sayı olmalı.`);
  return n;
}
```

- [ ] **Adım 5: Testi çalıştır ve geçtiğini gör**

Çalıştır: `cd D:\Claude\diogenes\app; node --test tests/core.test.js`
Beklenen: 5 test GEÇER, 0 başarısız.

- [ ] **Adım 6: wrangler'ı kur ve şemayı yerelde uygula**

Çalıştır: `cd D:\Claude\diogenes\app; npm install; node node_modules/wrangler/bin/wrangler.js d1 migrations apply diogenes --local`
Beklenen: `0001_init.sql` için ✅ görülür, hata yoktur. (Paket kurulumu yalnızca bu projenin devDependency'si içindir. Genel kısıtlardaki onay bu adımı da kapsar.)

- [ ] **Adım 7: Commit**

```bash
git add diogenes/app/package.json diogenes/app/package-lock.json diogenes/app/wrangler.json diogenes/app/.gitignore diogenes/app/migrations diogenes/app/src/core.js diogenes/app/tests/core.test.js
git commit -m "Diogenes: iskelet, sema, para/tarih/dogrulama"
```

---

### Görev 2: Ay durumu, dağıtım ve kaydırma

**Dosyalar:**
- Değiştir: `diogenes/app/src/core.js` (sonuna ekle)
- Test: `diogenes/app/tests/core.test.js` (sonuna ekle)

**Arayüzler:**
- Tüketir: Görev 1'deki fonksiyonlar.
- Üretir:
  - `ayDurumu(ay, {zarflar,gelirler,dagitimlar,harcamalar,aktarimlar})` şu yapıyı döner: `{ay, gelir, harcanan, atanmamis, zarflar:[{id,ad,aylik,konan,harcanan,aktarilan,kalan,eksik}]}`. `zarflar` yalnızca aktif zarfları içerir ve `sira`, ardından `id` sırasıyla dizilir.
  - `dagitimOner(tutar, durum)` şunu döner: `{kalemler:[{zarf_id,tutar}], artan}`.
  - `kaydirmaOner(durum, zarfId)` şunu döner: `{zarf_id, kaynaklar:[{zarf_id|null,tutar}], karsilanamayan}` ya da zarf eksi değilse `null`.

- [ ] **Adım 1: Başarısız testi yaz** (`tests/core.test.js` sonuna)

```js
const Z=[{id:1,ad:"Kira",aylik_kurus:1000000,sira:1,aktif:1},{id:2,ad:"Yemek",aylik_kurus:600000,sira:2,aktif:1},{id:3,ad:"Eski",aylik_kurus:100000,sira:3,aktif:0}];
const veri=(ek={})=>({zarflar:Z,gelirler:[],dagitimlar:[],harcamalar:[],aktarimlar:[],...ek});

test("ayDurumu: kalan, eksik, kümülatif atanmamış", () => {
  const d=c.ayDurumu("2026-12",veri({
    gelirler:[{tutar_kurus:1500000,tarih:"2026-11-01"},{tutar_kurus:1500000,tarih:"2026-12-01"},{tutar_kurus:999,tarih:"2027-01-01"}],
    dagitimlar:[{ay:"2026-11",zarf_id:1,tutar_kurus:1000000},{ay:"2026-12",zarf_id:1,tutar_kurus:1000000},{ay:"2026-12",zarf_id:2,tutar_kurus:400000}],
    harcamalar:[{zarf_id:2,tutar_kurus:450000,tarih:"2026-12-05"},{zarf_id:null,tutar_kurus:10000,tarih:"2026-12-06"},{zarf_id:2,tutar_kurus:1,tarih:"2026-11-30"}],
    aktarimlar:[{ay:"2026-11",zarf_id:null,tutar_kurus:20000}]
  }));
  assert.equal(d.gelir,1500000);
  assert.equal(d.harcanan,460000);
  assert.equal(d.atanmamis,3000000-2400000-10000-20000);
  assert.deepEqual(d.zarflar.map(z=>z.id),[1,2]);
  assert.deepEqual(d.zarflar[1],{id:2,ad:"Yemek",aylik:600000,konan:400000,harcanan:450000,aktarilan:0,kalan:-50000,eksik:200000});
  assert.equal(d.zarflar[0].eksik,0);
});

test("dagitimOner: sırayla eksikleri doldurur, artan atanmamış", () => {
  const d=c.ayDurumu("2026-12",veri());
  assert.deepEqual(c.dagitimOner(1500000,d),{kalemler:[{zarf_id:1,tutar:1000000},{zarf_id:2,tutar:500000}],artan:0});
  assert.deepEqual(c.dagitimOner(2000000,d),{kalemler:[{zarf_id:1,tutar:1000000},{zarf_id:2,tutar:600000}],artan:400000});
});

test("kaydirmaOner: önce atanmamış, sonra en dolu zarf", () => {
  const durum={atanmamis:20000,zarflar:[{id:1,kalan:300000},{id:2,kalan:-50000},{id:4,kalan:400000}]};
  assert.deepEqual(c.kaydirmaOner(durum,2),{zarf_id:2,kaynaklar:[{zarf_id:null,tutar:20000},{zarf_id:4,tutar:30000}],karsilanamayan:0});
  assert.equal(c.kaydirmaOner(durum,1),null);
  const kit={atanmamis:0,zarflar:[{id:2,kalan:-50000},{id:1,kalan:10000}]};
  assert.deepEqual(c.kaydirmaOner(kit,2),{zarf_id:2,kaynaklar:[{zarf_id:1,tutar:10000}],karsilanamayan:40000});
});
```

- [ ] **Adım 2: Testi çalıştır ve başarısız olduğunu gör**

Çalıştır: `node --test tests/core.test.js`
Beklenen: Yeni 3 test BAŞARISIZ olur ve `c.ayDurumu is not a function` hatası verir.

- [ ] **Adım 3: Kodu yaz** (`src/core.js` sonuna)

```js
const topla=xs=>xs.reduce((t,x)=>t+x.tutar_kurus,0);
const ayi=x=>x.ay||x.tarih.slice(0,7);

// Zarf kalanı aylık; atanmamış kümülatif (o aya kadar gelir − dağıtım − zarfsız harcama − zarfsız aktarım).
export function ayDurumu(ay,{zarflar=[],gelirler=[],dagitimlar=[],harcamalar=[],aktarimlar=[]}){
  const kadar=x=>ayi(x)<=ay,bu=x=>ayi(x)===ay;
  const atanmamis=topla(gelirler.filter(kadar))-topla(dagitimlar.filter(kadar))
    -topla(harcamalar.filter(h=>h.zarf_id==null&&kadar(h)))-topla(aktarimlar.filter(a=>a.zarf_id==null&&kadar(a)));
  const zarfIcin=(xs,id)=>topla(xs.filter(x=>x.zarf_id===id&&bu(x)));
  const liste=zarflar.filter(z=>z.aktif).sort((a,b)=>a.sira-b.sira||a.id-b.id).map(z=>{
    const konan=zarfIcin(dagitimlar,z.id),harcanan=zarfIcin(harcamalar,z.id),aktarilan=zarfIcin(aktarimlar,z.id);
    return {id:z.id,ad:z.ad,aylik:z.aylik_kurus,konan,harcanan,aktarilan,kalan:konan-harcanan-aktarilan,eksik:Math.max(0,z.aylik_kurus-konan)};
  });
  return {ay,gelir:topla(gelirler.filter(bu)),harcanan:topla(harcamalar.filter(bu)),atanmamis,zarflar:liste};
}

export function dagitimOner(tutar,durum){
  let kalan=tutar;const kalemler=[];
  for(const z of durum.zarflar){
    if(kalan<=0)break;
    const t=Math.min(z.eksik,kalan);
    if(t>0){kalemler.push({zarf_id:z.id,tutar:t});kalan-=t;}
  }
  return {kalemler,artan:kalan};
}

export function kaydirmaOner(durum,zarfId){
  const z=durum.zarflar.find(x=>x.id===zarfId);
  if(!z||z.kalan>=0)return null;
  let ihtiyac=-z.kalan;const kaynaklar=[];
  if(durum.atanmamis>0){const t=Math.min(durum.atanmamis,ihtiyac);kaynaklar.push({zarf_id:null,tutar:t});ihtiyac-=t;}
  for(const a of durum.zarflar.filter(x=>x.id!==zarfId&&x.kalan>0).sort((a,b)=>b.kalan-a.kalan)){
    if(ihtiyac<=0)break;
    const t=Math.min(a.kalan,ihtiyac);kaynaklar.push({zarf_id:a.id,tutar:t});ihtiyac-=t;
  }
  return {zarf_id:zarfId,kaynaklar,karsilanamayan:ihtiyac};
}
```

- [ ] **Adım 4: Testi çalıştır ve geçtiğini gör**

Çalıştır: `node --test tests/core.test.js`
Beklenen: 8 test GEÇER.

- [ ] **Adım 5: Commit**

```bash
git add diogenes/app/src/core.js diogenes/app/tests/core.test.js
git commit -m "Diogenes: ay durumu, dagitim ve kaydirma"
```

---

### Görev 3: Merdiven, ay kapanışı, özgürlük süresi

**Dosyalar:**
- Değiştir: `diogenes/app/src/core.js`, `diogenes/app/tests/core.test.js`

**Arayüzler:**
- Üretir:
  - `VARSAYILAN_MERDIVEN`: `[{ad,kural,hedef_kurus}]`, 4 basamak.
  - `etkinHedef(basamak,{aylikToplam,borcToplam})` ya bir sayı ya da `null` (sınırsız) döner.
  - `merdivenDurumu(merdiven,mctx)` şunu döner: `[{...basamak, hedef, tamam}]`. Liste `sira` sırasına göre dizilir.
  - `merdivenDagit(merdiven,tutar,mctx)` şunu döner: `[{id,tutar}]`.
  - `ayKapanisi(durum)` şunu döner: `{kapama:[{zarf_id,tutar}], dusum:[{zarf_id,tutar}], kaynaklar:[{zarf_id|null,tutar}], toplam}`.
  - `ozgurlukSuresi(birikim,aylikEk,yillikYuzde,hedef)` ay sayısını döner; 600 ayda (50 yıl) ulaşılamıyorsa `null` döner.

- [ ] **Adım 1: Başarısız testi yaz**

```js
const M=[{id:11,sira:1,ad:"Borçsuzluk",kural:"borc",hedef_kurus:null,biriken_kurus:0},{id:12,sira:2,ad:"Acil fon",kural:"acil3",hedef_kurus:null,biriken_kurus:4000000},{id:13,sira:3,ad:"Yatırım",kural:null,hedef_kurus:null,biriken_kurus:0}];
const mctx={aylikToplam:1600000,borcToplam:0};

test("merdiven: borç yoksa ilk basamak tamam, acil fon 3 ay", () => {
  const m=c.merdivenDurumu(M,mctx);
  assert.deepEqual(m.map(b=>[b.id,b.hedef,b.tamam]),[[11,0,true],[12,4800000,false],[13,null,false]]);
  assert.deepEqual(c.merdivenDurumu(M,{...mctx,borcToplam:50000})[0].tamam,false);
});

test("merdivenDagit: önce açık basamak dolar, taşan sonrakine", () => {
  assert.deepEqual(c.merdivenDagit(M,1000000,mctx),[{id:12,tutar:800000},{id:13,tutar:200000}]);
  const hepsiTamam=[{id:1,sira:1,ad:"A",kural:null,hedef_kurus:100,biriken_kurus:100}];
  assert.deepEqual(c.merdivenDagit(hepsiTamam,500,mctx),[{id:1,tutar:500}]);
  assert.deepEqual(c.merdivenDagit([],500,mctx),[]);
  assert.equal(c.VARSAYILAN_MERDIVEN.length,4);
});

test("ayKapanisi: eksiler önce atanmamıştan, sonra en dolu zarftan kapanır", () => {
  const k=c.ayKapanisi({atanmamis:20000,zarflar:[{id:1,kalan:300000},{id:2,kalan:-50000},{id:3,kalan:0}]});
  assert.deepEqual(k,{kapama:[{zarf_id:2,tutar:50000}],dusum:[{zarf_id:1,tutar:30000}],kaynaklar:[{zarf_id:1,tutar:270000}],toplam:270000});
  const bol=c.ayKapanisi({atanmamis:100000,zarflar:[{id:1,kalan:5000}]});
  assert.deepEqual(bol,{kapama:[],dusum:[],kaynaklar:[{zarf_id:null,tutar:100000},{zarf_id:1,tutar:5000}],toplam:105000});
  const acik=c.ayKapanisi({atanmamis:0,zarflar:[{id:2,kalan:-50000}]});
  assert.deepEqual(acik,{kapama:[{zarf_id:2,tutar:50000}],dusum:[],kaynaklar:[],toplam:0});
});

test("ozgurlukSuresi", () => {
  assert.equal(c.ozgurlukSuresi(100,0,0,100),0);
  assert.equal(c.ozgurlukSuresi(0,1000,0,12000),12);
  assert.equal(c.ozgurlukSuresi(0,0,0,1),null);
  assert.ok(c.ozgurlukSuresi(0,1000,20,24000)<24);
});
```

- [ ] **Adım 2: Testi çalıştır ve başarısız olduğunu gör**

Çalıştır: `node --test tests/core.test.js`
Beklenen: 4 yeni test BAŞARISIZ olur, hata mesajı `is not a function` olur.

- [ ] **Adım 3: Kodu yaz**

```js
export const VARSAYILAN_MERDIVEN=[
  {ad:"Borçsuzluk",kural:"borc",hedef_kurus:null},
  {ad:"Acil fon (3 ay)",kural:"acil3",hedef_kurus:null},
  {ad:"Düzenli yatırım",kural:null,hedef_kurus:null},
  {ad:"Ek gelir",kural:null,hedef_kurus:null},
];
export function etkinHedef(b,{aylikToplam,borcToplam}){
  if(b.kural==="acil3")return aylikToplam*3;
  if(b.kural==="borc")return borcToplam;
  return b.hedef_kurus??null;
}
export function merdivenDurumu(merdiven,mctx){
  return [...merdiven].sort((a,b)=>a.sira-b.sira||a.id-b.id).map(b=>{
    const hedef=etkinHedef(b,mctx);
    return {...b,hedef,tamam:hedef!==null&&b.biriken_kurus>=hedef};
  });
}
// Tutarı ilk tamamlanmamış basamaktan başlayarak dağıtır; hedefsiz basamak hepsini alır; artan son basamağa.
export function merdivenDagit(merdiven,tutar,mctx){
  const liste=merdivenDurumu(merdiven,mctx),parcalar=[];let kalan=tutar;
  for(const b of liste){
    if(kalan<=0)break;if(b.tamam)continue;
    const yer=b.hedef===null?kalan:b.hedef-b.biriken_kurus,t=Math.min(yer,kalan);
    if(t>0){parcalar.push({id:b.id,tutar:t});kalan-=t;}
  }
  if(kalan>0&&liste.length){
    const son=liste[liste.length-1],p=parcalar.find(x=>x.id===son.id);
    if(p)p.tutar+=kalan;else parcalar.push({id:son.id,tutar:kalan});
  }
  return parcalar;
}
// Ay kapanışı: eksi zarflar kapanır (önce atanmamış, sonra en dolu zarflar karşılar); kalan merdivene gidecek kaynaklardır.
export function ayKapanisi(durum){
  const kapama=durum.zarflar.filter(z=>z.kalan<0).map(z=>({zarf_id:z.id,tutar:-z.kalan}));
  let acik=kapama.reduce((t,k)=>t+k.tutar,0);
  const havuz=[];
  if(durum.atanmamis>0)havuz.push({zarf_id:null,tutar:durum.atanmamis});
  for(const z of durum.zarflar.filter(z=>z.kalan>0).sort((a,b)=>b.kalan-a.kalan))havuz.push({zarf_id:z.id,tutar:z.kalan});
  const dusum=[],kaynaklar=[];
  for(const h of havuz){
    const kapa=Math.min(acik,h.tutar);acik-=kapa;
    if(kapa>0&&h.zarf_id!==null)dusum.push({zarf_id:h.zarf_id,tutar:kapa});
    if(h.tutar-kapa>0)kaynaklar.push({zarf_id:h.zarf_id,tutar:h.tutar-kapa});
  }
  return {kapama,dusum,kaynaklar,toplam:kaynaklar.reduce((t,k)=>t+k.tutar,0)};
}
// Hesap, tavsiye değil: aylık bileşik getiriyle hedefe kaç ayda ulaşılır (en çok 600 ay).
export function ozgurlukSuresi(birikim,aylikEk,yillikYuzde,hedef){
  const r=Math.pow(1+(Number(yillikYuzde)||0)/100,1/12)-1;let b=birikim;
  for(let ay=0;ay<=600;ay++){if(b>=hedef)return ay;b=b*(1+r)+aylikEk;}
  return null;
}
```

- [ ] **Adım 4: Testi çalıştır ve geçtiğini gör**

Çalıştır: `node --test tests/core.test.js`
Beklenen: 12 test GEÇER.

- [ ] **Adım 5: Commit**

```bash
git add diogenes/app/src/core.js diogenes/app/tests/core.test.js
git commit -m "Diogenes: merdiven, ay kapanisi, ozgurluk suresi"
```

---

### Görev 4: Liste ve kayıt doğrulama

**Dosyalar:**
- Değiştir: `diogenes/app/src/core.js`, `diogenes/app/tests/core.test.js`

**Arayüzler:**
- Üretir:
  - `listeDogrula(tablo, satirlar)` normalleştirilmiş satırları DB sütun adlarıyla döner. Her satırda `id` ya bir sayıdır ya da `null` (yeni satır).
  - `LISTE_SUTUNLARI`: `{tablo:[sütun]}`.
  - `BIRIKIM_TURLERI`: `[[deger,ad]]`.
  - `harcamaDogrula(b,bugun)` şunu döner: `{istek_id|null, tutar_kurus, aciklama, zarf_id|null, tarih, etiket}`.
  - `gelirDogrula(b,bugun)` şunu döner: `{tutar_kurus, aciklama, tarih}`.

- [ ] **Adım 1: Başarısız testi yaz**

```js
test("listeDogrula: zarflar sıra alır, TL kuruşa döner", () => {
  assert.deepEqual(c.listeDogrula("zarflar",[{ad:"Kira",aylik:"10.000"},{id:"4",ad:" Yemek ",aylik:"0"}]),
    [{id:null,ad:"Kira",aylik_kurus:1000000,sira:1},{id:4,ad:"Yemek",aylik_kurus:0,sira:2}]);
  assert.deepEqual(c.listeDogrula("gelir_plani",[{ad:"Burs",tutar:"4000",gun:"7"}]),[{id:null,ad:"Burs",tutar_kurus:400000,gun:7}]);
  assert.deepEqual(c.listeDogrula("merdiven",[{ad:"Acil",kural:"acil3",hedef:"",biriken:""}]),[{id:null,ad:"Acil",sira:1,kural:"acil3",hedef_kurus:null,biriken_kurus:0}]);
  assert.deepEqual(c.listeDogrula("borclar",[{ad:"KYK",kalan:"20000",aylik:"500",kalan_taksit:""}]),[{id:null,ad:"KYK",kalan_kurus:2000000,aylik_kurus:50000,kalan_taksit:null}]);
  assert.deepEqual(c.listeDogrula("birikimler",[{tur:"altin",ad:"Gram",tutar:"3000"}]),[{id:null,tur:"altin",ad:"Gram",tutar_kurus:300000}]);
  assert.deepEqual(c.listeDogrula("abonelikler",[{ad:"Spotify",tutar:"60",gun:"12",zarf_id:"2"}]),[{id:null,ad:"Spotify",tutar_kurus:6000,gun:12,zarf_id:2,aktif:1}]);
});

test("listeDogrula: geçersizler", () => {
  assert.throws(()=>c.listeDogrula("yok",[]),{message:"Bilinmeyen liste."});
  assert.throws(()=>c.listeDogrula("zarflar",Array(51).fill({ad:"a",aylik:"1"})),{message:"Liste en çok 50 satır olabilir."});
  assert.throws(()=>c.listeDogrula("gelir_plani",[{ad:"x",tutar:"1",gun:"32"}]),{message:"Gün 1 ile 31 arasında tam sayı olmalı."});
  assert.throws(()=>c.listeDogrula("birikimler",[{tur:"bitcoin",ad:"x",tutar:"1"}]),{message:"Birikim türü geçersiz."});
  assert.throws(()=>c.listeDogrula("zarflar",[{id:"abc",ad:"x",aylik:"1"}]),{message:"Geçersiz kimlik."});
});

test("harcamaDogrula ve gelirDogrula", () => {
  assert.deepEqual(c.harcamaDogrula({istek_id:"a1",tutar:"640",aciklama:"Market",zarf_id:"2"},"2026-11-27"),
    {istek_id:"a1",tutar_kurus:64000,aciklama:"Market",zarf_id:2,tarih:"2026-11-27",etiket:""});
  assert.equal(c.harcamaDogrula({tutar:"1",aciklama:"x",zarf_id:""},"2026-11-27").zarf_id,null);
  assert.throws(()=>c.harcamaDogrula({tutar:"0",aciklama:"x"},"2026-11-27"),{message:"Tutar sıfır olamaz."});
  assert.deepEqual(c.gelirDogrula({tutar:"15.000",aciklama:"Burs",tarih:"2026-11-01"},"2026-11-27"),{tutar_kurus:1500000,aciklama:"Burs",tarih:"2026-11-01"});
});
```

- [ ] **Adım 2: Testi çalıştır ve başarısız olduğunu gör**

Çalıştır: `node --test tests/core.test.js`
Beklenen: 3 yeni test BAŞARISIZ olur.

- [ ] **Adım 3: Kodu yaz**

```js
export const BIRIKIM_TURLERI=[["nakit","Nakit"],["banka","Banka"],["altin","Altın"],["doviz","Döviz"],["fon","Fon"],["diger","Diğer"]];
export const LISTE_SUTUNLARI={
  zarflar:["ad","aylik_kurus","sira"],
  gelir_plani:["ad","tutar_kurus","gun"],
  abonelikler:["ad","tutar_kurus","gun","zarf_id","aktif"],
  borclar:["ad","kalan_kurus","aylik_kurus","kalan_taksit"],
  birikimler:["tur","ad","tutar_kurus"],
  merdiven:["ad","sira","kural","hedef_kurus","biriken_kurus"],
};
const bos=v=>v==null||v==="";
const kimlik=v=>{if(bos(v))return null;const n=Number(v);if(!Number.isInteger(n)||n<=0)throw new Hata("Geçersiz kimlik.");return n;};
const ayGunu=v=>{const n=/^\d+$/.test(String(v).trim())?Number(v):NaN;if(!Number.isInteger(n)||n<1||n>31)throw new Hata("Gün 1 ile 31 arasında tam sayı olmalı.");return n;};
export function listeDogrula(tablo,satirlar){
  if(!(tablo in LISTE_SUTUNLARI))throw new Hata("Bilinmeyen liste.");
  if(!Array.isArray(satirlar)||satirlar.length>50)throw new Hata("Liste en çok 50 satır olabilir.");
  return satirlar.map((r,i)=>{
    r=r||{};const id=kimlik(r.id);
    switch(tablo){
      case "zarflar":return {id,ad:metinDogrula(r.ad,"Zarf adı",40),aylik_kurus:tutarDogrula(r.aylik,{sifir:true}),sira:i+1};
      case "gelir_plani":return {id,ad:metinDogrula(r.ad,"Gelir adı",40),tutar_kurus:tutarDogrula(r.tutar),gun:ayGunu(r.gun)};
      case "abonelikler":return {id,ad:metinDogrula(r.ad,"Abonelik adı",40),tutar_kurus:tutarDogrula(r.tutar),gun:ayGunu(r.gun),zarf_id:kimlik(r.zarf_id),aktif:r.aktif===false||r.aktif===0?0:1};
      case "borclar":return {id,ad:metinDogrula(r.ad,"Borç adı",40),kalan_kurus:tutarDogrula(r.kalan,{sifir:true}),aylik_kurus:tutarDogrula(bos(r.aylik)?"0":r.aylik,{sifir:true}),kalan_taksit:bos(r.kalan_taksit)?null:sayiDogrula(r.kalan_taksit,"Kalan taksit",0,600)};
      case "birikimler":{
        if(!BIRIKIM_TURLERI.some(([v])=>v===r.tur))throw new Hata("Birikim türü geçersiz.");
        return {id,tur:r.tur,ad:metinDogrula(r.ad,"Birikim adı",40),tutar_kurus:tutarDogrula(r.tutar,{sifir:true})};
      }
      case "merdiven":{
        const kural=bos(r.kural)?null:r.kural;
        if(kural!==null&&kural!=="acil3"&&kural!=="borc")throw new Hata("Geçersiz kural.");
        return {id,ad:metinDogrula(r.ad,"Basamak adı",40),sira:i+1,kural,hedef_kurus:bos(r.hedef)?null:tutarDogrula(r.hedef),biriken_kurus:bos(r.biriken)?0:tutarDogrula(r.biriken,{sifir:true})};
      }
    }
  });
}
export function harcamaDogrula(b,bugun){
  b=b||{};
  const istek=bos(b.istek_id)?null:metinDogrula(b.istek_id,"İstek kimliği",80);
  return {istek_id:istek,tutar_kurus:tutarDogrula(b.tutar),aciklama:metinDogrula(b.aciklama,"Açıklama",80),zarf_id:kimlik(b.zarf_id),tarih:gunDogrula(b.tarih,bugun),etiket:bos(b.etiket)?"":metinDogrula(b.etiket,"Etiket",20)};
}
export function gelirDogrula(b,bugun){
  b=b||{};
  return {tutar_kurus:tutarDogrula(b.tutar),aciklama:metinDogrula(b.aciklama,"Açıklama",80),tarih:gunDogrula(b.tarih,bugun)};
}
```

- [ ] **Adım 4: Testi çalıştır ve geçtiğini gör**

Çalıştır: `node --test tests/core.test.js`
Beklenen: 15 test GEÇER.

- [ ] **Adım 5: Commit**

```bash
git add diogenes/app/src/core.js diogenes/app/tests/core.test.js
git commit -m "Diogenes: liste ve kayit dogrulama"
```

---

### Görev 5: Öneri üretimi, uygulama SQL'i ve görünüm

**Dosyalar:**
- Değiştir: `diogenes/app/src/core.js`, `diogenes/app/tests/core.test.js`

**Arayüzler:**
- Tüketir: `ayDurumu`, `dagitimOner`, `kaydirmaOner`, `ayKapanisi`, `merdivenDurumu`, `merdivenDagit`, `planGunu`, `oncekiAy`, `ayinSonGunu`, `tutarDogrula`, `tl`, `ayAdi`.
- Üretir:
  - `gunlukOneriler(gun,{gelirPlani,gelirler,abonelikler,mevcut:Set,aksam,baslangic,durum:(ay)=>durum})` şunu döner: `[{tur,anahtar,detay}]`.
  - `uygulaSql(oneri:{id,tur,detay}, karar:"onayla"|"reddet", duzenleme|null, ctx:{durum,merdiven,mctx,aktifZarf:Set,simdi,bugun})` şunlardan birini döner: `{ifadeler:[[sql,...params]]}` ya da `{eskidi:metin}`. Geçersiz bir durumda `Hata` fırlatır.
  - `oneriGorunum(oneri,{durum,zarfAd:Map,merdiven,mctx})` şunu döner: `{id,tur,baslik,aciklama,satirlar:[{zarf_id,ad,tutar}],toplam,duzenlenebilir,tutar?}`.
- Detay biçimleri:
  - `dagitim`: `{ay,tutar,kalemler:[{zarf_id,tutar}], gelir?:{plan_id,aciklama,tarih}, gelir_id?}`
  - `abonelik`: `{abonelik_id,ad,tutar,zarf_id,tarih}`
  - `kaydirma`: `{ay,zarf_id}`
  - `aktarim`: `{ay}`
- Anahtar biçimleri:
  - `dagitim:plan:<ay>:<plan_id>`
  - `dagitim:gelir:<gelir_id>`
  - `abonelik:<id>:<ay>`
  - `kaydirma:<ay>:<zarf_id>:<harcama_id>`
  - `aktarim:<ay>`

- [ ] **Adım 1: Başarısız testi yaz**

```js
const plan=[{id:1,ad:"Aile",tutar_kurus:1500000,gun:1},{id:3,ad:"Destek",tutar_kurus:1600000,gun:16},{id:2,ad:"Burs",tutar_kurus:400000,gun:7}];
const durumFn=ek=>ay=>c.ayDurumu(ay,veri(ek));

test("gunlukOneriler: geçmiş plan günleri, eksikler ardışık düşülür", () => {
  const o=c.gunlukOneriler("2026-12-08",{gelirPlani:plan,gelirler:[],abonelikler:[],mevcut:new Set(),aksam:false,baslangic:"2026-12-01",durum:durumFn()});
  const dag=o.filter(x=>x.tur==="dagitim");
  assert.deepEqual(dag.map(x=>x.anahtar),["dagitim:plan:2026-12:1","dagitim:plan:2026-12:2"]);
  assert.deepEqual(dag[0].detay,{ay:"2026-12",tutar:1500000,gelir:{plan_id:1,aciklama:"Aile",tarih:"2026-12-01"},kalemler:[{zarf_id:1,tutar:1000000},{zarf_id:2,tutar:500000}]});
  assert.deepEqual(dag[1].detay.kalemler,[{zarf_id:2,tutar:100000}]);
  assert.ok(!o.some(x=>x.tur==="aktarim"),"başlangıçtan önceki ay kapanmaz");
});

test("gunlukOneriler: gelmiş gelir, mevcut anahtar, başlangıç öncesi atlanır; abonelik ve kapanış", () => {
  const ab=[{id:5,ad:"Spotify",tutar_kurus:6000,gun:3,zarf_id:2,aktif:1},{id:6,ad:"Pasif",tutar_kurus:1,gun:1,zarf_id:2,aktif:0}];
  const o=c.gunlukOneriler("2026-12-08",{gelirPlani:plan,gelirler:[{plan_id:1,tarih:"2026-12-01",tutar_kurus:1500000}],abonelikler:ab,mevcut:new Set(["dagitim:plan:2026-12:2"]),aksam:false,baslangic:"2026-11-10",durum:durumFn({dagitimlar:[{ay:"2026-11",zarf_id:1,tutar_kurus:5000}]})});
  assert.deepEqual(o.map(x=>x.anahtar),["abonelik:5:2026-12","aktarim:2026-11"]);
  assert.deepEqual(o[0].detay,{abonelik_id:5,ad:"Spotify",tutar:6000,zarf_id:2,tarih:"2026-12-03"});
  const gec=c.gunlukOneriler("2026-12-02",{gelirPlani:plan,gelirler:[],abonelikler:[],mevcut:new Set(),aksam:false,baslangic:"2026-12-02",durum:durumFn()});
  assert.deepEqual(gec,[],"başlangıç gününden önceki plan günü önerilmez");
  const aksam=c.gunlukOneriler("2026-12-31",{gelirPlani:[],gelirler:[],abonelikler:[],mevcut:new Set(),aksam:true,baslangic:"2026-12-01",durum:durumFn({gelirler:[{tutar_kurus:100,tarih:"2026-12-01"}]})});
  assert.deepEqual(aksam.map(x=>x.anahtar),["aktarim:2026-12"]);
  const bosAy=c.gunlukOneriler("2026-12-31",{gelirPlani:[],gelirler:[],abonelikler:[],mevcut:new Set(),aksam:true,baslangic:"2026-12-01",durum:durumFn()});
  assert.deepEqual(bosAy,[],"aktarılacak bir şey yoksa kapanış önerilmez");
});

const ctx=(ek={})=>({durum:durumFn(ek.veri||{}),merdiven:ek.merdiven||M,mctx,aktifZarf:new Set([1,2]),simdi:"2026-12-08T10:00:00Z",bugun:"2026-12-08"});
const sqller=r=>r.ifadeler.map(x=>x[0].split(" ").slice(0,3).join(" "));

test("uygulaSql dagitim: planlı gelir eklenir, dağıtılır, düzenleme uygulanır", () => {
  const o={id:9,tur:"dagitim",detay:{ay:"2026-12",tutar:1500000,gelir:{plan_id:1,aciklama:"Aile",tarih:"2026-12-01"},kalemler:[{zarf_id:1,tutar:1000000},{zarf_id:2,tutar:500000}]}};
  const r=c.uygulaSql(o,"onayla",null,ctx());
  assert.deepEqual(r.ifadeler[0],["INSERT INTO gelirler(plan_id,tutar_kurus,aciklama,tarih,oneri_id) VALUES(?,?,?,?,?)",1,1500000,"Aile","2026-12-01",9]);
  assert.deepEqual(r.ifadeler[1],["INSERT INTO dagitimlar(ay,zarf_id,tutar_kurus,oneri_id,tarih) VALUES(?,?,?,?,?)","2026-12",1,1000000,9,"2026-12-08"]);
  assert.deepEqual(r.ifadeler.at(-1),["UPDATE oneriler SET durum=?,karar=? WHERE id=?","onaylandi","2026-12-08T10:00:00Z",9]);
  const d=c.uygulaSql(o,"onayla",{tutar:"14.000",kalemler:[{zarf_id:1,tutar:"10000"},{zarf_id:2,tutar:"0"}]},ctx());
  assert.equal(d.ifadeler[0][2],1400000);
  assert.equal(d.ifadeler.length,3);
  assert.throws(()=>c.uygulaSql(o,"onayla",{tutar:"100",kalemler:[{zarf_id:1,tutar:"200"}]},ctx()),{message:"Dağıtılan, gelen paradan fazla olamaz."});
  assert.deepEqual(c.uygulaSql({...o,detay:{...o.detay,kalemler:[{zarf_id:3,tutar:5}]}},"onayla",null,ctx()),{eskidi:"Önerideki bir zarf artık yok."});
  assert.deepEqual(sqller(c.uygulaSql(o,"reddet",null,ctx())),["UPDATE oneriler SET"]);
  assert.throws(()=>c.uygulaSql(o,"belki",null,ctx()),{message:"Karar onayla ya da reddet olmalı."});
});

test("uygulaSql abonelik ve kaydırma", () => {
  const ab=c.uygulaSql({id:4,tur:"abonelik",detay:{abonelik_id:5,ad:"Spotify",tutar:6000,zarf_id:2,tarih:"2026-12-03"}},"onayla",null,ctx());
  assert.deepEqual(ab.ifadeler[0].slice(1),["abonelik:5:2026-12",6000,"Spotify",2,"2026-12-03"]);
  const veriK={dagitimlar:[{ay:"2026-12",zarf_id:1,tutar_kurus:300000},{ay:"2026-12",zarf_id:2,tutar_kurus:100000}],harcamalar:[{zarf_id:2,tutar_kurus:150000,tarih:"2026-12-05"}]};
  const k=c.uygulaSql({id:5,tur:"kaydirma",detay:{ay:"2026-12",zarf_id:2}},"onayla",null,ctx({veri:veriK}));
  assert.deepEqual(k.ifadeler.slice(0,2).map(x=>[x[2],x[3]]),[[2,50000],[1,-50000]]);
  assert.deepEqual(c.uygulaSql({id:5,tur:"kaydirma",detay:{ay:"2026-12",zarf_id:1}},"onayla",null,ctx({veri:veriK})),{eskidi:"Zarf artık eksi değil ya da kaydırılacak para yok."});
});

test("uygulaSql aktarım: onayla merdivene, reddet atanmamışa; merdiven yoksa hata", () => {
  const veriA={gelirler:[{tutar_kurus:420000,tarih:"2026-11-01"}],dagitimlar:[{ay:"2026-11",zarf_id:1,tutar_kurus:300000},{ay:"2026-11",zarf_id:2,tutar_kurus:100000}],harcamalar:[{zarf_id:2,tutar_kurus:150000,tarih:"2026-11-05"}]};
  const o={id:7,tur:"aktarim",detay:{ay:"2026-11"}};
  const on=c.uygulaSql(o,"onayla",null,ctx({veri:veriA}));
  const ilk=x=>x[0].split("(")[0];
  assert.deepEqual(on.ifadeler.map(ilk),["INSERT INTO dagitimlar","INSERT INTO dagitimlar","INSERT INTO aktarimlar","UPDATE merdiven SET biriken_kurus=biriken_kurus+? WHERE id=?","UPDATE oneriler SET durum=?,karar=? WHERE id=?"]);
  assert.deepEqual(on.ifadeler[2].slice(1),["2026-11",1,12,270000,7,"2026-12-08"]);
  assert.deepEqual(on.ifadeler[3].slice(1),[270000,12]);
  const red=c.uygulaSql(o,"reddet",null,ctx({veri:veriA}));
  assert.deepEqual(red.ifadeler.slice(0,3).map(x=>[x[2],x[3]]),[[2,50000],[1,-30000],[1,-270000]]);
  assert.throws(()=>c.uygulaSql(o,"onayla",null,ctx({veri:veriA,merdiven:[]})),{message:"Önce hedef merdivenini kur."});
});

test("oneriGorunum", () => {
  const zarfAd=new Map([[1,"Kira"],[2,"Yemek"]]);
  const g=c.oneriGorunum({id:9,tur:"dagitim",detay:{ay:"2026-12",tutar:1600000,gelir:{plan_id:1,aciklama:"Aile",tarih:"2026-12-01"},kalemler:[{zarf_id:1,tutar:1000000}]}},{durum:durumFn(),zarfAd,merdiven:M,mctx});
  assert.equal(g.baslik,"Aile: 16.000 ₺ geldi mi?");
  assert.deepEqual(g.satirlar,[{zarf_id:1,ad:"Kira",tutar:1000000},{zarf_id:null,ad:"Atanmamış",tutar:600000}]);
  assert.equal(g.duzenlenebilir,true);
  const a=c.oneriGorunum({id:7,tur:"aktarim",detay:{ay:"2026-11"}},{durum:durumFn({gelirler:[{tutar_kurus:5000,tarih:"2026-11-01"}]}),zarfAd,merdiven:M,mctx});
  assert.equal(a.baslik,"Kasım 2026 kapanışı: 50 ₺ hedefe aktarılsın mı?");
  assert.match(a.aciklama,/Hedef: Acil fon\./);
});
```

- [ ] **Adım 2: Testi çalıştır ve başarısız olduğunu gör**

Çalıştır: `node --test tests/core.test.js`
Beklenen: 6 yeni test BAŞARISIZ olur.

- [ ] **Adım 3: Kodu yaz**

```js
// Zamanlayıcının önerileri. Kurulumdan (baslangic) önceki günler için öneri üretilmez; aynı anahtar ikinci kez üretilmez.
export function gunlukOneriler(gun,{gelirPlani=[],gelirler=[],abonelikler=[],mevcut=new Set(),aksam=false,baslangic,durum}){
  const ay=gun.slice(0,7),cikti=[];
  const ekle=(tur,anahtar,detay)=>{if(!mevcut.has(anahtar)){mevcut.add(anahtar);cikti.push({tur,anahtar,detay});}};
  const uygun=t=>t<=gun&&(!baslangic||t>=baslangic);
  const kapanis=a=>{const k=ayKapanisi(durum(a));if(k.toplam>0||k.kapama.length)ekle("aktarim",`aktarim:${a}`,{ay:a});};
  if(!aksam){
    const d=durum(ay),calisma={...d,zarflar:d.zarflar.map(z=>({...z}))};
    for(const p of [...gelirPlani].sort((a,b)=>a.gun-b.gun||a.id-b.id)){
      const t=planGunu(ay,p.gun),anahtar=`dagitim:plan:${ay}:${p.id}`;
      if(!uygun(t)||mevcut.has(anahtar))continue;
      if(gelirler.some(g=>g.plan_id===p.id&&g.tarih.slice(0,7)===ay))continue;
      const {kalemler}=dagitimOner(p.tutar_kurus,calisma);
      for(const k of kalemler)calisma.zarflar.find(z=>z.id===k.zarf_id).eksik-=k.tutar;
      ekle("dagitim",anahtar,{ay,tutar:p.tutar_kurus,gelir:{plan_id:p.id,aciklama:p.ad,tarih:t},kalemler});
    }
    for(const a of abonelikler.filter(a=>a.aktif)){
      const t=planGunu(ay,a.gun);
      if(uygun(t))ekle("abonelik",`abonelik:${a.id}:${ay}`,{abonelik_id:a.id,ad:a.ad,tutar:a.tutar_kurus,zarf_id:a.zarf_id,tarih:t});
    }
    const onceki=oncekiAy(ay);
    if(!baslangic||baslangic.slice(0,7)<=onceki)kapanis(onceki);
  }
  if(aksam&&gun===planGunu(ay,31))kapanis(ay);
  return cikti;
}

// Öneriyi uygulayan SQL ifadeleri (tek D1 batch'inde çalışır). Son ifade öneriyi kapatır.
export function uygulaSql(oneri,karar,duzenleme,ctx){
  if(karar!=="onayla"&&karar!=="reddet")throw new Hata("Karar onayla ya da reddet olmalı.");
  const d=oneri.detay,id=oneri.id,ifadeler=[],ekle=(sql,...p)=>ifadeler.push([sql,...p]);
  const dagit=(ay,zarf,tutar)=>ekle("INSERT INTO dagitimlar(ay,zarf_id,tutar_kurus,oneri_id,tarih) VALUES(?,?,?,?,?)",ay,zarf,tutar,id,ctx.bugun);
  if(oneri.tur==="dagitim"){
    if(karar==="onayla"){
      const tutar=duzenleme&&!bos(duzenleme.tutar)?tutarDogrula(duzenleme.tutar):d.tutar;
      const kalemler=duzenleme&&Array.isArray(duzenleme.kalemler)
        ?duzenleme.kalemler.map(k=>({zarf_id:Number(k.zarf_id),tutar:tutarDogrula(k.tutar,{sifir:true})})).filter(k=>k.tutar>0)
        :d.kalemler;
      if(kalemler.some(k=>!ctx.aktifZarf.has(k.zarf_id)))return {eskidi:"Önerideki bir zarf artık yok."};
      if(kalemler.reduce((t,k)=>t+k.tutar,0)>tutar)throw new Hata("Dağıtılan, gelen paradan fazla olamaz.");
      if(d.gelir)ekle("INSERT INTO gelirler(plan_id,tutar_kurus,aciklama,tarih,oneri_id) VALUES(?,?,?,?,?)",d.gelir.plan_id,tutar,d.gelir.aciklama,d.gelir.tarih,id);
      else if(tutar!==d.tutar)ekle("UPDATE gelirler SET tutar_kurus=? WHERE id=?",tutar,d.gelir_id);
      for(const k of kalemler)dagit(d.ay,k.zarf_id,k.tutar);
    }
  }else if(oneri.tur==="abonelik"){
    if(karar==="onayla")ekle("INSERT INTO harcamalar(istek_id,tutar_kurus,aciklama,zarf_id,tarih,kaynak) VALUES(?,?,?,?,?,'el') ON CONFLICT(istek_id) DO NOTHING",
      `abonelik:${d.abonelik_id}:${d.tarih.slice(0,7)}`,d.tutar,d.ad,ctx.aktifZarf.has(d.zarf_id)?d.zarf_id:null,d.tarih);
  }else if(oneri.tur==="kaydirma"){
    if(karar==="onayla"){
      const k=kaydirmaOner(ctx.durum(d.ay),d.zarf_id);
      if(!k||!k.kaynaklar.length)return {eskidi:"Zarf artık eksi değil ya da kaydırılacak para yok."};
      dagit(d.ay,d.zarf_id,k.kaynaklar.reduce((t,x)=>t+x.tutar,0));
      for(const x of k.kaynaklar)if(x.zarf_id!==null)dagit(d.ay,x.zarf_id,-x.tutar);
    }
  }else if(oneri.tur==="aktarim"){
    const k=ayKapanisi(ctx.durum(d.ay));
    let parcalar=[];
    if(karar==="onayla"&&k.toplam>0){parcalar=merdivenDagit(ctx.merdiven,k.toplam,ctx.mctx);if(!parcalar.length)throw new Hata("Önce hedef merdivenini kur.");}
    for(const x of k.kapama)dagit(d.ay,x.zarf_id,x.tutar);
    for(const x of k.dusum)dagit(d.ay,x.zarf_id,-x.tutar);
    if(parcalar.length){
      for(const x of k.kaynaklar)ekle("INSERT INTO aktarimlar(ay,zarf_id,merdiven_id,tutar_kurus,oneri_id,tarih) VALUES(?,?,?,?,?,?)",d.ay,x.zarf_id,parcalar[0].id,x.tutar,id,ctx.bugun);
      for(const p of parcalar)ekle("UPDATE merdiven SET biriken_kurus=biriken_kurus+? WHERE id=?",p.tutar,p.id);
    }else for(const x of k.kaynaklar)if(x.zarf_id!==null)dagit(d.ay,x.zarf_id,-x.tutar);
  }else throw new Hata("Bilinmeyen öneri türü.");
  ekle("UPDATE oneriler SET durum=?,karar=? WHERE id=?",karar==="onayla"?"onaylandi":"reddedildi",ctx.simdi,id);
  return {ifadeler};
}

// Kartta gösterilecek metin ve satırlar. Kaydırma ve kapanış tutarları güncel veriden hesaplanır.
export function oneriGorunum(o,{durum,zarfAd,merdiven,mctx}){
  const d=o.detay,ad=id=>id==null?"Atanmamış":zarfAd.get(id)||"Silinmiş zarf";
  const temel={id:o.id,tur:o.tur,duzenlenebilir:false,aciklama:""};
  const satir=x=>({zarf_id:x.zarf_id,ad:ad(x.zarf_id),tutar:x.tutar});
  if(o.tur==="dagitim"){
    const dag=d.kalemler.reduce((t,k)=>t+k.tutar,0),satirlar=d.kalemler.map(satir);
    if(d.tutar-dag>0)satirlar.push({zarf_id:null,ad:"Atanmamış",tutar:d.tutar-dag});
    return {...temel,baslik:d.gelir?`${d.gelir.aciklama}: ${tl(d.tutar)} geldi mi?`:`${tl(d.tutar)} geldi`,
      aciklama:d.gelir?"Geldiyse şöyle dağıtayım mı? Tutar farklıysa Düzenle'ye bas.":"Şöyle dağıtayım mı?",
      satirlar,toplam:d.tutar,tutar:d.tutar,duzenlenebilir:true};
  }
  if(o.tur==="abonelik")return {...temel,baslik:`${d.ad} ${tl(d.tutar)} çekildi mi?`,aciklama:"Onaylarsan zarftan düşerim.",satirlar:[satir({zarf_id:d.zarf_id,tutar:d.tutar})],toplam:d.tutar};
  if(o.tur==="kaydirma"){
    const k=kaydirmaOner(durum(d.ay),d.zarf_id);
    if(!k)return {...temel,baslik:`${ad(d.zarf_id)} artık eksi değil`,aciklama:"Reddedip kapatabilirsin.",satirlar:[],toplam:0};
    const top=k.kaynaklar.reduce((t,x)=>t+x.tutar,0);
    return {...temel,baslik:`${ad(d.zarf_id)} zarfı ${tl(top+k.karsilanamayan)} eksi`,
      aciklama:k.karsilanamayan>0?`Kaydırılacak para yetmiyor: ${tl(k.karsilanamayan)} açık kalır.`:"Şuradan kaydırayım mı?",
      satirlar:k.kaynaklar.map(satir),toplam:top};
  }
  if(o.tur==="aktarim"){
    const k=ayKapanisi(durum(d.ay)),hedef=merdivenDurumu(merdiven,mctx).find(b=>!b.tamam);
    const eksi=k.kapama.length?` Eksi zarflar (${k.kapama.map(x=>ad(x.zarf_id)).join(", ")}) önce kapatılır.`:"";
    return {...temel,baslik:`${ayAdi(d.ay)} kapanışı: ${tl(k.toplam)} hedefe aktarılsın mı?`,
      aciklama:`${hedef?`Hedef: ${hedef.ad}.`:"Tüm basamaklar tamam; son basamağa eklenir."} Reddedersen kalanlar Atanmamış'a döner.${eksi}`,
      satirlar:k.kaynaklar.map(satir),toplam:k.toplam};
  }
  return {...temel,baslik:"Bilinmeyen öneri",satirlar:[],toplam:0};
}
```

- [ ] **Adım 4: Testi çalıştır ve geçtiğini gör**

Çalıştır: `node --test tests/core.test.js`
Beklenen: 21 test GEÇER.

- [ ] **Adım 5: Commit**

```bash
git add diogenes/app/src/core.js diogenes/app/tests/core.test.js
git commit -m "Diogenes: oneri uretimi, uygulama ve gorunum"
```

---

### Görev 6: Worker (oturum, API, zamanlayıcı) ve duman testi

**Dosyalar:**
- Oluştur: `diogenes/app/src/worker.js`, `diogenes/app/scripts/build.mjs`, `diogenes/app/scripts/dev-vars.mjs`, `diogenes/app/scripts/duman.mjs`, `diogenes/app/public/giris.html` (duman testi girişi için gerekiyor; asıl giriş ekranı Görev 7'de yapılacak)

**Arayüzler:**
- Tüketir: `core.js` içindeki bütün dışa açık fonksiyonlar.
- Üretir (HTTP). Tüm uçlar oturum çerezi `diogenes_oturum` ister; `/api/login` istisnadır.
  - `POST /api/login {password}`
  - `POST /api/logout`
  - `GET /api/durum?ay=YYYY-AA` şunu döner: `{bugun,ay,kurulum,getiri,durum,oneriler,merdiven,zarflar,gelirPlani,abonelikler,borclar,birikimler,aylikToplam}`
  - `GET /api/gecmis?ay=` şunu döner: `{harcamalar,gelirler,aktarimlar,zarflar}`
  - `POST /api/harcama`, `/api/harcama/duzenle {id,...}`, `/api/harcama/sil {id}`
  - `POST /api/gelir`, `/api/gelir/duzenle {id,...}`, `/api/gelir/sil {id}`
  - `POST /api/oneri {id,karar,duzenleme?}`: başarılıysa `{ok:true}`; karar zaten verilmişse ya da öneri eskiyse 409.
  - `PUT /api/liste {tablo,satirlar}`
  - `POST /api/ayar {anahtar:"kurulum"|"getiri",deger}`
  - Hatalarda 400 ve `{error}` döner. Mesaj Türkçedir.

- [ ] **Adım 1: Duman testini yaz (bu testin başarısız olması bekleniyor)**

`diogenes/app/scripts/duman.mjs`:
```js
// Uçtan uca duman testi: `npm run dev` açıkken temiz yerel veritabanına karşı çalışır.
import fs from "node:fs";
import assert from "node:assert/strict";
const TABAN=process.env.DIOGENES_TABAN||"http://127.0.0.1:8787";
const vars=Object.fromEntries(fs.readFileSync(new URL("../.dev.vars",import.meta.url),"utf8").split(/\r?\n/).filter(Boolean).map(l=>l.split(/=(.*)/s).slice(0,2)));
let cerez="";
async function istek(yol,{method="GET",govde}={}){
  const r=await fetch(TABAN+yol,{method,headers:{"Content-Type":"application/json",cookie:cerez},body:govde?JSON.stringify(govde):undefined});
  const sc=r.headers.get("set-cookie");if(sc)cerez=sc.split(";")[0];
  return {status:r.status,j:await r.json().catch(()=>({}))};
}
const tamam=async(yol,o)=>{const r=await istek(yol,o);assert.ok(r.status<300,`${yol} → ${r.status} ${JSON.stringify(r.j)}`);return r.j;};
const zarf=(d,ad)=>d.durum.zarflar.find(z=>z.ad===ad);

assert.equal((await istek("/api/durum")).status,401,"girişsiz durum 401");
assert.equal((await istek("/api/login",{method:"POST",govde:{password:"yanlis"}})).status,401);
await tamam("/api/login",{method:"POST",govde:{password:vars.AUTH_PASSWORD}});
let d=await tamam("/api/durum");assert.equal(d.kurulum,false);

await tamam("/api/liste",{method:"PUT",govde:{tablo:"gelir_plani",satirlar:[{ad:"Aile",tutar:"15.000",gun:1},{ad:"Burs",tutar:"4.000",gun:7},{ad:"Destek",tutar:"16.000",gun:16}]}});
await tamam("/api/liste",{method:"PUT",govde:{tablo:"zarflar",satirlar:[{ad:"Kira",aylik:"10.000"},{ad:"Yemek",aylik:"6.000"}]}});
await tamam("/api/liste",{method:"PUT",govde:{tablo:"merdiven",satirlar:[{ad:"Borçsuzluk",kural:"borc"},{ad:"Acil fon",kural:"acil3"},{ad:"Yatırım"}]}});
await tamam("/api/ayar",{method:"POST",govde:{anahtar:"kurulum",deger:"1"}});

const bozuk=await istek("/api/harcama",{method:"POST",govde:{tutar:"0",aciklama:"x"}});
assert.equal(bozuk.status,400);assert.equal(bozuk.j.error,"Tutar sıfır olamaz.");

await tamam("/api/gelir",{method:"POST",govde:{tutar:"15.000",aciklama:"Deneme geliri"}});
d=await tamam("/api/durum");
assert.equal(d.durum.atanmamis,1500000);
const dag=d.oneriler.find(o=>o.tur==="dagitim");
assert.deepEqual(dag.satirlar.map(s=>[s.ad,s.tutar]),[["Kira",1000000],["Yemek",500000]]);
await tamam("/api/oneri",{method:"POST",govde:{id:dag.id,karar:"onayla"}});
assert.equal((await istek("/api/oneri",{method:"POST",govde:{id:dag.id,karar:"onayla"}})).status,409,"ikinci onay 409");
d=await tamam("/api/durum");
assert.equal(d.durum.atanmamis,0);assert.equal(zarf(d,"Kira").kalan,1000000);

const h={istek_id:"duman-1",tutar:"6.000",aciklama:"Market",zarf_id:zarf(d,"Yemek").id};
await tamam("/api/harcama",{method:"POST",govde:h});
await tamam("/api/harcama",{method:"POST",govde:h});
d=await tamam("/api/durum");
assert.equal(zarf(d,"Yemek").harcanan,600000,"aynı istek_id çoğalmaz");
const kay=d.oneriler.find(o=>o.tur==="kaydirma");assert.ok(kay,"eksi zarf için kaydırma önerisi");
await tamam("/api/oneri",{method:"POST",govde:{id:kay.id,karar:"onayla"}});
d=await tamam("/api/durum");
assert.equal(zarf(d,"Yemek").kalan,0);assert.equal(zarf(d,"Kira").kalan,900000);

const once=(await tamam("/api/durum")).oneriler.length;
for(let i=0;i<2;i++){const r=await fetch(TABAN+"/__scheduled?cron="+encodeURIComponent("0 5 * * *"));assert.equal(r.status,200);}
assert.ok((await tamam("/api/durum")).oneriler.length<=once+3,"zamanlayıcı iki kez çalışınca çift öneri yok");

await tamam("/api/liste",{method:"PUT",govde:{tablo:"zarflar",satirlar:[{id:zarf(d,"Kira").id,ad:"Kira",aylik:"10.000"}]}});
d=await tamam("/api/durum");
assert.equal(d.durum.zarflar.length,1);assert.equal(d.durum.atanmamis,0,"silinen Yemek'in kalanı 0'dı");
const g=await tamam(`/api/gecmis?ay=${d.ay}`);assert.equal(g.harcamalar.length,1);
console.log("Duman testi GEÇTİ");
```

`diogenes/app/scripts/dev-vars.mjs`:
```js
// Yerel geliştirme için .dev.vars: yoksa rastgele test şifresi ve oturum anahtarı yazar (gerçek şifre değildir).
import fs from "node:fs";
import crypto from "node:crypto";
const yol=new URL("../.dev.vars",import.meta.url);
if(!fs.existsSync(yol)){
  const r=()=>crypto.randomBytes(24).toString("hex");
  fs.writeFileSync(yol,`AUTH_PASSWORD=${r()}\nSESSION_SECRET=${r()}\nDAZAI_KEY=${r()}\n`);
  console.log(".dev.vars yazıldı (yerel test değerleri).");
}
```

`diogenes/app/scripts/build.mjs`:
```js
// Arayüz core.js'i tarayıcıda da kullanır: src/core.js → public/core.js.
import fs from "node:fs";
fs.copyFileSync(new URL("../src/core.js",import.meta.url),new URL("../public/core.js",import.meta.url));
for(const f of ["index.html","app.js","giris.html"])if(!fs.existsSync(new URL("../public/"+f,import.meta.url)))console.warn("Eksik: public/"+f);
console.log("public/core.js güncellendi.");
```

Geçici `diogenes/app/public/giris.html`. Bu dosya Görev 7'de stilli haliyle değiştirilecek:
```html
<!doctype html><meta charset="utf-8"><title>Diogenes giriş</title>
<form id="f"><input type="password" name="p" autocomplete="current-password"><button>Giriş</button></form>
<script>f.onsubmit=async e=>{e.preventDefault();const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:f.p.value})});if(r.ok)location.href="/";else alert((await r.json()).error)}</script>
```

- [ ] **Adım 2: Duman testini çalıştır ve başarısız olduğunu gör**

Çalıştır (iki ayrı terminal):
1. `cd D:\Claude\diogenes\app; Remove-Item -Recurse -Force .wrangler\state -ErrorAction SilentlyContinue; node node_modules/wrangler/bin/wrangler.js d1 migrations apply diogenes --local; npm run dev`
2. `cd D:\Claude\diogenes\app; npm run duman`

Beklenen: `npm run dev`, `src/worker.js` bulunamadığı için açılmaz. Duman testi de bağlanamaz (`fetch failed`).

- [ ] **Adım 3: `src/worker.js`'i yaz**

```js
// Diogenes sunucusu (Cloudflare Worker + D1). Tek kullanıcı: şifreli giriş, imzalı çerez.
// Bütün hesaplar src/core.js'te (saf, testli); burası yalnız HTTP, D1 ve zamanlayıcı.
import {Hata,istanbulGun,ayDurumu,merdivenDurumu,dagitimOner,gunlukOneriler,uygulaSql,oneriGorunum,listeDogrula,LISTE_SUTUNLARI,harcamaDogrula,gelirDogrula} from "./core.js";

const COOKIE="diogenes_oturum",SESSION_SECONDS=180*24*3600,MAX_GOVDE=64*1024;
const enc=new TextEncoder();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sign(secret,payload){const k=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(await crypto.subtle.sign("HMAC",k,enc.encode(payload)))}
async function safeEqual(a,b){const [x,y]=await Promise.all([a,b].map(v=>crypto.subtle.digest("SHA-256",enc.encode(v))));const l=new Uint8Array(x),r=new Uint8Array(y);let d=0;for(let i=0;i<l.length;i++)d|=l[i]^r[i];return d===0}
async function createSession(secret){const exp=String(Math.floor(Date.now()/1000)+SESSION_SECONDS);return `${exp}.${await sign(secret,exp)}`}
async function verifySession(secret,token){if(!secret||!token)return false;const [exp,sig,...rest]=token.split(".");if(rest.length||!/^\d{1,12}$/.test(exp||"")||!sig)return false;if(Number(exp)*1000<=Date.now())return false;return safeEqual(sig,await sign(secret,exp))}
const cookieOf=(req,name)=>{const m=(req.headers.get("cookie")||"").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));return m?decodeURIComponent(m[1]):undefined};
const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}});
const nowIso=()=>new Date().toISOString();
async function govde(req){const len=Number(req.headers.get("content-length")||0);if(len>MAX_GOVDE)throw new Hata("İstek çok büyük.");const t=await req.text();if(t.length>MAX_GOVDE)throw new Hata("İstek çok büyük.");try{return t?JSON.parse(t):{}}catch{throw new Hata("Geçersiz istek.")}}
function sameOrigin(req){const o=req.headers.get("origin");return !o||o===new URL(req.url).origin}

async function login(req,env){
  if(!sameOrigin(req))return json({error:"İstek reddedildi."},403);
  const ip=req.headers.get("cf-connecting-ip")||"?",since=new Date(Date.now()-15*60000).toISOString();
  await env.DB.prepare("DELETE FROM login_attempts WHERE at<?").bind(new Date(Date.now()-86400000).toISOString()).run();
  const n=await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE address=? AND at>?").bind(ip,since).first();
  if(n&&n.n>=8)return json({error:"Çok fazla deneme. 15 dakika sonra tekrar dene."},429);
  let password="";try{password=String((await govde(req)).password||"")}catch{return json({error:"Geçersiz istek."},400)}
  if(!env.AUTH_PASSWORD||!password||!(await safeEqual(password,env.AUTH_PASSWORD))){
    await env.DB.prepare("INSERT INTO login_attempts(address,at) VALUES(?,?)").bind(ip,nowIso()).run();
    return json({error:"Şifre yanlış."},401);
  }
  return json({ok:true},200,{"Set-Cookie":`${COOKIE}=${await createSession(env.SESSION_SECRET)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`});
}

const hepsi=async(env,sql,...p)=>(await env.DB.prepare(sql).bind(...p).all()).results;
async function veriYukle(env){
  const q=s=>hepsi(env,s);
  const [zarflar,gelirler,dagitimlar,harcamalar,aktarimlar,gelirPlani,abonelikler,borclar,birikimler,merdiven,ayarSatir]=await Promise.all([
    q("SELECT * FROM zarflar"),q("SELECT * FROM gelirler"),q("SELECT * FROM dagitimlar"),q("SELECT * FROM harcamalar"),q("SELECT * FROM aktarimlar"),
    q("SELECT * FROM gelir_plani ORDER BY gun,id"),q("SELECT * FROM abonelikler ORDER BY gun,id"),q("SELECT * FROM borclar ORDER BY id"),
    q("SELECT * FROM birikimler ORDER BY id"),q("SELECT * FROM merdiven ORDER BY sira,id"),q("SELECT * FROM ayarlar")]);
  const v={zarflar,gelirler,dagitimlar,harcamalar,aktarimlar,gelirPlani,abonelikler,borclar,birikimler,merdiven,ayarlar:Object.fromEntries(ayarSatir.map(r=>[r.anahtar,r.deger]))};
  v.durum=ay=>ayDurumu(ay,v);
  v.mctx={aylikToplam:zarflar.filter(z=>z.aktif).reduce((t,z)=>t+z.aylik_kurus,0),borcToplam:borclar.reduce((t,b)=>t+b.kalan_kurus,0)};
  v.aktifZarf=new Set(zarflar.filter(z=>z.aktif).map(z=>z.id));
  return v;
}
const oneriEkle=(env,tur,anahtar,detay)=>env.DB.prepare("INSERT INTO oneriler(tur,anahtar,detay_json,olusturma) VALUES(?,?,?,?) ON CONFLICT(anahtar) DO NOTHING").bind(tur,anahtar,JSON.stringify(detay),nowIso()).run();

async function durumYaniti(env,ay,bugun){
  const v=await veriYukle(env),zarfAd=new Map(v.zarflar.map(z=>[z.id,z.ad]));
  const bekleyen=await hepsi(env,"SELECT * FROM oneriler WHERE durum='bekliyor' ORDER BY id");
  return {bugun,ay,kurulum:v.ayarlar.kurulum==="1",getiri:Number(v.ayarlar.getiri||"0"),durum:v.durum(ay),
    oneriler:bekleyen.map(r=>oneriGorunum({id:r.id,tur:r.tur,detay:JSON.parse(r.detay_json)},{durum:v.durum,zarfAd,merdiven:v.merdiven,mctx:v.mctx})),
    merdiven:merdivenDurumu(v.merdiven,v.mctx),zarflar:v.zarflar,gelirPlani:v.gelirPlani,abonelikler:v.abonelikler,borclar:v.borclar,birikimler:v.birikimler,aylikToplam:v.mctx.aylikToplam};
}
async function zarfKontrol(env,zarfId){
  if(zarfId==null)return;
  const z=await env.DB.prepare("SELECT aktif FROM zarflar WHERE id=?").bind(zarfId).first();
  if(!z||!z.aktif)throw new Hata("Zarf bulunamadı.");
}
async function eksiKontrol(env,ay,zarfId,ref){
  if(zarfId==null)return;
  const v=await veriYukle(env),z=v.durum(ay).zarflar.find(z=>z.id===zarfId);
  if(!z||z.kalan>=0)return;
  const var_=await env.DB.prepare("SELECT 1 AS x FROM oneriler WHERE durum='bekliyor' AND anahtar LIKE ?").bind(`kaydirma:${ay}:${zarfId}:%`).first();
  if(!var_)await oneriEkle(env,"kaydirma",`kaydirma:${ay}:${zarfId}:${ref}`,{ay,zarf_id:zarfId});
}
async function harcamaEkle(env,b,bugun){
  const h=harcamaDogrula(b,bugun);await zarfKontrol(env,h.zarf_id);
  const istek=h.istek_id||crypto.randomUUID();
  await env.DB.prepare("INSERT INTO harcamalar(istek_id,tutar_kurus,aciklama,zarf_id,tarih,kaynak,etiket) VALUES(?,?,?,?,?,'el',?) ON CONFLICT(istek_id) DO NOTHING").bind(istek,h.tutar_kurus,h.aciklama,h.zarf_id,h.tarih,h.etiket).run();
  const row=await env.DB.prepare("SELECT id,zarf_id,tarih FROM harcamalar WHERE istek_id=?").bind(istek).first();
  await eksiKontrol(env,row.tarih.slice(0,7),row.zarf_id,row.id);
  return {ok:true,id:row.id};
}
async function harcamaDuzenle(env,b,bugun){
  const id=Number(b.id),h=harcamaDogrula({...b,istek_id:null},bugun);await zarfKontrol(env,h.zarf_id);
  const r=await env.DB.prepare("UPDATE harcamalar SET tutar_kurus=?,aciklama=?,zarf_id=?,tarih=? WHERE id=?").bind(h.tutar_kurus,h.aciklama,h.zarf_id,h.tarih,id).run();
  if(!r.meta.changes)throw new Hata("Harcama bulunamadı.");
  await eksiKontrol(env,h.tarih.slice(0,7),h.zarf_id,id);
  return {ok:true};
}
async function gelirEkle(env,b,bugun){
  const g=gelirDogrula(b,bugun);
  const r=await env.DB.prepare("INSERT INTO gelirler(tutar_kurus,aciklama,tarih) VALUES(?,?,?)").bind(g.tutar_kurus,g.aciklama,g.tarih).run();
  const id=r.meta.last_row_id,ay=g.tarih.slice(0,7),v=await veriYukle(env);
  await oneriEkle(env,"dagitim",`dagitim:gelir:${id}`,{ay,tutar:g.tutar_kurus,gelir_id:id,kalemler:dagitimOner(g.tutar_kurus,v.durum(ay)).kalemler});
  return {ok:true,id};
}
async function oneriKarar(env,b,bugun){
  const id=Number(b.id);if(!Number.isInteger(id))throw new Hata("Öneri bulunamadı.");
  const row=await env.DB.prepare("SELECT * FROM oneriler WHERE id=?").bind(id).first();
  if(!row)throw new Hata("Öneri bulunamadı.");
  if(row.durum!=="bekliyor")return json({error:"Bu öneri için zaten karar verilmiş."},409);
  const v=await veriYukle(env),oneri={id,tur:row.tur,detay:JSON.parse(row.detay_json)};
  const r=uygulaSql(oneri,b.karar,b.duzenleme||null,{durum:v.durum,merdiven:v.merdiven,mctx:v.mctx,aktifZarf:v.aktifZarf,simdi:nowIso(),bugun});
  const al=await env.DB.prepare("UPDATE oneriler SET durum='isleniyor' WHERE id=? AND durum='bekliyor'").bind(id).run();
  if(!al.meta.changes)return json({error:"Bu öneri için zaten karar verilmiş."},409);
  if(r.eskidi){
    await env.DB.prepare("UPDATE oneriler SET durum='eskidi',anahtar=anahtar||':eski:'||id,karar=? WHERE id=?").bind(nowIso(),id).run();
    if(oneri.tur==="dagitim"){const v2=await veriYukle(env);await oneriEkle(env,"dagitim",row.anahtar,{...oneri.detay,kalemler:dagitimOner(oneri.detay.tutar,v2.durum(oneri.detay.ay)).kalemler});}
    return json({error:`${r.eskidi} Öneri yenilendi, tekrar bak.`},409);
  }
  try{await env.DB.batch(r.ifadeler.map(([sql,...p])=>env.DB.prepare(sql).bind(...p)));}
  catch(e){await env.DB.prepare("UPDATE oneriler SET durum='bekliyor' WHERE id=? AND durum='isleniyor'").bind(id).run();throw e;}
  return json({ok:true});
}
const LISTE_VERI={zarflar:"zarflar",gelir_plani:"gelirPlani",abonelikler:"abonelikler",borclar:"borclar",birikimler:"birikimler",merdiven:"merdiven"};
async function listeKaydet(env,b,bugun){
  const tablo=b.tablo,rows=listeDogrula(tablo,b.satirlar),cols=LISTE_SUTUNLARI[tablo],v=await veriYukle(env);
  const eski=v[LISTE_VERI[tablo]].filter(r=>tablo!=="zarflar"||r.aktif),mevcut=new Set(eski.map(r=>r.id)),tut=new Set(rows.filter(r=>r.id).map(r=>r.id));
  for(const r of rows)if(r.id&&!mevcut.has(r.id))throw new Hata("Liste bu arada değişti; sayfayı yenile.");
  if(tablo==="abonelikler")for(const r of rows)if(r.zarf_id!=null&&!v.aktifZarf.has(r.zarf_id))throw new Hata("Abonelikteki zarf bulunamadı.");
  const st=[],ay=bugun.slice(0,7),durum=v.durum(ay);
  for(const r of rows){
    if(r.id)st.push(env.DB.prepare(`UPDATE ${tablo} SET ${cols.map(c=>c+"=?").join(",")} WHERE id=?`).bind(...cols.map(c=>r[c]),r.id));
    else if(tablo==="zarflar")st.push(env.DB.prepare("INSERT INTO zarflar(ad,aylik_kurus,sira,aktif,olusturma) VALUES(?,?,?,1,?)").bind(r.ad,r.aylik_kurus,r.sira,bugun));
    else st.push(env.DB.prepare(`INSERT INTO ${tablo}(${cols.join(",")}) VALUES(${cols.map(()=>"?").join(",")})`).bind(...cols.map(c=>r[c])));
  }
  for(const id of mevcut)if(!tut.has(id)){
    if(tablo==="zarflar"){
      st.push(env.DB.prepare("UPDATE zarflar SET aktif=0 WHERE id=?").bind(id));
      const z=durum.zarflar.find(z=>z.id===id);
      if(z&&z.kalan!==0)st.push(env.DB.prepare("INSERT INTO dagitimlar(ay,zarf_id,tutar_kurus,tarih) VALUES(?,?,?,?)").bind(ay,id,-z.kalan,bugun));
    }else st.push(env.DB.prepare(`DELETE FROM ${tablo} WHERE id=?`).bind(id));
  }
  if(st.length)await env.DB.batch(st);
  return {ok:true};
}
async function ayarKaydet(env,b,bugun){
  if(b.anahtar==="kurulum"){
    await env.DB.batch([
      env.DB.prepare("INSERT INTO ayarlar(anahtar,deger) VALUES('kurulum','1') ON CONFLICT(anahtar) DO UPDATE SET deger='1'"),
      env.DB.prepare("INSERT INTO ayarlar(anahtar,deger) VALUES('baslangic',?) ON CONFLICT(anahtar) DO NOTHING").bind(bugun)]);
    return {ok:true};
  }
  if(b.anahtar==="getiri"){
    const n=Number(String(b.deger).replace(",","."));
    if(!Number.isFinite(n)||n<0||n>100)throw new Hata("Getiri 0 ile 100 arasında olmalı.");
    await env.DB.prepare("INSERT INTO ayarlar(anahtar,deger) VALUES('getiri',?) ON CONFLICT(anahtar) DO UPDATE SET deger=excluded.deger").bind(String(n)).run();
    return {ok:true};
  }
  throw new Hata("Bilinmeyen ayar.");
}
const ayParam=(url,bugun)=>{const a=url.searchParams.get("ay")||"";return /^\d{4}-(0[1-9]|1[0-2])$/.test(a)?a:bugun.slice(0,7)};

async function api(req,env,url){
  const p=url.pathname,m=req.method,bugun=istanbulGun(new Date());
  if(p==="/api/login"&&m==="POST")return login(req,env);
  if(!(await verifySession(env.SESSION_SECRET,cookieOf(req,COOKIE))))return json({error:"Giriş yapman gerekiyor."},401);
  if(m!=="GET"&&!sameOrigin(req))return json({error:"İstek reddedildi."},403);
  try{
    if(p==="/api/logout"&&m==="POST")return json({ok:true},200,{"Set-Cookie":`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
    if(p==="/api/durum"&&m==="GET")return json(await durumYaniti(env,ayParam(url,bugun),bugun));
    if(p==="/api/gecmis"&&m==="GET"){
      const ay=ayParam(url,bugun);
      const [harcamalar,gelirler,aktarimlar,zarflar]=await Promise.all([
        hepsi(env,"SELECT * FROM harcamalar WHERE substr(tarih,1,7)=? ORDER BY tarih DESC,id DESC",ay),
        hepsi(env,"SELECT * FROM gelirler WHERE substr(tarih,1,7)=? ORDER BY tarih DESC,id DESC",ay),
        hepsi(env,"SELECT * FROM aktarimlar WHERE ay=?",ay),hepsi(env,"SELECT id,ad,aktif FROM zarflar ORDER BY sira,id")]);
      return json({ay,harcamalar,gelirler,aktarimlar,zarflar});
    }
    const b=await govde(req);
    if(p==="/api/harcama"&&m==="POST")return json(await harcamaEkle(env,b,bugun));
    if(p==="/api/harcama/duzenle"&&m==="POST")return json(await harcamaDuzenle(env,b,bugun));
    if(p==="/api/harcama/sil"&&m==="POST"){await env.DB.prepare("DELETE FROM harcamalar WHERE id=?").bind(Number(b.id)).run();return json({ok:true});}
    if(p==="/api/gelir"&&m==="POST")return json(await gelirEkle(env,b,bugun));
    if(p==="/api/gelir/duzenle"&&m==="POST"){const g=gelirDogrula(b,bugun);const r=await env.DB.prepare("UPDATE gelirler SET tutar_kurus=?,aciklama=?,tarih=? WHERE id=?").bind(g.tutar_kurus,g.aciklama,g.tarih,Number(b.id)).run();if(!r.meta.changes)throw new Hata("Gelir bulunamadı.");return json({ok:true});}
    if(p==="/api/gelir/sil"&&m==="POST"){await env.DB.prepare("DELETE FROM gelirler WHERE id=?").bind(Number(b.id)).run();return json({ok:true});}
    if(p==="/api/oneri"&&m==="POST")return await oneriKarar(env,b,bugun);
    if(p==="/api/liste"&&m==="PUT")return json(await listeKaydet(env,b,bugun));
    if(p==="/api/ayar"&&m==="POST")return json(await ayarKaydet(env,b,bugun));
  }catch(e){if(e instanceof Hata)return json({error:e.message},400);throw e;}
  return json({error:"Bulunamadı."},404);
}

async function zamanli(env,cron,simdi){
  const gun=istanbulGun(simdi),v=await veriYukle(env);
  if(v.ayarlar.kurulum!=="1")return;
  const mevcut=new Set((await hepsi(env,"SELECT anahtar FROM oneriler")).map(r=>r.anahtar));
  const yeni=gunlukOneriler(gun,{gelirPlani:v.gelirPlani,gelirler:v.gelirler,abonelikler:v.abonelikler,mevcut,aksam:cron==="30 20 * * *",baslangic:v.ayarlar.baslangic,durum:v.durum});
  for(const o of yeni)await oneriEkle(env,o.tur,o.anahtar,o.detay);
  console.log(gun,cron,"öneri",yeni.length);
}

const PUBLIC=new Set(["/giris.html","/manifest.webmanifest","/sw.js","/icon.svg","/icon-180.png","/icon-192.png","/icon-512.png"]);
export default {
  async fetch(req,env){
    const url=new URL(req.url);
    try{
      if(url.pathname.startsWith("/api/"))return await api(req,env,url);
      if(PUBLIC.has(url.pathname))return env.ASSETS.fetch(req);
      if(!(await verifySession(env.SESSION_SECRET,cookieOf(req,COOKIE))))return env.ASSETS.fetch(new Request(new URL("/giris.html",url),req));
      if(url.pathname==="/")return env.ASSETS.fetch(new Request(new URL("/index.html",url),req));
      return env.ASSETS.fetch(req);
    }catch(e){console.error("istek hatası",e&&e.message);return json({error:"Sunucu hatası."},500)}
  },
  async scheduled(event,env,ctx){ctx.waitUntil(zamanli(env,event.cron,new Date(event.scheduledTime)))}
};
```

- [ ] **Adım 4: Duman testini çalıştır ve geçtiğini gör**

Önce yukarıdaki 1. terminaldeki komutu yeniden çalıştır: önceki durumu temizle, şemayı uygula, `npm run dev` ile başlat. Ardından:

Çalıştır: `cd D:\Claude\diogenes\app; npm run duman; npm test`
Beklenen: `Duman testi GEÇTİ` çıktısı görülür ve 21 test GEÇER.

- [ ] **Adım 5: Commit**

```bash
git add diogenes/app/src/worker.js diogenes/app/scripts diogenes/app/public/giris.html
git commit -m "Diogenes: worker, API, zamanlayici ve duman testi"
```

---

### Görev 7: Arayüz kabuğu, Zarflar ekranı, öneri kartları, harcama/gelir

**Dosyalar:**
- Oluştur: `diogenes/app/public/index.html`, `diogenes/app/public/app.js`, `diogenes/app/public/manifest.webmanifest`, `diogenes/app/public/sw.js`
- Değiştir: `diogenes/app/public/giris.html` (stilli haline getir)
- Kopyala: `diogenes/icon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png` → `diogenes/app/public/`

**Arayüzler:**
- Tüketir: Görev 6'daki HTTP uçları ve `public/core.js` (`tl`, `kurusa`, `ayAdi`, `ozgurlukSuresi`, `VARSAYILAN_MERDIVEN`, `BIRIKIM_TURLERI`).
- Üretir: `app.js` içinde `h`, `api`, `sayfa`, `alan`, `zarfSecimi`, `tlYaz`, `ciz`, `yukle`, `is`. Bunlar Görev 8 ve 9'da aynı dosyada kullanılacak.

- [ ] **Adım 1: Kabuğu ve stili yaz**

`diogenes/app/public/index.html`:
```html
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f1115">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Diogenes">
<title>Diogenes</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="icon" href="/icon.svg">
<style>
:root{--zemin:#0f1115;--kart:#181b22;--kart2:#20242d;--cizgi:#2a2f3a;--yazi:#e8eaf0;--soluk:#8b93a5;--vurgu:#5eead4;--eksi:#f87171;--uyari:#fbbf24;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--zemin);color:var(--yazi);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;padding:env(safe-area-inset-top) 0 calc(72px + env(safe-area-inset-bottom))}
main{max-width:560px;margin:0 auto;padding:12px 16px}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:0 0 10px;color:var(--soluk);font-weight:600}h3{font-size:16px;margin:0 0 4px}
.ust{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--zemin);max-width:560px;margin:0 auto}
.alt{position:fixed;left:0;right:0;bottom:0;display:flex;background:var(--kart);border-top:1px solid var(--cizgi);padding-bottom:env(safe-area-inset-bottom);z-index:5}
.alt button{flex:1;background:none;border:0;color:var(--soluk);padding:14px 0;font:inherit;font-size:14px}
.alt button.secili{color:var(--vurgu);font-weight:600}
button{font:inherit;color:var(--yazi);background:var(--kart2);border:1px solid var(--cizgi);border-radius:10px;padding:10px 14px;cursor:pointer}
button.ana{background:var(--vurgu);color:#062a26;border-color:var(--vurgu);font-weight:600}
button.tehlike{color:var(--eksi);border-color:#5b2a2a}
button.ikon{background:none;border:0;padding:6px 10px;font-size:20px}
button:disabled{opacity:.4}
input,select{font:inherit;color:var(--yazi);background:var(--kart2);border:1px solid var(--cizgi);border-radius:10px;padding:10px 12px;width:100%}
label{display:block;margin:10px 0}label>span{display:block;font-size:13px;color:var(--soluk);margin-bottom:4px}
.kart,.oneri,.zarf{background:var(--kart);border:1px solid var(--cizgi);border-radius:14px;padding:14px;margin:10px 0}
.oneri{border-color:var(--uyari)}
.oneri ul{list-style:none;padding:0;margin:8px 0}.oneri li{display:flex;justify-content:space-between;padding:3px 0}
.oneri p{margin:0;color:var(--soluk);font-size:14px}
.dugmeler{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.zarf-ust{display:flex;justify-content:space-between;gap:8px}
.zarf small{color:var(--soluk);font-size:12px}
.zarf.eksi{border-color:var(--eksi)}.zarf.eksi b,.eksi{color:var(--eksi)}
.cubuk{height:8px;background:var(--kart2);border-radius:4px;overflow:hidden;margin:8px 0 6px}.cubuk i{display:block;height:100%;background:var(--vurgu)}
.ay{display:flex;justify-content:space-between;align-items:center}
.islemler{display:flex;gap:8px;margin:12px 0}
.fab{position:fixed;right:20px;bottom:calc(86px + env(safe-area-inset-bottom));width:58px;height:58px;border-radius:50%;font-size:30px;background:var(--vurgu);color:#062a26;border:0;box-shadow:0 6px 20px #0008;z-index:6}
.arka{position:fixed;inset:0;background:#000a;display:flex;align-items:flex-end;justify-content:center;z-index:10}
.sayfa{background:var(--kart);width:100%;max-width:560px;border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));max-height:90vh;overflow:auto}
.bildiri{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom));background:var(--kart2);border:1px solid var(--cizgi);padding:10px 16px;border-radius:10px;z-index:20;max-width:90vw}
.bildiri.hata{border-color:var(--eksi);color:var(--eksi)}
.liste .satir{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center;margin:6px 0}
.satir-dugme{display:flex}
.sayac{font-size:14px;color:var(--soluk)}.sayac.eksi{color:var(--eksi)}
.buyuk{font-size:36px;font-weight:700}
.merdiven{padding-left:18px}.merdiven li{margin:10px 0}.merdiven li.tamam{color:var(--vurgu)}
.gecmis{list-style:none;padding:0;margin:0}.gecmis li{display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--cizgi);cursor:pointer}
.gecmis small{display:block;color:var(--soluk);font-size:12px}
.sihirbaz h1{margin:6px 0}
details summary{cursor:pointer;font-weight:600}
a{color:var(--vurgu)}
</style>
</head>
<body>
<div id="kok"><main><p>Yükleniyor…</p></main></div>
<script type="module" src="/app.js"></script>
<script>if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});</script>
</body>
</html>
```

`diogenes/app/public/manifest.webmanifest`:
```json
{"name":"Diogenes","short_name":"Diogenes","start_url":"/","display":"standalone","background_color":"#0f1115","theme_color":"#0f1115","lang":"tr",
 "icons":[{"src":"/icon-192.png","sizes":"192x192","type":"image/png"},{"src":"/icon-512.png","sizes":"512x512","type":"image/png"},{"src":"/icon.svg","sizes":"any","type":"image/svg+xml"}]}
```

`diogenes/app/public/sw.js`:
```js
// Ağ önce; ağ yoksa son kopya. API hiç önbelleğe alınmaz.
const C="diogenes-v1";
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.startsWith("/api/"))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));}return r;}).catch(()=>caches.match(e.request)));
});
```

`diogenes/app/public/giris.html` (bu dosya Görev 6'daki geçici sürümün yerine geçer):
```html
<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diogenes · Giriş</title><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#e8eaf0;font:16px system-ui,sans-serif}
form{width:min(320px,90vw);display:grid;gap:12px}input,button{font:inherit;padding:12px;border-radius:10px;border:1px solid #2a2f3a;background:#20242d;color:inherit}
button{background:#5eead4;color:#062a26;font-weight:600;border:0}p{color:#f87171;min-height:1.4em;margin:0}</style></head>
<body><form id="f"><h1>Diogenes</h1><input type="password" name="p" placeholder="Şifre" autocomplete="current-password" required aria-label="Şifre"><button>Giriş</button><p id="m" role="alert"></p></form>
<script>
const f=document.getElementById("f"),m=document.getElementById("m");
f.onsubmit=async e=>{e.preventDefault();m.textContent="";
  try{const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:f.p.value})});
    if(r.ok)location.href="/";else m.textContent=(await r.json()).error||"Giriş olmadı.";}catch{m.textContent="Bağlantı yok.";}};
</script></body></html>
```

- [ ] **Adım 2: `app.js`'in temelini ve Zarflar ekranını yaz**

`diogenes/app/public/app.js`:
```js
// Diogenes arayüzü: tek sayfa, dört sekme ve Ayarlar. Veri /api/durum'dan; hesaplar sunucuda.
import {tl,kurusa,ayAdi,ozgurlukSuresi,VARSAYILAN_MERDIVEN,BIRIKIM_TURLERI} from "/core.js";

const $=(s,k=document)=>k.querySelector(s);
const h=(tag,attrs={},...kids)=>{
  const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k.startsWith("on"))e.addEventListener(k.slice(2),v);
    else if(v===true)e.setAttribute(k,"");
    else if(v!==false&&v!=null)e.setAttribute(k,v);
  }
  for(const c of kids.flat(Infinity))if(c!=null&&c!==false)e.append(c instanceof Node?c:String(c));
  return e;
};
async function api(yol,{method="GET",govde}={}){
  const r=await fetch(yol,{method,headers:{"Content-Type":"application/json"},body:govde?JSON.stringify(govde):undefined});
  if(r.status===401){location.href="/giris.html";throw new Error("Giriş gerekli.");}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||"Bir şey ters gitti.");
  return j;
}
const sakla={oku:k=>{try{return localStorage.getItem(k)}catch{return null}},yaz:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};
const tlYaz=k=>k==null?"":String(k/100).replace(".",",");

let D=null,sekme="zarflar",ay=null,sihirbazAdim=0;
const kok=$("#kok");
function bildir(m,hata=false){const t=h("div",{class:"bildiri"+(hata?" hata":""),role:"status"},m);document.body.append(t);setTimeout(()=>t.remove(),3500);}
async function yukle(){try{D=await api("/api/durum"+(ay?`?ay=${ay}`:""));ay=D.ay;ciz();}catch(e){bildir(e.message,true);}}
async function is(fn,mesaj){try{await fn();if(mesaj)bildir(mesaj);await yukle();}catch(e){bildir(e.message,true);}}

function ciz(){
  kok.replaceChildren();
  if(!D.kurulum){kok.append(sihirbaz());return;}
  const ekran={zarflar:zarflarEkrani,hedefler:hedeflerEkrani,gecmis:gecmisEkrani,piyasa:piyasaEkrani,ayarlar:ayarlarEkrani}[sekme]();
  kok.append(ust(),ekran,alt());
}
const SEKMELER=[["zarflar","Zarflar"],["hedefler","Hedefler"],["gecmis","Geçmiş"],["piyasa","Piyasa"]];
const ust=()=>h("header",{class:"ust"},h("h1",{},sekme==="ayarlar"?"Ayarlar":"Diogenes"),
  h("button",{class:"ikon","aria-label":sekme==="ayarlar"?"Ayarları kapat":"Ayarlar",onclick:()=>{sekme=sekme==="ayarlar"?"zarflar":"ayarlar";ciz();}},sekme==="ayarlar"?"✕":"⚙︎"));
const alt=()=>h("nav",{class:"alt"},SEKMELER.map(([k,ad])=>h("button",{class:sekme===k?"secili":"",onclick:()=>{sekme=k;ciz();}},ad)));
function ayDegis(n){const [y,m]=ay.split("-").map(Number);ay=new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7);yukle();}
const aySecici=()=>h("div",{class:"ay"},h("button",{class:"ikon","aria-label":"Önceki ay",onclick:()=>ayDegis(-1)},"‹"),h("strong",{},ayAdi(ay)),h("button",{class:"ikon","aria-label":"Sonraki ay",onclick:()=>ayDegis(1)},"›"));

function sayfa(baslik,icerik,kaydet){
  const arka=h("div",{class:"arka",onclick:e=>{if(e.target===arka)arka.remove();}});
  const form=h("form",{class:"sayfa",onsubmit:async e=>{e.preventDefault();try{await kaydet(new FormData(form));arka.remove();await yukle();}catch(err){bildir(err.message,true);}}},
    h("h2",{},baslik),icerik,h("div",{class:"dugmeler"},h("button",{class:"ana",type:"submit"},"Kaydet"),h("button",{type:"button",onclick:()=>arka.remove()},"Vazgeç")));
  arka.append(form);document.body.append(arka);const ilk=form.querySelector("input");if(ilk)ilk.focus();
  return arka;
}
const alan=(etiket,girdi)=>h("label",{},h("span",{},etiket),girdi);
const zarfSecimi=(ad,secili)=>h("select",{name:ad},h("option",{value:""},"Atanmamış"),D.durum.zarflar.map(z=>h("option",{value:z.id,selected:String(z.id)===String(secili)},z.ad)));

function zarflarEkrani(){
  const d=D.durum;
  return h("main",{},aySecici(),
    D.oneriler.map(oneriKarti),
    h("section",{},d.zarflar.map(zarfSatiri),
      h("div",{class:"zarf"+(d.atanmamis<0?" eksi":"")},h("div",{class:"zarf-ust"},h("span",{},"Atanmamış"),h("b",{},tl(d.atanmamis))))),
    h("div",{class:"islemler"},h("button",{onclick:()=>gelirFormu()},"+ Gelir")),
    h("button",{class:"fab","aria-label":"Harcama ekle",onclick:()=>harcamaFormu()},"+"));
}
function zarfSatiri(z){
  const oran=z.konan>0?Math.max(0,Math.min(100,Math.round(z.kalan/z.konan*100))):0;
  return h("div",{class:"zarf"+(z.kalan<0?" eksi":"")},
    h("div",{class:"zarf-ust"},h("span",{},z.ad),h("b",{},tl(z.kalan))),
    h("div",{class:"cubuk"},h("i",{style:`width:${oran}%`})),
    h("small",{},`Konan ${tl(z.konan)} / ${tl(z.aylik)} · Harcanan ${tl(z.harcanan)}`));
}
function oneriKarti(o){
  const karar=k=>is(()=>api("/api/oneri",{method:"POST",govde:{id:o.id,karar:k}}),k==="onayla"?"Uygulandı.":"Reddedildi.");
  return h("article",{class:"oneri"},h("h3",{},o.baslik),o.aciklama&&h("p",{},o.aciklama),
    h("ul",{},o.satirlar.map(s=>h("li",{},h("span",{},s.ad),h("b",{},tl(s.tutar))))),
    h("div",{class:"dugmeler"},h("button",{class:"ana",onclick:()=>karar("onayla")},"Onayla"),
      o.duzenlenebilir&&h("button",{onclick:()=>dagitimDuzenle(o)},"Düzenle"),
      h("button",{onclick:()=>karar("reddet")},"Reddet")));
}
function dagitimDuzenle(o){
  const bilgi=h("p",{class:"sayac"});
  const tutarG=h("input",{name:"tutar",inputmode:"decimal",value:tlYaz(o.tutar)});
  const girdiler=D.durum.zarflar.map(z=>{const s=o.satirlar.find(x=>x.zarf_id===z.id);return [z,h("input",{inputmode:"decimal",value:s?tlYaz(s.tutar):""})];});
  const say=()=>{const top=girdiler.reduce((t,[,g])=>t+(kurusa(g.value)||0),0),gelen=kurusa(tutarG.value)||0;bilgi.textContent=`Atanmamış kalacak: ${tl(gelen-top)}`;bilgi.classList.toggle("eksi",top>gelen);};
  for(const g of [tutarG,...girdiler.map(x=>x[1])])g.addEventListener("input",say);
  say();
  sayfa("Dağıtımı düzenle",[alan("Gelen tutar (₺)",tutarG),...girdiler.map(([z,g])=>alan(`${z.ad} (eksik ${tl(z.eksik)})`,g)),bilgi],async()=>{
    await api("/api/oneri",{method:"POST",govde:{id:o.id,karar:"onayla",duzenleme:{tutar:tutarG.value,kalemler:girdiler.filter(([,g])=>g.value.trim()).map(([z,g])=>({zarf_id:z.id,tutar:g.value}))}}});
    bildir("Uygulandı.");
  });
}
function harcamaFormu(k=null){
  const sonZarf=sakla.oku("sonZarf");
  let arka;
  arka=sayfa(k?"Harcamayı düzenle":"Harcama ekle",[
    alan("Tutar (₺)",h("input",{name:"tutar",inputmode:"decimal",required:true,value:k?tlYaz(k.tutar_kurus):""})),
    alan("Zarf",zarfSecimi("zarf_id",k?k.zarf_id:sonZarf)),
    alan("Açıklama",h("input",{name:"aciklama",required:true,maxlength:80,value:k?k.aciklama:""})),
    alan("Tarih",h("input",{name:"tarih",type:"date",value:k?k.tarih:D.bugun})),
    k&&h("button",{type:"button",class:"tehlike",onclick:()=>{if(confirm("Bu harcama silinsin mi?")){arka.remove();is(()=>api("/api/harcama/sil",{method:"POST",govde:{id:k.id}}),"Silindi.");}}},"Sil"),
  ],async f=>{
    const g={tutar:f.get("tutar"),zarf_id:f.get("zarf_id")||null,aciklama:f.get("aciklama"),tarih:f.get("tarih")};
    if(k)await api("/api/harcama/duzenle",{method:"POST",govde:{id:k.id,...g}});
    else{await api("/api/harcama",{method:"POST",govde:{istek_id:crypto.randomUUID(),...g}});sakla.yaz("sonZarf",g.zarf_id||"");}
    bildir("Kaydedildi.");
  });
}
function gelirFormu(k=null){
  let arka;
  arka=sayfa(k?"Geliri düzenle":"Gelir ekle",[
    alan("Tutar (₺)",h("input",{name:"tutar",inputmode:"decimal",required:true,value:k?tlYaz(k.tutar_kurus):""})),
    alan("Açıklama",h("input",{name:"aciklama",required:true,maxlength:80,value:k?k.aciklama:""})),
    alan("Tarih",h("input",{name:"tarih",type:"date",value:k?k.tarih:D.bugun})),
    k&&h("button",{type:"button",class:"tehlike",onclick:()=>{if(confirm("Bu gelir silinsin mi? Dağıtılmış para Atanmamış'ı eksiye düşürebilir.")){arka.remove();is(()=>api("/api/gelir/sil",{method:"POST",govde:{id:k.id}}),"Silindi.");}}},"Sil"),
  ],async f=>{
    const g={tutar:f.get("tutar"),aciklama:f.get("aciklama"),tarih:f.get("tarih")};
    await api(k?"/api/gelir/duzenle":"/api/gelir",{method:"POST",govde:k?{id:k.id,...g}:g});
    bildir(k?"Kaydedildi.":"Gelir eklendi; dağıtım önerisi hazır.");
  });
}
// Görev 8 ve 9 bu satırın üstüne ekler.
const hedeflerEkrani=()=>h("main",{},h("p",{},"Hedefler yakında."));
const gecmisEkrani=()=>h("main",{},h("p",{},"Geçmiş yakında."));
const piyasaEkrani=()=>h("main",{},h("p",{},"Piyasa yakında."));
const ayarlarEkrani=()=>h("main",{},h("p",{},"Ayarlar yakında."));
const sihirbaz=()=>h("main",{},h("p",{},"Kurulum yakında."));
yukle();
```

> Not: Son beş satırdaki "yakında" ekranları geçici. Görev 8 ve 9 bu satırların yerine gerçek ekranları yazacak. Bunlar plan boşluğu değil, adım adım kurulan kod.

İkonları kopyala: `Copy-Item D:\Claude\diogenes\icon.svg,D:\Claude\diogenes\icon-180.png,D:\Claude\diogenes\icon-192.png,D:\Claude\diogenes\icon-512.png D:\Claude\diogenes\app\public\`

- [ ] **Adım 3: Tarayıcıda telefon boyutunda kontrol et**

Çalıştır: önceki durumu temizle, şemayı uygula, ardından `npm run dev` (Görev 6'daki 1. terminal) ve `npm run duman`. Duman testi veritabanını kurulumu tamamlanmış hale getirir.
Sonra yerleşik tarayıcıda `http://127.0.0.1:8787` adresini mobil boyutta (375×812) aç. Şifreyi `.dev.vars` içindeki `AUTH_PASSWORD` değeri olarak gir; bu değer sohbete yazılmaz.

Beklenen:
- Ay seçici görünür.
- Kira zarfı görünür; kalan 9.000 ₺, kırmızı değil.
- Atanmamış satırı görünür.
- + düğmesi açılır form gösterir. 50 ₺'lik bir harcama ekleyince Kira kalanı 8.950 ₺ olur.
- "+ Gelir" ile 1.000 ₺ eklenince bir öneri kartı çıkar. Düzenle sayacı canlı güncellenir. Onayla'ya basınca kart kaybolur.
- Konsolda hata yoktur.

- [ ] **Adım 4: Commit**

```bash
git add diogenes/app/public
git commit -m "Diogenes: arayuz kabugu, zarflar, oneri kartlari, harcama ve gelir"
```

---

### Görev 8: İlk kurulum sihirbazı ve Ayarlar

**Dosyalar:**
- Değiştir: `diogenes/app/public/app.js`. Bu görevde geçici `ayarlarEkrani` ve `sihirbaz` satırları kaldırılır, yerlerine aşağıdaki kod yazılır.

**Arayüzler:**
- Tüketir: `PUT /api/liste`, `POST /api/ayar`, `POST /api/logout`, `VARSAYILAN_MERDIVEN`, `BIRIKIM_TURLERI`.
- Üretir: `LISTELER`, `listeEditoru(anahtar, ekBilgi?)`. Bu fonksiyon `{el, kaydet}` döner.

- [ ] **Adım 1: Kodu yaz.** Geçici iki satırı (`ayarlarEkrani`, `sihirbaz`) sil ve yerine bunu koy:

```js
const LISTELER={
  gelir_plani:{baslik:"Gelir planı",yeni:{ad:"",tutar:"",gun:""},alanlar:[["ad","Ad"],["tutar","Tutar (₺)","para"],["gun","Gün","sayi"]],
    kaynak:()=>D.gelirPlani,donustur:r=>({id:r.id,ad:r.ad,tutar:tlYaz(r.tutar_kurus),gun:String(r.gun)}),
    ilk:()=>[{ad:"Ayın 1'i",tutar:"15000",gun:"1"},{ad:"Ayın 7'si",tutar:"4000",gun:"7"},{ad:"Ayın 16'sı",tutar:"16000",gun:"16"}]},
  zarflar:{baslik:"Zarflar",yeni:{ad:"",aylik:""},alanlar:[["ad","Zarf adı"],["aylik","Aylık (₺)","para"]],sirali:true,
    kaynak:()=>D.zarflar.filter(z=>z.aktif).sort((a,b)=>a.sira-b.sira||a.id-b.id),donustur:r=>({id:r.id,ad:r.ad,aylik:tlYaz(r.aylik_kurus)})},
  abonelikler:{baslik:"Abonelikler",yeni:{ad:"",tutar:"",gun:"",zarf_id:null},alanlar:[["ad","Ad"],["tutar","Tutar (₺)","para"],["gun","Gün","sayi"],["zarf_id","Zarf","zarf"]],
    kaynak:()=>D.abonelikler,donustur:r=>({id:r.id,ad:r.ad,tutar:tlYaz(r.tutar_kurus),gun:String(r.gun),zarf_id:r.zarf_id,aktif:r.aktif})},
  borclar:{baslik:"Borçlar",yeni:{ad:"",kalan:"",aylik:"",kalan_taksit:""},alanlar:[["ad","Ad"],["kalan","Kalan (₺)","para"],["aylik","Aylık ödeme (₺)","para"],["kalan_taksit","Kalan taksit","sayi"]],
    kaynak:()=>D.borclar,donustur:r=>({id:r.id,ad:r.ad,kalan:tlYaz(r.kalan_kurus),aylik:tlYaz(r.aylik_kurus),kalan_taksit:r.kalan_taksit==null?"":String(r.kalan_taksit)})},
  birikimler:{baslik:"Birikimler",yeni:{tur:"nakit",ad:"",tutar:""},alanlar:[["tur","Tür","tur"],["ad","Ad"],["tutar","Tutar (₺)","para"]],
    kaynak:()=>D.birikimler,donustur:r=>({id:r.id,tur:r.tur,ad:r.ad,tutar:tlYaz(r.tutar_kurus)})},
  merdiven:{baslik:"Hedef merdiveni",yeni:{ad:"",hedef:"",biriken:"",kural:null},alanlar:[["ad","Basamak"],["hedef","Hedef (₺)","para"],["biriken","Biriken (₺)","para"]],sirali:true,
    kaynak:()=>D.merdiven,donustur:r=>({id:r.id,ad:r.ad,kural:r.kural,hedef:r.kural?"":tlYaz(r.hedef_kurus),biriken:tlYaz(r.biriken_kurus)}),
    ilk:()=>VARSAYILAN_MERDIVEN.map(b=>({ad:b.ad,kural:b.kural,hedef:"",biriken:""}))},
};
function listeEditoru(anahtar,ekBilgi){
  const L=LISTELER[anahtar];
  let satirlar=L.kaynak().map(L.donustur);
  if(!satirlar.length)satirlar=L.ilk?L.ilk():[{...L.yeni}];
  const kutu=h("div",{class:"liste"});
  const bildirEk=()=>{if(ekBilgi)ekBilgi(satirlar);};
  function girdi(r,[k,etiket,tur]){
    const degis=e=>{r[k]=e.target.value===""&&tur==="zarf"?null:e.target.value;bildirEk();};
    if(tur==="zarf")return h("select",{"aria-label":etiket,onchange:degis},h("option",{value:""},"Atanmamış"),D.zarflar.filter(z=>z.aktif).map(z=>h("option",{value:z.id,selected:String(z.id)===String(r[k])},z.ad)));
    if(tur==="tur")return h("select",{"aria-label":etiket,onchange:degis},BIRIKIM_TURLERI.map(([v,a])=>h("option",{value:v,selected:v===r[k]},a)));
    const kurallı=k==="hedef"&&r.kural;
    return h("input",{"aria-label":etiket,placeholder:kurallı?"Otomatik":etiket,disabled:!!kurallı,value:r[k]??"",inputmode:tur==="para"?"decimal":tur==="sayi"?"numeric":"text",oninput:degis});
  }
  function yeniden(){
    kutu.replaceChildren(...satirlar.map((r,i)=>h("div",{class:"satir",style:`grid-template-columns:repeat(${L.alanlar.length},1fr) auto`},
      L.alanlar.map(a=>girdi(r,a)),
      h("div",{class:"satir-dugme"},
        L.sirali&&h("button",{type:"button",class:"ikon","aria-label":"Yukarı taşı",disabled:i===0,onclick:()=>{[satirlar[i-1],satirlar[i]]=[satirlar[i],satirlar[i-1]];yeniden();}},"↑"),
        h("button",{type:"button",class:"ikon","aria-label":"Satırı sil",onclick:()=>{satirlar.splice(i,1);yeniden();}},"✕")))),
      h("button",{type:"button",onclick:()=>{satirlar.push({...L.yeni});yeniden();}},"+ Ekle"));
    bildirEk();
  }
  yeniden();
  const temiz=()=>satirlar.filter(r=>L.alanlar.some(([k,,t])=>t!=="tur"&&t!=="zarf"&&String(r[k]??"").trim()));
  return {el:kutu,kaydet:()=>api("/api/liste",{method:"PUT",govde:{tablo:anahtar,satirlar:temiz()}})};
}

const ADIMLAR=[
  ["gelir_plani","Gelirin","Para hangi gün ne kadar geliyor? Kontrol et, gerekirse düzelt."],
  ["birikimler","Şu anki birikimin","Nakit, banka, altın, döviz, fon: her birini toplam tutar olarak yaz. Yoksa satırı sil."],
  ["borclar","Borçların","Kredi kartı, KYK, taksit: kalan tutar ve aylık ödeme. Yoksa satırı sil."],
  ["zarflar","Zarfların","Paranı hangi zarflara ayıracaksın? Üstteki zarf, para gelince önce dolar."],
  ["merdiven","Hedef merdivenin","Ay sonunda kalan para, tamamlanmamış ilk basamağa gider. Kurallı basamakların hedefi kendiliğinden hesaplanır."],
];
function sihirbaz(){
  const [anahtar,baslik,aciklama]=ADIMLAR[sihirbazAdim],son=sihirbazAdim===ADIMLAR.length-1;
  const bilgi=h("p",{class:"sayac"}),plan=D.gelirPlani.reduce((t,g)=>t+g.tutar_kurus,0);
  const ed=listeEditoru(anahtar,anahtar==="zarflar"?s=>{
    const top=s.reduce((t,r)=>t+(kurusa(r.aylik)||0),0);
    bilgi.textContent=`Dağıtılan ${tl(top)} / Gelir ${tl(plan)} · ${tl(plan-top)} atanmamış`;bilgi.classList.toggle("eksi",top>plan);
  }:null);
  return h("main",{class:"sihirbaz"},h("small",{},`Adım ${sihirbazAdim+1}/${ADIMLAR.length}`),h("h1",{},baslik),h("p",{},aciklama),ed.el,bilgi,
    h("div",{class:"dugmeler"},
      sihirbazAdim>0&&h("button",{onclick:()=>{sihirbazAdim--;ciz();}},"Geri"),
      h("button",{class:"ana",onclick:()=>is(async()=>{await ed.kaydet();if(son)await api("/api/ayar",{method:"POST",govde:{anahtar:"kurulum",deger:"1"}});else sihirbazAdim++;},son?"Kurulum tamam.":null)},son?"Bitir":"İleri")));
}
function ayarlarEkrani(){
  const bolum=anahtar=>{const ed=listeEditoru(anahtar);return h("details",{class:"kart"},h("summary",{},LISTELER[anahtar].baslik),ed.el,h("div",{class:"dugmeler"},h("button",{class:"ana",onclick:()=>is(ed.kaydet,"Kaydedildi.")},"Kaydet")));};
  const getiri=h("input",{inputmode:"decimal",value:String(D.getiri)});
  return h("main",{},["zarflar","gelir_plani","abonelikler","borclar","birikimler","merdiven"].map(bolum),
    h("section",{class:"kart"},h("h2",{},"Projeksiyon"),alan("Yıllık getiri varsayımı (%)",getiri),
      h("button",{onclick:()=>is(()=>api("/api/ayar",{method:"POST",govde:{anahtar:"getiri",deger:getiri.value}}),"Kaydedildi.")},"Kaydet")),
    h("button",{class:"tehlike",onclick:()=>is(async()=>{await api("/api/logout",{method:"POST"});location.href="/giris.html";})},"Çıkış yap"));
}
```

- [ ] **Adım 2: Sihirbazı uçtan uca dene**

Çalıştır: Durumu temizle, şemayı uygula ve `npm run dev` ile başlat. Duman testini **çalıştırma**, sihirbaz görünmeli. Tarayıcıda mobil boyutla aç ve giriş yap.

Beklenen:
- Sihirbaz 1/5 adımında açılır, gelir planı 15000/4000/16000 olarak dolu gelir.
- İleri'ye basınca boş satır silinip devam edilebilir.
- Zarflar adımında satır eklendikçe sayaç canlı olarak "Dağıtılan … / Gelir 35.000 ₺" gösterir; toplam aşılırsa kırmızı olur.
- Merdivende 4 varsayılan basamak gelir, Borçsuzluk ve Acil fon için hedef alanı "Otomatik" yazar.
- Bitir'e basınca Zarflar ekranı açılır.
- ⚙︎ Ayarlar'da her bölüm açılıp kaydedilebilir. Zarf sırası ↑ ile değişir ve ana ekrana yansır.
- Geçersiz bir gün (32) girilince Türkçe hata bildirimi çıkar.

- [ ] **Adım 3: Commit**

```bash
git add diogenes/app/public/app.js
git commit -m "Diogenes: ilk kurulum sihirbazi ve ayarlar"
```

---

### Görev 9: Hedefler, Geçmiş ve Piyasa ekranları

**Dosyalar:**
- Değiştir: `diogenes/app/public/app.js`. Bu görevde geçici `hedeflerEkrani`, `gecmisEkrani` ve `piyasaEkrani` satırları kaldırılır.

**Arayüzler:**
- Tüketir: `GET /api/gecmis`, `ozgurlukSuresi`, `harcamaFormu`, `gelirFormu`, `aySecici`.

- [ ] **Adım 1: Kodu yaz.** Geçici üç satırı sil ve yerine bunu koy:

```js
function hedeflerEkrani(){
  const birikim=D.birikimler.reduce((t,b)=>t+b.tutar_kurus,0)+D.merdiven.reduce((t,b)=>t+b.biriken_kurus,0);
  const yillik=D.aylikToplam*12,hedef=yillik*25,oran=yillik?Math.min(100,Math.round(birikim*0.04/yillik*1000)/10):0;
  const planGelir=D.gelirPlani.reduce((t,g)=>t+g.tutar_kurus,0);
  const ekG=h("input",{inputmode:"decimal",value:tlYaz(Math.max(0,planGelir-D.aylikToplam))});
  const sonuc=h("p",{class:"sayac"});
  const hesapla=()=>{
    const ek=kurusa(ekG.value)||0,s=ozgurlukSuresi(birikim,ek,D.getiri,hedef);
    sonuc.textContent=!yillik?"Önce zarflarını kur."
      :s===null?"Bu tempoyla 50 yılda ulaşılmıyor."
      :`Ayda ${tl(ek)} ile yaklaşık ${Math.floor(s/12)} yıl ${s%12} ay. Yıllık getiri varsayımı %${D.getiri} (Ayarlar'dan değişir). Tavsiye değil, hesap.`;
  };
  ekG.addEventListener("input",hesapla);hesapla();
  return h("main",{},
    h("section",{class:"kart"},h("h2",{},"Finansal özgürlük"),h("div",{class:"buyuk"},`%${oran}`),h("div",{class:"cubuk"},h("i",{style:`width:${oran}%`})),
      h("small",{},`Birikim ${tl(birikim)} · Hedef ${tl(hedef)} (yıllık zarf giderinin 25 katı, %4 kuralı)`)),
    h("section",{class:"kart"},h("h2",{},"Hedef merdiveni"),h("ol",{class:"merdiven"},D.merdiven.map(b=>{
      const o=b.hedef?Math.min(100,Math.round(b.biriken_kurus/b.hedef*100)):0;
      return h("li",{class:b.tamam?"tamam":""},
        h("div",{class:"zarf-ust"},h("span",{},(b.tamam?"✓ ":"")+b.ad),h("b",{},b.hedef===null?tl(b.biriken_kurus):`${tl(b.biriken_kurus)} / ${tl(b.hedef)}`)),
        b.hedef!==null&&b.hedef>0&&h("div",{class:"cubuk"},h("i",{style:`width:${o}%`})));
    }))),
    h("section",{class:"kart"},h("h2",{},"Projeksiyon"),alan("Aylık ek birikim (₺)",ekG),sonuc));
}
function gecmisEkrani(){
  const yer=h("p",{},"Yükleniyor…"),ana=h("main",{},aySecici(),yer);
  api(`/api/gecmis?ay=${ay}`).then(g=>{
    const ad=new Map(g.zarflar.map(z=>[z.id,z.ad])),zad=id=>id==null?"Atanmamış":ad.get(id)||"Silinmiş zarf";
    const secim=h("select",{"aria-label":"Zarfa göre süz"},h("option",{value:""},"Tüm zarflar"),g.zarflar.map(z=>h("option",{value:z.id},z.ad)));
    const liste=h("ul",{class:"gecmis"});
    const listeCiz=()=>{const f=secim.value;const xs=g.harcamalar.filter(x=>!f||String(x.zarf_id)===f);
      liste.replaceChildren(...(xs.length?xs.map(x=>h("li",{onclick:()=>harcamaFormu(x)},h("span",{},`${x.tarih.slice(8)} · ${x.aciklama}`,h("small",{},zad(x.zarf_id))),h("b",{},"−"+tl(x.tutar_kurus)))):[h("li",{},"Bu ay harcama yok.")]));};
    secim.addEventListener("change",listeCiz);listeCiz();
    const aktarilan=g.aktarimlar.reduce((t,a)=>t+a.tutar_kurus,0),toplam=new Map();
    for(const x of g.harcamalar)toplam.set(x.zarf_id,(toplam.get(x.zarf_id)||0)+x.tutar_kurus);
    const enCok=[...toplam].sort((a,b)=>b[1]-a[1])[0];
    yer.replaceWith(
      h("section",{class:"kart"},h("h2",{},"Ay özeti"),h("p",{},`Hedefe aktarılan: ${tl(aktarilan)}`),enCok&&h("p",{},`En çok harcanan: ${zad(enCok[0])} (${tl(enCok[1])})`)),
      h("section",{class:"kart"},h("h2",{},"Gelirler"),h("ul",{class:"gecmis"},g.gelirler.length?g.gelirler.map(x=>h("li",{onclick:()=>gelirFormu(x)},h("span",{},`${x.tarih.slice(8)} · ${x.aciklama}`),h("b",{},"+"+tl(x.tutar_kurus)))):h("li",{},"Bu ay gelir yok."))),
      h("section",{class:"kart"},h("h2",{},"Harcamalar"),secim,liste));
  }).catch(e=>{yer.textContent=e.message;});
  return ana;
}
const piyasaEkrani=()=>h("main",{},h("section",{class:"kart"},h("h2",{},"Piyasa"),
  h("p",{},"Hisse taraması ayrı çalışıyor; ekranları eskisi gibi orada."),
  h("p",{},h("a",{href:"https://ross002200.github.io/Ross/diogenes/",target:"_blank",rel:"noopener"},"Tarama ekranlarını aç ↗")),
  h("small",{},"Öğrenme amaçlıdır, yatırım tavsiyesi değildir.")));
```

- [ ] **Adım 2: Tarayıcıda kontrol et**

Çalıştır: Durumu temizle, şemayı uygula, `npm run dev` ile başlat ve `npm run duman` çalıştır. Ardından tarayıcıda mobil boyutta aç.

Beklenen:
- **Hedefler ekranı:** yüzde, merdiven ve projeksiyon metni "Tavsiye değil, hesap." ile birlikte görünür. Ek tutar değişince sonuç canlı güncellenir.
- **Geçmiş ekranı:** Market 6.000 ₺ satırı görünür. Satıra dokununca düzenleme formu açılır. Zarf süzgeci çalışır.
- **Piyasa ekranı:** bağlantı yeni sekmede açılır.
- 320 px genişlikte yatay kaydırma olmaz.

- [ ] **Adım 3: Testleri ve duman testini son kez çalıştır**

Çalıştır: `npm test; npm run duman`. Duman testinden önce durum temizlenmeli.
Beklenen: 21 test GEÇER ve `Duman testi GEÇTİ` çıktısı görülür.

- [ ] **Adım 4: Commit**

```bash
git add diogenes/app/public/app.js
git commit -m "Diogenes: hedefler, gecmis ve piyasa ekranlari"
```

---

### Görev 10: Yayına alma (Diyar'ın onayıyla)

**Dosyalar:**
- Değiştir: `diogenes/app/wrangler.json` (gerçek `database_id` ve `routes`)
- Değiştir: `diogenes/docs/superpowers/specs/2026-11-27-diogenes-finans-asistani-design.md` (sona "Uygulama notları" eklenir)
- Değiştir: `D:\Claude\README.md` (Diogenes bölümüne finans asistanı eklenir)

- [ ] **Adım 1: Onay al.** Diyar'a şunları söyle ve "evet" demeden devam etme:
  - Cloudflare'de `diogenes` adında bir D1 veritabanı oluşturulacak.
  - `diogenes` adında bir worker yayınlanacak.
  - `diogenes.diyarross.com` adresi bu worker'a bağlanacak.

- [ ] **Adım 2: D1 veritabanını oluştur ve şemayı uygula**

Çalıştır: `cd D:\Claude\diogenes\app; node node_modules/wrangler/bin/wrangler.js d1 create diogenes`
Beklenen: Çıktıda `database_id` görünür. Bu değeri `wrangler.json` içindeki `00000000-…` yerine yaz. Ayrıca şu alanı ekle: `"routes":[{"pattern":"diogenes.diyarross.com","custom_domain":true}]`.
Çalıştır: `node node_modules/wrangler/bin/wrangler.js d1 migrations apply diogenes --remote`
Beklenen: `0001_init.sql` ✅

- [ ] **Adım 3: Secret'ları ayarla.** Şifreyi Diyar kendi girer; Claude şifre yazmaz.

`SESSION_SECRET` ve `DAZAI_KEY` rastgele üretilir ve doğrudan wrangler'a verilir, ekrana yazılmaz:
```powershell
cd D:\Claude\diogenes\app
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | node node_modules/wrangler/bin/wrangler.js secret put SESSION_SECRET
node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))" | node node_modules/wrangler/bin/wrangler.js secret put DAZAI_KEY
```
Diyar kendi terminalinde şu komutu çalıştırıp giriş şifresini kendisi yazar:
```powershell
node node_modules/wrangler/bin/wrangler.js secret put AUTH_PASSWORD
```

- [ ] **Adım 4: Yayınla**

Çalıştır: `npm run deploy`
Beklenen: Çıktıda `diogenes` worker'ının yayınlandığı, iki cron tetikleyicisi ve `diogenes.diyarross.com` adresi görünür.

- [ ] **Adım 5: Canlı ortamda kontrol et**

Tarayıcıda `https://diogenes.diyarross.com` adresini aç.
Beklenen: Giriş ekranı gelir. Diyar giriş yaptıktan sonra sihirbaz açılır. Kurulumu Diyar kendisi yapar; gerçek veriler onundur. `/api/durum` adresi oturumsuz açılınca 401 döner.

- [ ] **Adım 6: Belgeleri güncelle ve commit et**

Spec'in sonuna, bu planın "Spec'e göre uygulama kararları" bölümündeki 11 maddeyi "## 12. Uygulama notları (Aşama 1)" başlığıyla ekle. README'nin Diogenes bölümüne şu satırı ekle: "Finans asistanı (zarf bütçesi): `https://diogenes.diyarross.com`, kod `diogenes/app/` (Cloudflare Worker + D1, `npm test`, `npm run duman`)."

```bash
git add diogenes/app/wrangler.json diogenes/docs README.md
git commit -m "Diogenes: yayin ayarlari ve belgeler"
```

Push işlemi ayrıca onaya bağlıdır.
