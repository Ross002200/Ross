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
const needsRetinoid = p => has(normProfile(p), "acne", "marks", "pores");
// Retinoid takvimi ihtiyaç doğduğu gün başlar; ihtiyaç kalkınca sıfırlanır (yeniden eklenirse giriş baştan).
function retinoidStartFor(prevProfile, nextProfile, current, today) {
  if (!needsRetinoid(nextProfile)) return undefined;
  return prevProfile && needsRetinoid(prevProfile) && current ? current : today;
}
function doctorNote(profile) {
  const p = normProfile(profile);
  return has(p, "acne", "marks") || p.hair.thinning
    ? "Sivilce, leke ya da dökülme 2-3 ay düzenli bakıma rağmen sürüyorsa bir dermatoloğa görün; reçeteli tedaviler çok daha hızlı sonuç verir."
    : null;
}

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

const PRIO = { am: 0, pm: 1, checkin: 2, wk: 3, workout: 4, barber: 5, spf: 6, gym: 7, kafein: 8, uyku: 9 };
const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
function dayTimes(p, date) {
  const w = [0, 6].includes(weekday(date)) ? p.times.weekend : p.times.weekday, wake = toMin(w.wake);
  let sleep = toMin(w.sleep); if (sleep <= wake) sleep += 1440;
  return { wake, sleep };
}
function reminders(profile, days, state, now, extra = {}) {
  const p = normProfile(profile), done = (state && state.done) || {}, out = [];
  for (const d of days) {
    const { wake, sleep } = dayTimes(p, d.date), dn = done[d.date] || {}, fin = dn.tasks || [], list = [];
    const add = (kind, min, title, body) => { if (min >= wake && min <= sleep)
      list.push({ kind, at: atMin(d.date, min), title: cut(title, 80), body: cut(body, 300), tag: `${kind}-${d.date}` }); };
    const morning = (extra.morning || {})[d.date];
    if (!dn.amAll) add("am", wake + 10, morning ? "Günün listesi" : "Sabah rutini",
      (morning ? morning + " · " : "") + ((extra.ifthen || {})[d.date] ? extra.ifthen[d.date] + " · " : "") +
      d.am.map(s => s.label).join(" → ") + (d.uv != null ? ` (bugün UV ${d.uv})` : ""));
    if (!(extra.checkinDone || {})[d.date]) add("checkin", sleep - 75, "Check-in", "60 saniye: uyku, kilo, adım, protein, cilt. Koçun yarın sabah sana göre konuşsun.");
    add("kafein", Math.min(wake + 420, 900), "Kafeini bırak", "Bu saatten sonra kahve/çay yerine su ya da bitki çayı: uykun ve sabah yüzün için.");
    add("uyku", sleep - 60, "Ekranı bırak", "Işığı kıs, telefonu masaya bırak. Sabit uyku saati en ucuz glow-up.");
    const wo = (extra.workout || {})[d.date], av = (extra.avail || {})[d.date];
    if (wo) add("workout", av ? toMin(av.from) : toMin(p.times.gym) - 30, av ? `Müsait saatin başladı (${av.from}–${av.to})` : "Antrenman zamanı", wo);
    if (!dn.pmAll) add("pm", sleep - 45, "Akşam rutini", d.pm.map(s => s.label).join(" → "));
    if (d.uv != null && d.uv >= 6) add("spf", 780, "SPF yenile", `UV ${d.uv}: dışarıdaysan güneş kremini yenile.`);
    if (p.times.gymDays.includes(weekday(d.date)) && !fin.includes("gym"))
      add("gym", av ? toMin(av.to) : toMin(p.times.gym) + 90, "Spor sonrası", d.extras.filter(s => s.id === "gym" || s.id === "backwash").map(s => s.label).join(" · "));
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
    res.push({ at: atMin(last, dayTimes(p, last).wake + 60), title: "Zenon", body: "Bakım planın bitiyor: Zenon'u aç, yeni haftayı hazırlayayım.", tag: `renew-${last}` });
  }
  return res.map(r => ({ at: r.at.toISOString(), title: r.title, body: r.body, tag: r.tag }));
}

const api = { SRV, DEFAULT_PROFILE, normProfile, buildDay, buildWeek, reminders, streak, pruneDone, doctorNote,
  CARE_TIPS, pickTip, retinoidStartFor, isoDate, addDays, daysBetween, dayTimes, toMin, _t: { toMin, atMin, weekday, has } };
if (typeof module === "object" && module.exports) module.exports = api; else root.ZenonCare = api;
})(typeof self !== "undefined" ? self : this);
