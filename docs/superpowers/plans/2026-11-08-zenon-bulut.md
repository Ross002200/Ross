# Zenon Bulut Tarafı ve Dazai Bağlantısı: Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zenon'un fotoğraflar dışındaki tüm verisini `zenon.diyarross.com`'daki kendi Worker + D1'ine taşımak ve Dazai'nin Zenon'da bakım ve kombin maddelerini okuyup işaretleyebilmesini sağlamak.

**Architecture:** Yeni `zenon-sunucu/` Worker'ı Zenon'un statik dosyalarını şifreli girişin arkasında sunar, localStorage anahtarlarını `docs` tablosunda tutar, Dazai işaretlerini `inbox` tablosuna yazar. İstemcide yeni `zenon-sync.js`, zenon.js yüklenmeden önce buluttan çeker, gelen kutusunu uygular, sonra uygulamayı yükler; her `store.set` anahtarı gönderim sırasına koyar. Aurelius, Zenon'u Kleanthes gibi bağlantı listesine ekler.

**Tech Stack:** Cloudflare Workers + D1 (wrangler 4.92.0, Kleanthes'teki kopyası), düz JS (UMD modüller), node --test (Node 24); Aurelius'ta TypeScript + esbuild test koşucusu.

**Spec:** `docs/superpowers/specs/2026-11-08-zenon-bulut-design.md`

## Global Constraints

- Alan adı `zenon.diyarross.com`; Worker adı `zenon`; D1 adı `zenon`.
- Eşitlenmeyen anahtarlar: `photos`, `care.push`, `aurelius`.
- Anahtar başına en çok 1 MB (`JSON.stringify(data).length <= 1048576`).
- Dazai yetkisi `x-dazai-key` = `DAZAI_KEY`; Aurelius tarafında `ZENON_DAZAI_KEY`. Dazai anahtarı yalnız `/api/dazai/bugun` ve `/api/dazai/isaretle`'ye erişir.
- Hata metinleri Türkçe: `Yetkisiz.`, `Bilinmeyen madde.`, `Bugün için kombin kartı yok; Zenon'u açınca hazırlanır.`
- Madde id'leri: `kombin:gun`, `kombin:spor`, `bakim:sabah`, `bakim:aksam`, `gorev:<id>`.
- Yeni paket kurulmaz: wrangler `../Kleanthes/app/node_modules/wrangler/bin/wrangler.js` üzerinden çalışır.
- Ross deposu herkese açık: koda ve depoya sır yazılmaz; sırlar yalnız `wrangler secret put` ile.
- Çalışma ağacındaki kullanıcıya ait değişikliklere (`.gitignore`, `diogenes/*`) dokunulmaz; commit'lerde dosyalar tek tek eklenir.
- Canlıya yayın (Task 6) ve GitHub'a push kullanıcı onayıyla yapılır.

## Review Focus

1. Gelen kutusu kaydı, telefondaki değişiklik buluta gönderilemeden onaylanırsa (ack) Dazai'nin işareti kaybolur → ack yalnız başarılı gönderimden sonra (Task 3 testi: "gönderim başarısızsa ack yok").
2. Aynı "giydim" iki ayrı kayıtla gelirse (Dazai'ye iki kez söylendi) log'a iki kez yazılıp kirli sayacı iki kez artar → aynı gün + aynı kombin tek kayıt (Task 3 testi).
3. 1 MB'ı aşan tek anahtar (ör. çok büyük `log`) sırayı sonsuza dek tıkar → sunucu reddeder, istemci sıradan çıkarır (Task 1 ve Task 3 testleri).
4. Gönderim sürerken aynı anahtar yeniden değişirse yeni değer kaybolur → yalnız gönderilen metinle aynı kalan anahtar sıradan çıkar (Task 3 testi).
5. Eski GitHub Pages kopyası yeni kodu çalıştırınca github.io'da `/api`'ye istek atıp bozulur → eşitleme yalnız `zenon.diyarross.com`/localhost'ta açık (Task 3 testi `eslemeAcik`).

---

### Task 1: Sunucu iskeleti, giriş ve belge API'si

**Files:**
- Create: `zenon-sunucu/package.json`, `zenon-sunucu/wrangler.json`, `zenon-sunucu/.gitignore`, `zenon-sunucu/migrations/0001_init.sql`, `zenon-sunucu/src/docs.js`, `zenon-sunucu/src/worker.js`, `zenon-sunucu/giris.html`, `zenon-sunucu/scripts/build.mjs`
- Test: `zenon-sunucu/tests/docs.test.js`

**Interfaces:**
- Produces: `belgeleriAyikla(body) → {gecerli:[{key,text}], reddedilen:[{key,neden}]}` (items dizisi yoksa Error); `gecerliAnahtar(k):boolean`; `MAX_DOC=1048576`.
- HTTP (oturum çerezi gerekli): `GET /api/docs?since=ISO → {items:[{key,data,updated_at}]}`; `PUT /api/docs {items:[{key,data}]} → {ok,updated_at,reddedilen}`; `GET /api/inbox → {items:[{id,data}]}`; `POST /api/inbox/ack {ids} → {ok}`. `POST /api/login {password}`.

- [ ] **Step 1: Write the failing test**

`zenon-sunucu/tests/docs.test.js`:
```js
import {test} from "node:test";
import assert from "node:assert/strict";
import {belgeleriAyikla,gecerliAnahtar,MAX_DOC} from "../src/docs.js";

test("anahtar: Zenon anahtarları geçer, eşitlenmeyenler ve bozuklar geçmez", () => {
  for(const k of ["log","care.state","coach.todo","card:2026-11-09","wear.idx"])assert.equal(gecerliAnahtar(k),true,k);
  for(const k of ["photos","care.push","aurelius","","a b","x".repeat(81),null,7])assert.equal(gecerliAnahtar(k),false,String(k));
});

test("ayıkla: geçerliler metne çevrilir, bozuklar ve büyükler reddedilir, istek düşmez", () => {
  const r=belgeleriAyikla({items:[
    {key:"log",data:[{d:"2026-11-09"}]},
    {key:"photos",data:{}},
    {key:"plan",data:undefined},
    {key:"buyuk",data:"x".repeat(MAX_DOC)},
    {key:"care.state",data:{done:{}}}]});
  assert.deepEqual(r.gecerli,[{key:"log",text:'[{"d":"2026-11-09"}]'},{key:"care.state",text:'{"done":{}}'}]);
  assert.deepEqual(r.reddedilen.map(x=>x.key),["photos","plan","buyuk"]);
  assert.match(r.reddedilen[2].neden,/1 MB/);
});

test("ayıkla: items yoksa ya da çok fazlaysa hata", () => {
  assert.throws(()=>belgeleriAyikla({}),/items gerekli/);
  assert.throws(()=>belgeleriAyikla({items:Array.from({length:201},(_,i)=>({key:"k"+i,data:1}))}),/en çok 200/);
});
```

`zenon-sunucu/package.json`:
```json
{
  "name": "zenon-sunucu",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "node --test tests/docs.test.js",
    "wrangler": "node ../Kleanthes/app/node_modules/wrangler/bin/wrangler.js",
    "deploy": "node scripts/build.mjs && node ../Kleanthes/app/node_modules/wrangler/bin/wrangler.js deploy"
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd zenon-sunucu && npm test`
Expected: FAIL, `Cannot find module '.../src/docs.js'`

- [ ] **Step 3: Write minimal implementation**

`zenon-sunucu/src/docs.js`:
```js
// Zenon belge doğrulaması (saf): localStorage anahtarları docs tablosuna yazılmadan önce.
export const MAX_DOC=1024*1024,MAX_ITEMS=200;
export const SKIP=new Set(["photos","care.push","aurelius"]);
const KEY=/^[A-Za-z0-9_.:\-]{1,80}$/;
export const gecerliAnahtar=k=>typeof k==="string"&&KEY.test(k)&&!SKIP.has(k);
// Tek bozuk anahtar tüm isteği düşürmez: geçerliler yazılır, diğerleri nedeniyle döner (istemci onları sıradan çıkarır).
export function belgeleriAyikla(body){
  if(!body||!Array.isArray(body.items))throw new Error("items gerekli.");
  if(body.items.length>MAX_ITEMS)throw new Error("Bir seferde en çok 200 anahtar.");
  const gecerli=[],reddedilen=[];
  for(const it of body.items){
    const key=it&&it.key;
    if(!gecerliAnahtar(key)){reddedilen.push({key:String(key),neden:"Geçersiz ya da eşitlenmeyen anahtar."});continue;}
    if(it.data===undefined){reddedilen.push({key,neden:"Veri yok."});continue;}
    const text=JSON.stringify(it.data);
    if(text.length>MAX_DOC){reddedilen.push({key,neden:"1 MB sınırını aşıyor."});continue;}
    gecerli.push({key,text});
  }
  return {gecerli,reddedilen};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd zenon-sunucu && npm test`
Expected: PASS 3/3

- [ ] **Step 5: Add worker, schema, config, login page, build script**

`zenon-sunucu/migrations/0001_init.sql`:
```sql
-- Zenon: localStorage anahtarları (docs), Dazai gelen kutusu (inbox), giriş denemeleri.
CREATE TABLE docs (key TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX idx_docs_updated ON docs (updated_at);
CREATE TABLE inbox (id TEXT PRIMARY KEY, day TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, applied_at TEXT);
CREATE INDEX idx_inbox_open ON inbox (applied_at, day);
CREATE TABLE login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX idx_login_attempts ON login_attempts (address, at);
```

`zenon-sunucu/wrangler.json` (database_id Task 6'da gerçek değerle değiştirilir):
```json
{
  "name": "zenon",
  "main": "src/worker.js",
  "compatibility_date": "2026-05-15",
  "workers_dev": false,
  "assets": {"directory": "public", "binding": "ASSETS", "run_worker_first": true, "html_handling": "none", "not_found_handling": "none"},
  "d1_databases": [{"binding": "DB", "database_name": "zenon", "database_id": "00000000-0000-0000-0000-000000000000", "migrations_dir": "migrations"}],
  "observability": {"enabled": true},
  "routes": [{"pattern": "zenon.diyarross.com", "custom_domain": true}]
}
```

`zenon-sunucu/.gitignore`:
```
public/
.wrangler/
.dev.vars
```

`zenon-sunucu/src/worker.js`:
```js
// Zenon sunucusu (Cloudflare Worker + D1). Tek kullanıcı: şifreli giriş, imzalı çerez (Kleanthes'teki kod).
// Veri: Zenon'un localStorage anahtarları docs tablosunda (key → JSON). Dazai: /api/dazai/* (x-dazai-key); işaretler inbox'ta.
import {belgeleriAyikla} from "./docs.js";

const COOKIE="zenon_session",SESSION_SECONDS=180*24*3600,MAX_BODY=5*1024*1024;
const enc=new TextEncoder();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sign(secret,payload){const k=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(await crypto.subtle.sign("HMAC",k,enc.encode(payload)))}
export async function safeEqual(a,b){const [x,y]=await Promise.all([a,b].map(v=>crypto.subtle.digest("SHA-256",enc.encode(v))));const l=new Uint8Array(x),r=new Uint8Array(y);let d=0;for(let i=0;i<l.length;i++)d|=l[i]^r[i];return d===0}
async function createSession(secret){const exp=String(Math.floor(Date.now()/1000)+SESSION_SECONDS);return `${exp}.${await sign(secret,exp)}`}
async function verifySession(secret,token){if(!secret||!token)return false;const [exp,sig,...rest]=token.split(".");if(rest.length||!/^\d{1,12}$/.test(exp||"")||!sig)return false;if(Number(exp)*1000<=Date.now())return false;return safeEqual(sig,await sign(secret,exp))}
const cookieOf=(req,name)=>{const m=(req.headers.get("cookie")||"").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));return m?decodeURIComponent(m[1]):undefined};
export const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}});
export const nowIso=()=>new Date().toISOString();
export async function readJson(req,limit){const len=Number(req.headers.get("content-length")||0);if(len>limit)throw new Error("too_large");const t=await req.text();if(t.length>limit)throw new Error("too_large");return JSON.parse(t)}
function sameOrigin(req){const o=req.headers.get("origin");return !o||o===new URL(req.url).origin}

async function login(req,env){
  if(!sameOrigin(req))return json({error:"İstek reddedildi."},403);
  const ip=req.headers.get("cf-connecting-ip")||"?",since=new Date(Date.now()-15*60000).toISOString();
  await env.DB.prepare("DELETE FROM login_attempts WHERE at<?").bind(new Date(Date.now()-86400000).toISOString()).run();
  const n=await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE address=? AND at>?").bind(ip,since).first();
  if(n&&n.n>=8)return json({error:"Çok fazla deneme. 15 dakika sonra tekrar dene."},429);
  let password="";try{password=String((await readJson(req,500)).password||"")}catch{return json({error:"Geçersiz istek."},400)}
  if(!env.AUTH_PASSWORD||!password||!(await safeEqual(password,env.AUTH_PASSWORD))){
    await env.DB.prepare("INSERT INTO login_attempts(address,at) VALUES(?,?)").bind(ip,nowIso()).run();
    return json({error:"Şifre yanlış."},401);
  }
  const token=await createSession(env.SESSION_SECRET);
  return json({ok:true},200,{"Set-Cookie":`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`});
}

async function api(req,env,url){
  const p=url.pathname,m=req.method;
  if(p==="/api/login"&&m==="POST")return login(req,env);
  if(!(await verifySession(env.SESSION_SECRET,cookieOf(req,COOKIE))))return json({error:"Giriş yapman gerekiyor."},401);
  if(m!=="GET"&&!sameOrigin(req))return json({error:"İstek reddedildi."},403);
  if(p==="/api/logout"&&m==="POST")return json({ok:true},200,{"Set-Cookie":`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
  if(p==="/api/docs"&&m==="GET"){
    const since=url.searchParams.get("since")||"";
    const q=since?env.DB.prepare("SELECT key,data,updated_at FROM docs WHERE updated_at>? ORDER BY updated_at").bind(since):env.DB.prepare("SELECT key,data,updated_at FROM docs ORDER BY updated_at");
    const rows=await q.all();
    return json({items:rows.results.map(r=>({key:r.key,data:JSON.parse(r.data),updated_at:r.updated_at}))});
  }
  if(p==="/api/docs"&&m==="PUT"){
    let body;try{body=await readJson(req,MAX_BODY)}catch{return json({error:"İstek çok büyük ya da bozuk."},413)}
    let r;try{r=belgeleriAyikla(body)}catch(e){return json({error:e.message},400)}
    const at=nowIso();
    if(r.gecerli.length)await env.DB.batch(r.gecerli.map(x=>env.DB.prepare("INSERT INTO docs(key,data,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").bind(x.key,x.text,at)));
    return json({ok:true,updated_at:at,reddedilen:r.reddedilen});
  }
  if(p==="/api/inbox"&&m==="GET"){
    const rows=await env.DB.prepare("SELECT id,data FROM inbox WHERE applied_at IS NULL ORDER BY created_at LIMIT 200").all();
    return json({items:rows.results.map(r=>({id:r.id,data:JSON.parse(r.data)}))});
  }
  if(p==="/api/inbox/ack"&&m==="POST"){
    let b;try{b=await readJson(req,20000)}catch{return json({error:"Geçersiz istek."},400)}
    const ids=Array.isArray(b&&b.ids)?b.ids.filter(x=>typeof x==="string").slice(0,200):[];
    const at=nowIso();
    if(ids.length)await env.DB.batch(ids.map(id=>env.DB.prepare("UPDATE inbox SET applied_at=? WHERE id=? AND applied_at IS NULL").bind(at,id)));
    await env.DB.prepare("DELETE FROM inbox WHERE applied_at IS NOT NULL AND applied_at<?").bind(new Date(Date.now()-30*86400000).toISOString()).run();
    return json({ok:true});
  }
  return json({error:"Bulunamadı."},404);
}

const PUBLIC=new Set(["/giris.html","/manifest.webmanifest","/sw.js","/icon.svg","/icon-180.png","/icon-192.png","/icon-512.png"]);
export default {
  async fetch(req,env){
    const url=new URL(req.url);
    try{
      if(url.pathname.startsWith("/api/"))return await api(req,env,url);
      if(PUBLIC.has(url.pathname))return env.ASSETS.fetch(req);
      const ok=await verifySession(env.SESSION_SECRET,cookieOf(req,COOKIE));
      if(!ok)return env.ASSETS.fetch(new Request(new URL("/giris.html",url),req));
      if(url.pathname==="/"||url.pathname==="/index.html")return env.ASSETS.fetch(new Request(new URL("/index.html",url),req));
      return env.ASSETS.fetch(req);
    }catch(e){console.error("istek hatası",e&&e.message);return json({error:"Sunucu hatası."},500)}
  }
};
```

`zenon-sunucu/giris.html`:
```html
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Zenon">
<meta name="theme-color" content="#15141C">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="icon" href="/icon.svg">
<title>Zenon · Giriş</title>
<style>
:root{--bg:#15141C;--surface:#1E1D27;--line:#34333F;--text:#ECE7DD;--muted:#9A97A3;--accent:#C9A24A;--err:#D0675A;color-scheme:dark}
*{box-sizing:border-box}html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;padding:max(24px,env(safe-area-inset-top)) 20px max(24px,env(safe-area-inset-bottom))}
form{width:min(380px,100%);display:grid;gap:14px}
h1{margin:0;font-weight:600;font-size:44px;letter-spacing:.04em}h1 span{color:var(--accent)}
label{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);display:grid;gap:6px}
input{font:inherit;font-size:20px;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:14px;min-height:54px}
input:focus{outline:2px solid var(--accent);outline-offset:1px}
button{font:inherit;font-weight:600;font-size:17px;background:var(--accent);color:#1a1405;border:0;border-radius:6px;min-height:56px;cursor:pointer}
button[disabled]{opacity:.6}p{margin:0;color:var(--muted)}.err{color:var(--err);font-weight:600;min-height:20px}
</style>
</head>
<body>
<form id="f" autocomplete="on">
  <h1>Zenon<span>.</span></h1>
  <p>Stil ve bakım. Devam etmek için şifreni gir.</p>
  <label for="pw">Şifre<input id="pw" name="password" type="password" autocomplete="current-password" required></label>
  <button id="b" type="submit">Giriş</button>
  <div class="err" id="e" role="alert"></div>
</form>
<script>
document.getElementById("f").addEventListener("submit",async e=>{
  e.preventDefault();const b=document.getElementById("b"),err=document.getElementById("e");b.disabled=true;err.textContent="";
  try{const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:document.getElementById("pw").value})});
    const j=await r.json().catch(()=>({}));if(r.ok){location.replace("/");return}err.textContent=j.error||"Giriş olmadı.";}
  catch(x){err.textContent="Bağlantı yok. İnternetini kontrol et."}
  b.disabled=false;
});
</script>
</body>
</html>
```

`zenon-sunucu/scripts/build.mjs`:
```js
// Kökteki Zenon dosyalarını public/ içine kopyalar; sw.js önbellek adını her yayında yeniler.
import {cpSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
const kok=new URL("../../",import.meta.url),pub=new URL("../public/",import.meta.url);
export const DOSYALAR=["index.html","zenon.css","zenon-care.js","zenon-plan.js","zenon-coach.js","zenon.js","manifest.webmanifest","icon.svg","icon-180.png","icon-192.png","icon-512.png"];
rmSync(pub,{recursive:true,force:true});mkdirSync(pub,{recursive:true});
for(const f of DOSYALAR)cpSync(new URL(f,kok),new URL(f,pub));
cpSync(new URL("../giris.html",import.meta.url),new URL("giris.html",pub));
const sw=readFileSync(new URL("sw.js",kok),"utf8").replace(/const CACHE="[^"]*";/,`const CACHE="zenon-${Date.now().toString(36)}";`);
writeFileSync(new URL("sw.js",pub),sw);
console.log(`public/: ${DOSYALAR.length+2} dosya`);
```

- [ ] **Step 6: Build and syntax-check**

Run: `cd zenon-sunucu && npm run build && node --check src/worker.js && npm test`
Expected: `public/: 13 dosya`, no syntax error, PASS 3/3.

- [ ] **Step 7: Commit**

```bash
git add zenon-sunucu/package.json zenon-sunucu/wrangler.json zenon-sunucu/.gitignore zenon-sunucu/migrations zenon-sunucu/src zenon-sunucu/giris.html zenon-sunucu/scripts zenon-sunucu/tests
git commit -m "Zenon sunucusu: giris, belge ve gelen kutusu API'si"
```

---

### Task 2: Sunucu tarafı Dazai maddeleri ve işaretleme

**Files:**
- Create: `zenon-sunucu/src/dazai.js`
- Modify: `zenon-sunucu/src/worker.js` (dazai rotaları), `zenon-sunucu/package.json` (test betiği)
- Test: `zenon-sunucu/tests/dazai.test.js`

**Interfaces:**
- Consumes: `json`, `readJson`, `nowIso`, `safeEqual` (Task 1, worker.js); `ZenonCare` (`../../zenon-care.js`: `buildDay(profile,date,wx,state) → {am,pm,weekly,active}`, `markRoutine(day,entry,kind,on)`, `DEFAULT_PROFILE`; adım = `{id,label,why}`).
- Produces: `zenonBugun(day, d, bekleyen) → {app:"zenon",day,ozet,maddeler}` (d = `{profile,care,card,log,todo,wx}`, bekleyen = inbox data dizisi); `isaretleKaydi(day, b, d) → {kayit, mesaj}` ya da Error. Inbox kaydı şekilleri: `{tur:"giydim",d,slot:"gun"|"spor",key,title,occ,ids}`, `{tur:"bakim",d,kind:"am"|"pm",on}`, `{tur:"gorev",d,id,on}`. Kart belgesi `card:<gün>` = `{gun:{key,title,pieces,ids,occ}|null, spor:{…}|null}`.
- Plan kararı (spec'ten ayrılış): adım ve parça listesi `baslik` yerine standarttaki `ayrinti` alanına konur; başlık kısa kalır ki bildirim metni uzamasın. Aurelius bu alanı Dazai metninde gösterir (Task 5).

- [ ] **Step 1: Write the failing test**

`zenon-sunucu/tests/dazai.test.js`:
```js
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
```

Modify `zenon-sunucu/package.json` test betiği: `"test": "node --test tests/docs.test.js tests/dazai.test.js"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd zenon-sunucu && npm test`
Expected: FAIL, `Cannot find module '.../src/dazai.js'`

- [ ] **Step 3: Write minimal implementation**

`zenon-sunucu/src/dazai.js`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd zenon-sunucu && npm test`
Expected: PASS 9/9

- [ ] **Step 5: Wire routes in worker.js**

Add the import at the top of `zenon-sunucu/src/worker.js`:
```js
import {zenonBugun,isaretleKaydi} from "./dazai.js";
```
Add before `async function api(`:
```js
// Dazai: x-dazai-key = DAZAI_KEY. Yalnız günün maddeleri ve gelen kutusuna yazma; gardırobun tamamı okunmaz.
const GUN=/^\d{4}-\d{2}-\d{2}$/;
async function dazai(req,env,url){
  const k=req.headers.get("x-dazai-key")||"";
  if(!env.DAZAI_KEY||!k||!(await safeEqual(k,env.DAZAI_KEY)))return json({error:"Yetkisiz."},401);
  const doc=async key=>{const r=await env.DB.prepare("SELECT data FROM docs WHERE key=?").bind(key).first();return r?JSON.parse(r.data):null};
  const veri=async day=>{const [profile,care,card,log,todo,wx]=await Promise.all(["care.profile","care.state",`card:${day}`,"log","coach.todo","wxDays"].map(doc));return {profile,care,card,log,todo,wx}};
  if(url.pathname==="/api/dazai/bugun"&&req.method==="GET"){
    const day=url.searchParams.get("day")||"";if(!GUN.test(day))return json({error:"Tarih gerekli."},400);
    const [d,bek]=await Promise.all([veri(day),env.DB.prepare("SELECT data FROM inbox WHERE day=? AND applied_at IS NULL ORDER BY created_at").bind(day).all()]);
    return json(zenonBugun(day,d,bek.results.map(r=>JSON.parse(r.data))));
  }
  if(url.pathname==="/api/dazai/isaretle"&&req.method==="POST"){
    let b;try{b=await readJson(req,2000)}catch{return json({error:"Geçersiz istek."},400)}
    if(!b||typeof b!=="object")return json({error:"Geçersiz istek."},400);
    const day=String(b.day||"");if(!GUN.test(day))return json({error:"Tarih gerekli."},400);
    let r;try{r=isaretleKaydi(day,b,await veri(day))}catch(e){return json({error:e.message},400)}
    const id=String(b.anahtar||"").slice(0,60)||`${String(b.id).slice(0,40)}-${day}-${Date.now()}`,onceki=String(b.onceki||"").slice(0,60);
    if(onceki&&await env.DB.prepare("SELECT 1 AS x FROM inbox WHERE id=?").bind(onceki).first())return json({ok:true,mesaj:r.mesaj});
    await env.DB.prepare("INSERT INTO inbox(id,day,data,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,day,JSON.stringify(r.kayit),nowIso()).run();
    return json({ok:true,mesaj:r.mesaj});
  }
  return json({error:"Bulunamadı."},404);
}
```
In `api()`, directly after the `/api/login` line:
```js
  if(p.startsWith("/api/dazai/"))return dazai(req,env,url);
```

- [ ] **Step 6: Verify**

Run: `cd zenon-sunucu && node --check src/worker.js && npm test`
Expected: no syntax error, PASS 9/9.

- [ ] **Step 7: Commit**

```bash
git add zenon-sunucu/src zenon-sunucu/tests/dazai.test.js zenon-sunucu/package.json
git commit -m "Zenon sunucusu: Dazai gunun maddeleri ve isaretleme (gelen kutusu)"
```

---

### Task 3: İstemci eşitleme modülü (zenon-sync.js)

**Files:**
- Create: `zenon-sync.js` (depo kökü)
- Test: `tests/sync.test.js`

**Interfaces:**
- Consumes: inbox kayıt şekilleri ve HTTP uçları (Task 1–2); `ZenonCare.buildDay`, `markRoutine`.
- Produces (node `require`, tarayıcıda `window.ZenonSyncCore`): `eslenir(k)`, `eslemeAcik(host)`, `bekleyenEkle(list,k)`, `paketle(keys,metin,limit)`, `cekilenler(items,bekleyen,metin)`, `gelenUygula(s,kayitlar,C) → {log,care,todo,seen,degisen}`, `istemci({ls,api,C}) → {kirli,hepsiKirli,gonder,cek,gelen,bekleyen}`. Tarayıcıda `window.ZenonSync = {kirli(k), hepsiKirli()}`; modül açılışta zenon-plan.js, zenon-coach.js, zenon.js'i sırayla yükler. `#syncBadge` öğesi varsa bekleyen gönderim olduğunda görünür olur.

- [ ] **Step 1: Write the failing test**

`tests/sync.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sync.test.js`
Expected: FAIL, `Cannot find module '../zenon-sync.js'`

- [ ] **Step 3: Write minimal implementation**

`zenon-sync.js`:
```js
/* Zenon eşitleme: localStorage (zenon9:*) ↔ zenon.diyarross.com (D1) ve Dazai gelen kutusu.
   Saf çekirdek + bağımlılıkla kurulan istemci (node'da test edilir) + tarayıcı açılışı.
   Tarayıcıda zenon-care.js'ten sonra yüklenir; eşitlemeden sonra zenon-plan.js, zenon-coach.js, zenon.js'i yükler. */
(function (root) {
"use strict";
const P = "zenon9:", PK = "zenon-sync:bekleyen", SK = "zenon-sync:since", SEEN = "zenon-sync:goruldu";
const SKIP = new Set(["photos", "care.push", "aurelius"]);
const eslenir = k => typeof k === "string" && k.length > 0 && !SKIP.has(k);
const eslemeAcik = host => host === "zenon.diyarross.com" || host === "localhost" || host === "127.0.0.1";
const bekleyenEkle = (list, k) => eslenir(k) && !list.includes(k) ? [...list, k] : list;
function paketle(keys, metin, limit = 3e6) {
  const out = []; let boy = 0;
  for (const k of keys) { const t = metin(k); if (t == null) continue; if (out.length && boy + t.length > limit) break; out.push(k); boy += t.length; }
  return out;
}
const cekilenler = (items, bekleyen, metin) => items.filter(it => eslenir(it.key) && !bekleyen.includes(it.key) && metin(it.key) !== JSON.stringify(it.data));

// Dazai işaretlerini yerel duruma uygular. s = {log, care, todo, profile, wx, seen}; girdi değiştirilmez.
function gelenUygula(s, kayitlar, C) {
  const log = [...(s.log || [])], care = { ...(s.care || {}), done: { ...((s.care || {}).done || {}) } }, todo = { ...(s.todo || {}) }, seen = [...(s.seen || [])], degisen = new Set();
  for (const { id, data: e } of kayitlar) {
    if (seen.includes(id) || !e) continue; seen.push(id);
    if (e.tur === "giydim") {
      const t = { ...(todo[e.d] || {}) };
      if (e.slot === "spor") t.weargym = true;
      else { t.wear = true; if (!log.some(l => l.d === e.d && l.key === e.key)) { log.push({ d: e.d, key: e.key, title: e.title, occ: e.occ, ids: e.ids || [], applied: false }); degisen.add("log"); } }
      todo[e.d] = t; degisen.add("coach.todo");
    } else if (e.tur === "bakim" && s.profile) {
      const gun = C.buildDay(s.profile, e.d, (s.wx || {})[e.d] || null, care);
      care.done[e.d] = C.markRoutine(gun, care.done[e.d], e.kind, e.on); degisen.add("care.state");
    } else if (e.tur === "gorev") {
      const g = { am: [], pm: [], tasks: [], ...(care.done[e.d] || {}) };
      g.tasks = (g.tasks || []).filter(x => x !== e.id); if (e.on) g.tasks.push(e.id);
      care.done[e.d] = g; degisen.add("care.state");
    }
  }
  return { log, care, todo, seen: seen.slice(-200), degisen: [...degisen] };
}

// d = {ls: localStorage benzeri, api(path, opt) → Promise<json>, C: ZenonCare}
function istemci(d) {
  const oku = k => { try { return JSON.parse(d.ls.getItem(k)); } catch (e) { return null; } };
  const metin = k => d.ls.getItem(P + k);
  let bekleyen = oku(PK) || [], ucusta = false;
  const kaydet = () => d.ls.setItem(PK, JSON.stringify(bekleyen));
  function kirli(k) { const n = bekleyenEkle(bekleyen, k); if (n !== bekleyen) { bekleyen = n; kaydet(); } }
  function hepsiKirli() { const ks = []; for (let i = 0; i < d.ls.length; i++) { const k = d.ls.key(i); if (k && k.startsWith(P)) ks.push(k.slice(P.length)); } ks.forEach(kirli); }
  async function gonder() {
    if (ucusta) return false; ucusta = true;
    try {
      bekleyen = bekleyen.filter(k => metin(k) != null); kaydet();
      while (bekleyen.length) {
        const paket = paketle(bekleyen, metin), giden = new Map(paket.map(k => [k, metin(k)])), items = [];
        for (const [k, t] of giden) { try { items.push({ key: k, data: JSON.parse(t) }); } catch (e) { /* bozuk JSON gönderilmez, sıradan düşer */ } }
        const r = await d.api("docs", { method: "PUT", body: JSON.stringify({ items }) });
        if (r && r.reddedilen && r.reddedilen.length) console.warn("Zenon eşitleme reddetti:", r.reddedilen);
        const once = bekleyen.length;
        bekleyen = bekleyen.filter(k => !giden.has(k) || metin(k) !== giden.get(k)); kaydet();
        if (bekleyen.length >= once) break;
      }
      return true;
    } catch (e) { return false; } finally { ucusta = false; }
  }
  async function cek() {
    const since = d.ls.getItem(SK) || "";
    const r = await d.api("docs" + (since ? "?since=" + encodeURIComponent(since) : ""));
    const items = (r && r.items) || [], yeni = cekilenler(items, bekleyen, metin);
    for (const it of yeni) d.ls.setItem(P + it.key, JSON.stringify(it.data));
    const enson = items.reduce((m, it) => it.updated_at > m ? it.updated_at : m, since);
    if (enson) d.ls.setItem(SK, enson);
    return yeni.length;
  }
  async function gelen() {
    const r = await d.api("inbox"), kayitlar = (r && r.items) || [];
    if (!kayitlar.length) return 0;
    const s = { log: oku(P + "log") || [], care: oku(P + "care.state") || {}, todo: oku(P + "coach.todo") || {}, profile: oku(P + "care.profile"), wx: oku(P + "wxDays") || {}, seen: oku(SEEN) || [] };
    const o = gelenUygula(s, kayitlar, d.C), yeni = { log: o.log, "care.state": o.care, "coach.todo": o.todo };
    for (const k of o.degisen) { d.ls.setItem(P + k, JSON.stringify(yeni[k])); kirli(k); }
    d.ls.setItem(SEEN, JSON.stringify(o.seen));
    // Onay yalnız değişiklik buluta yazıldıktan sonra: yoksa Dazai'nin işareti sunucu görünümünden düşer.
    if (await gonder()) await d.api("inbox/ack", { method: "POST", body: JSON.stringify({ ids: kayitlar.map(x => x.id) }) });
    return o.degisen.length;
  }
  return { kirli, hepsiKirli, gonder, cek, gelen, bekleyen: () => bekleyen };
}

function tarayici() {
  const ac = eslemeAcik(location.hostname);
  const api = async (path, opt = {}) => {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetch("/api/" + path, { ...opt, headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", signal: ctl.signal });
      if (r.status === 401) { location.reload(); throw new Error("401"); }
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } finally { clearTimeout(tm); }
  };
  const z = istemci({ ls: localStorage, api, C: root.ZenonCare });
  let t = 0;
  const rozet = () => { const b = document.getElementById("syncBadge"); if (b) b.hidden = !(ac && z.bekleyen().length); };
  const gonder = () => z.gonder().then(rozet);
  root.ZenonSync = {
    kirli(k) { if (!ac) return; z.kirli(k); rozet(); clearTimeout(t); t = setTimeout(gonder, 2000); },
    hepsiKirli() { if (ac) z.hepsiKirli(); }
  };
  const yukle = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
  (async () => {
    if (ac) { try { await z.gonder(); await z.cek(); await z.gelen(); } catch (e) { console.warn("Zenon eşitleme:", e && e.message); } }
    for (const src of ["zenon-plan.js", "zenon-coach.js", "zenon.js"]) await yukle(src);
    rozet();
    if (!ac) return;
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible") return;
      try { await z.gonder(); const n = (await z.cek()) + (await z.gelen()); rozet(); if (n) location.reload(); } catch (e) { rozet(); }
    });
    addEventListener("online", gonder);
  })();
}

const api = { eslenir, eslemeAcik, bekleyenEkle, paketle, cekilenler, gelenUygula, istemci };
if (typeof module === "object" && module.exports) module.exports = api;
else { root.ZenonSyncCore = api; tarayici(); }
})(typeof self !== "undefined" ? self : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sync.test.js`
Expected: PASS 10/10

- [ ] **Step 5: Run all root tests**

Run: `node --test tests/care.test.js tests/coach.test.js tests/plan.test.js tests/sync.test.js`
Expected: all pass (mevcut testler bozulmaz).

- [ ] **Step 6: Commit**

```bash
git add zenon-sync.js tests/sync.test.js
git commit -m "Zenon: istemci esitleme modulu (bulut, gelen kutusu)"
```

---

### Task 4: Zenon'u eşitlemeye bağlama, kombin kartı, eski bildirim ve Aurelius planının kaldırılması

**Files:**
- Modify: `index.html` (script sırası ~391–394, bildirim kartı ~248–250, eşitleme rozeti), `zenon.js` (store ~3–6; renderFit ~640; renderWear ~1424; bildirim bloğu ~1165–1201; pushAurPlan ~1254–1262 ve 1286; restoreData ~1779; açılış satırı ~1836), `sw.js` (SHELL, /api atlama), `zenon-sunucu/scripts/build.mjs` (DOSYALAR)
- Test: `tests/sync.test.js` (kart yardımcıları için), tarayıcı yoklaması

**Interfaces:**
- Consumes: `window.ZenonSync.kirli(k)`, `hepsiKirli()` (Task 3); kart şekli `{gun:{key,title,pieces,ids,occ}|null, spor:{…}|null}` (Task 2).
- Produces: `card:<gün>` localStorage anahtarı (eşitlenir), `zenon-sync.js` script'i index.html'de.

- [ ] **Step 1: Write the failing test** (kart şekli saf yardımcıda)

Append to `tests/sync.test.js`:
```js
test("kart: kombin seçiminden Dazai kartı, eksik olan null", () => {
  const sec={f:{key:"f12",title:"Lacivert"},p:[{it:{id:3,n:"Triko"}},{it:{id:7,n:"Chino"}}]};
  assert.deepEqual(S.kartYap(sec,"okul",it=>it.n),{key:"f12",title:"Lacivert",pieces:"Triko, Chino",ids:[3,7],occ:"okul"});
  assert.equal(S.kartYap(null,"okul",it=>it.n),null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sync.test.js`
Expected: FAIL, `S.kartYap is not a function`

- [ ] **Step 3: Implement kartYap**

In `zenon-sync.js`, add after `cekilenler`:
```js
// Zenon'un kombin seçimi ({f, p:[{it}]}) → Dazai'nin okuduğu kart parçası.
const kartYap = (x, occ, ad) => x ? { key: x.f.key, title: x.f.title, pieces: x.p.map(p => ad(p.it)).join(", "), ids: x.p.map(p => p.it.id), occ } : null;
```
and add `kartYap` to the exported `api` object: `const api = { eslenir, eslemeAcik, bekleyenEkle, paketle, cekilenler, kartYap, gelenUygula, istemci };`

Run: `node --test tests/sync.test.js` → Expected: PASS 11/11

- [ ] **Step 4: Wire zenon.js**

a) `store.set` (satır ~5) şu olur:
```js
  set(k,v){try{localStorage.setItem("zenon9:"+k,JSON.stringify(v));if(window.ZenonSync)window.ZenonSync.kirli(k)}catch(e){}}
```

