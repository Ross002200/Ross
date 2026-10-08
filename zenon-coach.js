/* Zenon 師 Koç · kural tabanlı koç motoru: günün yapılacakları, koçun notu (sert / motive / şakacı / bilgi),
   haftalık değerlendirme. Saf fonksiyonlar (DOM ve ağ yok). Tarayıcıda window.ZenonCoach, node'da require().
   Kanıt notları: kendini izleme + raporlama (Harkin 2016), "iki kez kaçırma" (Lally 2010), kilo kaybı ~%0,7/hafta
   (Garthe 2011), protein ~1,6–2 g/kg (ISSN), uyku ve görünüş (Axelsson 2010, Sundelin 2013). */
(function (root) {
"use strict";
const node = typeof module === "object" && module.exports;
const ZC = node ? require("./zenon-care.js") : root.ZenonCare;
const ZP = node ? require("./zenon-plan.js") : root.ZenonPlan;
const { addDays, daysBetween } = ZC;
const wdOf = d => new Date(d + "T12:00").getDay();
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
/* Yalnız otomatik adım içeren kayıt check-in değildir (adım senkronu). */
const isCheckin = e => !!e && (e.ci === true || Object.keys(e).some(k => k !== "steps" && k !== "stepsAuto"));
function vals(log, date, from, n, key) {
  const o = [];
  for (let i = from; i < from + n; i++) { const e = log[addDays(date, -i)]; if (e && e[key] != null && e[key] !== "") o.push(+e[key]); }
  return o;
}

/* ---------- vücut ---------- */
function avgWeight(log, date, from = 0, n = 7) { const a = vals(log || {}, date, from, n, "weight"); return a.length ? mean(a) : null; }
function lastWeight(log, date) {
  for (let i = 0; i < 60; i++) { const e = (log || {})[addDays(date, -i)]; if (e && +e.weight > 0) return +e.weight; }
  return null;
}
function proteinTarget(log, date) { return Math.round((lastWeight(log, date) || 90) * 1.7 / 10) * 10; }
function weeklyReview(log, date) {
  log = log || {};
  const wA = vals(log, date, 0, 7, "weight"), wB = vals(log, date, 7, 7, "weight");
  const avg = wA.length ? mean(wA) : null, prev = wB.length ? mean(wB) : null;
  const deltaKg = wA.length >= 3 && wB.length >= 3 ? Math.round((avg - prev) * 100) / 100 : null;
  const sleepAvg = mean(vals(log, date, 0, 7, "sleep")), stepsAvg = mean(vals(log, date, 0, 7, "steps"));
  const moodAvg = mean(vals(log, date, 0, 7, "mood"));
  const checkins = Array.from({ length: 7 }, (_, i) => log[addDays(date, -i)]).filter(isCheckin).length;
  let verdict = null;
  if (deltaKg != null) verdict = deltaKg <= -0.3 && deltaKg >= -0.9 ? "hedefte" : deltaKg > -0.3 ? "yavaş" : "fazla hızlı";
  const actions = [];
  if (verdict === "yavaş") actions.push("Günde ~200 kcal azalt ya da 2.000 adım ekle; iki hafta böyle giderse tekrar bakarız.");
  if (verdict === "fazla hızlı") actions.push("Biraz daha ye: kas kaybetmeyelim, hedef haftada ~0,6 kg.");
  if (sleepAvg != null && sleepAvg < 7) actions.push("Kalkış saatini her gün aynı tut, yatmadan 1 saat önce ekranı bırak.");
  if (stepsAvg != null && stepsAvg < 8000) actions.push("Adımı 8.000'e çıkar: ders aralarında 10 dakikalık yürüyüş.");
  if (checkins < 5) actions.push("Check-in'i en az 5 gün yap: ölçmediğini yönetemezsin.");
  return { avg, prev, deltaKg, targetKg: -0.6, sleepAvg, stepsAvg, moodAvg, checkins, verdict, actions };
}

/* ---------- günün yapılacakları ---------- */
function workoutFor(date) {
  const wd = wdOf(date), d = ZP.PROGRAM.days[wd];
  if (d) return { label: `${d.focus} günü`, kind: "gym",
    detail: d.ex.slice(0, 3).map(e => `${e.name} ${e.sets} set`).join(" · ") + (d.ex.length > 3 ? ` +${d.ex.length - 3} hareket` : "") };
  const c = ZP.PROGRAM.cardio[wd];
  if (c) return { label: `Kardiyo · ${c} dk Zone 2`, kind: "cardio", detail: "Konuşabileceğin tempoda: eğimli yürüyüş ya da bisiklet." };
  return { label: "Dinlenme · 8.000 adım yürüyüş", kind: "rest", detail: "Aktif dinlenme: hafif yürüyüş ve esneme." };
}
function monthItems(ctx) { return ctx.items || ZP.MONTHS[ctx.date.slice(0, 7)] || []; }
function todayTodos(ctx) {
  const { date } = ctx, log = ctx.log || {}, e = log[date] || {}, t = ctx.todo || {}, cd = ctx.careDone || {}, care = ctx.care;
  const p = proteinTarget(log, date), w = workoutFor(date), out = [];
  const dm = ctx.doneMap || {}, full = d => dm[d] && dm[d].amAll && dm[d].pmAll;
  if (care && !full(addDays(date, -1)) && full(addDays(date, -2)))
    out.push({ id: "recovery", kind: "recovery", label: "Toparlanma: bugün kaçırma", detail: "Dün olmadı, sorun değil. İki gün üst üste kaçırmıyoruz: sabah ve akşam rutini.", done: !!(cd.amAll && cd.pmAll) });
  out.push({ id: "am", kind: "care", label: "Sabah rutini", detail: care ? `${care.am.length} adım · Bakım sekmesinde` : "Önce bakım profilini doldur", done: !!cd.amAll });
  out.push({ id: "workout", kind: w.kind, label: w.label, detail: w.detail, done: !!(t.workout || e.workout) });
  out.push({ id: "steps", kind: "body", label: "8.000+ adım", detail: "Telefonunun sağlık uygulamasından bak, check-in'e yaz.", done: !!(t.steps || +e.steps >= 8000) });
  out.push({ id: "protein", kind: "body", label: `${p} g protein`, detail: "Yumurta, yoğurt, lor, tavuk, ton balığı, mercimek.", done: !!(t.protein || +e.protein >= p) });
  if ((ctx.bought || {}).kreatin) out.push({ id: "kreatin", kind: "body", label: "Kreatin 3–5 g", detail: "Her gün, saat fark etmez; suya ya da yoğurda karıştır.", done: !!t.kreatin });
  out.push({ id: "pm", kind: "care", label: "Akşam rutini",
    detail: care ? `${care.pm.length} adım` + (care.active ? ` · ${care.active === "retinoid" ? "retinoid" : "BHA"} gecesi` : "") : "", done: !!cd.pmAll });
  out.push({ id: "checkin", kind: "checkin", label: "Check-in", detail: "60 saniye: uyku, kilo, adım, protein, cilt, ruh hali.", done: isCheckin(log[date]) });
  const wk = Math.floor((+date.slice(8) - 1) / 7) + 1, bought = ctx.bought || {};
  const shop = monthItems(ctx).filter(i => !i.optional && (i.week || 1) <= wk && !bought[i.id]).sort((a, b) => a.priority - b.priority)[0];
  if (shop) out.push({ id: "shop:" + shop.id, kind: "shop", label: shop.name, detail: `${shop.priceTL.toLocaleString("tr-TR")} TL · ${shop.where}`, done: false });
  if (wdOf(date) === 1 && (ctx.ifthen || []).filter(x => x.active !== false).length < 2)
    out.push({ id: "ifthen", kind: "plan", label: "Haftanın 2–3 'eğer–o zaman' planını yaz", detail: "Takip → Planlarım. Örnek: Eğer ders geç biterse → 18:30'da salondayım.", done: !!t.ifthen });
  for (const ev of ctx.events || []) {
    const off = daysBetween(date, ev.date), tpl = (ZP.EVENTS || {})[ev.type] || (ZP.EVENTS || {}).diger;
    if (!tpl || off < 0 || off > 7) continue;
    tpl.tasks.forEach((tk, i) => { if (tk.off === off) { const id = `ev:${ev.id}:${i}`;
      out.push({ id, kind: "event", label: tk.label, detail: `${ev.title || tpl.name} · ${off === 0 ? "bugün" : off + " gün kaldı"}`, done: !!t[id] }); } });
  }
  if (wdOf(date) === 0) out.push({ id: "review", kind: "review", label: "Haftalık değerlendirme", detail: "10 dakika: kilo ortalaması, uyku, uyum. Takip sekmesinde.", done: !!t.review });
  const ds = ctx.coachStart ? daysBetween(ctx.coachStart, date) : null;
  if (ds != null && ds >= 0 && (ds === 14 || ds % 30 === 0))
    out.push({ id: "photo", kind: "photo", label: "İlerleme fotoğrafı", detail: "Gün ışığında, 1,5 m uzaktan; önden ve iki yandan, hep aynı açı.", done: !!t.photo });
  return out;
}

/* ---------- koçun sesi ---------- */
const L = (p, arr) => arr.map((t, i) => ({ id: p + (i + 1), t }));
const LINES = {
  sert: L("ser", [
    "İki gündür rutin yok. Bahaneyi duydum, şimdi lavaboya: 3 dakika, hepsi bu.",
    "Cildin seni beklemiyor. Bu akşam temizleyici, nemlendirici, yatak. Pazarlık yok.",
    "Dün de olmadı, önceki gün de. Üçüncüye izin vermiyoruz. Bugün tek hedef: akşam rutini.",
    "Motivasyon gelmesini bekleme, gelmeyecek. Disiplin gelir, o da sen başlayınca.",
    "Ürünler dolapta durarak işe yaramıyor. Kapağını aç.",
    "Bir günü kaçırmak normal, iki günü kaçırmak alışkanlığın başlangıcı. Bu gece zinciri geri tak.",
    "Aynadaki adam iki gündür ihmal ediliyor. O da sensin.",
    "Hedefini sen koydun, ben sadece hatırlatıyorum: bugün sabah ve akşam rutini, ikisi de.",
    "Check-in yapmadan koçluk olmaz. 60 saniye ayır, sonra konuşalım.",
    "Yorgunsan kısa rutini yap: temizle, nemlendir. Sıfır yapmak yok.",
    "Bu hafta kendine verdiğin sözü tutmadın. Bugün tutarsan hafta yine senin.",
    "Spor salonunda set kaçırmıyorsun, lavaboda neden kaçırıyorsun? Aynı disiplin.",
    "Ertelediğin her gün sonucu bir gün öteliyor. Bugünü kaybetme."
  ]),
  motive: L("mot", [
    "{streak} gün seri. Ayna bunu fark etmeye başladı bile.",
    "{streak} gündür eksiksizsin. Alışkanlık böyle kurulur: sessizce, her gün.",
    "Seri {streak} gün. Çoğu insan üçüncü günde bırakır; sen bırakmadın.",
    "Kilo trendi hedefte. Yüzün bunu herkesten önce gösterecek.",
    "{streak} gün. Bu artık bir deneme değil, bir kimlik: bakımlı adam.",
    "Tutarlılık yeteneği yener. Şu an tam olarak bunu yapıyorsun.",
    "Haftalık ortalama düşüyor, ritim doğru. Hızlanma, aynı tempoda devam.",
    "{streak} gün seri. Bugün de yap, yarın kendine teşekkür edersin.",
    "Fotoğraflar yalan söylemez: 14. günde farkı sen de göreceksin.",
    "Disiplinin işliyor. Ödülün bu akşam: rutini yap ve erken uyu.",
    "Hedefe göre gidiyorsun. Şimdi sıkıcı kısmı koru: aynı şeyi her gün.",
    "{streak} gündür kendine verdiğin sözü tutuyorsun. Bunun adı karakter.",
    "Bu tempoyla bir ay sonra insanlar 'ne yaptın?' diye soracak."
  ]),
  sakaci: L("sak", [
    "Cildin bugün senden daha disiplinli, rekabet et.",
    "Retinoid gecesi: yüzün rahat uyusun diye sen de erken uyu. Takım oyunu.",
    "Protein hedefi: tavuğa ve yoğurda 'kardeşim' diye hitap etme zamanı.",
    "Sakal çizgin bu kadar netken hayatın da net olsun: odanı topla.",
    "Su iç. Böbreklerin sana kalp emojisi yolluyor.",
    "Bugünkü misyon: aynaya bakıp 'fena değilmiş' demek. Kanıtı rutinde.",
    "Saç kili yalnız saça. Alnın şikâyetçi olmasın.",
    "Bench Press'te bir set fazla, Instagram'da bir dakika eksik. Takas mantıklı.",
    "Uyku senin ücretsiz glow-up kremin. Bu gece iki kat sür.",
    "Parfüm: 2 sprey. Üçüncüsü asansördekiler için ceza.",
    "Bugün o kadar iyi gidiyorsun ki rakiplerine haksızlık oluyor.",
    "Dişlerine de rutin var: ipini kullan, gülüşün teşekkür eder."
  ]),
  bilgi: L("bil", [
    "Yüzdeki yağ ayrıca eritilmez: toplam yağ düşünce önce yüz incelir. Başkaları farkı ~4 kg'da fark etmeye başlıyor.",
    "Sabah şişliğinin en güçlü sebebi uykusuzluk. 7–9 saat ve her gün aynı kalkış saati.",
    "Tuzu yasaklama, sabit tut: günden güne büyük oynamalar şişliği değiştirir.",
    "İlerlemeyi 30 cm'lik selfie'ye bakıp ölçme: yakın çekim burnu ~%30 geniş gösterir. 1,5 m uzaktan çek.",
    "Mewing ve çene aletlerinin kanıtı yok; sert sakız çene kasını büyütüp yüzü genişletebilir.",
    "Kilonu tek güne değil 7 günlük ortalamaya göre değerlendir; günlük oynama sudur.",
    "Protein kası korur: kilo verirken günde ~150 g hedefle, öğünlere böl.",
    "Haftada her kas için en az 10 zorlayıcı set büyümeyi destekler; göğüs ve omzuna set ekle.",
    "SPF olmadan leke kremi boşa gider: izlerin en büyük düşmanı güneş.",
    "Retinoid ilk haftalarda cildi kötüleşmiş gibi gösterebilir; sonucu 8–12 haftada değerlendir.",
    "Boynu jiletle sıfıra alma: 0,5–1 mm makine batık kılı en çok azaltan değişiklik.",
    "Uykusuz yüzler çalışmalarda belirgin şekilde daha yorgun ve daha az çekici bulundu. Uyku glow-up'ın temeli.",
    "Dik duruş ve açık beden dili flört deneylerinde olumlu yanıtı belirgin artırdı; omuzlarını geri al.",
    "Antiperspiranı geceleri kuru koltuk altına sür, sabah daha etkili olur."
  ]),
  toparlanma: L("top", [
    "Dün olmadı. Bir kez insanlık, iki kez alışkanlık: bugün zinciri geri tak.",
    "Kaçırılan bir gün seriyi bozmaz; ikinci gün bozar. Bugün senin günün.",
    "Dünü düşünme, bugünün ilk adımı lavabo: 2 dakika.",
    "Araştırma net: tek kaçırma alışkanlığı öldürmez. Bugün yaparsan hiçbir şey kaybetmedin.",
    "Joker hakkını kullandın. Şimdi ödemesini yap: sabah ve akşam rutini, ikisi de."
  ]),
  guvenlik: L("guv", [
    "Son günlerde uykun ya da moralin düşük görünüyor. Bu bir glow-up meselesi değil; birkaç gün böyle devam ederse bir doktorla ya da uzmanla konuş.",
    "Kilo çok hızlı gidiyor; bu kas kaybı ve yorgunluk demek. Biraz daha ye ve bir diyetisyen ya da doktorla konuş.",
    "Kendini zorlama dönemi değil, toparlanma dönemi. Uykuyu öne al; kötü hissetmeye devam edersen bir uzmanla konuş."
  ])
};

function recentHas(seen, date, id) { return Object.entries(seen || {}).some(([d, x]) => x === id && daysBetween(d, date) > 0 && daysBetween(d, date) <= 10); }
function coachNote(ctx) {
  const { date } = ctx, log = ctx.log || {}, dm = ctx.doneMap || {}, seen = ctx.seen || {}, start = ctx.coachStart || date;
  const done = d => dm[d] && dm[d].amAll && dm[d].pmAll;
  const y1 = addDays(date, -1), y2 = addDays(date, -2);
  const missed = !!ctx.care && [y1, y2].every(d => daysBetween(start, d) >= 0 && !done(d));
  const anyLog = Object.values(log).some(isCheckin);
  const noCheckin = anyLog && [1, 2, 3].every(i => !isCheckin(log[addDays(date, -i)])) && daysBetween(start, date) >= 3;
  const sl = vals(log, date, 1, 7, "sleep"), md = vals(log, date, 1, 7, "mood");
  const w1 = weeklyReview(log, date), w2 = weeklyReview(log, addDays(date, -7)), bw = lastWeight(log, date) || 90;
  const fastLoss = w1.deltaKg != null && w2.deltaKg != null && -w1.deltaKg > bw * 0.01 && -w2.deltaKg > bw * 0.01;
  const lowSleep = sl.length >= 4 && mean(sl) < 6, lowMood = md.length >= 4 && mean(md) <= 2;
  const streak = forgivingStreak(dm, y1);
  const recovering = !!ctx.care && !done(y1) && done(y2);
  const recentPlayful = Object.entries(seen).filter(([d, id]) => { const n = daysBetween(d, date); return n > 0 && n <= 7 && String(id).startsWith("sak"); }).length;
  let tone, why;
  if (lowSleep || lowMood || fastLoss) { tone = "guvenlik"; why = lowSleep ? "uyku ortalaması 6 saatin altında" : lowMood ? "ruh hali düşük" : "kilo kaybı haftada %1'in üstünde"; }
  else if (missed) { tone = "sert"; why = "iki gündür rutin tamamlanmadı"; }
  else if (noCheckin) { tone = "sert"; why = "3 gündür check-in yok"; }
  else if (w1.verdict === "yavaş" && w2.verdict === "yavaş" && w1.stepsAvg != null && w1.stepsAvg < 6000) {
    tone = "sert"; why = "kilo iki haftadır hedefin gerisinde ve adım ortalaması 6.000'in altında"; }
  else if (recovering) { tone = "toparlanma"; why = "dün kaçtı, önceki gün tamdı"; }
  else if ([3, 7, 14, 21, 30, 45, 60, 90].includes(streak)) { tone = "motive"; why = `${streak} gün seri`; }
  else if (w1.verdict === "hedefte") { tone = "motive"; why = "haftalık kilo hedefte"; }
  else if (streak >= 2 && hash(date) % 3 === 0 && recentPlayful < 2) { tone = "sakaci"; why = "iyi gidiyorsun"; }
  else { tone = "bilgi"; why = "günün bilgisi"; }
  const recent = new Set(Object.entries(seen).filter(([d]) => { const n = daysBetween(d, date); return n > 0 && n <= 10; }).map(([, id]) => id));
  if (tone === "bilgi" && ctx.profile && ctx.profile.times && !recentHas(seen, date, "bil-kalkis")) {
    const tm = x => { const [h, m] = String(x || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
    const t = ctx.profile.times, diff = tm((t.weekend || {}).wake) - tm((t.weekday || {}).wake);
    if (diff > 60) return { tone: "bilgi", id: "bil-kalkis", why: "hafta sonu kalkış farkı",
      text: `Hafta sonu kalkışın hafta içinden ${Math.round(diff / 60 * 10) / 10} saat geç. Bu 'sosyal jet lag' uykunu ve sabah yüzünü bozar: farkı 1 saatin altına indir.` };
  }
  let pool = LINES[tone];
  if (tone === "motive" && streak < 2) pool = pool.filter(l => !l.t.includes("{streak}"));
  const fresh = pool.filter(l => !recent.has(l.id)), list = fresh.length ? fresh : pool;
  const pick = list[hash(date + tone) % list.length];
  return { tone: tone === "guvenlik" ? "bilgi" : tone === "toparlanma" ? "motive" : tone, id: pick.id, text: pick.t.replace(/\{streak\}/g, String(streak)), why };
}

/* ---------- bağışlayıcı seri: tek kaçırma (iki yanı tam) joker, 7 günde bir; iki kaçırma sıfırlar ---------- */
function forgivingStreak(dm, date, todayPending = false) {
  dm = dm || {};
  const full = d => dm[d] && dm[d].amAll && dm[d].pmAll;
  if (!full(date) && !todayPending) return 0;   // kaçırılmış bir günden geriye seri sayılmaz (joker sağı tam gün ister)
  let d = full(date) ? date : addDays(date, -1), n = 0, joker = null;
  for (let i = 0; i < 400; i++) {
    if (full(d)) { n++; d = addDays(d, -1); continue; }
    const prev = addDays(d, -1), next = addDays(d, 1);
    if (n > 0 && full(prev) && full(next) && (joker === null || daysBetween(d, joker) >= 7)) { joker = d; d = prev; continue; }
    break;
  }
  return n;
}

/* ---------- beslenme ---------- */
const SLOTS = ["kahvalti", "ogle", "aksam"];
/* Gün sırasına göre döngü: ardışık iki günde aynı öğün imkânsız (her öğünde ≥ 3 seçenek). */
function pickMeal(slot, date) {
  const list = ZP.MEALS.filter(m => m.slot === slot), n = list.length, day = daysBetween("2026-01-01", date);
  return list[(((day + hash(slot)) % n) + n) % n];
}
function mealPlan(target, date) {
  const meals = SLOTS.map(s => pickMeal(s, date));
  const snacks = ZP.MEALS.filter(m => m.slot === "ara").sort((a, b) => b.protein - a.protein);
  let protein = meals.reduce((t, m) => t + m.protein, 0), k = hash(date) % snacks.length, tries = 0;
  while (protein < target && tries++ < snacks.length) { const sn = snacks[k++ % snacks.length]; if (meals.includes(sn)) continue; meals.push(sn); protein += sn.protein; }
  return { meals, protein, kcal: meals.reduce((t, m) => t + m.kcal, 0), cost: meals.reduce((t, m) => t + m.cost, 0),
    bySlot: Object.fromEntries(SLOTS.map((s, i) => [s, meals[i].id])), shortBy: Math.max(0, target - protein) };
}
function marketList(start, days, target) {
  const sum = {};
  for (let i = 0; i < days; i++) for (const m of mealPlan(target, addDays(start, i)).meals) for (const it of m.items) {
    const k = it.name + "|" + it.unit; sum[k] = sum[k] || { name: it.name, unit: it.unit, qty: 0, cat: it.cat }; sum[k].qty += it.qty; }
  const groups = {};
  for (const v of Object.values(sum)) (groups[v.cat] = groups[v.cat] || []).push(v);
  for (const g of Object.values(groups)) g.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  return groups;
}

/* ---------- beden algısı öz kontrolü ---------- */
function bodyCheckResult(answers) {
  const a = (answers || []).map(x => +x || 0), total = a.reduce((t, x) => t + x, 0), flag = total >= 8 || a[3] === 3;
  return { total, flag, message: flag
    ? "Görünüşünle ilgili düşünceler sana yük oluyor gibi görünüyor. Bu bir glow-up sorunu değil; bir psikolog ya da psikiyatristle konuşmak gerçekten iyi gelir. Kendine zarar verme düşüncen olursa hemen 112'yi ara."
    : "Dengelisin. Hedefin kendine iyi bakmak; kusursuz görünmek değil." };
}

/* ---------- haftalık paylaşım metni ---------- */
function weeklyShareText(log, doneMap, date, opts = {}) {
  const w = weeklyReview(log, date), f = (x, d = 1) => x == null ? "—" : x.toFixed(d).replace(".", ",");
  let full = 0; for (let i = 1; i <= 7; i++) { const x = (doneMap || {})[addDays(date, -i)]; if (x && x.amAll && x.pmAll) full++; }
  const lines = [`Zenon · haftalık özet (${date.slice(8)}.${date.slice(5, 7)})`, `Rutin: ${full}/7 gün · seri ${forgivingStreak(doneMap, addDays(date, -1))} gün`,
    `Uyku ort.: ${f(w.sleepAvg)} sa · adım ort.: ${w.stepsAvg == null ? "—" : Math.round(w.stepsAvg).toLocaleString("tr-TR")}`];
  if (opts.showWeight && w.deltaKg != null) lines.push(`Kilo: ${w.deltaKg > 0 ? "+" : ""}${f(w.deltaKg, 2)} kg/hafta (hedef −0,6)`);
  lines.push(`Bu hafta hedefim: ${w.actions[0] || "aynı tempoda devam"}`);
  return lines.join(String.fromCharCode(10));
}

const MORNING_ORDER = ["recovery", "event", "gym", "cardio", "rest", "shop", "body", "plan", "review", "photo"];
function morningText(todos) {
  const rank = t => { const k = t.id === "recovery" ? "recovery" : t.kind; const i = MORNING_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  return (todos || []).filter(t => !t.done && t.id !== "checkin" && t.id !== "am" && t.id !== "pm")
    .sort((a, b) => rank(a) - rank(b)).slice(0, 3).map((t, j) => `${j + 1}) ${t.label}`).join(" ");
}
/* ---------- v7: saat aralıkları, tahlil, antrenman, günün kokusu ---------- */
const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const WIN_OF = t => ["am", "recovery", "kreatin", "ifthen"].includes(t.id) ? "sabah"
  : ["pm", "checkin"].includes(t.id) ? "aksam"
  : (t.id === "workout" || t.kind === "shop" || t.kind === "event" || t.id === "review") ? "musait" : "gun";
/* Görevleri saat aralıklarına dağıtır. avail: {from:"HH:MM", to:"HH:MM"} bugün müsait olduğun aralık (yoksa spor saati). */
function dayPlan(todos, profile, date, avail) {
  const p = ZC.normProfile(profile), { wake, sleep } = ZC.dayTimes(p, date), gym = ZC.toMin(p.times.gym);
  const mf = avail ? ZC.toMin(avail.from) : gym - 30, mt = avail ? ZC.toMin(avail.to) : gym + 90;
  const W = { sabah: ["Sabah", wake, wake + 120], gun: ["Gün boyu", wake + 120, sleep - 150], musait: [avail ? "Müsait olduğun saat" : "Müsait olduğunda", mf, mt], aksam: ["Akşam", sleep - 150, sleep] };
  const rel = m => ((m - wake) % 1440 + 1440) % 1440;
  return Object.entries(W).map(([id, [title, from, to]]) => ({ id, title, from: hhmm(from), to: hhmm(to), _f: rel(from), items: todos.filter(t => WIN_OF(t) === id) }))
    .filter(w => w.items.length).sort((a, b) => a._f - b._f).map(({ _f, ...w }) => w);
}
/* Şu anki (ya da sıradaki) aralık. nowMin: gece yarısından beri dakika. */
function nowWindow(windows, nowMin) {
  if (!windows.length) return null;
  const f = s => ZC.toMin(s), inW = w => { const a = f(w.from), b = f(w.to); return a <= b ? nowMin >= a && nowMin < b : nowMin >= a || nowMin < b; };
  const open = windows.filter(w => inW(w) && w.items.some(t => !t.done)).sort((a, b) => f(b.from) - f(a.from));
  return open[0] || windows.find(w => f(w.from) > nowMin && w.items.some(t => !t.done))
    || windows.find(w => w.items.some(t => !t.done)) || windows[windows.length - 1];
}
const LAB_T = { d3: [20, 30], b12: [200, 300], ferritin: [30, 50], hb: [13.5, 14], tsh: [0.4, 4.0] };
function labStatus(key, v) {
  const t = LAB_T[key]; if (!t || v == null || isNaN(+v)) return null; v = +v;
  if (key === "tsh") return v < t[0] || v > t[1] ? { level: v < t[0] ? "dusuk" : "yuksek", advice: "Referans dışında: doktoruna göster (tiroid)." } : { level: "normal", advice: "Normal aralıkta." };
  if (v < t[0]) return { level: "dusuk", advice: key === "d3" ? "Düşük: D3 takviyesi gerekir; dozu doktor belirlesin, 3 ay sonra tekrar ölç." : "Düşük: doktoruna göster; takviyeyi doktor önersin." };
  if (v < t[1]) return { level: "sinirda", advice: key === "d3" ? "Sınırda: güneş + kışın düşük doz D3 düşünülebilir; doktoruna sor." : "Sınırda: beslenmeye dikkat, 3–6 ayda tekrar ölç." };
  return { level: "normal", advice: "Normal: takviyeye gerek yok." };
}
/* Çift ilerleme: tüm setler üst tekrara ulaştıysa ağırlık artır; ortalama alt sınırın 1 altındaysa düşür. */
function liftNext({ kg, reps, range, step }) {
  const [lo, hi] = range, avg = reps.reduce((s, x) => s + x, 0) / reps.length;
  if (reps.every(r => r >= hi)) return { kg: Math.round((kg + step) * 10) / 10, reps: lo, why: "artir" };
  if (avg < lo - 1) return { kg: Math.max(0, Math.round((kg - step) * 10) / 10), reps: lo, why: "dus" };
  return { kg, reps: Math.min(hi, Math.max(...reps) + 1), why: "tekrar" };
}
/* Günün kokusu: sahip olunan parfümlerden hava ve etkinliğe göre seçim. */
function scentOfDay(owned, wx, event, date) {
  const P = (ZP.PERFUMES || []).filter(p => (owned || []).includes(p.id)); if (!P.length) return null;
  const t = wx && wx.temp != null ? wx.temp : 15, night = ["date", "dugun"].includes(event);
  const order = night && t < 24 ? ["tatli", "odunsu", "taze"] : t <= 14 ? ["tatli", "odunsu", "taze"] : t >= 24 ? ["taze", "odunsu", "tatli"] : ["odunsu", "tatli", "taze"];
  const best = order.map(st => P.filter(p => p.style === st)).find(g => g.length);
  const p = best[hash(date + "koku") % best.length];
  let sprays = p.sl >= 80 ? 1 : p.sl >= 65 ? 2 : 3; if (t >= 24) sprays = Math.max(1, sprays - 1);
  const why = night ? "Bugün etkinlik var: gece kokusu." : t <= 14 ? `${Math.round(t)}°: soğukta tatlı-sıcak koku iyi açılır.` : t >= 24 ? `${Math.round(t)}°: sıcakta hafif koku, az sprey.` : `${Math.round(t)}°: ılık hava, dengeli koku.`;
  return { id: p.id, name: `${p.brand} ${p.name}`, sprays, why };
}
/* Alınacaklar: sıradaki alınmamış maddeler (hafta, sonra öncelik) ve ilk adım. */
function nextSteps(items, bought, n = 3) {
  const b = bought || {};
  return (items || []).filter(i => !i.optional && !b[i.id]).sort((x, y) => (x.week || 1) - (y.week || 1) || x.priority - y.priority)
    .slice(0, n).map(i => ({ id: i.id, name: i.name, priceTL: i.priceTL, where: i.where, first: (i.how || [])[0] || "" }));
}
function pickIfThen(plans, date) {
  const a = (plans || []).filter(p => p.active !== false);
  return a.length ? a[hash(date + "if") % a.length] : null;
}

const api = { todayTodos, coachNote, weeklyReview, proteinTarget, avgWeight, workoutFor, LINES,
  forgivingStreak, mealPlan, marketList, bodyCheckResult, weeklyShareText, pickIfThen, isCheckin, morningText, nextSteps,
  dayPlan, nowWindow, labStatus, liftNext, scentOfDay };
if (node) module.exports = api; else root.ZenonCoach = api;
})(typeof self !== "undefined" ? self : this);
