const test = require("node:test"), assert = require("node:assert/strict");
const K = require("../zenon-coach.js"), C = require("../zenon-care.js"), P = require("../zenon-plan.js");
const base = (date, extra = {}) => ({ date, care: C.buildDay({ issues: ["acne"] }, date, null, {}), careDone: {}, log: {}, todo: {},
  items: P.MONTHS["2026-10"], bought: {}, coachStart: "2026-10-01", seen: {}, doneMap: {}, ...extra });

test("boş log, ilk gün: koç çökmez, bilgi tonu", () => {
  const n = K.coachNote(base("2026-10-08", { coachStart: "2026-10-08" }));
  assert.equal(n.tone, "bilgi"); assert.ok(n.text.length > 10);
});

test("iki gün üst üste rutin yok → sert", () => {
  const doneMap = { "2026-10-06": { amAll: true, pmAll: true } };
  assert.equal(K.coachNote(base("2026-10-09", { doneMap })).tone, "sert");
});

test("7 gün seri → motive; güvenlik eşiği → bilgi ve uzmana yönlendirme", () => {
  const doneMap = {}; for (let i = 1; i <= 7; i++) doneMap[C.addDays("2026-10-15", -i)] = { amAll: true, pmAll: true };
  assert.equal(K.coachNote(base("2026-10-15", { doneMap })).tone, "motive");
  const log = {}; for (let i = 1; i <= 6; i++) log[C.addDays("2026-10-15", -i)] = { sleep: 5, mood: 2 };
  const n = K.coachNote(base("2026-10-15", { doneMap: {}, log }));
  assert.equal(n.tone, "bilgi"); assert.match(n.text, /doktor|uzman|diyetisyen/i);
});

test("cümle 10 gün tekrar etmez", () => {
  const seen = {};
  for (let i = 0; i < 10; i++) {
    const d = C.addDays("2026-10-20", i), n = K.coachNote(base(d, { seen }));
    assert.ok(!Object.values(seen).includes(n.id), n.id); seen[d] = n.id;
  }
});

test("yapılacaklar: Pazartesi Push, Perşembe ve Pazar kardiyo, Pazar değerlendirme, alınan madde görünmez", () => {
  assert.match(K.todayTodos(base("2026-10-12")).find(t => t.id === "workout").label, /Push/);
  assert.match(K.todayTodos(base("2026-10-15")).find(t => t.id === "workout").label, /Kardiyo/);
  const paz = K.todayTodos(base("2026-10-18"));
  assert.match(paz.find(t => t.id === "workout").label, /Kardiyo/);
  assert.ok(paz.some(t => t.id === "review"));
  assert.equal(K.todayTodos(base("2026-10-07")).find(t => t.kind === "shop").id, "shop:cleanser");   // isteğe bağlı maddeler öne çıkmaz
  const sonra = K.todayTodos(base("2026-10-07", { bought: { cleanser: "2026-10-07" } })).find(t => t.kind === "shop");
  assert.notEqual(sonra && sonra.id, "shop:cleanser");
});

test("haftalık değerlendirme ve protein hedefi", () => {
  const log = {}; for (let i = 0; i < 14; i++) log[C.addDays("2026-10-20", -i)] = { weight: 90 - 0.09 * (13 - i) };
  const w = K.weeklyReview(log, "2026-10-20");
  assert.ok(w.deltaKg < -0.5 && w.deltaKg > -0.7, String(w.deltaKg));
  assert.equal(w.verdict, "hedefte");
  assert.equal(K.proteinTarget({ "2026-10-20": { weight: 90 } }, "2026-10-20"), 150);
  assert.equal(K.proteinTarget({}, "2026-10-20"), 150);
});

test("her tonda en az 12 cümle, güvenlik cümleleri uzmana yönlendirir", () => {
  for (const t of ["sert", "motive", "sakaci", "bilgi"]) assert.ok(K.LINES[t].length >= 12, t);
  assert.ok(K.LINES.guvenlik.every(l => /doktor|uzman|diyetisyen/i.test(l.t)));
});

test("kilo iki hafta hedefin gerisinde ve adım < 6.000 → sert", () => {
  const log = {}, doneMap = {};
  for (let i = 0; i < 21; i++) { const d = C.addDays("2026-10-25", -i); log[d] = { weight: 90, steps: 4000, sleep: 7.5, mood: 4 }; doneMap[d] = { amAll: true, pmAll: true }; }
  const n = K.coachNote(base("2026-10-25", { log, doneMap }));
  assert.equal(n.tone, "sert"); assert.match(n.why, /kilo|adım/);
});