b) `restoreData` (satır ~1779): `location.reload();` öncesine `if(window.ZenonSync) window.ZenonSync.hepsiKirli();` ekle:
```js
function restoreData(txt){ const j=JSON.parse(txt); if(!j||!j.data) throw 0; Object.entries(j.data).forEach(([k,v])=>{ if(k!=="zenon9:care.push"&&k!=="zenon9:coach.body"&&k!=="zenon9:aurelius") localStorage.setItem(k,v); }); if(window.ZenonSync) window.ZenonSync.hepsiKirli(); location.reload(); }
```

c) Kart yazma yardımcısı: `function todayWear(){` satırından hemen önce ekle:
```js
// Dazai için günün kombin kartı (card:<gün>, buluta eşitlenir). Değişmediyse yeniden yazılmaz; 3 günden eski kartlar telefondan silinir.
function kartYaz(d,kart){ const k="card:"+d, s=JSON.stringify(kart); if(localStorage.getItem("zenon9:"+k)!==s) store.set(k,kart); }
for(let i=localStorage.length-1;i>=0;i--){ const k=localStorage.key(i); if(k&&k.startsWith("zenon9:card:")&&k.slice(12)<ZC.addDays(TODAY,-3)) localStorage.removeItem(k); }
```

d) `renderWear()` içinde `const W=todayWear(), …` satırından hemen sonra:
```js
  kartYaz(TODAY,{gun:ZenonSyncCore.kartYap(W.day,W.occ,nm),spor:ZenonSyncCore.kartYap(W.gym,"spor",nm)});
```
`ZenonSyncCore` tarayıcıda `window.ZenonSyncCore`'dur (Task 3); zenon.js her zaman zenon-sync.js'ten sonra yüklenir.

