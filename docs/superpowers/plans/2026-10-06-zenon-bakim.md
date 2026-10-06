# Zenon 整 Bakım (Parça 1, Zenon tarafı) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zenon'a bakım profili anketi, kural tabanlı günlük/haftalık rutin, hava ayarı, günün bilgisi, takip ve Web Push istemcisini eklemek (sunucu yokken "yakında" durumunda).

**Architecture:** Saf rutin motoru `zenon-care.js` (DOM/ağ yok, tarayıcıda `window.ZenonCare`, node'da `require`) + `zenon.js` içinde arayüz bölümü + `sw.js` push işleyicileri. Veriler yalnız `localStorage` (`zenon9:` önekli `store`). Sunucu tarafı (Seneca) bu planın **dışında**; ayrı plan, Seneca'daki Faz 3 bitince.

**Tech Stack:** Vanilla JS (ES2020, derleme yok), node 24 `node:test` (bağımlılıksız), Playwright (Python, `channel="msedge"`) görsel kontrol, Open-Meteo.

**Spec:** `docs/superpowers/specs/2026-10-06-zenon-bakim-design.md`

## Global Constraints

- Kişisel veri depoya yazılmaz (depo herkese açık). Profil, işaretlemeler, cihaz anahtarı yalnız `localStorage`: `care.profile`, `care.state`, `care.push`, `wxDays`.
- Rutin motoru kural tabanlı; yapay zekâ yok; çevrimdışı çalışır.
- Hatırlatma sınırları: başlık ≤ 80, gövde ≤ 300 karakter, toplam ≤ 100, zaman şimdi ile +8 gün arası.
- Bildirim kalkıştan önce ve yatıştan sonra yok; günde en fazla 6.
- `SRV = "https://seneca-diyar.duckdns.org"`.
- Seneca dosyalarına bu planda **dokunulmaz**.
- Telefon genişliği (375 px) yatay kaydırma yok; 6 sekme sığar.
- Bütçe değerleri `TIERS` ile aynı: `eko` · `den` · `yat`.
- Git: dal `claude/daily-increases-site-gumybo`; push öncesi `git fetch --filter=blob:none origin` + rebase; `diogenes/data/*.json`'a dokunulmaz. Commit mesajları `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ile biter.

## Review Focus

- Gece yarısından sonra yatış (ör. hafta sonu 00:30): akşam hatırlatması aynı günün 23:45'inde olmalı, ertesi güne kaymamalı → Task 3 testi.
- Hava verisi yok (çevrimdışı / Open-Meteo hata): rutin yine üretilmeli, UV notu çıkmamalı → Task 1 testi.
- Eski ya da eksik profil (alan eksik, `times` yok): motor varsayılanlarla çalışmalı, çökmemeli → Task 1 testi.
- Uygulama gün içinde geç açılırsa (ör. 15:00): geçmiş saatlere hatırlatma gönderilmemeli → Task 3 testi.
- Uzun adım listeleri: bildirim gövdesi 300 karakteri aşmamalı (sunucu 400 döner) → Task 3 testi.

---

### Task 1: Rutin motoru çekirdeği (`zenon-care.js`)

**Files:**
- Create: `zenon-care.js`
- Test: `tests/care.test.js`

**Interfaces:**
- Produces (export): `SRV`, `DEFAULT_PROFILE`, `normProfile(p)`, `buildDay(profile, date, wx, state) -> Day`, `buildWeek(profile, startDate, wxByDate, state) -> Day[7]`, `streak(done, today) -> number`, `pruneDone(done, today, keep=60)`, `doctorNote(profile) -> string|null`, `isoDate(Date)`, `addDays("YYYY-MM-DD", n)`, `daysBetween(a, b)`.
- `Day = {date, uv, am:[Step], pm:[Step], extras:[Step], weekly:[Task], notes:[string], active:"retinoid"|"bha"|null}`; `Step = {id, label, why}`; `Task = {id, label, why, due?}`.
- `wx = {t, tmin, tmax, uv, hum}` ya da `null`. `state = {retinoidStart?, done:{date:{am:[ids], pm:[ids], tasks:[ids], amAll, pmAll}}, tips:{date:id}}`.

- [ ] **Step 1: Write the failing tests** — `tests/care.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../zenon-care.js");

const base = { skin: "normal", issues: [] };
const nightsInWeek = (p, start, state) => C.buildWeek(p, start, {}, state).filter(d => d.active === "retinoid").length;

test("normProfile eksik alanları varsayılanla doldurur", () => {
  const p = C.normProfile({ skin: "oily", times: { weekday: { wake: "06:00" } } });
  assert.equal(p.times.weekday.wake, "06:00");
  assert.equal(p.times.weekday.sleep, "23:30");
  assert.deepEqual(p.times.gymDays, []);
  assert.equal(p.hair.lastCut, null);
  assert.deepEqual(C.normProfile(null).issues, []);
});

test("hava yokken rutin üretilir, UV notu yok", () => {
  const d = C.buildDay(base, "2026-10-07", null, {});
  assert.ok(d.am.length >= 3 && d.pm.length >= 2);
  assert.equal(d.uv, null);
  assert.ok(!d.notes.some(n => n.includes("UV")));
});

test("retinoid ve BHA hiçbir gece çakışmaz", () => {
  const p = { ...base, issues: ["acne", "blackheads"] };
  const st = { retinoidStart: "2026-10-05" };
  for (let i = 0; i < 120; i++) {
    const d = C.buildDay(p, C.addDays("2026-10-05", i), null, st);
    assert.ok(d.pm.filter(s => s.id === "retinoid" || s.id === "bha").length <= 1);
  }
});

test("retinoid girişi haftalara göre artar, hassas cilt yavaş", () => {
  const p = { ...base, issues: ["acne"] }, st = { retinoidStart: "2026-10-05" };
  assert.equal(nightsInWeek(p, "2026-10-05", st), 2);
  assert.equal(nightsInWeek(p, "2026-10-19", st), 3);
  assert.equal(nightsInWeek(p, "2026-11-09", st), 7);
  assert.equal(nightsInWeek({ ...p, issues: ["acne", "blackheads"] }, "2026-11-09", st), 5);
  assert.equal(nightsInWeek({ ...p, skin: "sensitive" }, "2026-10-19", st), 2);
});

test("2 dakikalık sabah en fazla 3 adım", () => {
  const d = C.buildDay({ ...base, skin: "oily", issues: ["acne", "marks"], amMinutes: 2 }, "2026-10-07", null, {});
  assert.ok(d.am.length <= 3);
});

test("hava kuralları: UV, soğuk-kuru, sıcak-nemli", () => {
  const uv = C.buildDay(base, "2026-10-07", { t: 20, tmin: 15, tmax: 24, uv: 7, hum: 50 }, {});
  assert.ok(uv.am.some(s => s.id === "spf50"));
  assert.ok(uv.notes.some(n => n.includes("13:00")));
  const cold = C.buildDay(base, "2026-10-07", { t: 4, tmin: 1, tmax: 7, uv: 1, hum: 35 }, {});
  assert.ok(cold.am.some(s => s.id === "cream"));
  assert.ok(cold.extras.some(s => s.id === "lip"));
  const hot = C.buildDay(base, "2026-10-07", { t: 29, tmin: 24, tmax: 32, uv: 5, hum: 75 }, {});
  assert.ok(hot.am.some(s => s.id === "gel"));
});

test("haftalık görevler ve berber", () => {
  const p = { ...base, hair: { lastCut: "2026-09-10" } };
  const sun = C.buildDay(p, "2026-10-04", null, {});            // Pazar
  assert.ok(sun.weekly.some(t => t.id === "nails"));
  const barber = sun.weekly.find(t => t.id === "barber");
  assert.equal(barber.due, 24);
});

test("seri ve budama", () => {
  const done = { "2026-10-05": { amAll: true, pmAll: true }, "2026-10-06": { amAll: true, pmAll: true }, "2026-10-07": { amAll: true } };
  assert.equal(C.streak(done, "2026-10-07"), 2);
  const pr = C.pruneDone({ "2026-07-01": {}, "2026-10-01": {} }, "2026-10-07");
  assert.deepEqual(Object.keys(pr), ["2026-10-01"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL, `Cannot find module '../zenon-care.js'`.

- [ ] **Step 3: Write `zenon-care.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: 8 test PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add zenon-care.js tests/care.test.js
git commit -m "Zenon Bakım: rutin motoru çekirdeği" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Günün bilgisi (ipucu kütüphanesi)

**Files:**
- Modify: `zenon-care.js` (CARE_TIPS + pickTip; export'a eklenir)
- Test: `tests/care.test.js` (ekleme)

**Interfaces:**
- Consumes: `normProfile`, `has`, `daysBetween` (Task 1).
- Produces: `CARE_TIPS: [{id, t, tags:[string], src}]`, `pickTip(profile, date, history) -> tip` (`history = {date: id}`; aynı tarih aynı ipucunu döndürür; son 13 günde gösterilen tekrar etmez).

- [ ] **Step 1: Write the failing tests** — `tests/care.test.js` sonuna:

```js
test("ipucu kütüphanesi: en az 60, kimlikler tekil, kaynaklı", () => {
  assert.ok(C.CARE_TIPS.length >= 60);
  assert.equal(new Set(C.CARE_TIPS.map(x => x.id)).size, C.CARE_TIPS.length);
  for (const x of C.CARE_TIPS) assert.ok(x.t && x.src && x.tags.length);
});

test("ipucu 14 gün tekrar etmez, aynı gün aynı ipucu", () => {
  const p = { skin: "oily", issues: ["acne"] }, h = {};
  for (let i = 0; i < 14; i++) { const d = C.addDays("2026-10-01", i); h[d] = C.pickTip(p, d, h).id; }
  assert.equal(new Set(Object.values(h)).size, 14);
  assert.equal(C.pickTip(p, "2026-10-05", h).id, h["2026-10-05"]);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test tests/`
Expected: 2 FAIL (`C.CARE_TIPS` undefined).

- [ ] **Step 3: Implement** — `zenon-care.js` içinde `doctorNote`'tan sonra:

```js
const T = (id, tags, t, src) => ({ id, tags, t, src });
const CARE_TIPS = [
  T(1, ["spf"], "SPF'yi yüz ve boyun için yaklaşık iki parmak boyu sür; az sürersen koruma etiketin çok altına düşer.", "AAD"),
  T(2, ["spf"], "Bulutlu havada da UV'nin büyük kısmı geçer; UV 3 ve üstünde güneş kremi şart.", "WHO"),
  T(3, ["spf"], "Dışarıdaysan güneş kremini 2 saatte bir, terledikten sonra hemen yenile.", "AAD"),
  T(4, ["spf"], "Kulak kepçesi, ense ve dudaklar en çok unutulan yerler; SPF'li dudak balmı kullan.", "Cleveland Clinic"),
  T(5, ["genel"], "Yüzünü ılık suyla yıka; sıcak su cildin yağ bariyerini bozar ve kurutur.", "AAD"),
  T(6, ["genel"], "Yüzünü havluyla ovma, bastırarak kurula; ayrı ve temiz bir yüz havlusu kullan.", "AAD"),
  T(7, ["genel"], "Nemlendiriciyi cilt hafif nemliyken sür; suyu cilde hapseder.", "AAD"),
  T(8, ["genel"], "Yeni ürünü önce 3-4 gün çene altına sürerek dene; tepki yoksa yüze geç.", "AAD"),
  T(9, ["genel"], "Aynı anda birden fazla yeni ürüne başlama; sorun çıkarsa hangisi olduğunu bilemezsin.", "AAD"),
  T(10, ["genel"], "Telefon ekranını haftada birkaç kez sil; yanağa değen yüzey bakteri taşır.", "Cleveland Clinic"),
  T(11, ["genel"], "7-9 saat uyku cildin onarım süresi; göz altı ve donukluk önce uykudan etkilenir.", "Harvard Health"),
  T(12, ["genel"], "Gün içinde su şişeni yanında taşı; susuzluk önce dudakta ve göz çevresinde görünür.", "Mayo Clinic"),
  T(13, ["oily"], "Yağlı ciltte de nemlendirici gerekir; jel ya da 'oil-free' olanı seç.", "AAD"),
  T(14, ["oily"], "Gün içindeki parlama için yağ alıcı kâğıt kullan; yüzü sık yıkamak yağlanmayı artırır.", "AAD"),
  T(15, ["oily", "pores"], "Niasinamid (%2-5) yağ dengesine ve gözenek görünümüne yardımcı olur; sabah, nemlendiriciden önce.", "Draelos 2006"),
  T(16, ["dry"], "Kuru ciltte köpüren temizleyici yerine krem ya da süt kıvamlı temizleyici seç.", "AAD"),
  T(17, ["dry", "dryness"], "Seramid, gliserin ve hyaluronik asit içeren nemlendiriciler bariyeri onarır.", "AAD"),
  T(18, ["dryness"], "Kışın kalorifer havayı kurutur; odada nemlendirici ya da su kabı işe yarar.", "Mayo Clinic"),
  T(19, ["sensitive"], "Hassas ciltte etikette 'fragrance-free' (parfümsüz) ara; 'unscented' koku maskeleyici içerebilir.", "AAD"),
  T(20, ["sensitive", "redness"], "Kızarıklıkta çinko oksitli (mineral) güneş kremleri genelde daha az tahriş eder.", "AAD"),
  T(21, ["redness"], "Acılı yemek, alkol ve çok sıcak duş kızarıklığı tetikleyebilir; seni hangisinin etkilediğini not et.", "AAD"),
  T(22, ["acne"], "Sivilceyi sıkma; iz ve leke kalma riskini artırır, iyileşmeyi uzatır.", "AAD"),
  T(23, ["acne", "retinoid"], "Retinoidler ilk haftalarda sivilceyi artırmış gibi gösterebilir; sonucu 8-12 haftada değerlendir.", "AAD"),
  T(24, ["acne"], "Benzoil peroksit havlu ve yastık kılıfını ağartır; beyaz kılıf kullan.", "AAD"),
  T(25, ["acne"], "Yastık kılıfını 2-3 günde bir değiştir; yağ ve bakteri birikir.", "AAD"),
  T(26, ["acne", "spor"], "Antrenmandan sonra terli kıyafetle bekleme; mümkünse hemen duş al.", "AAD"),
  T(27, ["acne"], "Saç ürünlerindeki yağlar alın çizgisinde sivilce yapabilir; ürünü yüze değdirme.", "AAD"),
  T(28, ["blackheads"], "Siyah noktada BHA (salisilik asit) gözeneğin içine işler; sıkmaktan çok daha güvenli.", "AAD"),
  T(29, ["blackheads", "pores"], "Burun bandı geçici çözüm; düzenli BHA kalıcı fark yaratır.", "AAD"),
  T(30, ["marks"], "Leke ve izlerin en büyük düşmanı güneş; SPF olmadan leke kremi boşa gider.", "AAD"),
  T(31, ["marks"], "C vitamini serumunu sabah kullan; ışıktan korunan koyu şişede olanı seç.", "Cleveland Clinic"),
  T(32, ["retinoid"], "Retinoidi kuru cilde, bezelye kadar, göz ve dudak kenarından uzak sür.", "AAD"),
  T(33, ["retinoid"], "Retinoid kullanırken SPF'yi asla atlama; cilt güneşe daha duyarlı olur.", "AAD"),
  T(34, ["retinoid"], "Tahriş olursa bırakma: araya bir gece boşluk koy ya da önce nemlendirici sür.", "AAD"),
  T(35, ["darkcircles"], "Göz altı morluğunda uyku, alerji ve tuz belirleyici; soğuk kompres şişliği azaltır.", "Mayo Clinic"),
  T(36, ["darkcircles"], "Göz çevresine de güneş kremi sür; güneş göz altı pigmentini koyulaştırır.", "AAD"),
  T(37, ["ingrown", "sakal"], "Tıraşta kılın çıkış yönünde ve az geçişle tıraş ol; batık kıl riski azalır.", "AAD"),
  T(38, ["ingrown", "sakal"], "Tıraştan önce yüzü 2-3 dk ılık suyla ıslat ya da duştan sonra tıraş ol.", "AAD"),
  T(39, ["sakal"], "Jileti 5-7 tıraşta bir değiştir; körelmiş bıçak tahriş ve kesik demek.", "AAD"),
  T(40, ["sakal"], "Sakal altındaki cilt de yıkanmalı ve nemlenmeli; kaşıntı ve kepeği önler.", "AAD"),
  T(41, ["sakal"], "Boyun çizgisi: Adem elmasının yaklaşık iki parmak üstünden geçen düz bir hat.", "Berber pratiği"),
  T(42, ["sakal"], "Sakal yağını birkaç damla avuçta ısıtıp sakala ve altındaki cilde yay.", "AAD"),
  T(43, ["sac"], "Şampuanı saç derisine uygula; uçlara inen köpük yeterli.", "AAD"),
  T(44, ["sac"], "Saç kremini yalnız uçlara sür; saç derisine sürmek yağlanmayı artırır.", "AAD"),
  T(45, ["sac"], "Islak saç daha kırılgandır; havluyla ovma, bastırarak kurula.", "AAD"),
  T(46, ["kepek"], "Ketokonazollü ya da çinko pritionlu şampuanı saç derisinde 3-5 dakika beklet, sonra durula.", "AAD"),
  T(47, ["kepek"], "Kepek şampuanını haftada 2 kez kullan; kalan günler normal şampuan.", "AAD"),
  T(48, ["dokulme"], "Günde 50-100 tel dökülmesi normaldir; tepe ya da alın açılıyorsa erken dönemde dermatoloğa görün.", "AAD"),
  T(49, ["dokulme"], "Saçı sürekli sıkı toplamak ya da sıkı şapka çekme kaynaklı dökülme yapabilir.", "AAD"),
  T(50, ["sac"], "Berber aralığını 3-4 haftada tut; kısa kesimler 3. haftada formunu kaybeder.", "Berber pratiği"),
  T(51, ["ter"], "Antiperspirantı geceleri kuru koltuk altına sür; sabaha ter kanallarını tıkar, gün boyu daha etkili.", "AAD"),
  T(52, ["ter"], "Deodorant kokuyu örter, antiperspirant teri azaltır; çok terliyorsan ikincisi gerekir.", "Cleveland Clinic"),
  T(53, ["ter"], "Pamuk ve nefes alan teknik kumaşlar teri daha iyi yönetir; kalın polyester kokuyu tutar.", "Genel bakım pratiği"),
  T(54, ["spor"], "Spor sonrası yüzünü yıka; ter, bant ya da kask altında kalan bölgelerde sivilce yapar.", "AAD"),
  T(55, ["backacne"], "Sırt sivilcesinde salisilik asit ya da benzoil peroksitli yıkama ürününü 1-2 dk bekletip durula.", "AAD"),
  T(56, ["genel"], "Diş ipini günde bir kez kullan: diş arası çürüğün ve ağız kokusunun en sık sebebi orada.", "ADA"),
  T(57, ["genel"], "Dilini de fırçala ya da kazıyıcı kullan; ağız kokusunun büyük kısmı dilden gelir.", "ADA"),
  T(58, ["genel"], "Diş fırçasını 3-4 ayda bir ya da kılları açılınca değiştir.", "ADA"),
  T(59, ["genel"], "Tırnakları düz kes, köşeleri hafif yuvarlat; batık tırnağı önler.", "AAD"),
  T(60, ["genel"], "Dudak balmını gün içinde yenile; dudakları yalamak onları daha çok kurutur.", "AAD"),
  T(61, ["combo"], "Karma ciltte T bölgesine hafif jel, yanaklara daha zengin krem sürebilirsin.", "AAD"),
  T(62, ["normal"], "Normal ciltte basit kal: temizleyici, nemlendirici, SPF. Fazla ürün fayda değil tahriş getirir.", "AAD")
];
function profileTags(p) {
  const t = ["genel", "spf", "sakal", "sac", p.skin, ...p.issues];
  if (p.hair.dandruff) t.push("kepek");
  if (p.hair.thinning) t.push("dokulme");
  if (p.sweat === "high") t.push("ter");
  if (p.times.gymDays.length) t.push("spor");
  if (has(p, "acne", "marks", "pores")) t.push("retinoid");
  return t;
}
function pickTip(profile, date, history) {
  const p = normProfile(profile), tags = profileTags(p), h = history || {};
  const pool = CARE_TIPS.filter(x => x.tags.some(t => tags.includes(t)));
  if (h[date]) { const same = pool.find(x => x.id === h[date]); if (same) return same; }
  const recent = new Set(Object.entries(h).filter(([d]) => { const n = daysBetween(d, date); return n > 0 && n < 14; }).map(([, id]) => id));
  const fresh = pool.filter(x => !recent.has(x.id)), list = fresh.length ? fresh : pool;
  let s = 0; for (const c of date) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return list[s % list.length];
}
```

Export satırına `CARE_TIPS, pickTip` eklenir:

```js
const api = { SRV, DEFAULT_PROFILE, normProfile, buildDay, buildWeek, streak, pruneDone, doctorNote,
  CARE_TIPS, pickTip, isoDate, addDays, daysBetween, _t: { toMin, atMin, weekday, has } };
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/`
Expected: 10 PASS.

- [ ] **Step 5: Commit**

```bash
git add zenon-care.js tests/care.test.js
git commit -m "Zenon Bakım: günün bilgisi (62 kaynaklı ipucu)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hatırlatma üreticisi

**Files:**
- Modify: `zenon-care.js` (`reminders` + export)
- Test: `tests/care.test.js` (ekleme)

**Interfaces:**
- Consumes: `buildWeek` çıktısı `Day[]`, `normProfile`, `toMin`, `atMin`, `weekday`, `addDays`.
- Produces: `reminders(profile, days, state, now:Date) -> [{at:ISO-UTC string, title, body, tag}]`. Sıralı, yalnız `now`'dan sonrası, en sonda tek `tag:"renew"`.

- [ ] **Step 1: Write the failing tests**

```js
const R = (p, start, state, now, wx) => C.reminders(p, C.buildWeek(p, start, wx || {}, state || {}), state || {}, now);
const loc = r => new Date(r.at);

test("hatırlatmalar kalkış-yatış içinde, günde ≤ 6, sonda renew", () => {
  const p = { issues: ["acne"], hair: { lastCut: "2026-09-12" }, times: { gymDays: [1, 3], gym: "18:00" } };
  const wx = {}; for (let i = 0; i < 7; i++) wx[C.addDays("2026-10-05", i)] = { t: 22, tmin: 15, tmax: 26, uv: 7, hum: 50 };
  const out = R(p, "2026-10-05", {}, new Date(2026, 9, 5, 0, 0), wx);
  assert.equal(out[out.length - 1].tag, "renew");
  const byDay = {};
  for (const r of out.slice(0, -1)) {
    const d = loc(r), k = C.isoDate(d), m = d.getHours() * 60 + d.getMinutes(), we = [0, 6].includes(d.getDay());
    assert.ok(m >= (we ? 570 : 450), `${r.tag} kalkıştan önce`);
    byDay[k] = (byDay[k] || 0) + 1;
  }
  assert.ok(Object.values(byDay).every(n => n <= 6));
});

test("gece yarısından sonra yatış: akşam rutini aynı gün 23:45", () => {
  const out = R({}, "2026-10-10", {}, new Date(2026, 9, 10, 0, 0));   // Cumartesi, yatış 00:30
  const pm = out.find(r => r.tag === "pm-2026-10-10"), d = loc(pm);
  assert.equal(C.isoDate(d), "2026-10-10");
  assert.equal(d.getHours() * 60 + d.getMinutes(), 23 * 60 + 45);
});

test("yalnız gelecekteki hatırlatmalar; tamamlanan rutin gönderilmez", () => {
  const out = R({}, "2026-10-07", { done: { "2026-10-07": { pmAll: true } } }, new Date(2026, 9, 7, 15, 0));
  assert.ok(out.every(r => new Date(r.at) > new Date(2026, 9, 7, 15, 0)));
  assert.ok(!out.some(r => r.tag === "am-2026-10-07"));
  assert.ok(!out.some(r => r.tag === "pm-2026-10-07"));
});

test("başlık ≤ 80, gövde ≤ 300, toplam ≤ 100", () => {
  const day = C.buildDay({}, "2026-10-07", null, {});
  day.am = Array.from({ length: 40 }, (_, i) => ({ id: "x" + i, label: "Çok uzun bir adım adı " + i, why: "" }));
  const out = C.reminders({}, [day], {}, new Date(2026, 9, 7, 0, 0));
  assert.ok(out.every(r => r.title.length <= 80 && r.body.length <= 300));
  assert.ok(R({}, "2026-10-07", {}, new Date(2026, 9, 7, 0, 0)).length <= 100);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test tests/`
Expected: 4 FAIL (`C.reminders is not a function`).

- [ ] **Step 3: Implement** — `pickTip`'ten sonra:

```js
const PRIO = { am: 0, pm: 1, spf: 2, gym: 3, wk: 4, barber: 5 };
const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
function dayTimes(p, date) {
  const w = [0, 6].includes(weekday(date)) ? p.times.weekend : p.times.weekday, wake = toMin(w.wake);
  let sleep = toMin(w.sleep); if (sleep <= wake) sleep += 1440;
  return { wake, sleep };
}
function reminders(profile, days, state, now) {
  const p = normProfile(profile), done = (state && state.done) || {}, out = [];
  for (const d of days) {
    const { wake, sleep } = dayTimes(p, d.date), dn = done[d.date] || {}, fin = dn.tasks || [], list = [];
    const add = (kind, min, title, body) => { if (min >= wake && min <= sleep)
      list.push({ kind, at: atMin(d.date, min), title: cut(title, 80), body: cut(body, 300), tag: `${kind}-${d.date}` }); };
    if (!dn.amAll) add("am", wake + 10, "Sabah rutini", d.am.map(s => s.label).join(" → ") + (d.uv != null ? ` (bugün UV ${d.uv})` : ""));
    if (!dn.pmAll) add("pm", sleep - 45, "Akşam rutini", d.pm.map(s => s.label).join(" → "));
    if (d.uv != null && d.uv >= 6) add("spf", 780, "SPF yenile", `UV ${d.uv}: dışarıdaysan güneş kremini yenile.`);
    if (p.times.gymDays.includes(weekday(d.date)) && !fin.includes("gym"))
      add("gym", toMin(p.times.gym) + 90, "Spor sonrası", d.extras.filter(s => s.id === "gym" || s.id === "backwash").map(s => s.label).join(" · "));
    const tasks = d.weekly.filter(t => t.id !== "barber" && !fin.includes(t.id));
    if (tasks.length) add("wk", wake + 30, "Bugünün bakım görevleri", tasks.map(t => t.label).join(", "));
    const br = d.weekly.find(t => t.id === "barber");
    if (br && !fin.includes("barber") && (br.due - 24) % 3 === 0) add("barber", 720, "Berber", br.label + ". Randevu al.");
    list.sort((a, b) => PRIO[a.kind] - PRIO[b.kind]);
    out.push(...list.slice(0, 6));
  }
  const res = out.filter(r => r.at > now).sort((a, b) => a.at - b.at).slice(0, 99);
  if (days.length) {
    const last = addDays(days[days.length - 1].date, 1);
    res.push({ at: atMin(last, dayTimes(p, last).wake + 60), title: "Zenon", body: "Bakım planın bitiyor: Zenon'u aç, yeni haftayı hazırlayayım.", tag: "renew" });
  }
  return res.map(r => ({ at: r.at.toISOString(), title: r.title, body: r.body, tag: r.tag }));
}
```

Export satırına `reminders` eklenir:

```js
const api = { SRV, DEFAULT_PROFILE, normProfile, buildDay, buildWeek, reminders, streak, pruneDone, doctorNote,
  CARE_TIPS, pickTip, isoDate, addDays, daysBetween, _t: { toMin, atMin, weekday, has } };
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/`
Expected: 14 PASS.

- [ ] **Step 5: Commit**

```bash
git add zenon-care.js tests/care.test.js
git commit -m "Zenon Bakım: hatırlatma üreticisi" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 整 Bakım arayüzü (anket, rutin, Bugün kartı, Takip, hava)

**Files:**
- Modify: `index.html` (sekme, `#care` bölümü, `#careMini`, Takip satırı, script etiketi)
- Modify: `zenon.css` (6 sütun sekme + bakım stilleri)
- Modify: `zenon.js` (hava isteği, bakım bölümü, hash yönlendirme, açılış)
- Modify: `sw.js` (`zenon-v2`, `zenon-care.js` önbellekte)
- Modify: `build-preview.py` (`zenon-care.js` de gömülür)
- Test: Playwright betiği (scratchpad, depoya girmez)

**Interfaces:**
- Consumes: `window.ZenonCare` (Task 1-3).
- Produces (Task 5 için, `zenon.js` IIFE kapsamında): `careProfile`, `careState`, `wxDays`, `let careWarn`, `let syncPush` (bu görevde boş fonksiyon), `renderCareMini()`, `TODAY`.

- [ ] **Step 1: `index.html`**

a) `<script src="zenon.js"></script>` satırının hemen önüne:

```html
<script src="zenon-care.js"></script>
```

b) Bugün ilk sütununda `<div class="city-meta">…</div>` satırından sonra:

```html
        <div class="sec" id="careMini"></div>
```

c) `<!-- 記 -->` yorumunun hemen önüne:

```html
  <!-- 整 -->
  <section class="view" id="care" aria-label="Bakım">
    <div class="card"><span class="kan" aria-hidden="true">手入</span><p class="ep">第六話</p><h1 class="rgb">手入れ</h1><p class="sub">BAKIM · <span id="careSub">Sabah, akşam, hafta</span></p></div>
    <div id="careSurvey"></div>
    <div id="careMain">
      <div class="grid-2">
        <div class="col">
          <div class="sec"><div class="sec-h"><span class="label">Sabah</span><span class="label" id="careAmN"></span></div><div class="rules" id="careAm" style="border-top:1px solid var(--line)"></div></div>
          <div class="sec"><div class="sec-h"><span class="label">Akşam</span><span class="label" id="carePmN"></span></div><div class="rules" id="carePm" style="border-top:1px solid var(--line)"></div></div>
          <div class="sec"><div class="sec-h"><span class="label">Bugünün görevleri</span></div><div class="rules" id="careTasks" style="border-top:1px solid var(--line)"></div></div>
        </div>
        <div class="col">
          <div class="sec"><div class="sec-h"><span class="label">Hava ve notlar</span></div><div class="rules" id="careNotes" style="border-top:1px solid var(--line)"></div></div>
          <div class="sec"><div class="sec-h"><span class="label">Günün bilgisi</span></div><p id="careTip"></p></div>
          <div class="sec"><div class="sec-h"><span class="label">Bu hafta</span></div><div class="rules" id="careWeek" style="border-top:1px solid var(--line)"></div></div>
          <div class="sec"><div class="row-btns" style="margin:0"><button class="btn" id="careEdit">Profili düzenle</button></div><p class="label" id="careDoc" style="margin-top:10px"></p></div>
        </div>
      </div>
    </div>
  </section>
```

d) Takip ikinci sütununda `Yedek · cihazlar arası taşı` bölümünün hemen önüne:

