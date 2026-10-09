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
  const nov = P.MONTHS["2026-11"], d3 = nov.find(i => i.id === "d3");
  assert.ok(P.OWNED.some(o => o.id === "kreatin") && P.OWNED.some(o => o.id === "whey"));
  assert.ok(d3 && d3.how.some(h => /tahlil/i.test(h)));
  assert.ok(P.LABS.some(l => l.key === "d3") && P.LABS.some(l => l.key === "ferritin"));
});

test("ekim listesi v3: hastanesiz yol — reçeteli ürün ana listede yok, reçetesiz eşdeğerler rutine bağlı", () => {
  const L = P.MONTHS["2026-10"], plan = L.filter(i => !i.optional), total = plan.reduce((s, i) => s + i.priceTL, 0);
  assert.ok(!plan.some(i => i.rx), "ana listede reçeteli var");
  assert.ok(total <= 16000, String(total));
  for (const [id, step] of [["comedomed", "retinoid"]]) {
    const i = L.find(x => x.id === id);
    assert.ok(i && (i.care || []).includes(step), id);
    assert.ok(i.alt.some(a => /reçete/i.test(a.name + a.why)), id + " reçeteli sürüm alternatifte");
  }
  assert.ok(P.LABS && P.LABS.length >= 4);
  assert.ok(P.LIFTS && P.LIFTS.length >= 5 && P.LIFTS.every(l => l.range.length === 2));
  for (const p of P.PERFUMES) assert.ok(["tatli", "odunsu", "taze"].includes(p.style), p.id);
});

test("ekim listesi v4: az ve öz — en çok 12 madde, dudak/diş/tıraş makinesi yok, her üründe kullanım rehberi, saç şekillendirici var", () => {
  const L = P.MONTHS["2026-10"];
  assert.ok(L.length <= 12, String(L.length));
  assert.ok(!L.some(i => /lip|dudak|diş fırça|tepe|oneblade|tıraş makinesi/i.test(i.id + " " + i.name)));
  for (const i of L) assert.ok(i.when && i.use && i.use.length >= 3, i.id);
  assert.ok(L.some(i => i.id === "styler") && !L.some(i => ["seasalt", "paste", "powder"].includes(i.id)));
  assert.ok(!L.some(i => (i.use || []).some(u => /fön/i.test(u) && !/fön(süz| yok| gerekmez)/i.test(u))), "fön gerektiren kullanım kalmadı");
  const br = L.find(i => i.id === "barber");
  assert.ok(br.links.length >= 3 && br.links.every(([n, u]) => n && /^https:\/\//.test(u)));
});

test("nereden alınır rehberi: güven sırasıyla en az 4 kanal, kaçınılacaklar listesi", () => {
  assert.ok(P.WHERE && P.WHERE.trust.length >= 4 && P.WHERE.avoid.length >= 3);
  assert.ok(P.WHERE.trust.every(w => w.name && w.why && w.for));
});

test("v10: sahip olunanlar listede yok; saç kremi var; pudra isteğe bağlı; yüz şişkinliği rehberi", () => {
  const L = P.MONTHS["2026-10"], own = new Set(P.OWNED.map(o => o.id));
  for (const m of Object.values(P.MONTHS)) assert.ok(!m.some(i => own.has(i.id)), "sahip olunan ürün listede");
  assert.ok(L.some(i => i.id === "conditioner" && !i.optional && (i.care || []).includes("hair")));
  assert.ok(P.PUFF && P.PUFF.tips.length >= 8 && P.PUFF.tips.every(t => t.t && t.ev));
  assert.ok(P.HAIRCARE && P.HAIRCARE.length >= 6);
  const total = L.filter(i => !i.optional).reduce((s, i) => s + i.priceTL, 0);
  assert.ok(total <= 16000, String(total));
});

test("v11/v12: sepetler mağazaya göre, her ürünün mağazası belli; sabah 10 dk planı", () => {
  const L = P.MONTHS["2026-10"];
  for (const i of L.filter(i => i.type === "urun")) assert.ok(["Kozvit", "Saçhane", "Zara", "Beymen", "Market"].includes(i.shop), i.id);
  const by = s => L.filter(i => i.shop === s && !i.optional).map(i => i.id).sort();
  assert.deepEqual(by("Kozvit"), ["cleanser", "moist", "spf"]);
  assert.deepEqual(by("Zara"), ["shampoo"]);
  assert.deepEqual(by("Beymen"), ["parfum"]);
  assert.deepEqual(by("Saçhane"), ["comedomed", "conditioner", "styler"]);
  assert.ok(P.SHOPS.Kozvit.url.startsWith("https://") && P.SHOPS["Saçhane"].url.startsWith("https://"));
  const m = P.MORNING10, sum = m.reduce((s, x) => s + x.min, 0);
  assert.ok(m.length >= 5 && sum <= 10, String(sum));
  assert.ok(m.some(x => /yüz|temiz/i.test(x.t)) && m.some(x => /saç/i.test(x.t)));
});

test("v12: sipariş listesi — kepek ilacı/sırt/antiperspirant yok, diş var, parfüm Extradose, yol haritası", () => {
  const L = P.MONTHS["2026-10"], ids = L.map(i => i.id);
  for (const x of ["dercos", "sirt", "antip"]) assert.ok(!ids.includes(x), x);
  assert.ok(ids.includes("toothpaste") && ids.includes("dentist"));
  const pf = L.find(i => i.id === "parfum");
  assert.match(pf.name, /Extradose/); assert.equal(pf.shop, "Beymen");
  assert.ok(P.PERFUMES.some(p => p.id === "extradose50") && P.PERFUMES.some(p => p.id === "lhi50"));
  assert.ok(P.ROADMAP.length >= 5 && P.ROADMAP.every(r => r.when && r.items.length >= 2));
  assert.equal(P.PRESET.hair.dandruff, false);
});