e) `renderFit()` içinde `$("#pinBtn").href=pinURL(f.pin); curFit={f,parts};` satırından sonra (yarın planı gece girilince yarının kartı):
```js
  if(forTomorrow) kartYaz(TARGET,{gun:ZenonSyncCore.kartYap({f,p:parts},curOcc(),nm),spor:null});
```

f) Aurelius'a plan gönderimi kaldırılır: `function pushAurPlan(list){ … }` bloğunu (açıklama satırı "// Dazai (Aurelius) için günün planı…" ve `let aurPlanSent="", aurPlanTimer=0;` dahil) sil; `renderTodo()` içindeki `renderNow(list); pushAurStatus(done,list.length); pushAurPlan(list);` satırını `renderNow(list); pushAurStatus(done,list.length);` yap.

g) Bildirimler Dazai raporuna geçer: `async function renderPush(){ … }`, `async function syncPushNow(){ … }`, `let syncT=0; syncPush=()=>{ … };`, `async function pushEnable(){ … }`, `async function pushDisable(){ … }` ve `$("#pushOn")…`, `$("#pushTest")…` satırlarını sil. Yerine (silinen bloğun yerine) ekle:
```js
// Bakım hatırlatmaları artık Dazai'nin öğle ve gece raporunda. Eski Seneca bildirim planı bir kez boşaltılır (olmazsa 7 gün içinde kendiliğinden biter).
if(pushCfg&&pushCfg.on){ zapi("plan",{method:"PUT",body:JSON.stringify({hatirlatmalar:[]})}).then(()=>{ pushCfg.on=false; store.set("care.push",pushCfg); },()=>{}); }
```
Açılış satırındaki (`processLog(); renderSizeLab(); …`) `renderPush(); ` çağrısını sil. Ardından `grep -n "renderPush\|syncPushNow\|pushEnable\|pushDisable\|pushAurPlan" zenon.js` boş dönmeli. `syncPush` (no-op, satır ~1035) ve diğer çağrıları kalır.

