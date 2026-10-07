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

test("retinoid başlangıcı yalnız ihtiyaç yeni doğunca ayarlanır", () => {
  assert.equal(C.retinoidStartFor(null, { issues: [] }, undefined, "2026-10-06"), undefined);
  assert.equal(C.retinoidStartFor(null, { issues: ["acne"] }, undefined, "2026-10-06"), "2026-10-06");
  assert.equal(C.retinoidStartFor({ issues: [] }, { issues: ["acne"] }, "2026-08-01", "2026-10-06"), "2026-10-06");
  assert.equal(C.retinoidStartFor({ issues: ["acne"] }, { issues: ["acne", "marks"] }, "2026-08-01", "2026-10-06"), "2026-08-01");
  assert.equal(C.retinoidStartFor({ issues: ["acne"] }, { issues: [] }, "2026-08-01", "2026-10-06"), undefined);
});

test("koç hatırlatmaları: sabah listesi, check-in, antrenman öncesi; check-in yapıldıysa yok", () => {
  const p = { times: { gymDays: [1], gym: "18:00" } }, d = "2026-10-12";
  const extra = { morning: { [d]: "Günün listesi: 1) Sabah rutini 2) Push günü" }, checkinDone: {}, workout: { [d]: "Push: Bench Press 3 set" } };
  const out = C.reminders(p, C.buildWeek(p, d, {}, {}), {}, new Date(2026, 9, 12, 0, 0), extra);
  assert.match(out.find(r => r.tag === "am-" + d).body, /Günün listesi/);
  assert.ok(out.some(r => r.tag === "checkin-" + d));
  assert.ok(out.some(r => r.tag === "workout-" + d));
  const out2 = C.reminders(p, C.buildWeek(p, d, {}, {}), {}, new Date(2026, 9, 12, 0, 0), { ...extra, checkinDone: { [d]: true } });
  assert.ok(!out2.some(r => r.tag === "checkin-" + d));
});
