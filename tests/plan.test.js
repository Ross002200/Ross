const test = require("node:test"), assert = require("node:assert/strict");
const P = require("../zenon-plan.js");

test("program Aurelius ile aynı günler", () => {
  assert.deepEqual(Object.keys(P.PROGRAM.days).map(Number).sort(), [1, 2, 3, 5, 6]);
  assert.equal(P.PROGRAM.days[1].focus, "Push");
  assert.deepEqual(Object.keys(P.PROGRAM.cardio).map(Number).sort(), [0, 4]);
});

test("ekim listesi v2: tek bütçe ≤ 15.000 TL (parfüm dahil), rx → reçetesiz alternatif, ürünlerde içerik", () => {
  const L = P.MONTHS["2026-10"], plan = L.filter(i => !i.optional), total = plan.reduce((s, i) => s + i.priceTL, 0);
  assert.ok(total <= 15000 && total >= 10000, String(total));
  assert.ok(plan.some(i => i.type === "parfum"), "parfüm listede");
  for (const i of L.filter(i => i.rx)) assert.ok(i.alt && i.alt.length >= 1 && i.alt.every(a => a.how.length >= 2), i.id);
  for (const i of L.filter(i => ["urun", "ilac", "parfum"].includes(i.type))) assert.ok(i.ingredients && i.ingredients.actives && i.ingredients.validation, i.id);
  assert.ok(P.MONTHS["2026-11"] && P.MONTHS["2026-11"].length >= 3);
  assert.equal(new Set(L.map(x => x.id)).size, L.length);
  for (const i of L) assert.ok(i.how.length >= 3, i.id);
  assert.ok(L.filter(i => i.rx).every(i => i.how.some(h => /eczane/i.test(h))));
});

test("önayar geçerli bir bakım profili", () => {
  assert.equal(P.PRESET.skin, "combo");
  assert.ok(P.PRESET.issues.includes("ingrown"));
  assert.deepEqual(P.PRESET.times.gymDays, [1, 2, 3, 5, 6]);
});

test("A2 veri: öğünler, eğer-o zaman şablonları, etkinlikler, beden soruları", () => {
  assert.ok(P.MEALS.length >= 16);
  for (const s of ["kahvalti", "ogle", "aksam", "ara"]) assert.ok(P.MEALS.filter(m => m.slot === s).length >= 3, s);
  assert.ok(P.MEALS.every(m => m.protein > 0 && m.items.length));
  assert.ok(P.IFTHEN.length >= 8);
  for (const k of ["date", "mulakat", "dugun", "diger"]) assert.ok(P.EVENTS[k].tasks.length >= 5, k);
  assert.equal(P.BODYCHECK.length, 5);
});