- [ ] **Step 5: Wire index.html, sw.js, build list**

a) `index.html` script satırları:
```html
<script src="zenon-care.js"></script>
<script src="zenon-sync.js"></script>
```
(`zenon-plan.js`, `zenon-coach.js`, `zenon.js` satırları silinir; onları zenon-sync.js yükler.)

b) Bildirim kartı (satır ~248–250, `<div class="sec"><div class="sec-h"><span class="label">Bildirimler</span>…</div></div>` bloğu) şununla değişir:
```html
          <div class="sec"><div class="sec-h"><span class="label">Bildirimler</span></div>
            <p class="label" style="text-transform:none;letter-spacing:.02em">Bakım hatırlatmaları artık Dazai'nin öğle ve gece raporunda geliyor.</p></div>
```

c) `<header class="top">` satırından hemen sonra:
```html
    <span id="syncBadge" class="label" hidden style="position:fixed;top:calc(env(safe-area-inset-top) + 6px);right:12px;z-index:60;font-size:11px;opacity:.75">eşitlenmedi</span>
```

d) `sw.js`: SHELL dizisine `"zenon-sync.js"` ekle (`"zenon-care.js",` sonrasına) ve fetch dinleyicisinde `if(e.request.method!=="GET"||u.origin!==location.origin) return;` satırından sonra:
```js
  if(u.pathname.startsWith("/api/")) return;                          // eşitleme ve Dazai istekleri önbelleğe girmez
```
`const CACHE="zenon-v20";` → `const CACHE="zenon-v21";` (GitHub Pages kopyası için; yeni adreste build betiği yeniden adlandırır).

