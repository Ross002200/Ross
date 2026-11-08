/* Zenon eşitleme: localStorage (zenon9:*) ↔ zenon.diyarross.com (D1) ve Dazai gelen kutusu.
   Saf çekirdek + bağımlılıkla kurulan istemci (node'da test edilir) + tarayıcı açılışı.
   Tarayıcıda zenon-care.js'ten sonra yüklenir; eşitlemeden sonra zenon-plan.js, zenon-coach.js, zenon.js'i yükler. */
(function (root) {
"use strict";
const P = "zenon9:", PK = "zenon-sync:bekleyen", SK = "zenon-sync:since", SEEN = "zenon-sync:goruldu", IK = "zenon-sync:ilk", RK = "zenon-sync:reddedilen";
const SKIP = new Set(["photos", "care.push", "aurelius", "coach.body"]);   // coach.body: ekranda "yalnız bu telefonda kalır" sözü
const eslenir = k => typeof k === "string" && k.length > 0 && !SKIP.has(k);
const eslemeAcik = host => host === "zenon.diyarross.com" || host === "localhost" || host === "127.0.0.1";
const bekleyenEkle = (list, k) => eslenir(k) && !list.includes(k) ? [...list, k] : list;
function paketle(keys, metin, limit = 3e6) {
  const out = []; let boy = 0;
  for (const k of keys) { const t = metin(k); if (t == null) continue; if (out.length && boy + t.length > limit) break; out.push(k); boy += t.length; }
  return out;
}
// Eklenen parçaların fotoğrafı (img) telefonda kalır: giderken çıkarılır, gelirken yerel fotoğraf id ile geri takılır.
const fotosuz = (k, v) => k === "added" && Array.isArray(v) ? v.map(x => { if (!x || typeof x !== "object") return x; const { img, ...r } = x; return r; }) : v;
function fotoTak(k, uzak, yerelMetin) {
  if (k !== "added" || !Array.isArray(uzak)) return uzak;
  let yerel = []; try { yerel = JSON.parse(yerelMetin) || []; } catch (e) { yerel = []; }
  const img = new Map((Array.isArray(yerel) ? yerel : []).filter(x => x && x.img).map(x => [x.id, x.img]));
  return uzak.map(x => x && img.has(x.id) ? { ...x, img: img.get(x.id) } : x);
}
function ayni(k, yerelMetin, uzak) {
  if (yerelMetin == null) return false;
  try { return JSON.stringify(fotosuz(k, JSON.parse(yerelMetin))) === JSON.stringify(uzak); } catch (e) { return false; }
}
const cekilenler = (items, bekleyen, metin) => items.filter(it => eslenir(it.key) && !bekleyen.includes(it.key) && !ayni(it.key, metin(it.key), it.data));
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
  // Hiç tam çekme yapmamış cihaz (yeni ya da verisi silinmiş) buluta yazmaz: yoksa Zenon'un varsayılanları buluttaki gerçek verinin üzerine yazılır.
  const ilkVar = () => d.ls.getItem(IK) === "1";
  // Yedekten geri yükleme bilerek buluttakinin üzerine yazar.
  function hepsiKirli() { const ks = []; for (let i = 0; i < d.ls.length; i++) { const k = d.ls.key(i); if (k && k.startsWith(P)) ks.push(k.slice(P.length)); } ks.forEach(kirli); d.ls.setItem(IK, "1"); }
  async function gonder() {
    if (ucusta || !ilkVar()) return false; ucusta = true;
    const red = [];
    try {
      bekleyen = bekleyen.filter(k => metin(k) != null); kaydet();
      while (bekleyen.length) {
        const paket = paketle(bekleyen, metin), giden = new Map(paket.map(k => [k, metin(k)])), items = [];
        for (const [k, t] of giden) { try { items.push({ key: k, data: fotosuz(k, JSON.parse(t)) }); } catch (e) { /* bozuk JSON gönderilmez, sıradan düşer */ } }
        const r = await d.api("docs", { method: "PUT", body: JSON.stringify({ items }) });
        if (r && r.reddedilen && r.reddedilen.length) { console.warn("Zenon eşitleme reddetti:", r.reddedilen); red.push(...r.reddedilen.map(x => x.key)); }
        const once = bekleyen.length;
        bekleyen = bekleyen.filter(k => !giden.has(k) || metin(k) !== giden.get(k)); kaydet();
        if (bekleyen.length >= once) break;
      }
      d.ls.setItem(RK, JSON.stringify(red));
      return true;
    } catch (e) { return false; } finally { ucusta = false; }
  }
  async function cek() {
    const ilk = ilkVar(), since = ilk ? d.ls.getItem(SK) || "" : "";
    const r = await d.api("docs" + (since ? "?since=" + encodeURIComponent(since) : ""));
    const items = (r && r.items) || [];
    // İlk tam çekmede bulut kazanır: bekleyen yerel varsayılanlar da buluttakiyle ezilir ve sıradan çıkar.
    const yeni = ilk ? cekilenler(items, bekleyen, metin) : items.filter(it => eslenir(it.key) && !ayni(it.key, metin(it.key), it.data));
    for (const it of yeni) d.ls.setItem(P + it.key, JSON.stringify(fotoTak(it.key, it.data, metin(it.key))));
    if (!ilk) { const uzak = new Set(items.map(it => it.key)); bekleyen = bekleyen.filter(k => !uzak.has(k)); kaydet(); }
    const enson = items.reduce((m, it) => it.updated_at > m ? it.updated_at : m, since);
    if (enson) d.ls.setItem(SK, enson);
    if (!ilk) d.ls.setItem(IK, "1");
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
  return { kirli, hepsiKirli, gonder, cek, gelen, ilkVar, bekleyen: () => bekleyen, reddedilen: () => oku(RK) || [] };
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
  const rozet = () => { const b = document.getElementById("syncBadge"); if (!b) return; const red = z.reddedilen().length; b.hidden = !(ac && (z.bekleyen().length || red)); b.textContent = red ? "eşitlenemedi: veri çok büyük" : "eşitlenmedi"; };
  const gonder = () => z.gonder().then(rozet);
  root.ZenonSync = {
    kirli(k) { if (!ac) return; z.kirli(k); rozet(); clearTimeout(t); t = setTimeout(gonder, 2000); },
    hepsiKirli() { if (ac) z.hepsiKirli(); }
  };
  const yukle = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
  (async () => {
    const yukleHepsi = async () => { if (!root.ZENON_INLINE) for (const src of ["zenon-plan.js", "zenon-coach.js", "zenon.js"]) await yukle(src); };   // önizlemede satır içi
    if (!ac) { await yukleHepsi(); rozet(); return; }
    const esitle = async () => { await z.gonder(); return (await z.cek()) + (await z.gelen()); };
    const is = esitle().catch(e => { console.warn("Zenon eşitleme:", e && e.message); return 0; });
    if (z.ilkVar()) {
      // Daha önce eşitlenmiş cihaz: en çok 2,5 sn bekle, sonra yerelden aç; eşitleme arkada sürer, bir şey değiştiyse sayfa yenilenir.
      const n = await Promise.race([is, new Promise(r => setTimeout(() => r(-1), 2500))]);
      await yukleHepsi();
      if (n === -1) is.then(m => { rozet(); if (m) location.reload(); });
    } else {
      // Hiç eşitlenmemiş cihaz: buluttaki veriyi indirmeden açma (çekme başarısızsa gönderim de kapalı kalır).
      await is; await yukleHepsi();
    }
    rozet();
    const tekrar = async () => { try { const n = await esitle(); rozet(); if (n) location.reload(); } catch (e) { rozet(); } };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tekrar(); });
    addEventListener("online", tekrar);
  })();
}

const api = { eslenir, eslemeAcik, bekleyenEkle, paketle, cekilenler, kartYap, gelenUygula, istemci };
if (typeof module === "object" && module.exports) module.exports = api;
else { root.ZenonSyncCore = api; tarayici(); }
})(typeof self !== "undefined" ? self : this);
