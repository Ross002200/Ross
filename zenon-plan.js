/* Zenon 師 Koç · plan verisi: antrenman programı (Aurelius'tan kopya), aylık alışveriş listesi ve "Nasıl alınır" rehberleri.
   Tarayıcıda window.ZenonPlan, node'da require(). Fiyatlar 6–7 Ekim 2026; kaynaklar Masaüstü/reports altındaki raporlar. */
(function (root) {
"use strict";
const ex = rows => rows.map(([name, sets]) => ({ name, sets }));

/* Aurelius 5 günlük program (Aurelius'ta Pazartesi=0; burada JS günü: Pazar=0, Pazartesi=1). */
const PROGRAM = {
  days: {
    1: { focus: "Push", ex: ex([["Bench Press", 3], ["Pec Fly", 2], ["Seated DB Press", 2], ["DB Lateral Raise", 2], ["BB Skull Crusher", 2], ["DB Triceps Extension", 1]]) },
    2: { focus: "Pull", ex: ex([["T-Bar Row", 2], ["DB Bench Row", 2], ["Lat Pulldown", 2], ["Shrug", 2], ["Barbell Curl", 2], ["Hammer Curl", 2]]) },
    3: { focus: "Legs", ex: ex([["Leg Press", 2], ["Leg Extension", 2], ["Hip Thrust", 3], ["Lying Leg Curl", 2], ["Romanian Deadlift", 2], ["Calf Raise", 2]]) },
    5: { focus: "Üst vücut", ex: ex([["T-Bar Row", 2], ["Lat Pulldown", 2], ["Incline DB Press", 2], ["Shoulder Press", 1], ["Lateral Raise", 1], ["Barbell Curl", 2], ["Cable Pushdown", 2]]) },
    6: { focus: "Bacak", ex: ex([["Leg Extension", 2], ["Stiff Leg Deadlift", 2], ["Barbell Squat", 2], ["Abductor", 2], ["Calf Raise", 2], ["Ab Crunch", 2]]) }
  },
  cardio: { 4: 40, 0: 40 },
  advice: [
    "Göğüs haftada ~7 set: Pazartesi Bench Press'e ve Cuma Incline DB Press'e +1 set ekle (kas büyümesi için hedef ≥10 set).",
    "Yan omuz haftada ~3 set: Pazartesi ve Cuma Lateral Raise'e +2'şer set ekle; omuz genişliği yüzü daha ince gösterir.",
    "Her harekette son seti 1–2 tekrar yedekle bitir; ağırlığı ve tekrarı Aurelius'a kaydet, her hafta birini artırmayı dene."
  ]
};

const STORE_CHECK = "Kargo gelince kutu bandını açmadan ÜTS Mobil uygulamasında 'Ürün Sorgula' ile barkodu okut; ürün çıkmıyorsa kayıt dışıdır, iade et.";
const SELLER = "Markanın Trendyol/Hepsiburada resmi mağazası, eczane siteleri ya da Akakçe'de 'Yetkili satıcı' etiketli satıcıyı seç; rozet tek başına garanti değil, satıcı puanına ve yorumlara da bak.";
const CHEAP = "Fiyatı diğer satıcıların belirgin şekilde altındaysa alma: sahte kozmetik operasyonlarında güneş kremi ve diş macunu da ele geçirildi (Ankara, Ağustos 2026).";
const RETURN = "Online alışverişte 14 gün cayma hakkın var; ama hijyen bandı/mührü açılmış kozmetikte bu hak kullanılamıyor, bandı inceledikten sonra aç.";
const PHARMACY = "Türkiye'de ilaçlar (reçeteli ya da reçetesiz) internetten satılamaz: e-reçeteyle bir fiziksel eczaneye git, kimliğini göster.";
const ITS = "Kutudaki karekodu İTS Mobil uygulamasıyla okut: kayıtlı mı, son kullanma tarihi ve fiyatı görünür.";

const MONTHS = {
  "2026-10": [
    { id: "mhrs", cat: "Doktor", name: "Dermatoloji randevusu (MHRS)", size: "Devlet hastanesi", priceTL: 50, where: "MHRS", priority: 1, week: 1, rx: false, budget: "bakim",
      how: ["MHRS uygulamasını indir ya da mhrs.gov.tr'ye e-Devlet şifrenle gir (telefonla: ALO 182).",
        "Klinik olarak 'Dermatoloji' (Deri ve Zührevi Hastalıkları), hastane türü olarak devlet hastanesini seç; muayene katılım payı 50 TL (eğitim-araştırma 90 TL, özel 100 TL). Aile hekiminden sevk alırsan %50 indirim.",
        "Gidemeyeceksen en az 24 saat önce iptal et; gitmezsen aynı bölümden 15 gün randevu alamazsın.",
        "Yanına kullandığın ürünlerin listesini ve sorunlu bölgelerin gün ışığında çekilmiş fotoğraflarını al.",
        "Doktora söyle: alında sivilce ve siyah nokta, yanaklarda iz ve kızarıklık, kepek ve şakaklarda dökülme endişesi, boyunda batık kıl.",
        "Sor: adapalen (Differin), %20 azelaik asit (Skinoren) ve %2 ketokonazol şampuan (Konazol) uygun mu? Saç çizgisine de baktır."],
      warn: ["Teşhis ve tedavi kararı doktorundur; bu liste yalnızca soracaklarını hatırlatır."] },
    { id: "differin", cat: "Cilt (reçeteli)", name: "Differin %0,1 jel", size: "30 g", priceTL: 904, where: "Eczane (beyaz reçete)", priority: 2, week: 1, rx: true, budget: "bakim",
      how: [PHARMACY, ITS,
        "Eczacıya kullanımı sor: akşam kuru cilde bezelye kadar, göz ve dudak kenarından uzak; ilk iki hafta haftada 2 gece.",
        "SGK'nın ödeyip ödemediğini eczacıya sor; ödemiyorsa fiyat yaklaşık 904 TL.",
        "Tahriş olursa bırakma, bir gece ara ver ya da önce nemlendirici sür; sonuç 8–12 haftada görünür."],
      warn: ["Doktor yazmadıysa alma.", "Kullandığın sürece her sabah SPF şart."] },
    { id: "skinoren", cat: "Cilt (reçeteli)", name: "Skinoren %20 krem (azelaik asit)", size: "30 g", priceTL: 1004, where: "Eczane (beyaz reçete)", priority: 3, week: 1, rx: true, budget: "bakim",
      how: [PHARMACY, ITS,
        "Eczacıya kullanımı sor: genelde sabah temiz cilde ince tabaka; ilk günlerde hafif karıncalanma normal.",
        "Doğal kökenli (tahıldan) ve kanıtı güçlü tek madde: sivilce, iz ve kızarıklığa birlikte etki eder."],
      warn: ["Doktor yazmadıysa alma."] },
    { id: "konazol", cat: "Saç (reçeteli)", name: "Konazol %2 şampuan (ketokonazol)", size: "100 ml", priceTL: 179, where: "Eczane (beyaz reçete)", priority: 4, week: 1, rx: true, budget: "bakim",
      how: [PHARMACY, ITS,
        "Haftada 2 kez, saç derisine köpürt ve 3–5 dakika beklet, sonra durula; 2–4 hafta sonra haftada 1'e in.",
        "Reçetesiz yedek: Head & Shoulders ya da Vichy Dercos DS (eczane/yetkili satıcı)."],
      warn: ["Kepek 4 haftada geçmezse doktora tekrar söyle."] },
    { id: "spf", cat: "Cilt", name: "La Roche-Posay Anthelios UVMune 400 Oil Control renkli fluid SPF50+", size: "50 ml", priceTL: 591, where: "Narecza (yetkili)", priority: 5, week: 1, rx: false, budget: "bakim", care: ["spf30", "spf50", "moistspf"],
      how: [SELLER, CHEAP + " Bu üründe 399–450 TL'lik ilanlar şüpheli.", STORE_CHECK, RETURN,
        "Her sabah iki parmak boyu sür; dışarıdaysan 2 saatte bir yenile. Renkli formül leke ve izlerin koyulaşmasına karşı da korur."],
      warn: [] },
    { id: "cleanser", cat: "Cilt", name: "Avène Cleanance temizleme jeli", size: "400 ml", priceTL: 569, where: "Kozvit (yetkili)", priority: 6, week: 1, rx: false, budget: "bakim", care: ["cleanse", "pmcleanse"],
      how: [SELLER, STORE_CHECK, RETURN, "Sabah ve akşam ılık suyla 30 saniye; yüzü havluyla ovma, bastırarak kurula."],
      warn: [] },
    { id: "moist", cat: "Cilt", name: "CeraVe nemlendirici losyon", size: "236 ml", priceTL: 670, where: "Yetkili eczane sitesi", priority: 7, week: 1, rx: false, budget: "bakim", care: ["lotion", "gel", "cream", "pmmoist"],
      how: [SELLER, CHEAP + " CeraVe'de 300 TL civarı ilanlar yetkili fiyatın yarısı; uzak dur.", STORE_CHECK, "Seramidli: retinoid ve azelaik asidin kurutmasını dengeler; nemli cilde sür."],
      warn: [] },
    { id: "oneblade", cat: "Tıraş", name: "Philips OneBlade QP1425", size: "Tarak setli", priceTL: 1245, where: "Philips resmi mağaza / yetkili", priority: 8, week: 2, rx: false, budget: "bakim",
      how: ["Philips'in resmi mağazasından ya da yetkili satıcıdan al; garanti belgesini ve faturayı sakla.",
        "Boyunda 0,5–1 mm tarakla kullan, jiletle sıfıra kazıma: batık kılın en etkili çözümü bu.",
        "Yedek bıçağı da resmi kanaldan al; ucuz 'uyumlu bıçak' ilanları cildi tahriş edebilir.",
        "Zaten 0,5–1 mm taraklı bir makinen varsa bu maddeyi atla."],
      warn: [] },
    { id: "lip", cat: "Dudak", name: "Bepanthol Lipstick SPF30", size: "4,5 g", priceTL: 161, where: "Eczane sitesi", priority: 9, week: 2, rx: false, budget: "bakim", care: ["lip"],
      how: [SELLER, "Gün içinde ve dışarı çıkmadan sür; dudaklarını yalama, daha çok kurutur.", STORE_CHECK],
      warn: [] },
    { id: "clay", cat: "Saç", name: "Reuzel Matte Clay (bütçe: Ossion Matte Wax 100 ml, 150 TL)", size: "35 g", priceTL: 1032, where: "Akakçe yetkili / kuaför malzemecisi", priority: 10, week: 2, rx: false, budget: "bakim",
      how: ["Kalın dalgalı saçına mat kil uygun: nemli saçı fönle yukarı kurut, sonra bezelye-badem kadar kili avuçta ısıtıp köklerden uçlara.",
        "Ürünü saç çizgisinin iki parmak gerisinden başlat; akşam alnını mutlaka yıka (pomad akneyi önler).",
        "Yağlı pomadlardan (hindistan cevizi yağı, kakao yağı içeren) kaçın; alındaki pürüzü artırabilir.",
        "Reuzel'de normal fiyat 900–1.050 TL bandı; 5–6 kat pahalı ilanlar da var, onlardan uzak dur."],
      warn: [] },
    { id: "scale", cat: "Vücut", name: "Dijital mutfak tartısı", size: "5 kg / 1 g", priceTL: 199, where: "Pazaryeri", priority: 11, week: 2, rx: false, budget: "bakim",
      how: ["1 g hassasiyet ve dara (tare) özelliği olan modeli seç.",
        "İlk 2 hafta proteini tartarak öğren (tavuk, yoğurt, yumurta, lor); sonra göz kararı yeterli.",
        "Hedef günde ~150 g protein; check-in'e yaklaşık değeri yaz."],
      warn: [] },
    { id: "decant", cat: "Koku", name: "Dekant: Afnan 9PM Elixir 5 ml + Armaf CDNIM 5 ml", size: "2 × 5 ml", priceTL: 375, where: "Dekant Parfüm / Dekant Doktoru", priority: 12, week: 2, rx: false, budget: "bakim",
      how: ["Dekant = orijinal şişeden küçük şişeye aktarılmış koku; tam şişe almadan önce 1 hafta gerçek hayatta denemenin ucuz yolu.",
        "Tende dene, kâğıtta değil; bir güne tek koku, 4–6 saat sonra hâlâ hissediliyor mu not et.",
        "Beymen'e gidip Dior Homme Parfum ve Stronger With You Intensely testerlarını ücretsiz dene: bir bileğe bir koku.",
        "Dekant satıcısının orijinal şişeden aktardığı bağımsız olarak doğrulanamıyor; yorumları ve iade koşulunu kontrol et."],
      warn: [] },
    { id: "barber", cat: "Görünüm", name: "Berber + kargo payı", size: "Bu ay", priceTL: 1300, where: "Kendi berberin", priority: 13, week: 1, rx: false, budget: "bakim",
      how: ["Fotoğraf götür ve uzunlukları mm ile söyle (numara markaya göre değişir).",
        "Saç: 'Yanlar alçak-orta taper, üst önde 6–8 cm makasla dokulu; şakaklara çizgi çekme, ten fade istemiyorum.'",
        "Sakal: 'Yanak 3–5 mm, çene 6–8 mm. Boyun çizgisi Âdem elmasının iki parmak üstünden kulak arkasına U; altı 0,5–1 mm.'",
        "Kaş: 'Yalnızca iki kaşın arasını al, şekline dokunma.'",
        "3–4 haftada bir düzelt; berbere bahşiş adettir, oranı sana kalmış."],
      warn: ["Kargo ve berber tahmini; fiyat toplanmadı."] },
    { id: "perf_dhp", cat: "Parfüm", name: "Dior Homme Parfum", size: "75 ml", priceTL: 7830, where: "Beymen / Boyner (yetkili)", priority: 14, week: 2, rx: false, budget: "parfum",
      how: ["Önce Beymen ya da Boyner'de testerdan dene: bileğine sık, 4–6 saat yaşa.",
        "Fragrantica'da kalıcılık ve yayılımda 77 parfüm arasında 1., kadın oylamasında 2.: iris, deri, odun; şık ve tatlı değil. Okul ve gündüz için 1–2 sprey yeter.",
        "Yalnızca yetkili satıcıdan al (Beymen, Boyner, Sephora); kampanya ve sepet indirimlerini takip et.",
        "Kutu altındaki ve şişe dibindeki batch kodu aynı olmalı; CheckFresh yalnız üretim tarihini çözer, orijinallik kanıtı değildir.",
        "Akakçe'de 1.590 TL'den başlayan ilanlar, 'tester/kutusuz' ilanlar ve Trendruum.com gibi siteler sahte riski taşır."],
      warn: ["Alternatif paket: Dior Homme Parfum + Afnan Supremacy Not Only Intense = 11.270 TL (dört mevsim taze günlük koku)."] },
    { id: "perf_swy", cat: "Parfüm", name: "Emporio Armani Stronger With You Intensely", size: "100 ml", priceTL: 6000, where: "Beymen (A101'de 5.499 TL)", priority: 15, week: 2, rx: false, budget: "parfum",
      how: ["Beymen'de testerdan dene; tatlı karamel-vanilya-amber, date ve kış akşamları için.",
        "Fragrantica beğenisi %91, kadın oylamasında 6.; kış ve gece kokusu, 2–3 sprey yeter.",
        "Yetkili satıcı fiyatı 5.500–7.500 TL; 2.000 TL civarı ilanlar sahte riski taşır.",
        "Batch kodu kutu ve şişede aynı mı bak; mühürsüz kutu alma."],
      warn: [] }
  ]
};

const PRESET = {
  skin: "combo", issues: ["acne", "blackheads", "marks", "pores", "ingrown"],
  beard: { style: "stubble", density: "dense" },
  hair: { type: "wavy", oilyScalp: false, dandruff: true, thinning: true, lastCut: null }, sweat: "mid",
  times: { weekday: { wake: "07:30", sleep: "23:30" }, weekend: { wake: "09:30", sleep: "00:30" }, gymDays: [1, 2, 3, 5, 6], gym: "18:00" },
  amMinutes: 5, budget: "den", currentProducts: ""
};

const api = { PROGRAM, MONTHS, PRESET };
if (typeof module === "object" && module.exports) module.exports = api; else root.ZenonPlan = api;
})(typeof self !== "undefined" ? self : this);