```html
        <div class="sec"><div class="sec-h"><span class="label">Bakım · son 14 gün</span><span class="label" id="careStreak"></span></div><div id="careHist"></div></div>
```

e) Sekme çubuğunda `data-view="log"` düğmesinin önüne:

```html
  <button class="tab" data-view="care" data-k="整"><span class="k">整</span>Bakım</button>
```

- [ ] **Step 2: `zenon.css`**

`.tabs nav{…grid-template-columns:repeat(5,1fr)}` içinde `repeat(5,1fr)` → `repeat(6,1fr)`. Dosya sonuna:

```css
/* 整 bakım */
.ck{display:grid;grid-template-columns:40px 1fr;width:100%;text-align:left;border-bottom:1px solid var(--line)}
.ck:last-child{border-bottom:0}
.ck i{font-style:normal;display:grid;place-items:center;min-height:46px;border-right:1px solid var(--line);font-family:var(--mono);color:var(--ink-3)}
.ck.on i{background:var(--red);color:#F4ECDD}
.ck p{padding:10px 11px;font-size:13.5px}
.ck small{display:block;color:var(--ink-3);font-size:12px;margin-top:2px}
.ck.on p{color:var(--ink-3)}
.survey .field{margin-bottom:14px}
.survey textarea{margin-top:0}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips label{border:1px solid var(--line-2);padding:8px 10px;font-size:13px;display:flex;gap:6px;align-items:center}
.chips input{accent-color:var(--red)}
.times{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field input[type=time],.field input[type=date]{min-width:0;width:100%}
#careTip{font-size:14px;line-height:1.5}
```

