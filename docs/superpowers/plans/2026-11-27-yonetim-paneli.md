# Yönetim Paneli: Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `D:\Claude\Yönet.cmd` ile açılan, yalnız bu bilgisayardan erişilen bir sayfada altı projenin durumu, testi, yayını, yedeği, sırları ve Dazai anahtarlarının yenilenmesi.

**Architecture:** `yonet/` altında ek paketsiz bir Node HTTP sunucusu (`127.0.0.1`, rastgele kapı, rastgele giriş anahtarı) ve tek bir HTML sayfası. Saf modüller (proje listesi, durum kuralları, sır gizleme, iş çalıştırıcı, komut kurucular) test edilir; kabuk komutları `child_process.spawn(..., {shell:true})` ile çalışır, çıktı satır satır gizlenip sayfaya sorgulamayla (1 sn) akar.

**Tech Stack:** Node 24 (yerleşik `http`, `child_process`, `crypto`, `node:test`), wrangler (her projenin kendi node_modules'ı), Python 3.12 (`C:\Users\diyar\AppData\Local\Programs\Python\Python312\python.exe`).

**Spec:** `docs/superpowers/specs/2026-11-27-yonetim-paneli-design.md`

## Global Constraints

- Kod `D:\Claude\yonet\`; ek npm paketi yok.
- Sunucu yalnız `127.0.0.1`; her istek `x-yonet` başlığında açılış anahtarını taşır (sayfanın kendisi `?t=`); yoksa 403. `Origin` varsa `http://127.0.0.1:<kapı>` olmalı.
- Aynı anda tek iş; ikinci iş 409.
- Sır değerleri ekrana, kayda, dosyaya yazılmaz (Uyku anahtarı istisna: `Belgeler\Kleanthes-uyku-anahtari.txt`, spec gereği).
- Yayın ve anahtar yenileme `onay:true` ister.
- Yayından önce testler; ağ/503 hatasında en çok 3 deneme.
- Yedekler `D:\Claude\yedekler\<YYYY-MM-DD>\`, git dışında; eski yedekler silinmez.
- Seneca testleri `python -m pytest -q tests` (kökten çalıştırınca `yedek/` kopyaları hata verir).
- Diogenes dalı `claude/daily-increases-site-gumybo`.
- Commit/push kullanıcı onayıyla; bu plandaki commit'ler yerel.

## Review Focus

1. İnternet hiç yokken Durum tümünü kırmızı göstermemeli, "bağlantı yok" (gri) demeli → Task 1 testi.
2. Anahtar yenilemede ikinci taraf başarısız olursa "yarım kaldı" açıkça söylenmeli ve üretilen değer çıktıda görünmemeli → Task 3 testi.
3. Bir iş sürerken ikinci istek kuyruğa girmemeli, 409 dönmeli; iş bitince yeni iş kabul edilmeli → Task 2 ve Task 4 testleri.
4. Wrangler "not logged in" çıktısında kullanıcıya `wrangler login` önerilmeli → Task 2 testi.
5. Giriş anahtarı olmadan `/api/*` ve sayfa 403; başka Origin'den POST 403 → Task 4 testi.

---

### Task 1: Saf modüller (sır gizleme, proje listesi, durum kuralları)

**Files:**
- Create: `yonet/gizle.mjs`, `yonet/projeler.mjs`, `yonet/durum.mjs`, `yonet/.gitignore`, `yedekler/.gitignore`
- Test: `yonet/tests/saf.test.mjs`

**Interfaces:**
- Produces: `gizleyici(bilinen: string[]) → (metin: string) => string`; `KOK: string` (D:\Claude, sonda ayraç yok); `PYTHON: string`; `PROJELER: Proje[]` (`{id, ad, klasor, adres, worker?, wr?, d1?, test: Adim[], yayin: Adim[], sirlar: string[], taze?: {sorgu?: string, git?: string, esik: number, oneri: string}, kirmiziOneri?: string}`, `Adim = {klasor: string, komut: string}`); `gunFarki(a, b): number`; `degerlendir(p: Proje, g: {canli: boolean|null, son: string|null, bilgi?: string}, bugun: string) → {renk: "yesil"|"sari"|"kirmizi"|"gri", ozet: string, oneri: string}`.

- [ ] **Step 1: Write the failing test**

`yonet/tests/saf.test.mjs`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test yonet/tests/saf.test.mjs`
Expected: FAIL, `Cannot find module '…/yonet/gizle.mjs'`.

- [ ] **Step 3: Implement**

`yonet/gizle.mjs`:
```js
// Çıktıdaki sırları gizler: bilinen değerler (anahtar yenilemede üretilenler) ve 32+ karakterlik onaltılık dizgiler.
const UZUN_HEX=/(?<![0-9a-f-])[0-9a-f]{32,}(?![0-9a-f-])/gi;
export function gizleyici(bilinen=[]){
  const degerler=bilinen.map(v=>String(v??"").trim()).filter(v=>v.length>=8);
  return metin=>{let s=String(metin);for(const v of degerler)s=s.split(v).join("••••");return s.replace(UZUN_HEX,"••••");};
}
```

`yonet/projeler.mjs`:
```js
// Altı proje: klasör, canlı adres, test ve yayın adımları, D1, beklenen sırlar, tazelik ölçüsü.
// Yeni proje = yeni kayıt. Komutlar kabukta (Windows cmd) çalışır; klasörler D:\Claude'a göre.
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";
export const KOK=dirname(dirname(fileURLToPath(import.meta.url)));
export const PYTHON="C:\\Users\\diyar\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";
const W=wr=>`node "${KOK}\\${wr}\\node_modules\\wrangler\\bin\\wrangler.js"`;
export const wrangler=W;
export const DIOGENES_DAL="claude/daily-increases-site-gumybo";

export const PROJELER=[
  {id:"aurelius",ad:"Aurelius / Dazai",klasor:"Aurelius",adres:"https://aurelius.diyarross.com/",worker:"aurelius",wr:"Aurelius",d1:"aurelius",
    test:[{klasor:"Aurelius",komut:"node scripts/test-core.mjs"},{klasor:"Aurelius",komut:"node scripts/test-jarvis.mjs"},{klasor:"Aurelius",komut:"node scripts/test-voice.mjs"}],
    yayin:[{klasor:"Aurelius",komut:"node scripts/deploy.mjs"},{klasor:"Aurelius\\cron",komut:`${W("Aurelius")} deploy --config wrangler.json`}],
    sirlar:["AUTH_PASSWORD","CRON_SECRET","ELEVENLABS_API_KEY","ELEVENLABS_VOICE_ID","EPIKTETOS_DAZAI_KEY","KLEANTHES_DAZAI_KEY","KLEANTHES_OZET_KEY","OWNER_ID","SENECA_SIFRE","SESSION_SECRET","VAPID_PRIVATE_KEY","VAPID_PUBLIC_KEY","ZENON_DAZAI_KEY"],
    taze:{sorgu:"SELECT MAX(day) son FROM jarvis_sessions",bilgiSorgu:"SELECT COUNT(*) n FROM daily_pushes WHERE day=date('now','+3 hours')",esik:7,oneri:"Dazai ile konuş: yazılı sohbette 'Bugün ne var?'"}},
  {id:"kleanthes",ad:"Kleanthes",klasor:"Kleanthes\\app",adres:"https://kleanthes.diyarross.com/",worker:"kleanthes",wr:"Kleanthes\\app",d1:"kleanthes",
    test:[{klasor:"Kleanthes\\app",komut:"npm test"}],
    yayin:[{klasor:"Kleanthes\\app",komut:"npm run deploy"}],
    sirlar:["AUTH_PASSWORD","DAZAI_KEY","OZET_KEY","SESSION_SECRET","UYKU_KEY","VAPID_PRIVATE_KEY","VAPID_PUBLIC_KEY"],
    taze:{sorgu:"SELECT MAX(id) son FROM docs WHERE coll='uyku'",esik:3,oneri:"Apple uyku Kestirmesini çalıştır (ya da Dazai'ye uykunu söyle)."}},
  {id:"zenon",ad:"Zenon",klasor:"zenon-sunucu",adres:"https://zenon.diyarross.com/",worker:"zenon",wr:"Kleanthes\\app",d1:"zenon",d1Klasor:"zenon-sunucu",
    test:[{klasor:".",komut:"node --test tests/care.test.js tests/coach.test.js tests/plan.test.js tests/sync.test.js"},{klasor:"zenon-sunucu",komut:"npm test"}],
    yayin:[{klasor:"zenon-sunucu",komut:"npm run deploy"}],
    sirlar:["AUTH_PASSWORD","DAZAI_KEY","SESSION_SECRET"],
    taze:{sorgu:"SELECT MAX(updated_at) son FROM docs",esik:3,oneri:"Zenon'u telefonda aç (zenon.diyarross.com)."}},
  {id:"epiktetos",ad:"Epiktetos",klasor:"Epiktetos",adres:"https://epiktetos.diyarross.com/",worker:"epiktetos",wr:"Epiktetos",d1:"epiktetos",
    test:[{klasor:"Epiktetos",komut:"npx tsc --noEmit"},{klasor:"Epiktetos",komut:"npx vitest run"}],
    yayin:[{klasor:"Epiktetos",komut:"npm run deploy"}],
    sirlar:["ANTHROPIC_API_KEY","DAZAI_KEY","KOC_SIFRE"],
    taze:{sorgu:"SELECT MAX(day) son FROM kart",esik:3,oneri:"iPad'de Epiktetos'u aç; Koç ekranında Koç şifresi girili olmalı."}},
  {id:"seneca",ad:"Seneca",klasor:"Seneca",adres:"https://seneca-diyar.duckdns.org/zenon/api/saglik",
    test:[{klasor:"Seneca",komut:`"${PYTHON}" -m pytest -q tests`}],yayin:[],sirlar:[],
    kirmiziOneri:"Evdeki bilgisayarda Seneca'yı başlat (Seneca\\baslat.cmd)."},
  {id:"diogenes",ad:"Diogenes",klasor:"diogenes",adres:"https://ross002200.github.io/Ross/diogenes/",
    test:[{klasor:"diogenes",komut:`"${PYTHON}" -m pytest -q scan/tests`}],yayin:[],sirlar:[],
    taze:{git:DIOGENES_DAL,esik:2,oneri:"GitHub Actions'ta Diogenes taramalarını kontrol et."}},
];
```

`yonet/durum.mjs`:
```js
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
```

`yonet/.gitignore`:
```
son-is.json
```
`yedekler/.gitignore`:
```
*
!.gitignore
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test yonet/tests/saf.test.mjs`
Expected: PASS 4/4.

- [ ] **Step 5: Commit**

```bash
git add yonet/gizle.mjs yonet/projeler.mjs yonet/durum.mjs yonet/.gitignore yonet/tests/saf.test.mjs yedekler/.gitignore
git commit -m "Yonetim paneli: proje listesi, durum kurallari, sir gizleme"
```

---

### Task 2: İş çalıştırıcı (tek iş, yeniden deneme, çıktı akışı)

**Files:**
- Create: `yonet/is.mjs`
- Test: `yonet/tests/is.test.mjs`

**Interfaces:**
- Consumes: `gizleyici` (Task 1).
- Produces: `class IsYoneticisi { constructor(calistir: (adim: {klasor, komut, girdi?}, satir: (s: string) => void) => Promise<number>) ; meşgul: boolean; durum(): {calisiyor: boolean, ad: string, satirlar: string[], sonuc: null | {ok: boolean, ozet: string}}; baslat(ad: string, isFn: (ctx) => Promise<{ok: boolean, ozet: string}>, bilinen?: string[]): void }` — `baslat` meşgulken `Error("mesgul")` atar. `ctx = {adim(adim: {klasor, komut, girdi?, deneme?}): Promise<{ok: boolean, cikti: string[]}>, yaz(s: string): void}`. `oneriBul(cikti: string[]): string` (wrangler giriş hatası → "Cloudflare girişi gerekli: terminalde `wrangler login`"). `agHatasi(cikti: string[]): boolean`. `kabukCalistir` (gerçek spawn).

- [ ] **Step 1: Write the failing test**

`yonet/tests/is.test.mjs`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test yonet/tests/is.test.mjs`
Expected: FAIL, `Cannot find module '…/yonet/is.mjs'`.

- [ ] **Step 3: Implement `yonet/is.mjs`**

```js
// Tek seferde bir iş: adımlar sırayla, çıktı gizlenip satır satır biriktirilir; ağ hatasında yeniden denenir.
import {spawn} from "node:child_process";
import {join} from "node:path";
import {gizleyici} from "./gizle.mjs";
import {KOK} from "./projeler.mjs";

const AG=/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|Could not resolve|\b503\b|\b502\b|Service Unavailable|socket hang up/i;
export const agHatasi=cikti=>cikti.some(s=>AG.test(s));
export function oneriBul(cikti){
  const t=cikti.join("\n");
  if(/not authenticated|not logged in|wrangler login|Authentication error|code: 10000/i.test(t))return "Cloudflare girişi gerekli: terminalde `wrangler login` çalıştır.";
  if(agHatasi(cikti))return "Ağ hatası: internet bağlantını kontrol edip yeniden dene.";
  return "";
}

// Gerçek çalıştırıcı: Windows kabuğunda, D:\Claude'a göre klasörde. girdi varsa stdin'e yazılır (sır değerleri).
export function kabukCalistir(adim,satir){
  return new Promise(res=>{
    const c=spawn(adim.komut,{cwd:join(KOK,adim.klasor),shell:true,windowsHide:true,env:{...process.env,FORCE_COLOR:"0",NO_COLOR:"1"}});
    const parca=akis=>{let kalan="";akis.on("data",d=>{const s=(kalan+d.toString("utf8")).split(/\r?\n/);kalan=s.pop()??"";for(const l of s)if(l.trim())satir(l.replace(/\x1b\[[0-9;]*m/g,""));});akis.on("end",()=>{if(kalan.trim())satir(kalan);});};
    parca(c.stdout);parca(c.stderr);
    if(adim.girdi!==undefined){c.stdin.write(adim.girdi);}
    c.stdin.end();
    c.on("error",e=>{satir(`Başlatılamadı: ${e.message}`);res(1);});
    c.on("close",kod=>res(kod??1));
    IsYoneticisi.aktif=c;
  });
}

export class IsYoneticisi{
  static aktif=null;
  constructor(calistir=kabukCalistir){this.calistir=calistir;this.d={calisiyor:false,ad:"",satirlar:[],sonuc:null};}
  get mesgul(){return this.d.calisiyor;}
  durum(){return {...this.d,satirlar:[...this.d.satirlar]};}
  baslat(ad,isFn,bilinen=[]){
    if(this.d.calisiyor)throw new Error("mesgul");
    const gizle=gizleyici(bilinen),tum=[];
    this.d={calisiyor:true,ad,satirlar:[],sonuc:null};
    const yaz=s=>{const g=gizle(s);this.d.satirlar.push(g);if(this.d.satirlar.length>2000)this.d.satirlar.shift();};
    const adim=async a=>{
      const deneme=Math.max(1,a.deneme??1);let cikti=[];
      for(let i=1;i<=deneme;i++){
        cikti=[];yaz(`$ ${a.komut.replace(/"[^"]*node_modules[\\/]wrangler[^"]*"/,"wrangler")}`);
        const kod=await this.calistir(a,s=>{cikti.push(s);tum.push(s);yaz(s);});
        if(kod===0)return {ok:true,cikti};
        if(i<deneme&&agHatasi(cikti)){yaz(`Ağ hatası, yeniden deneniyor (${i+1}/${deneme})…`);await new Promise(r=>setTimeout(r,this.calistir===kabukCalistir?8000:1));continue;}
        break;
      }
      return {ok:false,cikti};
    };
    (async()=>{
      let sonuc;
      try{sonuc=await isFn({adim,yaz});}
      catch(e){sonuc={ok:false,ozet:e instanceof Error?e.message:"Hata"};}
      if(!sonuc.ok){const o=oneriBul(tum);if(o&&!sonuc.ozet.includes(o))sonuc={...sonuc,ozet:`${sonuc.ozet} ${o}`.trim()};}
      this.d.sonuc=sonuc;this.d.calisiyor=false;IsYoneticisi.aktif=null;
    })();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test yonet/tests/is.test.mjs`
Expected: PASS 5/5.

- [ ] **Step 5: Commit**

```bash
git add yonet/is.mjs yonet/tests/is.test.mjs
git commit -m "Yonetim paneli: is calistirici (tek is, yeniden deneme, cikti gizleme)"
```

---

### Task 3: İşler (durum topla, test, yayın, yedek, sırlar, anahtar yenile)

**Files:**
- Create: `yonet/isler.mjs`
- Test: `yonet/tests/isler.test.mjs`

**Interfaces:**
- Consumes: `PROJELER`, `KOK`, `PYTHON`, `wrangler(wr)`, `DIOGENES_DAL` (Task 1); `degerlendir` (Task 1); `ctx.adim/ctx.yaz` (Task 2).
- Produces: `istanbulBugun(): string`; `testIsi(ids: string[]) → isFn`; `yayinIsi(id) → isFn`; `yedekIsi(gun: string) → isFn`; `sirlarIsi() → isFn`; `ANAHTARLAR: {id, ad, hedefler: {proje, wr, worker, ad}[], dosya?: string}[]`; `anahtarIsi(id, deger: string) → isFn`; `durumTopla(deps: {fetch, adim}) → Promise<{id, ad, adres, renk, ozet, oneri}[]>`; `ayikla(cikti: string[]) → unknown` (wrangler `--json` çıktısından ilk JSON dizisi).

- [ ] **Step 1: Write the failing test**

`yonet/tests/isler.test.mjs`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test yonet/tests/isler.test.mjs`
Expected: FAIL, `Cannot find module '…/yonet/isler.mjs'`.

- [ ] **Step 3: Implement `yonet/isler.mjs`**

```js
// Panel işleri: her biri ctx ({adim, yaz}) alan bir fonksiyon döner ve {ok, ozet} sonuçlanır.
import {join} from "node:path";
import {homedir} from "node:os";
import {writeFileSync,mkdirSync,readdirSync} from "node:fs";
import {PROJELER,KOK,PYTHON,wrangler,DIOGENES_DAL} from "./projeler.mjs";
import {degerlendir} from "./durum.mjs";

const proje=id=>{const p=PROJELER.find(x=>x.id===id);if(!p)throw new Error(`Bilinmeyen proje: ${id}`);return p;};
export const istanbulBugun=()=>new Date(Date.now()+3*3600e3).toISOString().slice(0,10);
export function ayikla(cikti){const t=cikti.join("\n"),i=t.indexOf("[");if(i<0)return null;try{return JSON.parse(t.slice(i,t.lastIndexOf("]")+1));}catch{return null;}}

export const testIsi=ids=>async ctx=>{
  const sonuc=[];
  for(const id of ids){const p=proje(id);let ok=true;for(const a of p.test){const r=await ctx.adim(a);if(!r.ok){ok=false;break;}}sonuc.push([p.ad,ok]);}
  return {ok:sonuc.every(([,o])=>o),ozet:sonuc.map(([a,o])=>`${a} ${o?"✓":"✗"}`).join(" · ")};
};

export async function canliMi(fetchFn,adres){
  for(let i=0;i<2;i++){try{const r=await fetchFn(adres,{redirect:"manual",signal:AbortSignal.timeout(15000)});if(r.status<500)return true;}catch{/* yeniden */}}
  return false;
}