test("bakım profili yokken 'rutin yok' diye sert olunmaz", () => {
  assert.notEqual(K.coachNote(base("2026-10-09", { care: null })).tone, "sert");
});

/* ---------- Aşama A2 ---------- */
const full = { amAll: true, pmAll: true };
const dmOf = (days, misses) => { const m = {}; days.forEach(d => { if (!misses.includes(d)) m[d] = full; }); return m; };
const oct = n => `2026-10-${String(n).padStart(2, "0")}`;

test("bağışlayıcı seri: tek kaçırma joker, art arda iki kaçırma sıfırlar, 7 günde bir joker", () => {
  const days = [1, 2, 3, 4, 5, 6, 7].map(oct);
  assert.equal(K.forgivingStreak(dmOf(days, [oct(4)]), oct(7)), 6);
  assert.equal(K.forgivingStreak(dmOf(days, [oct(4), oct(5)]), oct(7)), 2);
  assert.equal(K.forgivingStreak(dmOf(days, [oct(2), oct(5)]), oct(7)), 4);
});

test("toparlanma maddesi: dün kaçtı, önceki gün tamdı", () => {
  const doneMap = { [oct(7)]: full };
  const t = K.todayTodos(base(oct(9), { doneMap }));
  assert.equal(t[0].id, "recovery");
  assert.ok(!K.todayTodos(base(oct(9), { doneMap: { [oct(7)]: full, [oct(8)]: full } })).some(x => x.id === "recovery"));
});

test("pazartesi plan maddesi ve etkinlik görevleri doğru günde", () => {
  assert.ok(K.todayTodos(base("2026-10-12", { ifthen: [] })).some(t => t.id === "ifthen"));
  const ev = [{ id: "e1", type: "date", date: "2026-10-17", title: "Akşam yemeği" }];
  const g = d => K.todayTodos(base(d, { events: ev })).filter(t => t.kind === "event");
  assert.ok(g("2026-10-10").some(t => /berber/i.test(t.label)));           // T-7
  assert.ok(g("2026-10-17").some(t => /parfüm/i.test(t.label)));           // T-0
  assert.equal(g("2026-10-18").length, 0);                                  // etkinlikten sonra yok
});

test("öğün planı protein hedefini tutar ve ertesi gün aynı öğünü tekrarlamaz", () => {
  for (let i = 0; i < 10; i++) {
    const d = C.addDays("2026-10-10", i), a = K.mealPlan(150, d), b = K.mealPlan(150, C.addDays(d, 1));
    assert.ok(a.protein >= 150, `${d} ${a.protein}`);
    for (const slot of ["kahvalti", "ogle", "aksam"]) assert.notEqual(a.bySlot[slot], b.bySlot[slot], `${d} ${slot}`);
  }
  const m = K.marketList("2026-10-12", 7, 150);
  assert.ok(Object.keys(m).length >= 3 && Object.values(m).every(g => g.length));
});

test("beden kontrolü eşiği ve haftalık paylaşım metni", () => {
  assert.equal(K.bodyCheckResult([1, 1, 1, 1, 1]).flag, false);
  assert.equal(K.bodyCheckResult([2, 2, 2, 1, 1]).flag, true);
  assert.equal(K.bodyCheckResult([0, 0, 0, 3, 0]).flag, true);
  const log = {}; for (let i = 0; i < 14; i++) log[C.addDays("2026-10-20", -i)] = { weight: 90 - 0.09 * (13 - i), sleep: 7, steps: 9000 };
  const t = K.weeklyShareText(log, {}, "2026-10-20", { showWeight: false });
  assert.match(t, /Zenon/); assert.doesNotMatch(t, /kg/);
  assert.match(K.weeklyShareText(log, {}, "2026-10-20", { showWeight: true }), /kg/);
});

test("eğer-o zaman: aktif planlardan tarihle seçim", () => {
  const plans = [{ id: "a", if: "x", then: "y", active: true }, { id: "b", if: "p", then: "q", active: false }];
  assert.equal(K.pickIfThen(plans, "2026-10-12").id, "a");
  assert.equal(K.pickIfThen([], "2026-10-12"), null);
});

