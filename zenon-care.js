/* Zenon 整 Bakım · rutin motoru: saf fonksiyonlar (DOM ve ağ yok). Tarayıcıda window.ZenonCare, node'da require(). */
(function (root) {
"use strict";
const SRV = "https://seneca-diyar.duckdns.org";
const DAY = 864e5, pad = n => String(n).padStart(2, "0");
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY);
const toMin = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const atMin = (date, min) => { const d = parseDate(date); d.setMinutes(min); return d; };
const weekday = s => parseDate(s).getDay();

const DEFAULT_PROFILE = {
  skin: "normal", issues: [], beard: { style: "stubble", density: "medium" },
  hair: { type: "straight", oilyScalp: false, dandruff: false, thinning: false, lastCut: null }, sweat: "mid",
  times: { weekday: { wake: "07:30", sleep: "23:30" }, weekend: { wake: "09:30", sleep: "00:30" }, gymDays: [], gym: "18:00" },
  amMinutes: 5, budget: "den", currentProducts: ""
};
function normProfile(p) {
  p = p || {}; const d = DEFAULT_PROFILE, t = p.times || {};
  return { ...d, ...p, issues: Array.isArray(p.issues) ? p.issues : [],
    beard: { ...d.beard, ...p.beard }, hair: { ...d.hair, ...p.hair },
    times: { ...d.times, ...t, weekday: { ...d.times.weekday, ...t.weekday }, weekend: { ...d.times.weekend, ...t.weekend },
      gymDays: Array.isArray(t.gymDays) ? t.gymDays : [] } };
}
const has = (p, ...k) => k.some(x => p.issues.includes(x));

const S = {
  rinse: ["Ilık suyla yıka", "Kuru ya da hassas ciltte sabah temizleyici bariyeri yorar."],
  cleanse: ["Nazik temizleyici", "Gece biriken yağı alır; ılık su, 30 saniye."],
  niacin: ["Niasinamid serumu", "Yağ dengesi ve gözenek görünümü."],
  vitc: ["C vitamini serumu", "Leke ve izlerde ton eşitler; SPF ile birlikte çalışır."],
  azelaic: ["Azelaik asit", "Kızarıklık ve leke için nazik aktif."],
  gel: ["Jel nemlendirici", "Hafif; yağlı cilt ya da nemli günler için."],
  lotion: ["Seramidli nemlendirici", "Cilt bariyerini korur."],
  cream: ["Krem nemlendirici", "Kuru cilt ya da soğuk-kuru hava için daha zengin."],
  spf30: ["SPF 30+", "Yaşlanmanın ve lekenin ana sebebi güneş."],
  spf50: ["SPF 50", "UV yüksek: en yüksek koruma."],
  moistspf: ["SPF'li nemlendirici", "Kısa sabah: nem ve koruma tek adımda."],
  pmcleanse: ["Temizleyici", "Güneş kremini, teri ve kiri çıkarır."],
  retinoid: ["Retinoid (bezelye kadar)", "Sivilce, iz ve gözenek; kolajeni artırır."],
  bha: ["BHA (salisilik asit)", "Siyah nokta ve batık kıl; gözenek içini temizler."],
  pmmoist: ["Nemlendirici", "Gece onarımı."],
  antip: ["Antiperspirant", "Gece kuru koltuk altına: sabah daha etkili."],
  floss: ["Diş ipi + fırçalama", "Diş arası çürük ve ağız kokusu."],
  lip: ["Dudak balmı", "Soğuk-kuru hava dudağı çatlatır."],
  gym: ["Spor sonrası duş + yüz yıkama", "Ter gözenekleri tıkar."],
  backwash: ["Sırta BHA'lı vücut yıkama (1-2 dk beklet)", "Sırt sivilcesi için."]
};
const step = (id, extra) => ({ id, label: S[id][0], why: S[id][1], ...extra });

const BHA_NIGHTS = [2, 6];
const RET_NIGHTS = [[1, 4], [1, 3, 5], [0, 1, 2, 3, 4, 5, 6]];
function retinoidStage(p, date, state) {
  const start = (state && state.retinoidStart) || date;
  const w = Math.floor(Math.max(0, daysBetween(start, date)) / 7), s = p.skin === "sensitive" ? Math.floor(w / 2) : w;
  return s < 2 ? 0 : s < 4 ? 1 : 2;
}
function nightActive(p, date, state) {
  const wd = weekday(date);
  if (has(p, "blackheads", "pores", "ingrown") && BHA_NIGHTS.includes(wd)) return "bha";
  if (has(p, "acne", "marks", "pores") && RET_NIGHTS[retinoidStage(p, date, state)].includes(wd)) return "retinoid";
  return null;
}
const coldDry = wx => !!wx && wx.tmin <= 8 && wx.hum < 45;
const hotHumid = wx => !!wx && wx.t >= 26 && wx.hum > 60;
function moistKind(p, wx) {
  if (hotHumid(wx)) return "gel";
  if (coldDry(wx)) return "cream";
  return p.skin === "oily" ? "gel" : p.skin === "dry" ? "cream" : "lotion";
}

const BEARD = { clean: [[1, 3, 5], "Tıraş (kıl yönünde, tek geçiş)"], stubble: [[1, 4], "Kirli sakalı makineyle eşitle"],
  short: [[3, 0], "Sakal düzelt + boyun çizgisi"], full: [[0], "Sakalı şekillendir + sakal yağı"] };
function weeklyTasks(p, date) {
  const wd = weekday(date), t = [], on = (days, id, label, why) => { if (days.includes(wd)) t.push({ id, label, why }); };
  const b = BEARD[p.beard.style] || BEARD.stubble;
  on(b[0], "beard", b[1], "Düzenli görünüm, batık kıl riski az.");
  on([0], "nails", "Tırnak kes (düz kes, köşeleri yuvarlat)", "Batık tırnağı önler.");
  on(has(p, "acne") ? [1, 3, 5, 0] : [3, 0], "pillow", "Yastık kılıfını değiştir", "Yağ ve bakteri birikir.");
  on([1, 4, 0], "towel", "Yüz havlusunu değiştir", "Nemli havlu bakteri üretir.");
  const wash = p.hair.oilyScalp ? [1, 3, 5, 0] : [2, 6];
  if (wash.includes(wd)) t.push({ id: "hair", why: "Şampuan saç derisine, krem uçlara.",
    label: p.hair.dandruff && wash.slice(0, 2).includes(wd) ? "Saç yıka: kepek şampuanı, 3-5 dk beklet" : "Saç yıka" });
  if (p.hair.lastCut) { const n = daysBetween(p.hair.lastCut, date);
    if (n >= 24) t.push({ id: "barber", label: `Berber zamanı (son kesimden ${n} gün)`, why: "Kısa kesim 3-4 haftada formunu kaybeder.", due: n }); }
  return t;
}

function buildDay(profile, date, wx, state) {
  const p = normProfile(profile), notes = [], uv = wx && wx.uv != null ? Math.round(wx.uv) : null;
  const mk = moistKind(p, wx), am = [step(["dry", "sensitive"].includes(p.skin) ? "rinse" : "cleanse")];
  if (p.amMinutes >= 5) {
    const act = has(p, "redness") ? "azelaic" : (p.skin === "oily" || has(p, "acne", "pores")) ? "niacin" : has(p, "marks") ? "vitc" : null;
    if (act) am.push(step(act));
    am.push(step(mk), step(uv != null && uv >= 6 ? "spf50" : "spf30"));
  } else am.push(step("moistspf"));
  const active = nightActive(p, date, state), pm = [step("pmcleanse")];
  if (active) pm.push(step(active));
  pm.push(step("pmmoist", active === "retinoid" ? { why: "Retinoidden 10 dk sonra: tahrişi azaltır." } : {}));
  if (p.sweat === "high") pm.push(step("antip"));
  pm.push(step("floss"));
  const extras = [], wd = weekday(date);
  if (p.times.gymDays.includes(wd)) { extras.push(step("gym")); if (has(p, "backacne")) extras.push(step("backwash")); }
  if (coldDry(wx)) extras.push(step("lip"));
  if (uv != null && uv >= 3) notes.push(`UV ${uv}: SPF şart, bulutlu olsa da.`);
  if (uv != null && uv >= 6) notes.push("13:00'te SPF'yi yenile.");
  if (coldDry(wx)) notes.push("Soğuk ve kuru: krem nemlendirici ve dudak balmı.");
  if (hotHumid(wx)) notes.push("Sıcak ve nemli: jel nemlendirici; gün içinde yüzü yalnız suyla çalkala.");
  if (active === "retinoid") notes.push("Retinoid gecesi: kuru cilde, göz ve dudak kenarından uzak.");
  if (active === "bha") notes.push("BHA gecesi: retinoid yok, ertesi sabah SPF şart.");
  return { date, uv, am, pm, extras, weekly: weeklyTasks(p, date), notes, active };
}
function buildWeek(profile, start, wxByDate, state) {
  return Array.from({ length: 7 }, (_, i) => { const d = addDays(start, i); return buildDay(profile, d, (wxByDate || {})[d] || null, state); });
}
function streak(done, today) {
  const ok = d => done[d] && done[d].amAll && done[d].pmAll; let n = 0, d = ok(today) ? today : addDays(today, -1);
  while (ok(d)) { n++; d = addDays(d, -1); }
  return n;
}
function pruneDone(done, today, keep = 60) {
  const o = {}; for (const k in done) if (daysBetween(k, today) < keep) o[k] = done[k]; return o;
}
function doctorNote(profile) {
  const p = normProfile(profile);
  return has(p, "acne", "marks") || p.hair.thinning
    ? "Sivilce, leke ya da dökülme 2-3 ay düzenli bakıma rağmen sürüyorsa bir dermatoloğa görün; reçeteli tedaviler çok daha hızlı sonuç verir."
    : null;
}

const api = { SRV, DEFAULT_PROFILE, normProfile, buildDay, buildWeek, streak, pruneDone, doctorNote,
  isoDate, addDays, daysBetween, _t: { toMin, atMin, weekday, has } };
if (typeof module === "object" && module.exports) module.exports = api; else root.ZenonCare = api;
})(typeof self !== "undefined" ? self : this);