export const yayinIsi=(id,yokla=adres=>canliMi(fetch,adres))=>async ctx=>{
  const p=proje(id);
  if(!p.yayin.length)throw new Error(`${p.ad} için panelden yayını yok.`);
  for(const a of p.test){const r=await ctx.adim(a);if(!r.ok)return {ok:false,ozet:`${p.ad}: testler geçmedi, yayın yapılmadı.`};}
  for(const a of p.yayin){const r=await ctx.adim({...a,deneme:3});if(!r.ok)return {ok:false,ozet:`${p.ad}: yayın başarısız; canlı sürüm değişmedi.`};}
  return (await yokla(p.adres))?{ok:true,ozet:`${p.ad} yayınlandı, site açılıyor ✓`}:{ok:false,ozet:`${p.ad} yayınlandı ama site cevap vermiyor.`};
};

export const yedekIsi=gun=>async ctx=>{
  const klasor=join(KOK,"yedekler",gun);mkdirSync(klasor,{recursive:true});const sonuc=[];
  for(const p of PROJELER.filter(x=>x.d1)){
    const r=await ctx.adim({klasor:p.d1Klasor??p.wr,komut:`${wrangler(p.wr)} d1 export ${p.d1} --remote --output "${join(klasor,p.d1+".sql")}"`,deneme:3});
    sonuc.push([p.d1,r.ok]);
  }
  const s=await ctx.adim({klasor:"Seneca",komut:`"${PYTHON}" -c "import sqlite3; s=sqlite3.connect('data/seneca.db'); d=sqlite3.connect(r'${join(klasor,"seneca.db")}'); s.backup(d); d.close()"`});
  sonuc.push(["seneca",s.ok]);
  ctx.yaz(`Yedek klasörü: ${klasor}`);
  ctx.yaz(`Toplam yedek günü: ${readdirSync(join(KOK,"yedekler")).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).length} (eski yedekler silinmez)`);
  return {ok:sonuc.every(([,o])=>o),ozet:sonuc.map(([a,o])=>`${a} ${o?"✓":"✗"}`).join(" · ")};
};