- [ ] **Step 3: `zenon.js` hava isteği** — `loadWx` içindeki satırları değiştir:

```js
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,relative_humidity_2m_mean&timezone=auto&forecast_days=8`);
    if(!r.ok) throw 0; const d=(await r.json()).daily, i=forTomorrow?1:0, tmax=d.temperature_2m_max[i], tmin=d.temperature_2m_min[i];
    wx={t:(tmax*2+tmin)/3,tmin,tmax,rain:d.precipitation_probability_max[i]??0,wind:d.wind_speed_10m_max[i],live:true};
    wxDays={}; d.time.forEach((k,j)=>{ wxDays[k]={t:(d.temperature_2m_max[j]*2+d.temperature_2m_min[j])/3,tmin:d.temperature_2m_min[j],tmax:d.temperature_2m_max[j],uv:d.uv_index_max?.[j]??null,hum:d.relative_humidity_2m_mean?.[j]??null}; });
    store.set("wxDays",wxDays);
    $("#wxMsg").textContent=""; renderWx(); renderFit(true); renderCare(); syncPush();
```

- [ ] **Step 4: `zenon.js` bakım bölümü** — `/* ================= chrome ================= */` satırının hemen önüne:

```js
/* ================= 整 · bakım: profil, rutin, takip ================= */
const ZC=window.ZenonCare;
let careProfile=store.get("care.profile"); if(careProfile) careProfile=ZC.normProfile(careProfile);
let careState=store.get("care.state")||{};
careState.done=ZC.pruneDone(careState.done||{},TODAY); careState.tips=careState.tips||{};
let wxDays=store.get("wxDays")||{}, careEditing=false, careWarn=false;
let syncPush=()=>{};                                  // bildirim istemcisi (Task 5) bunu değiştirir
const saveCare=()=>store.set("care.state",careState);
const careDay=(date=TODAY)=>ZC.buildDay(careProfile,date,wxDays[date]||null,careState);
const escH=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const dayName=s=>["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"][new Date(s+"T12:00").getDay()]+" "+s.slice(8)+"."+s.slice(5,7);
const ISSUES=[["acne","Sivilce"],["blackheads","Siyah nokta"],["marks","Akne izi / leke"],["pores","Geniş gözenek"],["redness","Kızarıklık"],["darkcircles","Göz altı morluğu"],["dryness","Kuruluk"],["ingrown","Batık kıl"],["backacne","Sırt sivilcesi"]];
const SKINS=[["oily","Yağlı"],["combo","Karma"],["normal","Normal"],["dry","Kuru"],["sensitive","Hassas"]];
const BEARDS=[["clean","Tam tıraş"],["stubble","Kirli sakal"],["short","Kısa sakal"],["full","Uzun sakal"]];
const careOpts=(list,v)=>list.map(([k,n])=>`<option value="${k}" ${String(k)===String(v)?"selected":""}>${n}</option>`).join("");
const chk=(name,val,on,label)=>`<label><input type="checkbox" name="${name}" value="${val}" ${on?"checked":""}>${label}</label>`;

