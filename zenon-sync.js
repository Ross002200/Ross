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
// Zenon'un kombin seçimi ({f, p:[{it}]}) → Dazai'nin okuduğu kart parçası.
const kartYap = (x, occ, ad) => x ? { key: x.f.key, title: x.f.title, pieces: x.p.map(p => ad(p.it)).join(", "), ids: x.p.map(p => p.it.id), occ } : null;

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
    if (!root.ZENON_INLINE) for (const src of ["zenon-plan.js", "zenon-coach.js", "zenon.js"]) await yukle(src);   // önizlemede satır içi
    rozet();
    if (!ac) return;
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible") return;
      try { await z.gonder(); const n = (await z.cek()) + (await z.gelen()); rozet(); if (n) location.reload(); } catch (e) { rozet(); }
    });
    addEventListener("online", gonder);
  })();
}

const api = { eslenir, eslemeAcik, bekleyenEkle, paketle, cekilenler, kartYap, gelenUygula, istemci };
if (typeof module === "object" && module.exports) module.exports = api;
else { root.ZenonSyncCore = api; tarayici(); }
})(typeof self !== "undefined" ? self : this);