export const sirlarIsi=()=>async ctx=>{
  let hepsi=true;
  for(const p of PROJELER.filter(x=>x.worker)){
    const r=await ctx.adim({klasor:p.wr,komut:`${wrangler(p.wr)} secret list --name ${p.worker}`,deneme:2});
    const liste=ayikla(r.cikti);
    if(!r.ok||!Array.isArray(liste))throw new Error(`${p.ad}: sır listesi alınamadı.`);
    const adlar=liste.map(x=>x.name),eksik=p.sirlar.filter(s=>!adlar.includes(s)),fazla=adlar.filter(s=>!p.sirlar.includes(s));
    if(eksik.length)hepsi=false;
    ctx.yaz(`${p.ad}: ${eksik.length?`eksik ✗ ${eksik.join(", ")}`:`tanımlı ✓ (${adlar.length})`}${fazla.length?` · fazladan: ${fazla.join(", ")}`:""}`);
  }
  return {ok:hepsi,ozet:hepsi?"Bütün sırlar tanımlı ✓":"Eksik sır var; listeye bak."};
};

const A={ad:"Aurelius / Dazai",wr:"Aurelius",worker:"aurelius"};
export const ANAHTARLAR=[
  {id:"kleanthes",ad:"Kleanthes ↔ Dazai",hedefler:[{ad:"Kleanthes",wr:"Kleanthes\\app",worker:"kleanthes",sir:"DAZAI_KEY"},{...A,sir:"KLEANTHES_DAZAI_KEY"}]},
  {id:"zenon",ad:"Zenon ↔ Dazai",hedefler:[{ad:"Zenon",wr:"Kleanthes\\app",worker:"zenon",sir:"DAZAI_KEY"},{...A,sir:"ZENON_DAZAI_KEY"}]},
  {id:"epiktetos",ad:"Epiktetos ↔ Dazai",hedefler:[{ad:"Epiktetos",wr:"Epiktetos",worker:"epiktetos",sir:"DAZAI_KEY"},{...A,sir:"EPIKTETOS_DAZAI_KEY"}]},
  {id:"uyku",ad:"Uyku Kestirmesi",hedefler:[{ad:"Kleanthes",wr:"Kleanthes\\app",worker:"kleanthes",sir:"UYKU_KEY"}],dosya:join(homedir(),"Documents","Kleanthes-uyku-anahtari.txt")},
];
export const anahtarIsi=(id,deger)=>async ctx=>{
  const k=ANAHTARLAR.find(x=>x.id===id);if(!k)throw new Error(`Bilinmeyen anahtar: ${id}`);
  const tamam=[];
  for(const h of k.hedefler){
    const r=await ctx.adim({klasor:h.wr,komut:`${wrangler(h.wr)} secret put ${h.sir} --name ${h.worker}`,girdi:deger,deneme:3});
    if(!r.ok)return {ok:false,ozet:tamam.length?`Yarım kaldı: ${h.ad} eski anahtarla, ${tamam.join(", ")} yenisiyle. Yeniden dene.`:`${k.ad}: anahtar konamadı; hiçbir şey değişmedi.`};
    tamam.push(h.ad);
  }
  if(k.dosya){writeFileSync(k.dosya,`Kleanthes uyku anahtari (yalniz Kestirme icine yapistir, sonra bu dosyayi sil):\r\n${deger}\r\n`);ctx.yaz(`Yeni anahtar dosyada: ${k.dosya}`);}
  return {ok:true,ozet:`${k.ad} anahtarı yenilendi ✓`};
};

