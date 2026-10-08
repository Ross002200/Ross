const test = require("node:test"), assert = require("node:assert/strict");
const P = require("../zenon-plan.js");

test("program Aurelius ile aynı günler", () => {
  assert.deepEqual(Object.keys(P.PROGRAM.days).map(Number).sort(), [1, 2, 3, 5, 6]);
  assert.equal(P.PROGRAM.days[1].focus, "Push");
  assert.deepEqual(Object.keys(P.PROGRAM.cardio).map(Number).sort(), [0, 4]);
});

test("ekim listesi: tek bütçe ≤ 16.000 TL (parfüm dahil; v3 hafif aşım izni), rx → reçetesiz alternatif, ürünlerde içerik", () => {
  const L = P.MONTHS["2026-10"], plan = L.filter(i => !i.optional), total = plan.reduce((s, i) => s + i.priceTL, 0);
  assert.ok(total <= 16000 && total >= 10000, String(total));
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

test("parfüm rehberi: Beymen, Boyner, Zara ve pazaryeri; liste parfümü seçenekleri rehberde", () => {
  const P2 = P.PERFUMES;
  assert.ok(P2.length >= 10);
  for (const s of ["Beymen", "Boyner", "Zara", "Pazaryeri"]) assert.ok(P2.some(p => p.store.split(" · ").includes(s)), s);
  assert.ok(P2.filter(p => p.store === "Zara").length >= 3);
  for (const p of P2) assert.ok(p.id && p.name && p.priceTL > 0 && p.ml > 0 && p.why && p.when, p.id);
  assert.equal(new Set(P2.map(p => p.id)).size, P2.length);
  const item = P.MONTHS["2026-10"].find(i => i.id === "parfum");
  assert.ok(item.choices.length >= 4 && item.choices.every(id => P2.some(p => p.id === id)));
  assert.ok(item.choices.every(id => P2.find(p => p.id === id).priceTL <= 6100));
});

test("nükleer parfümler ve takviyeler: performans eşiği, tahlil önce, doktor tahlil listesi", () => {
  const N = P.PERFUMES.filter(p => p.nuke);
  assert.ok(N.length >= 6, String(N.length));
  for (const p of N) assert.ok(p.ll >= 80 && p.sl >= 69, p.id);
  const nov = P.MONTHS["2026-11"], kr = nov.find(i => i.id === "kreatin"), d3 = nov.find(i => i.id === "d3");
  assert.ok(kr && kr.type === "takviye" && kr.ingredients && kr.how.length >= 3);
  assert.ok(d3 && d3.how.some(h => /tahlil/i.test(h)));
  assert.ok(P.MONTHS["2026-10"].find(i => i.id === "doktor").how.some(h => /D vitamini/.test(h) && /ferritin/i.test(h)));
});

test("ekim listesi v3: hastanesiz yol — reçeteli ürün ana listede yok, reçetesiz eşdeğerler rutine bağlı", () => {
  const L = P.MONTHS["2026-10"], plan = L.filter(i => !i.optional), total = plan.reduce((s, i) => s + i.priceTL, 0);
  assert.ok(!plan.some(i => i.rx), "ana listede reçeteli var");
  assert.ok(total <= 16000, String(total));
  for (const [id, step] of [["comedomed", "retinoid"], ["azelaik", "azelaic"], ["dercos", "hair"]]) {
    const i = L.find(x => x.id === id);
    assert.ok(i && (i.care || []).includes(step), id);
    assert.ok(i.alt.some(a => /reçete/i.test(a.name + a.why)), id + " reçeteli sürüm alternatifte");
  }
  assert.ok(P.LABS && P.LABS.length >= 4);
  assert.ok(P.LIFTS && P.LIFTS.length >= 5 && P.LIFTS.every(l => l.range.length === 2));
  for (const p of P.PERFUMES) assert.ok(["tatli", "odunsu", "taze"].includes(p.style), p.id);
});