e) `zenon-sunucu/scripts/build.mjs` DOSYALAR listesine `"zenon-sync.js"` ekle (`"zenon-care.js",` sonrasına). Beklenen çıktı artık `public/: 14 dosya`.

- [ ] **Step 6: Verify syntax, tests and a browser smoke**

Run: `node --check zenon.js && node --check zenon-sync.js && node --check sw.js && node --test tests/care.test.js tests/coach.test.js tests/plan.test.js tests/sync.test.js && (cd zenon-sunucu && npm run build && npm test)`
Expected: no syntax error; all root tests pass; `public/: 14 dosya`; server PASS 9/9.

Tarayıcı yoklaması (eşitleme kapalı yerel önizleme; github.io davranışıyla aynı): depo kökünde `python -m http.server 8765 --bind 127.0.0.1` arka planda başlatılır, ancak `eslemeAcik("127.0.0.1")` true olduğundan `/api` 404 verir ve açılış uyarı yazıp devam etmelidir. Built-in browser ile `http://127.0.0.1:8765/` aç; beklenen: Bugün sekmesi çizilir, konsolda `Zenon eşitleme:` uyarısından başka hata yok, `localStorage` içinde `zenon9:card:<bugün>` var. Sonra sunucuyu durdur.

- [ ] **Step 7: Commit**

