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
