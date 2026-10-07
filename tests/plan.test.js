const test = require("node:test"), assert = require("node:assert/strict");
const P = require("../zenon-plan.js");

test("program Aurelius ile aynı günler", () => {
  assert.deepEqual(Object.keys(P.PROGRAM.days).map(Number).sort(), [1, 2, 3, 5, 6]);
  assert.equal(P.PROGRAM.days[1].focus, "Push");
  assert.deepEqual(Object.keys(P.PROGRAM.cardio).map(Number).sort(), [0, 4]);
});

test("ekim listesi: bakım ≤ 10.000 TL, parfüm ayrı, her maddede nasıl alınır", () => {
  const L = P.MONTHS["2026-10"], sum = b => L.filter(i => i.budget === b).reduce((s, i) => s + i.priceTL, 0);
  assert.ok(sum("bakim") <= 10000, String(sum("bakim")));
  assert.ok(sum("parfum") >= 11000 && sum("parfum") <= 15000);
  assert.equal(new Set(L.map(x => x.id)).size, L.length);
  for (const i of L) assert.ok(i.how.length >= 3, i.id);
  assert.ok(L.filter(i => i.rx).every(i => i.how.some(h => /eczane/i.test(h))));
});

test("önayar geçerli bir bakım profili", () => {
  assert.equal(P.PRESET.skin, "combo");
  assert.ok(P.PRESET.issues.includes("ingrown"));
  assert.deepEqual(P.PRESET.times.gymDays, [1, 2, 3, 5, 6]);
});