```bash
git add index.html zenon.js sw.js zenon-sync.js tests/sync.test.js zenon-sunucu/scripts/build.mjs
git commit -m "Zenon: buluta esitleme, Dazai kombin karti; eski bildirim ve Aurelius plan gonderimi kaldirildi"
```

---

### Task 5: Aurelius'ta Zenon bağlantısı

Depo: `D:\Claude\Aurelius` (dal `sesli-asistan`).

**Files:**
- Modify: `lib/jarvis/baglanti.ts`, `lib/jarvis/sources.ts`, `lib/jarvis/app-fetch.ts`, `lib/jarvis/agent-config.ts`, `lib/jarvis/prompt.ts`, `lib/jarvis/gunluk.ts`, `cloudflare-env.d.ts`, `vite.config.ts`
- Test: `tests/dazai.ts`

**Interfaces:**
- Consumes: Zenon `/api/dazai/bugun`, `/api/dazai/isaretle` (Task 2); madde `ayrinti` alanı.
- Produces: `BAGLANTILAR` içinde `{app:"zenon",ad:"Zenon",url:"https://zenon.diyarross.com"}`; `bugunTopla(day, deps, apps?: string[])`; env `ZENON_DAZAI_KEY`, service binding `ZENON`.

- [ ] **Step 1: Write the failing tests**