function renderSurvey(){
  const p=ZC.normProfile(careProfile), t=p.times;
  $("#careSurvey").innerHTML=`<form class="sec survey" id="careForm">
    <div class="sec-h"><span class="label">Bakım profili · 2 dakika</span></div>
    <label class="field"><span class="label">Cilt tipi · yıkadıktan 1 saat sonra: her yer parlıyorsa yağlı, yalnız alın-burun parlıyorsa karma, geriliyorsa kuru, kolay kızarıyorsa hassas</span><select name="skin">${careOpts(SKINS,p.skin)}</select></label>
    <div class="field"><span class="label">Sorunlar · birden fazla seçebilirsin</span><div class="chips">${ISSUES.map(([k,n])=>chk("issues",k,p.issues.includes(k),n)).join("")}</div></div>
    <label class="field"><span class="label">Sakal</span><select name="beard">${careOpts(BEARDS,p.beard.style)}</select></label>
    <label class="field"><span class="label">Sakal yoğunluğu</span><select name="density">${careOpts([["sparse","Seyrek"],["medium","Orta"],["dense","Sık"]],p.beard.density)}</select></label>
    <label class="field"><span class="label">Saç yapısı</span><select name="hairType">${careOpts([["straight","Düz"],["wavy","Dalgalı"],["curly","Kıvırcık"]],p.hair.type)}</select></label>
    <div class="field"><span class="label">Saç derisi</span><div class="chips">${chk("oilyScalp",1,p.hair.oilyScalp,"Çabuk yağlanıyor")}${chk("dandruff",1,p.hair.dandruff,"Kepek")}${chk("thinning",1,p.hair.thinning,"Dökülme endişesi")}</div></div>
    <label class="field"><span class="label">Son berber</span><input type="date" name="lastCut" value="${p.hair.lastCut||""}"></label>
    <label class="field"><span class="label">Terleme</span><select name="sweat">${careOpts([["low","Az"],["mid","Orta"],["high","Çok"]],p.sweat)}</select></label>
    <div class="field"><span class="label">Hafta içi · kalkış / yatış</span><div class="times"><input type="time" name="wdWake" value="${t.weekday.wake}" required><input type="time" name="wdSleep" value="${t.weekday.sleep}" required></div></div>
    <div class="field"><span class="label">Hafta sonu · kalkış / yatış</span><div class="times"><input type="time" name="weWake" value="${t.weekend.wake}" required><input type="time" name="weSleep" value="${t.weekend.sleep}" required></div></div>
    <div class="field"><span class="label">Spor günleri ve saati</span><div class="chips">${DAYS.map(([d,n])=>chk("gymDays",d,t.gymDays.includes(d),n)).join("")}</div><input type="time" name="gym" value="${t.gym}"></div>
    <label class="field"><span class="label">Sabah ayırabildiğin süre</span><select name="amMinutes">${careOpts([[2,"2 dakika"],[5,"5 dakika"],[10,"10 dakika"]],p.amMinutes)}</select></label>
    <label class="field"><span class="label">Bütçe</span><select name="budget">${careOpts(TIERS,p.budget)}</select></label>
    <label class="field"><span class="label">Şu an kullandığın ürünler</span><textarea class="note-in" name="products" rows="2" placeholder="Örn. Nivea krem, Gillette jilet">${escH(p.currentProducts)}</textarea></label>
    <div class="row-btns"><button class="btn solid" type="submit">Kaydet · rutinimi hazırla</button>${careProfile?`<button class="btn" type="button" id="careCancel">Vazgeç</button>`:""}</div>
  </form>`;
}
const ckRow=(kind,s,on)=>`<button type="button" class="ck ${on?"on":""}" data-ck="${kind}:${s.id}" aria-pressed="${on}"><i>${on?"✓":""}</i><p>${s.label}<small>${s.why}</small></p></button>`;
function renderCare(){
  const survey=!careProfile||careEditing;
  $("#careSurvey").style.display=survey?"":"none"; $("#careMain").style.display=survey?"none":"";
  if(survey) renderSurvey();
  renderCareMini(); renderCareLog();
  if(survey) return;
  const d=careDay(), dn=careState.done[TODAY]||{}, on=(k,id)=>(dn[k]||[]).includes(id);
  $("#careSub").textContent=`${ZC.streak(careState.done,TODAY)} GÜN SERİ · ${d.active==="retinoid"?"RETİNOİD GECESİ":d.active==="bha"?"BHA GECESİ":"DİNLENME GECESİ"}`;
  $("#careAm").innerHTML=d.am.map(s=>ckRow("am",s,on("am",s.id))).join("");
  $("#carePm").innerHTML=d.pm.map(s=>ckRow("pm",s,on("pm",s.id))).join("");
  $("#careAmN").textContent=`${d.am.filter(s=>on("am",s.id)).length}/${d.am.length}`;
  $("#carePmN").textContent=`${d.pm.filter(s=>on("pm",s.id)).length}/${d.pm.length}`;
  const tasks=[...d.weekly,...d.extras];
  $("#careTasks").innerHTML=tasks.length?tasks.map(s=>ckRow("tasks",s,on("tasks",s.id))).join(""):`<p class="empty">Bugün ek görev yok.</p>`;
  $("#careNotes").innerHTML=(d.notes.length?d.notes:["Hava verisi gelince UV ve nem notları burada."]).map(n=>`<div class="rule"><span>Not</span><p>${n}</p></div>`).join("");
  const tip=careTip(); $("#careTip").innerHTML=`${tip.t} <span class="label">· ${tip.src}</span>`;
  $("#careWeek").innerHTML=ZC.buildWeek(careProfile,TODAY,wxDays,careState).map(x=>`<div class="rule"><span>${dayName(x.date)}</span><p>${[x.active==="retinoid"?"Retinoid gecesi":x.active==="bha"?"BHA gecesi":"Aktif yok",...x.weekly.map(t=>t.label)].join(" · ")}</p></div>`).join("");
  $("#careDoc").textContent=ZC.doctorNote(careProfile)||"";
}
function careTip(){
  const tip=ZC.pickTip(careProfile,TODAY,careState.tips);
  if(careState.tips[TODAY]!==tip.id){ const from=ZC.addDays(TODAY,-30);
    careState.tips=Object.fromEntries(Object.entries(careState.tips).filter(([k])=>k>=from)); careState.tips[TODAY]=tip.id; saveCare(); }
  return tip;
}
function renderCareMini(){
  const el=$("#careMini");
  if(!careProfile){ el.innerHTML=`<div class="sec-h"><span class="label">Bakım</span></div><div class="row-btns" style="margin:0"><button class="btn solid" data-go="care">整 Bakım profilini doldur · 2 dk</button></div>`; return; }
  const d=careDay(), dn=careState.done[TODAY]||{};
  const left=d.am.filter(s=>!(dn.am||[]).includes(s.id)).length+d.pm.filter(s=>!(dn.pm||[]).includes(s.id)).length;
  const next=!dn.amAll?"Sabah rutini":!dn.pmAll?"Akşam rutini":"Bugün tamam ✓";
  el.innerHTML=`<div class="sec-h"><span class="label">Bugünün bakımı</span><span class="label">${left} adım kaldı</span></div>
    <div class="row-btns" style="margin:0"><button class="btn solid" data-go="care">${next} →</button></div>
    <p class="label" style="margin-top:8px;text-transform:none;letter-spacing:.02em">${careTip().t}</p>
    ${careWarn?`<p class="label" style="color:var(--red);margin-top:6px">Bildirim planı gönderilemedi, rutin ekranda</p>`:""}`;
}
function renderCareLog(){
  if(!careProfile){ $("#careHist").innerHTML=`<p class="empty">Bakım profili doldurulunca burada görünür.</p>`; $("#careStreak").textContent=""; return; }
  const cells=Array.from({length:14},(_,i)=>{ const k=ZC.addDays(TODAY,i-13), x=careState.done[k]||{}, full=x.amAll&&x.pmAll, half=!full&&(x.amAll||x.pmAll);
    return `<span class="cal ${full?"on":""} ${k===TODAY?"today":""}" title="${k}${full?" · tamam":half?" · yarım":""}" style="${half?"opacity:.55":""}">${+k.slice(8)}</span>`; }).join("");
  $("#careHist").innerHTML=`<div class="calgrid">${cells}</div>`;
  $("#careStreak").textContent=`${ZC.streak(careState.done,TODAY)} gün seri`;
}
document.addEventListener("submit",e=>{
  if(e.target.id!=="careForm") return; e.preventDefault();
  const f=new FormData(e.target), g=k=>f.get(k);
  careProfile=ZC.normProfile({skin:g("skin"),issues:f.getAll("issues"),beard:{style:g("beard"),density:g("density")},
    hair:{type:g("hairType"),oilyScalp:!!g("oilyScalp"),dandruff:!!g("dandruff"),thinning:!!g("thinning"),lastCut:g("lastCut")||null},
    sweat:g("sweat"),times:{weekday:{wake:g("wdWake"),sleep:g("wdSleep")},weekend:{wake:g("weWake"),sleep:g("weSleep")},gymDays:f.getAll("gymDays").map(Number),gym:g("gym")||"18:00"},
    amMinutes:+g("amMinutes"),budget:g("budget"),currentProducts:(g("products")||"").trim()});
  store.set("care.profile",careProfile);
  if(!careState.retinoidStart){ careState.retinoidStart=TODAY; saveCare(); }
  careEditing=false; renderCare(); window.scrollTo({top:0}); toast("Rutinin hazır"); syncPush();
});
document.addEventListener("click",e=>{
  const go=e.target.closest("[data-go]"); if(go) goView(go.dataset.go);
  if(e.target.closest("#careEdit")){ careEditing=true; renderCare(); window.scrollTo({top:0}); }
  if(e.target.closest("#careCancel")){ careEditing=false; renderCare(); }
  const b=e.target.closest("[data-ck]"); if(!b) return;
  const [kind,id]=b.dataset.ck.split(":"), dn=careState.done[TODAY]||(careState.done[TODAY]={});
  ["am","pm","tasks"].forEach(k=>dn[k]=dn[k]||[]);
  const i=dn[kind].indexOf(id); if(i>=0) dn[kind].splice(i,1); else dn[kind].push(id);
  const d=careDay(); dn.amAll=d.am.every(s=>dn.am.includes(s.id)); dn.pmAll=d.pm.every(s=>dn.pm.includes(s.id));
  if(kind==="tasks"&&id==="barber"&&i<0){ careProfile.hair.lastCut=TODAY; store.set("care.profile",careProfile); }
  saveCare(); renderCare(); syncPush();
});
function goView(v){ const t=document.querySelector(`.tab[data-view="${v}"]`); if(t) t.click(); }
window.addEventListener("hashchange",()=>goView(location.hash.slice(1)));
```

Not: `DAYS` ve `TIERS` dosyada daha aşağıda/yukarıda `const` olarak tanımlı; anket yalnız açılış çağrısından (tüm tanımlar yüklendikten) sonra çizildiği için taşımaya gerek yok.

- [ ] **Step 5: `zenon.js` açılış** — son satırlardaki açılış çağrısını değiştir:

```js
processLog(); renderSizeLab(); renderCapsule(); renderCart(); renderLog(); renderWx(); renderPlan(); renderFit(false); renderFilters(); renderList(); renderLook(); renderShop(); renderCands(); renderCare();
if(location.hash.length>1) goView(location.hash.slice(1));
loadWx();
```

- [ ] **Step 6: `sw.js` ve `build-preview.py`**

`sw.js`:

```js
const CACHE="zenon-v2";
const SHELL=["./","index.html","zenon.css","zenon-care.js","zenon.js","manifest.webmanifest","icon.svg","icon-180.png","icon-192.png","icon-512.png"];
```

`build-preview.py` gövde satırı:

```python
body = body.replace('<script src="zenon-care.js"></script>', '<script>' + open('zenon-care.js', encoding='utf-8').read() + '</script>')
body = body.replace('<script src="zenon.js"></script>', '<script>' + open('zenon.js', encoding='utf-8').read() + '</script>')
```

- [ ] **Step 7: Görsel ve davranış kontrolü** — scratchpad'e `care_check.py`:

```python
import subprocess, sys, time
from playwright.sync_api import sync_playwright
ROOT = r"C:\Users\diyar\Documents\Ross"; OUT = sys.argv[1]
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2); errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge"); pg = b.new_page(viewport={"width": 375, "height": 812})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8765/#care"); pg.wait_for_timeout(900)
        pg.screenshot(path=OUT + r"\1-anket.png", full_page=True)
        pg.check("input[name=issues][value=acne]"); pg.check("input[name=issues][value=blackheads]")
        pg.click("#careForm button[type=submit]"); pg.wait_for_timeout(500)
        pg.click("#careAm .ck"); pg.wait_for_timeout(200)
        pg.screenshot(path=OUT + r"\2-rutin.png", full_page=True)
        assert pg.evaluate("document.documentElement.scrollWidth") <= 375, "yatay kaydırma var"
        pg.click('.tab[data-view="today"]'); pg.wait_for_timeout(500)
        pg.screenshot(path=OUT + r"\3-bugun.png", full_page=True)
        pg.click('.tab[data-view="log"]'); pg.wait_for_timeout(500)
        pg.screenshot(path=OUT + r"\4-takip.png", full_page=True)
        b.close()