/* ---------- A2 gözden geçirme düzeltmeleri ---------- */
test("yalnız adım içeren kayıt check-in sayılmaz", () => {
  const log = { "2026-10-14": { steps: 9000, stepsAuto: true } };
  assert.equal(K.isCheckin(log["2026-10-14"]), false);
  assert.equal(K.isCheckin({ ci: true, steps: 9000 }), true);
  assert.equal(K.todayTodos(base("2026-10-14", { log })).find(t => t.id === "checkin").done, false);
});

test("öğün: 400 gün boyunca aynı öğün ardışık günde tekrar etmez; 160 g hedefi tutulur", () => {
  for (let i = 0; i < 400; i++) {
    const d = C.addDays("2026-09-01", i), a = K.mealPlan(160, d), b = K.mealPlan(160, C.addDays(d, 1));
    for (const s of ["kahvalti", "ogle", "aksam"]) assert.notEqual(a.bySlot[s], b.bySlot[s], `${d} ${s}`);
    assert.ok(a.protein >= 160, `${d} ${a.protein}`);
  }
});

test("seri: kaçırılmış tarihle çağrılınca joker harcanmadan atlanmaz", () => {
  const dm = {}; for (let i = 1; i <= 30; i++) if (i !== 26 && i !== 29) dm[oct(i)] = full;
  assert.equal(K.forgivingStreak(dm, oct(29)), 0);
  const bekleyen = { ...dm }; delete bekleyen[oct(30)];
  assert.equal(K.forgivingStreak(bekleyen, oct(30), true), 0);    // bugün bekliyor → dün (29) kaçık → 0
  assert.equal(K.forgivingStreak(dm, oct(30)), 3);                  // 30,28,27; 26 ikinci joker olamaz (3 gün)
  assert.equal(K.forgivingStreak(dm, oct(28)), 27);                 // 28,27 + joker 26 + 25…1
});

test("sabah metni: toparlanma ve etkinlik önce gelir", () => {
  const todos = [{ id: "workout", label: "Push günü", done: false }, { id: "steps", label: "8.000+ adım", done: false },
    { id: "protein", label: "150 g protein", done: false }, { id: "ev:e1:0", kind: "event", label: "Berber randevusu al", done: false },
    { id: "recovery", kind: "recovery", label: "Toparlanma: bugün kaçırma", done: false }];
  const t = K.morningText(todos);
  assert.match(t, /^1\) Toparlanma/); assert.match(t, /Berber/);
});

test("hafta sonu geç kalkış notu (bilgi tonu)", () => {
  const profile = { times: { weekday: { wake: "07:30" }, weekend: { wake: "10:30" } } };
  const n = K.coachNote(base("2026-10-08", { coachStart: "2026-10-08", profile }));
  assert.equal(n.tone, "bilgi"); assert.match(n.text, /kalk/i);
});

test("sıradaki adımlar: alınmamış, isteğe bağlı olmayan, hafta ve önceliğe göre", () => {
  const items = [{ id: "a", week: 2, priority: 1, name: "A", priceTL: 10, how: ["a1"] }, { id: "b", week: 1, priority: 5, name: "B", priceTL: 20, how: ["b1"] },
    { id: "c", week: 1, priority: 2, name: "C", priceTL: 30, how: ["c1"] }, { id: "d", week: 1, priority: 1, optional: true, name: "D", priceTL: 1, how: ["d1"] }];
  const s = K.nextSteps(items, { c: "2026-10-08" }, 2);
  assert.deepEqual(s.map(x => x.id), ["b", "a"]);
  assert.equal(s[0].first, "b1");
  assert.equal(K.nextSteps(items, { a: 1, b: 1, c: 1 }).length, 0);
});

test("kreatin alındıysa her gün yapılacaklarda; alınmadıysa yok", () => {
  assert.ok(!K.todayTodos(base("2026-11-03")).some(t => t.id === "kreatin"));
  const t = K.todayTodos(base("2026-11-03", { owned: ["kreatin"], todo: { kreatin: true } })).find(x => x.id === "kreatin");
  assert.ok(t && /3/.test(t.label) && t.done === true);
});