In `tests/dazai.ts` (`gunlukTests` içinde):
- `assert.deepEqual(spec('isaretle')?.props.uygulama.enum,['kleanthes']);` satırını şununla değiştir:
```ts
assert.deepEqual(spec('isaretle')?.props.uygulama.enum,['kleanthes','zenon']);
```
- `const s4=…` bloğundan (`assert.equal(s4[0].ok,false);`) sonra ekle:
```ts
// Zenon da bağlantı listesinde; istenirse yalnız bir uygulama sorulur
const {BAGLANTILAR}=await import('../lib/jarvis/baglanti');
assert.deepEqual(BAGLANTILAR.map(b=>b.app),['kleanthes','zenon']);
const yalniz:string[]=[];
const s5=await bugunTopla('2026-11-09',{fetch:async(url:string)=>{yalniz.push(url);return cevap(200,{ozet:'kombin hazır',maddeler:[]});},anahtar:()=>'k'},['zenon']);
assert.equal(s5.length,1);assert.equal(yalniz[0],'https://zenon.diyarross.com/api/dazai/bugun?day=2026-11-09');
// ayrıntı Dazai metninde görünür (bildirimde değil)
const zb=birlestir([parseBugun('zenon','Zenon',{ozet:'kombin hazır',maddeler:[{id:'bakim:aksam',baslik:'Akşam bakımı',tur:'onay',durum:'bekliyor',ilerleme:'0/3 adım',ayrinti:'Temizle, Nemlendir, Diş ipi'}]})],[],[]);
assert.match(gunlukMetin(zb),/- \[bekliyor\] Akşam bakımı \(0\/3 adım\): Temizle, Nemlendir, Diş ipi · id bakim:aksam/);
assert.doesNotMatch(aksamBildirimi(zb),/Temizle/);
```
- Talimat testlerinin sonuna ekle:
```ts
assert.match(talimat(),/isaretle \(uygulama zenon/,'kıyafet ve bakım Zenon\'a işaretlenir');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-jarvis.mjs`
Expected: FAIL (enum `['kleanthes']` ≠ `['kleanthes','zenon']`).

- [ ] **Step 3: Implement**

`lib/jarvis/baglanti.ts`:
```ts
export const BAGLANTILAR=[{app:"kleanthes",ad:"Kleanthes",url:"https://kleanthes.diyarross.com"},{app:"zenon",ad:"Zenon",url:"https://zenon.diyarross.com"}];
```
ve `bugunTopla` imzası/gövdesi:
```ts
export async function bugunTopla(day:string,deps:BaglantiDeps,apps?:string[]):Promise<UygulamaSonucu[]>{
  return Promise.all(BAGLANTILAR.filter(b=>!apps||apps.includes(b.app)).map(async b=>{
```
(gövdenin geri kalanı aynı).

`lib/jarvis/gunluk.ts` `gunlukMetin` içindeki madde satırı:
```ts
    parts.push(`## ${s.ad}${s.ozet?` · ${s.ozet}`:""}\n${s.maddeler.map(m=>`- [${DURUM_TR[m.durum]}] ${etiket(m)}${m.ayrinti?`: ${m.ayrinti}`:""} · id ${m.id}`).join("\n")||"Madde yok."}`);
```

`lib/jarvis/agent-config.ts` isaretle aracı:
```ts
  {name:"isaretle",description:"Bir uygulamadaki günlük maddeyi yapıldı olarak işaretler ya da değerini kaydeder (ör. uyku 7,5 saat, omega-3 alındı, su 500 ml, kombin giyildi, akşam bakımı yapıldı). id'yi gunun_isleri listesinden al.",props:{uygulama:s("Uygulama",{enum:["kleanthes","zenon"]}),id:s("Madde id'si (ör. uyku, takviye:omega3, su, antrenman, kombin:gun, bakim:aksam, gorev:towel)"),yapildi:{type:"boolean",description:"Onay maddesi için: yapıldı mı"},deger:{type:"number",description:"Miktar maddesi için değer (uyku saat, su ml)"},not:s("İsteğe bağlı not")},required:["uygulama","id"]},
