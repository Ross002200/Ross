// Zenon sunucusu (Cloudflare Worker + D1). Tek kullanıcı: şifreli giriş, imzalı çerez (Kleanthes'teki kod).
// Veri: Zenon'un localStorage anahtarları docs tablosunda (key → JSON). Dazai: /api/dazai/* (x-dazai-key); işaretler inbox'ta.
import {belgeleriAyikla} from "./docs.js";
import {zenonBugun,isaretleKaydi} from "./dazai.js";

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

async function api(req,env,url){
  const p=url.pathname,m=req.method;
  if(p==="/api/login"&&m==="POST")return login(req,env);
  if(p.startsWith("/api/dazai/"))return dazai(req,env,url);
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
