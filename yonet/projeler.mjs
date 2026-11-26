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