```

`lib/jarvis/prompt.ts` — "- Yemek → kleanthes_kaydet …" satırından sonra yeni satır:
```
- Kıyafet ya da bakım ("şunu giydim", "akşam rutinini yaptım", "yastık kılıfını değiştirdim") → isaretle (uygulama zenon, id gunun_isleri'nden: kombin:gun, kombin:spor, bakim:sabah, bakim:aksam, gorev:…). Sabah günün kombinini ve bakım adımlarını Zenon maddelerinden söyle.
```

`lib/jarvis/sources.ts`:
- `baglantiDeps` anahtarları: `const keys:Record<string,string|undefined>={kleanthes:env.KLEANTHES_DAZAI_KEY,zenon:env.ZENON_DAZAI_KEY};`
- import satırından `zenonLines`'ı çıkar; `bugunTopla`'yı `@/lib/jarvis/baglanti`'den içe aktar (dosyada yoksa).
- `appSummary` içindeki zenon satırı:
```ts
    zenon:async()=>{const [z]=await bugunTopla(day,baglantiDeps(),["zenon"]);return z.ok?[z.ozet,...z.maddeler.map(m=>`${m.baslik}${m.ayrinti?` (${m.ayrinti})`:""}: ${m.durum==="yapildi"?"tamam":m.durum==="kismen"?`kısmen${m.ilerleme?`, ${m.ilerleme}`:""}`:"bekliyor"}`)]:[`Zenon'a ulaşılamadı (${z.neden}).`];},
```

`lib/jarvis/app-fetch.ts`:
```ts
type Binding="KLEANTHES"|"EPIKTETOS"|"SENECA"|"ZENON";
```
ve HOSTS'a `"zenon.diyarross.com":"ZENON",` ekle.

`cloudflare-env.d.ts`: `KLEANTHES_DAZAI_KEY?:string;` sonrasına `ZENON_DAZAI_KEY?:string; ZENON?:Fetcher;` ekle.

`vite.config.ts` services dizisine: `{ binding: "ZENON", service: "zenon" },`

- [ ] **Step 4: Run tests**

Run: `node scripts/test-jarvis.mjs && node scripts/test-voice.mjs && npx tsc --noEmit -p . 2>&1 | grep -E "baglanti|sources|gunluk|app-fetch|agent-config" ; echo tsc-bitti`
Expected: `Jarvis tests passed.`, `Voice tests passed.`, bu dosyalar için tsc hatası yok. (test-core'daki eski Kleanthes domain beklentisi işten önce de kırmızıdır; bu görev onu değiştirmez.)

- [ ] **Step 5: Commit**

```bash
git add lib/jarvis/baglanti.ts lib/jarvis/sources.ts lib/jarvis/app-fetch.ts lib/jarvis/agent-config.ts lib/jarvis/prompt.ts lib/jarvis/gunluk.ts cloudflare-env.d.ts vite.config.ts tests/dazai.ts
git commit -m "Dazai: Zenon baglantisi (kombin, bakim), madde ayrintisi Dazai metninde"
```

---

### Task 6: Yayın ve canlı yoklama (kullanıcı onayıyla)

Bu görev canlıya yayın içerir: başlamadan önce kullanıcıdan "yayınla" onayı alınır. `W` = `node ../Kleanthes/app/node_modules/wrangler/bin/wrangler.js` (zenon-sunucu klasöründen). Cloudflare/ağ 503 ya da "fetch failed" verirse 3 kez yeniden denenir.

- [ ] **Step 1: D1 oluştur ve wrangler.json'a yaz**

Run: `cd zenon-sunucu && $W d1 create zenon`
Expected: çıktıda `"database_id": "<uuid>"`. Bu değeri `wrangler.json`'daki `00000000-0000-0000-0000-000000000000` yerine yaz.

- [ ] **Step 2: Şemayı uygula**

Run: `$W d1 migrations apply zenon --remote`
Expected: `0001_init.sql` ✅

- [ ] **Step 3: Sırlar**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | $W secret put SESSION_SECRET
```
DAZAI_KEY'i üret, aynı değeri iki tarafa koy, sohbete yazdırma:
```bash
K=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"); printf '%s' "$K" | $W secret put DAZAI_KEY; (cd ../Aurelius && printf '%s' "$K" | npx wrangler secret put ZENON_DAZAI_KEY --name aurelius); printf '%s' "$K" > "$TEMP/zenon-dazai-key"
```
`AUTH_PASSWORD`'u kullanıcı kendisi koyar (gerçek şifre sohbete girmez): kullanıcıya şu komut verilir: `cd D:\Claude\zenon-sunucu` ardından `node ../Kleanthes/app/node_modules/wrangler/bin/wrangler.js secret put AUTH_PASSWORD`.

- [ ] **Step 4: Zenon'u yayınla**

Run: `npm run deploy`
Expected: `Deployed zenon`, `zenon.diyarross.com (custom domain)`, Current Version ID.

- [ ] **Step 5: Canlı yoklama (veri yazmaz)**

```bash
curl -s https://zenon.diyarross.com/ | grep -c "Zenon · Giriş"
curl -s -o /dev/null -w "%{http_code}\n" https://zenon.diyarross.com/api/docs
curl -s "https://zenon.diyarross.com/api/dazai/bugun?day=2026-11-09" -H "x-dazai-key: yanlis"
curl -s "https://zenon.diyarross.com/api/dazai/bugun?day=2026-11-09" -H "x-dazai-key: $(cat $TEMP/zenon-dazai-key)"
curl -s -X POST https://zenon.diyarross.com/api/dazai/isaretle -H "x-dazai-key: $(cat $TEMP/zenon-dazai-key)" -H "Content-Type: application/json" -d '{"day":"2026-11-09","id":"yoga","yapildi":true}'
rm "$TEMP/zenon-dazai-key"
```
Expected: `1`; `401`; `{"error":"Yetkisiz."}`; `{"app":"zenon","day":"2026-11-09","ozet":"Bakım profili yok · Zenon bugün kombin hazırlamadı","maddeler":[]}`; `{"error":"Bilinmeyen madde."}`.

- [ ] **Step 6: Aurelius'u yayınla**

```bash
cd ../Aurelius && export AURELIUS_WORKER_NAME=aurelius AURELIUS_D1_NAME=aurelius AURELIUS_D1_ID=1b248521-69d1-4cdd-bef6-757f6ad5ee2c AURELIUS_CUSTOM_DOMAIN=diyarross.com && node scripts/run-framework.mjs build && node -e "const c=require('./dist/server/wrangler.json');console.log(c.name,(c.services||[]).map(s=>s.binding).join(','))" && npx wrangler deploy --config dist/server/wrangler.json
```
Expected: `aurelius KLEANTHES,EPIKTETOS,SENECA,ZENON`, sonra `Deployed aurelius`.

- [ ] **Step 7: Ross deposunu güncelle ve gönder (kullanıcı onayıyla)**

Yerel dal origin'in gerisinde (Diogenes bot commit'leri). `git fetch origin && git rebase origin/claude/daily-increases-site-gumybo` (kullanıcının commit'lenmemiş değişiklikleri için önce `git stash -u` gerekirse, sonra `git stash pop`), testler yeniden: `node --test tests/care.test.js tests/coach.test.js tests/plan.test.js tests/sync.test.js`, ardından `git push origin HEAD`. Aurelius: `git push origin sesli-asistan`.

- [ ] **Step 8: Kullanıcıya taşıma adımları**

1. `zenon.diyarross.com` → şifreyle giriş.
2. Eski Zenon (github.io) → Takip → Yedek indir; yeni Zenon → Geri yükle (dosya). Not: `coach.body` (aylık beden kontrolü) yedeğe zaten girmiyor; yeni Zenon'da sıfırdan başlar.
3. Safari → Paylaş → Ana Ekrana Ekle; eski Zenon simgesini sil.
4. Dazai'ye "Bugün ne var?" → Zenon maddeleri gelmeli; "akşam rutinini yaptım" → işaret; Zenon'u açınca bakım işaretli olmalı.

---

### Task 7: Eski adresin yönlendirilmesi (kullanıcı taşımayı doğruladıktan sonra)

**Files:**
- Modify: `index.html` (`<head>` içine ilk script)

- [ ] **Step 1: Add redirect for github.io only**

`index.html` `<head>` içinde, `<meta charset…>` satırından sonra:
```html
<script>if(/\.github\.io$/.test(location.hostname)){document.documentElement.innerHTML='<body style="font-family:system-ui;background:#15141C;color:#ECE7DD;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><p>Zenon taşındı.<br><a style="color:#C9A24A" href="https://zenon.diyarross.com/">zenon.diyarross.com</a></p></body>';throw 0;}</script>
```

- [ ] **Step 2: Verify**

Run: `node -e "const h=require('fs').readFileSync('index.html','utf8');if(!h.includes('github\\\\.io'))process.exit(1);console.log('ok')"` → Expected: `ok`. `cd zenon-sunucu && npm run build` → `public/: 14 dosya` (yeni adreste yönlendirme çalışmaz; hostname koşulu).

- [ ] **Step 3: Commit and push (kullanıcı onayıyla)**

```bash
git add index.html
git commit -m "Zenon: eski GitHub Pages adresi yeni adrese yonlendirir"
git push origin HEAD
```