finally:
    srv.terminate()
print("HATALAR:", errs or "yok")
```

Run: `PYTHONUTF8=1 python "<scratchpad>/care_check.py" "<scratchpad>"`
Expected: `HATALAR: yok`; dört ekran görüntüsü okunur ve kontrol edilir: anket 375 px'te taşmıyor, 6 sekme okunuyor, işaretlenen adım ✓ ve kırmızı, Bugün kartında "Bugünün bakımı", Takip'te 14 günlük şerit. `node --test tests/` hâlâ 14 PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html zenon.css zenon.js sw.js build-preview.py
git commit -m "Zenon Bakım: 整 sekmesi, anket, rutin, Bugün kartı, takip" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Bildirim istemcisi (Web Push, sunucu hazır değilken "yakında")

**Files:**
- Modify: `index.html` (Bakım sekmesine bildirim bloğu)
- Modify: `zenon.js` (bildirim bölümü)
- Modify: `sw.js` (`push`, `notificationclick`)

**Interfaces:**
- Consumes: `ZC.SRV`, `ZC.buildWeek`, `ZC.reminders`, `careProfile`, `careState`, `wxDays`, `careWarn`, `syncPush`, `renderCareMini`, `toast`, `TODAY` (Task 4).
- Sunucu sözleşmesi (spec Bölüm 2): `GET /zenon/api/saglik`, `GET /zenon/api/anahtar → {public}`, `POST /zenon/api/abone {cihaz, token, subscription}`, `PUT /zenon/api/plan {hatirlatmalar}`, `POST /zenon/api/test`; başlıklar `X-Zenon-Cihaz`, `X-Zenon-Token`. Push yükü `{title, body, tag, url}`.

- [ ] **Step 1: `index.html`** — Bakım bölümünde `Profili düzenle` `sec`'inin hemen önüne:

```html
          <div class="sec"><div class="sec-h"><span class="label">Bildirimler</span><span class="label" id="pushState"></span></div>
            <p class="label" id="pushMsg" style="margin-bottom:10px;text-transform:none;letter-spacing:.02em"></p>
            <div class="row-btns" style="margin:0"><button class="btn solid" id="pushOn">Bildirimleri aç</button><button class="btn" id="pushTest">Test bildirimi</button></div></div>