/* ---------- v7: saat aralıkları, tahlil, antrenman kaydı, günün kokusu ---------- */
test("gün planı: görevler saat aralıklarına dağılır; müsait saat esnek görevleri taşır", () => {
  const prof = { times: { weekday: { wake: "07:30", sleep: "23:30" }, weekend: { wake: "09:30", sleep: "00:30" }, gymDays: [1], gym: "18:00" } };
  const todos = K.todayTodos(base("2026-10-12", { profile: prof }));
  const w = K.dayPlan(todos, prof, "2026-10-12", null);
  const where = id => w.find(x => x.items.some(t => t.id === id));
  assert.equal(where("am").id, "sabah");
  assert.equal(where("pm").id, "aksam");
  assert.equal(where("workout").id, "musait");
  assert.equal(where("musait") , undefined);
  assert.equal(w.find(x => x.id === "sabah").from, "07:30");
  assert.equal(w.find(x => x.id === "musait").from, "17:30");                 // gym 18:00, 30 dk önce
  const w2 = K.dayPlan(todos, prof, "2026-10-12", { from: "12:00", to: "14:00" });
  const m = w2.find(x => x.id === "musait");
  assert.deepEqual([m.from, m.to], ["12:00", "14:00"]);
  assert.ok(w2.every((x, i) => i === 0 || w2[i - 1].from <= x.from));        // saate göre sıralı
  const all = w2.flatMap(x => x.items.map(t => t.id)).sort();
  assert.deepEqual(all, todos.map(t => t.id).sort());                        // hiçbir görev kaybolmaz
  assert.equal(K.nowWindow(w2, 13 * 60).id, "musait");
});

test("tahlil yorumu: D vitamini, ferritin, B12 eşikleri", () => {
  assert.equal(K.labStatus("d3", 12).level, "dusuk");
  assert.equal(K.labStatus("d3", 25).level, "sinirda");
  assert.equal(K.labStatus("d3", 40).level, "normal");
  assert.equal(K.labStatus("ferritin", 20).level, "dusuk");
  assert.equal(K.labStatus("b12", 180).level, "dusuk");
  assert.match(K.labStatus("d3", 12).advice, /doktor/i);
  assert.equal(K.labStatus("yok", 5), null);
});

test("antrenman kaydı: tüm setler üst tekrara ulaşınca ağırlık artar, yoksa tekrar artar", () => {
  assert.deepEqual(K.liftNext({ kg: 60, reps: [10, 10, 10], range: [8, 10], step: 2.5 }), { kg: 62.5, reps: 8, why: "artir" });
  assert.deepEqual(K.liftNext({ kg: 60, reps: [10, 9, 8], range: [8, 10], step: 2.5 }), { kg: 60, reps: 10, why: "tekrar" });
  assert.equal(K.liftNext({ kg: 60, reps: [6, 5, 5], range: [8, 10], step: 2.5 }).why, "dus");
});

test("günün kokusu: soğukta tatlı/ağır, sıcakta hafif; etkinlikte gece kokusu; sahip olunan yoksa null", () => {
  const owned = ["zara-ebony-elixir", "tmwi-beymen"];
  assert.equal(K.scentOfDay(owned, { temp: 8 }, null, "2026-10-12").id, "tmwi-beymen");
  assert.equal(K.scentOfDay(owned, { temp: 27 }, null, "2026-10-12").id, "zara-ebony-elixir");
  assert.equal(K.scentOfDay(owned, { temp: 20 }, "date", "2026-10-12").id, "tmwi-beymen");
  assert.equal(K.scentOfDay([], { temp: 10 }, null, "2026-10-12"), null);
  assert.ok(K.scentOfDay(owned, { temp: 8 }, null, "2026-10-12").sprays >= 1);
});

test("yüz şişkinliği: sabah şişkinse dünkü uyku/tuz/alkol nedenleri ve ipucu döner", () => {
  const log = { "2026-10-13": { sleep: 5.5, note: "akşam döner ve bira" }, "2026-10-14": { puff: 2 } };
  const a = K.puffAdvice(log, "2026-10-14");
  assert.equal(a.level, 2);
  assert.ok(a.reasons.some(r => /uyku/i.test(r)) && a.reasons.some(r => /tuz/i.test(r)) && a.reasons.some(r => /alkol/i.test(r)));
  assert.ok(a.tips.length >= 2);
  assert.equal(K.puffAdvice({ "2026-10-14": { puff: 0 } }, "2026-10-14"), null);
  const full = { amAll: true, pmAll: true }, n = K.coachNote(base("2026-10-14", { log, coachStart: "2026-10-01", doneMap: { "2026-10-12": full, "2026-10-13": full } }));
  assert.match(n.text, /şiş/i);
});
