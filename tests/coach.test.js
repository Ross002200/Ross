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
  assert.equal(K.todayTodos(base("2026-10-07")).find(t => t.kind === "shop").id, "shop:mhrs");
  const sonra = K.todayTodos(base("2026-10-07", { bought: { mhrs: "2026-10-07" } })).find(t => t.kind === "shop");
  assert.notEqual(sonra && sonra.id, "shop:mhrs");
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