export async function durumTopla(d,bugun=istanbulBugun()){
  let internet=true;
  try{await d.fetch("https://www.google.com/generate_204",{signal:AbortSignal.timeout(8000)});}catch{internet=false;}
  return Promise.all(PROJELER.map(async p=>{
    if(!internet)return {id:p.id,ad:p.ad,adres:p.adres,...degerlendir(p,{canli:null,son:null},bugun)};
    const canli=await canliMi(d.fetch,p.adres);
    let son=null,bilgi;
    if(p.taze?.sorgu){
      const r=await d.adim({klasor:p.d1Klasor??p.wr,komut:`${wrangler(p.wr)} d1 execute ${p.d1} --remote --json --command "${p.taze.sorgu}"`,deneme:2});
      son=ayikla(r.cikti)?.[0]?.results?.[0]?.son??null;
      if(p.taze.bilgiSorgu){const b=await d.adim({klasor:p.d1Klasor??p.wr,komut:`${wrangler(p.wr)} d1 execute ${p.d1} --remote --json --command "${p.taze.bilgiSorgu}"`,deneme:2});const n=ayikla(b.cikti)?.[0]?.results?.[0]?.n;if(n!==undefined)bilgi=`bugün ${n} bildirim`;}
    }else if(p.taze?.git){
      await d.adim({klasor:".",komut:`git fetch -q origin ${p.taze.git}`});
      const r=await d.adim({klasor:".",komut:`git log -1 --format=%cI origin/${p.taze.git}`});
      son=r.cikti.find(s=>/^\d{4}-\d{2}-\d{2}/.test(s))??null;
    }
    return {id:p.id,ad:p.ad,adres:p.adres,...degerlendir(p,{canli,son,bilgi},bugun)};
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test yonet/tests/isler.test.mjs`
Expected: PASS 6/6.

- [ ] **Step 5: Commit**

```bash
git add yonet/isler.mjs yonet/tests/isler.test.mjs
git commit -m "Yonetim paneli: durum, test, yayin, yedek, sirlar, anahtar yenileme isleri"
```

---

### Task 4: Sunucu, sayfa, açılış

**Files:**
- Create: `yonet/sunucu.mjs`, `yonet/sayfa.html`, `Yönet.cmd`
- Test: `yonet/tests/sunucu.test.mjs`

**Interfaces:**
- Consumes: `IsYoneticisi`, `kabukCalistir` (Task 2); `testIsi`, `yayinIsi`, `yedekIsi`, `sirlarIsi`, `anahtarIsi`, `ANAHTARLAR`, `durumTopla`, `istanbulBugun` (Task 3); `PROJELER` (Task 1).
- Produces: `sunucuKur({token, yonetici, durumFn}) → http.Server` (dinlemez; `listen(0,"127.0.0.1")` çağıranda). HTTP: `GET /?t=` sayfa; `GET /api/projeler`; `POST /api/durum` (iş olarak; sonuç `durum()` içinde `veri`); `POST /api/is {tur, proje?, anahtar?, onay?}` → 202 / 409 / 400; `GET /api/is` → `durum()`; `POST /api/kapat`.

- [ ] **Step 1: Write the failing test**

`yonet/tests/sunucu.test.mjs`:
```js
import {test} from "node:test";
import assert from "node:assert/strict";
import {sunucuKur} from "../sunucu.mjs";
import {IsYoneticisi} from "../is.mjs";

async function ac(yonetici=new IsYoneticisi(async()=>0)){
  const s=sunucuKur({token:"T0K",yonetici,durumFn:async()=>[{id:"zenon",renk:"sari"}]});
  await new Promise(r=>s.listen(0,"127.0.0.1",r));
  const taban=`http://127.0.0.1:${s.address().port}`;
  return {s,taban,iste:(yol,o={})=>fetch(taban+yol,{...o,headers:{"x-yonet":"T0K","content-type":"application/json",...(o.headers||{})}})};
}

test("anahtarsız sayfa ve API 403; anahtarla 200", async () => {
  const {s,taban,iste}=await ac();
  assert.equal((await fetch(taban+"/")).status,403);
  assert.equal((await fetch(taban+"/?t=YANLIS")).status,403);
  assert.equal((await fetch(taban+"/?t=T0K")).status,200);
  assert.equal((await fetch(taban+"/api/projeler")).status,403);
  assert.equal((await iste("/api/projeler")).status,200);
  s.close();
});

test("başka Origin'den POST 403", async () => {
  const {s,iste}=await ac();
  assert.equal((await iste("/api/is",{method:"POST",headers:{origin:"https://kotu.example"},body:JSON.stringify({tur:"test",proje:"kleanthes"})})).status,403);
  s.close();
});

test("yayın ve anahtar onaysız 400; iş sürerken ikinci 409", async () => {
  let birak;const y=new IsYoneticisi(async()=>{await new Promise(r=>(birak=r));return 0;});
  const {s,iste}=await ac(y);
  assert.equal((await iste("/api/is",{method:"POST",body:JSON.stringify({tur:"yayin",proje:"kleanthes"})})).status,400);
  assert.equal((await iste("/api/is",{method:"POST",body:JSON.stringify({tur:"anahtar",anahtar:"zenon"})})).status,400);
  assert.equal((await iste("/api/is",{method:"POST",body:JSON.stringify({tur:"test",proje:"kleanthes"})})).status,202);
  assert.equal((await iste("/api/is",{method:"POST",body:JSON.stringify({tur:"test",proje:"zenon"})})).status,409);
  assert.equal((await iste("/api/is")).status,200);
  birak();s.close();
});

test("durum işi sonucu veri olarak döner", async () => {
  const {s,iste}=await ac();
  assert.equal((await iste("/api/durum",{method:"POST"})).status,202);
  let d;for(let i=0;i<50;i++){d=await (await iste("/api/is")).json();if(!d.calisiyor)break;await new Promise(r=>setTimeout(r,10));}
  assert.deepEqual(d.sonuc.veri,[{id:"zenon",renk:"sari"}]);
  s.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test yonet/tests/sunucu.test.mjs`
Expected: FAIL, `Cannot find module '…/yonet/sunucu.mjs'`.

- [ ] **Step 3: Implement `yonet/sunucu.mjs`**

```js
// Yönetim paneli sunucusu: yalnız 127.0.0.1, açılış anahtarı, tek iş. Çalıştırma: node yonet/sunucu.mjs
import http from "node:http";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {exec} from "node:child_process";
import {fileURLToPath} from "node:url";
import {IsYoneticisi,kabukCalistir} from "./is.mjs";
import {PROJELER} from "./projeler.mjs";
import {testIsi,yayinIsi,yedekIsi,sirlarIsi,anahtarIsi,ANAHTARLAR,durumTopla,istanbulBugun} from "./isler.mjs";

const SAYFA=new URL("./sayfa.html",import.meta.url),SON=new URL("./son-is.json",import.meta.url);
const json=(res,kod,v)=>{res.writeHead(kod,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(v));};
const govde=req=>new Promise(r=>{let s="";req.on("data",d=>{s+=d;if(s.length>10000)req.destroy();});req.on("end",()=>{try{r(s?JSON.parse(s):{});}catch{r({});}});});

export function sunucuKur({token,yonetici,durumFn}){
  const s=http.createServer(async(req,res)=>{
    const url=new URL(req.url,"http://127.0.0.1"),kapi=s.address()?.port;
    if(url.pathname==="/"){
      if(url.searchParams.get("t")!==token)return json(res,403,{error:"Yetkisiz."});
      res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
      return res.end(readFileSync(SAYFA,"utf8").replace("__TOKEN__",token));
    }
    if(!url.pathname.startsWith("/api/"))return json(res,404,{error:"Bulunamadı."});
    if(req.headers["x-yonet"]!==token)return json(res,403,{error:"Yetkisiz."});
    const o=req.headers.origin;if(o&&o!==`http://127.0.0.1:${kapi}`)return json(res,403,{error:"İstek reddedildi."});
    const baslat=(ad,fn,bilinen)=>{try{yonetici.baslat(ad,fn,bilinen);return json(res,202,{ok:true});}catch{return json(res,409,{error:`Şu an çalışan iş var: ${yonetici.durum().ad}`});}};
    if(url.pathname==="/api/projeler"&&req.method==="GET")return json(res,200,{projeler:PROJELER.map(p=>({id:p.id,ad:p.ad,adres:p.adres,yayin:p.yayin.length>0})),anahtarlar:ANAHTARLAR.map(a=>({id:a.id,ad:a.ad})),son:existsSync(SON)?JSON.parse(readFileSync(SON,"utf8")):null});
    if(url.pathname==="/api/is"&&req.method==="GET")return json(res,200,yonetici.durum());
    if(url.pathname==="/api/kapat"&&req.method==="POST"){json(res,200,{ok:true});setTimeout(()=>process.exit(0),100);return;}
    if(url.pathname==="/api/durum"&&req.method==="POST")return baslat("Durum",async()=>({ok:true,ozet:"Durum güncellendi",veri:await durumFn()}));
    if(url.pathname==="/api/is"&&req.method==="POST"){
      const b=await govde(req),ids=PROJELER.map(p=>p.id);
      if(b.tur==="test"){const hedef=b.proje==="hepsi"?ids:[b.proje];if(!hedef.every(i=>ids.includes(i)))return json(res,400,{error:"Bilinmeyen proje."});return baslat(`Test: ${b.proje}`,testIsi(hedef));}
      if(b.tur==="yayin"){if(b.onay!==true)return json(res,400,{error:"Onay gerekli."});if(!ids.includes(b.proje))return json(res,400,{error:"Bilinmeyen proje."});return baslat(`Yayın: ${b.proje}`,yayinIsi(b.proje));}
      if(b.tur==="yedek")return baslat("Yedek",yedekIsi(istanbulBugun()));
      if(b.tur==="sirlar")return baslat("Sırlar",sirlarIsi());
      if(b.tur==="anahtar"){if(b.onay!==true)return json(res,400,{error:"Onay gerekli."});if(!ANAHTARLAR.some(a=>a.id===b.anahtar))return json(res,400,{error:"Bilinmeyen anahtar."});const deger=randomBytes(24).toString("hex");return baslat(`Anahtar: ${b.anahtar}`,anahtarIsi(b.anahtar,deger),[deger]);}
      return json(res,400,{error:"Bilinmeyen iş."});
    }
    return json(res,404,{error:"Bulunamadı."});
  });
  return s;
}

// Doğrudan çalıştırılınca: sunucuyu aç, tarayıcıyı başlat, son işi kaydet.
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const token=randomBytes(32).toString("hex"),yonetici=new IsYoneticisi(kabukCalistir);
  const d={adim:a=>new Promise(r=>{const cikti=[];kabukCalistir(a,s=>cikti.push(s)).then(k=>r({ok:k===0,cikti}));}),fetch};
  const s=sunucuKur({token,yonetici,durumFn:()=>durumTopla(d)});
  const once=existsSync(SON)?JSON.parse(readFileSync(SON,"utf8")):null;
  if(once&&once.calisiyor)writeFileSync(SON,JSON.stringify({...once,calisiyor:false,yarim:true}));
  setInterval(()=>{const x=yonetici.durum();if(x.ad)writeFileSync(SON,JSON.stringify({ad:x.ad,calisiyor:x.calisiyor,sonuc:x.sonuc,zaman:new Date().toISOString()}));},2000);
  const kapat=()=>{try{(IsYoneticisi.aktif)?.kill();}catch{}process.exit(0);};
  process.on("SIGINT",kapat);process.on("SIGTERM",kapat);process.on("SIGHUP",kapat);
  s.listen(0,"127.0.0.1",()=>{
    const adres=`http://127.0.0.1:${s.address().port}/?t=${token}`;
    console.log("Yönetim paneli açık. Bu pencereyi kapatınca panel durur.");
    exec(`start "" "${adres}"`);
  });
}
```

- [ ] **Step 4: Write `yonet/sayfa.html`**

```html
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yönetim Paneli</title>
<style>
:root{--bg:#101114;--yuz:#181a1f;--cizgi:#2b2e35;--yazi:#e9e6df;--soluk:#9aa0a8;--yesil:#3fb27f;--sari:#d9a441;--kirmizi:#d0584a;--gri:#6b7078;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--yazi);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;padding:20px max(16px,3vw)}
h1{font-size:22px;margin:0 0 4px}p{margin:0}.soluk{color:var(--soluk)}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
button{font:inherit;background:var(--yuz);color:var(--yazi);border:1px solid var(--cizgi);border-radius:6px;padding:6px 10px;cursor:pointer}
button:hover{border-color:var(--soluk)}button:disabled{opacity:.45;cursor:not-allowed}button.ana{background:#24324a;border-color:#3a5683}
table{width:100%;border-collapse:collapse;background:var(--yuz);border:1px solid var(--cizgi);border-radius:8px;overflow:hidden}
td,th{padding:10px;border-bottom:1px solid var(--cizgi);text-align:left;vertical-align:top}th{color:var(--soluk);font-weight:600;font-size:13px}
.nokta{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;background:var(--gri)}
.yesil{background:var(--yesil)}.sari{background:var(--sari)}.kirmizi{background:var(--kirmizi)}.gri{background:var(--gri)}
.oneri{color:var(--sari);font-size:13px;margin-top:2px}.dugmeler{display:flex;gap:6px;flex-wrap:wrap}
section{margin-top:18px}h2{font-size:16px;margin:0 0 8px}
pre{background:#0b0c0e;border:1px solid var(--cizgi);border-radius:8px;padding:12px;max-height:340px;overflow:auto;white-space:pre-wrap;font:13px/1.4 ui-monospace,Consolas,monospace;margin:8px 0 0}
#sonuc{font-weight:600;margin-top:8px}#sonuc.ok{color:var(--yesil)}#sonuc.hata{color:var(--kirmizi)}
@media (max-width:700px){td:nth-child(3),th:nth-child(3){display:none}}
</style>
</head>
<body>
<header>
  <div><h1>Yönetim Paneli</h1><p class="soluk" id="alt">Yükleniyor…</p></div>
  <div class="dugmeler"><button class="ana" id="yenile">Durumu yenile</button><button id="hepsi">Hepsini test et</button><button id="yedek">Yedek al</button><button id="sirlar">Sırları kontrol et</button><button id="kapat">Kapat</button></div>
</header>
<table><thead><tr><th>Proje</th><th>Durum</th><th>Adres</th><th></th></tr></thead><tbody id="satirlar"></tbody></table>
<section><h2>Dazai anahtarlarını yenile</h2><div class="dugmeler" id="anahtarlar"></div>
<p class="soluk" style="margin-top:6px;font-size:13px">Giriş şifresini değiştirmek için terminalde ilgili klasörde: <code>wrangler secret put AUTH_PASSWORD</code></p></section>
<section><h2 id="isAd">İşlem çıktısı</h2><div id="sonuc"></div><pre id="cikti"></pre></section>
<script>
const T="__TOKEN__",$=s=>document.querySelector(s);
const api=(yol,govde)=>fetch(yol,{method:govde===undefined?"GET":"POST",headers:{"x-yonet":T,"content-type":"application/json"},body:govde===undefined?undefined:JSON.stringify(govde)});
let projeler=[],durum={},izle=0;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function ciz(){
  $("#satirlar").innerHTML=projeler.map(p=>{const d=durum[p.id]||{renk:"gri",ozet:"bilinmiyor"};return `<tr><td><b>${esc(p.ad)}</b></td><td><span class="nokta ${d.renk}"></span>${esc(d.ozet)}${d.oneri?`<div class="oneri">${esc(d.oneri)}</div>`:""}</td><td><a href="${esc(p.adres)}" target="_blank" rel="noopener" class="soluk">${esc(p.adres.replace("https://",""))}</a></td><td><div class="dugmeler"><button data-test="${p.id}">Test</button>${p.yayin?`<button data-yayin="${p.id}">Yayınla</button>`:""}</div></td></tr>`;}).join("");
}
function kilit(v){document.querySelectorAll("button").forEach(b=>{if(b.id!=="kapat")b.disabled=v;});}
async function basla(yol,govde){
  const r=await api(yol,govde);const j=await r.json().catch(()=>({}));
  if(!r.ok){$("#sonuc").className="hata";$("#sonuc").textContent=j.error||"Başlatılamadı.";return;}
  kilit(true);$("#sonuc").textContent="";$("#cikti").textContent="";clearInterval(izle);izle=setInterval(takip,1000);takip();
}
async function takip(){
  const d=await (await api("/api/is")).json();
  $("#isAd").textContent=d.ad?`İşlem: ${d.ad}${d.calisiyor?" (çalışıyor…)":""}`:"İşlem çıktısı";
  $("#cikti").textContent=d.satirlar.join("\n");$("#cikti").scrollTop=1e9;
  if(!d.calisiyor){clearInterval(izle);kilit(false);if(d.sonuc){$("#sonuc").className=d.sonuc.ok?"ok":"hata";$("#sonuc").textContent=d.sonuc.ozet;if(d.sonuc.veri){for(const x of d.sonuc.veri)durum[x.id]=x;ciz();$("#alt").textContent=`Son kontrol: ${new Date().toLocaleTimeString("tr-TR")}`;}}}
}
document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b||b.disabled)return;
  if(b.id==="yenile")return basla("/api/durum",{});
  if(b.id==="hepsi")return basla("/api/is",{tur:"test",proje:"hepsi"});
  if(b.id==="yedek")return basla("/api/is",{tur:"yedek"});
  if(b.id==="sirlar")return basla("/api/is",{tur:"sirlar"});
  if(b.id==="kapat"){api("/api/kapat",{});document.body.innerHTML="<p style='padding:20px'>Panel kapandı. Bu sekmeyi kapatabilirsin.</p>";return;}
  if(b.dataset.test)return basla("/api/is",{tur:"test",proje:b.dataset.test});
  if(b.dataset.yayin){const p=projeler.find(x=>x.id===b.dataset.yayin);if(confirm(`${p.ad} canlıya yayınlansın mı? Önce testler çalışır.`))basla("/api/is",{tur:"yayin",proje:p.id,onay:true});return;}
  if(b.dataset.anahtar){if(confirm(`${b.textContent} anahtarı yenilensin mi? Yeni anahtar iki tarafa birden konur.`))basla("/api/is",{tur:"anahtar",anahtar:b.dataset.anahtar,onay:true});}
});
(async()=>{
  const j=await (await api("/api/projeler")).json();projeler=j.projeler;
  $("#anahtarlar").innerHTML=j.anahtarlar.map(a=>`<button data-anahtar="${a.id}">${esc(a.ad)}</button>`).join("");
  if(j.son&&j.son.yarim){$("#sonuc").className="hata";$("#sonuc").textContent=`Önceki işlem yarım kaldı: ${j.son.ad}`;}
  ciz();basla("/api/durum",{});
})();
</script>
</body>
</html>
```

- [ ] **Step 5: Write `Yönet.cmd` (depo kökü, UTF-8)**

```bat
@echo off
chcp 65001 >nul
title Yönetim Paneli
cd /d "%~dp0"
node yonet\sunucu.mjs
if errorlevel 1 pause
```

- [ ] **Step 6: Run tests**

Run: `node --test yonet/tests/`
Expected: tüm yonet testleri PASS (4+5+6+4 = 19).

- [ ] **Step 7: Commit**

```bash
git add yonet/sunucu.mjs yonet/sayfa.html yonet/tests/sunucu.test.mjs "Yönet.cmd"
git commit -m "Yonetim paneli: sunucu, sayfa ve acilis"
```

---

### Task 5: Masaüstü kısayolu ve gerçek deneme

- [ ] **Step 1: Kısayol**

PowerShell:
```powershell
$m=[Environment]::GetFolderPath("Desktop"); $w=New-Object -ComObject WScript.Shell; $k=$w.CreateShortcut("$m\Yönet.lnk"); $k.TargetPath="D:\Claude\Yönet.cmd"; $k.WorkingDirectory="D:\Claude"; $k.IconLocation="shell32.dll,21"; $k.Save(); Test-Path "$m\Yönet.lnk"
```
Expected: `True`.

- [ ] **Step 2: Paneli arka planda başlat ve built-in browser ile aç**

`node yonet/sunucu.mjs` arka planda; çıktısındaki adres yerine, `exec start` tarayıcıyı açar. Built-in browser'da aynı adresi açmak için: sunucu başladıktan sonra `son-is.json` yerine adres konsola yazılmadığından, deneme sırasında `YONET_ADRES_YAZ=1` ortam değişkeniyle adresi konsola da yaz: `sunucu.mjs`'de `console.log` satırına `if(process.env.YONET_ADRES_YAZ)console.log(adres);` ekle.

- [ ] **Step 3: Durum, Hepsini test et, Sırlar**

Built-in browser'da sayfayı aç. Beklenen:
- Durum: altı satır; Zenon ve Epiktetos sarı (öneriyle), Kleanthes sarı (uyku), Aurelius sarı (Dazai 7+ gün), Seneca ve Diogenes yeşil (ya da gerçek durum neyse). Konsolda hata yok.
- Hepsini test et: "Aurelius / Dazai ✓ · Kleanthes ✓ · Zenon ✓ · Epiktetos ✓ · Seneca ✓ · Diogenes ✓".
- Sırlar: "Bütün sırlar tanımlı ✓". Eksik/fazladan çıkarsa `projeler.mjs` listesi canlıya göre düzeltilir (Ruling olarak).
Sunucuyu durdur.

- [ ] **Step 4: Commit**

```bash
git add yonet/sunucu.mjs yonet/projeler.mjs
git commit -m "Yonetim paneli: gercek deneme duzeltmeleri"
```