```

- [ ] **Step 2: `zenon.js` bildirim bölümü** — Task 4 bakım bölümünün sonuna (`window.addEventListener("hashchange"…)` satırından sonra):

```js
/* 整 · bildirimler: Seneca sunucusu üzerinden Web Push. Sunucu yalnız hatırlatma metnini ve saatini görür. */
let pushCfg=store.get("care.push");                    // {cihaz, token, on}
let srvReady=null;
const randHex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(b=>b.toString(16).padStart(2,"0")).join("");
const pushOk=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
const iOS=/iPad|iPhone|iPod/.test(navigator.userAgent), standalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const pushLive=()=>!!(pushCfg&&pushCfg.on&&pushOk()&&Notification.permission==="granted");
const b64u=s=>{ const r=atob((s+"=".repeat((4-s.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(r,c=>c.charCodeAt(0)); };
async function zapi(path,opt={}){
  const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),8000);
  const h={"Content-Type":"application/json"}; if(pushCfg){ h["X-Zenon-Cihaz"]=pushCfg.cihaz; h["X-Zenon-Token"]=pushCfg.token; }
  try{ const r=await fetch(`${ZC.SRV}/zenon/api/${path}`,{...opt,headers:h,signal:ctl.signal}); if(!r.ok) throw new Error(r.status); return await r.json(); }
  finally{ clearTimeout(tm); }
}
async function renderPush(){
  const st=$("#pushState"), msg=$("#pushMsg"), on=$("#pushOn"), test=$("#pushTest");
  const off=(s,m)=>{ st.textContent=s; msg.textContent=m; on.disabled=true; test.disabled=true; };
  if(!pushOk()||(iOS&&!standalone())) return off("kapalı","Bildirim için: Safari → Paylaş → Ana Ekrana Ekle, sonra Zenon'u ana ekrandaki simgeden aç.");
  if(srvReady===null) srvReady=await zapi("saglik").then(()=>true,()=>false);
  if(!srvReady) return off("yakında","Bildirim sunucusu henüz hazır değil. Rutin yine burada; sunucu açılınca bu düğme çalışır.");
  const live=pushLive(); st.textContent=live?"açık":"kapalı"; on.disabled=false; test.disabled=!live;
  on.textContent=live?"Bildirimleri kapat":"Bildirimleri aç";
  msg.textContent=live?"Sabah, akşam ve görev hatırlatmaları önümüzdeki 7 gün için planlandı.":"Rutin saatlerinde telefonuna bildirim gelir.";
}
async function syncPushNow(){
  if(!pushLive()||!careProfile) return;
  const week=ZC.buildWeek(careProfile,TODAY,wxDays,careState);
  try{ await zapi("plan",{method:"PUT",body:JSON.stringify({hatirlatmalar:ZC.reminders(careProfile,week,careState,new Date())})}); careWarn=false; }
  catch(e){ careWarn=true; }
  renderCareMini();
}
let syncT=0; syncPush=()=>{ clearTimeout(syncT); syncT=setTimeout(syncPushNow,1500); };
async function pushEnable(){
  try{
    if(await Notification.requestPermission()!=="granted"){ toast("Bildirim izni verilmedi"); return renderPush(); }
    const reg=await navigator.serviceWorker.ready, key=(await zapi("anahtar")).public;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});
    pushCfg={cihaz:(pushCfg&&pushCfg.cihaz)||randHex(32),token:(pushCfg&&pushCfg.token)||randHex(32),on:true};
    await zapi("abone",{method:"POST",body:JSON.stringify({cihaz:pushCfg.cihaz,token:pushCfg.token,subscription:sub.toJSON()})});
    store.set("care.push",pushCfg); await syncPushNow(); toast("Bildirimler açık");
  }catch(e){ toast("Bildirim açılamadı"); }
  renderPush();
}
async function pushDisable(){
  try{ await zapi("plan",{method:"PUT",body:JSON.stringify({hatirlatmalar:[]})}); }catch(e){}
  pushCfg.on=false; store.set("care.push",pushCfg); renderPush(); toast("Bildirimler kapandı");
}
$("#pushOn").addEventListener("click",()=>pushLive()?pushDisable():pushEnable());
$("#pushTest").addEventListener("click",()=>zapi("test",{method:"POST"}).then(()=>toast("Test bildirimi gönderildi"),()=>toast("Gönderilemedi")));
```

Açılış satırına (Task 4 Step 5'teki `renderCare();`'den sonra) `renderPush(); syncPush();` ekle:

```js
processLog(); renderSizeLab(); renderCapsule(); renderCart(); renderLog(); renderWx(); renderPlan(); renderFit(false); renderFilters(); renderList(); renderLook(); renderShop(); renderCands(); renderCare(); renderPush(); syncPush();
```

- [ ] **Step 3: `sw.js`** — dosya sonuna:

```js
// Web Push: Seneca sunucusundaki Zenon servisi {title, body, tag, url} gönderir.
self.addEventListener("push",e=>{
  let d={}; try{ d=e.data?e.data.json():{}; }catch(err){ d={body:e.data?e.data.text():""}; }
  e.waitUntil(self.registration.showNotification(d.title||"Zenon",{body:d.body||"",tag:d.tag||"zenon",icon:"icon-192.png",badge:"icon-192.png",data:{url:d.url||"./#care"}}));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  const url=new URL((e.notification.data&&e.notification.data.url)||"./#care",self.registration.scope).href;
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(ws=>{
    const w=ws.find(c=>c.url.startsWith(self.registration.scope));
    if(w) return w.navigate(url).then(c=>(c||w).focus()).catch(()=>w.focus());
    return clients.openWindow(url);
  }));
});
```

- [ ] **Step 4: Kontrol** — Task 4'teki `care_check.py`'yi tekrar çalıştır; ek olarak Bakım ekran görüntüsünde bildirim bloğu "kapalı" ya da "yakında" durumunu ve açıklamasını göstermeli (sunucu henüz yok), sayfa hatası olmamalı. `node --check sw.js` ve `node --test tests/` (14 PASS).

Run: `PYTHONUTF8=1 python "<scratchpad>/care_check.py" "<scratchpad>"; node --check sw.js; node --test tests/`
Expected: `HATALAR: yok`, sözdizimi hatası yok, 14 PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html zenon.js sw.js
git commit -m "Zenon Bakım: Web Push istemcisi (sunucu açılana kadar 'yakında')" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: README, yayın ve hafıza

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README** — bölümler tablosuna satır ve dosya listesine `zenon-care.js` ekle:

```markdown
| 整 Bakım | Kısa anketle bakım profili; kural tabanlı sabah/akşam rutini (retinoid ve BHA takvimi, havaya göre UV/nem ayarı), haftalık görevler (sakal, saç, berber, yastık kılıfı), günün kaynaklı bilgisi, seri takibi. Bildirimler Seneca sunucusu üzerinden (sunucu tarafı açılınca). |
```

```markdown
- `zenon-care.js`: bakım rutin motoru (saf fonksiyonlar; `node --test tests/` ile test edilir)
```

- [ ] **Step 2: Son test ve push**

```bash
node --test tests/
git add README.md && git commit -m "Zenon Bakım: README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git fetch --filter=blob:none origin && git rebase origin/claude/daily-increases-site-gumybo && git push origin HEAD:claude/daily-increases-site-gumybo
```

Expected: 14 PASS, push başarılı. Birkaç dakika sonra `https://ross002200.github.io/Ross/zenon-care.js` 200 döner (`curl -s -o /dev/null -w "%{http_code}"`).

- [ ] **Step 3: Hafıza** — `project_zenon.md`'ye: Bakım Parça 1 Zenon tarafı yayında; sunucu tarafı (Seneca `zenon_push.py`) bekliyor, Seneca'daki Faz 3 bitince ve kullanıcı onayıyla; spec yolu.
