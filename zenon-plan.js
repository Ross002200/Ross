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

/* Liste v2 (2026-10-08): tek bütçe ≤ 15.000 TL (parfüm dahil). İçerik analizi: Masaüstü/reports/Rutin ürünleri içerik analizi.md;
   reçetesiz alternatifler: research_notes/Rutin ürünleri içerik analizi/receteesiz_alternatifler.md; parfüm: parfum_boyner.md.
   validation: legal = yasal statü (ruhsat / ÜTS bildirimi), seal = bağımsız mühür, evidence = etkenin klinik kanıtı. */
const V = (legal, seal, evidence) => ({ legal, seal, evidence });
const I = (actives, flags, validation) => ({ actives, flags, validation });
const ILAC = "Ruhsatlı ilaç (TİTCK); kutudaki karekodu İTS Mobil ile okut";
const KOZ = "Kozmetik: TİTCK'ya bildirilmiş olmalı; barkodu ÜTS Mobil 'Ürün Sorgula' ile okut";
const NOSEAL = "TR versiyonunda doğrulanmış bağımsız mühür yok";
const DOCTOR_ALT = "Reçete için hastane şart değil: aile hekimin (ASM) yazabilir, ücreti sen ödersin; MHRS'de 'uzaktan muayene' ya da yasal bir online doktorun e-reçetesi de olur.";
const MONTHS = {
  "2026-10": [
    { id: "doktor", type: "hizmet", optional: true, cat: "Doktor", name: "İsteğe bağlı: aile hekimi ya da online doktor (tahlil + ileride reçete)", size: "Muayene", priceTL: 0, where: "ASM (hastane randevusu gerekmez) / online", priority: 1, week: 3, rx: false,
      how: [DOCTOR_ALT,
        "Aile hekimi: e-Devlet ya da MHRS'den kendi aile hekimine randevu al; genelde aynı hafta. Hastane katılım payı 50 TL, aile hekimi ücretsiz.",
        "Hastane: MHRS → Dermatoloji → devlet hastanesi (50 TL); gidemezsen 24 saat önce iptal et.",
        "Yanına sorunlu bölgelerin gün ışığında fotoğraflarını ve bu listeyi götür.",
        "Söyle: alında sivilce ve siyah nokta, yanakta iz ve kızarıklık, kepek, boyunda batık kıl. Sor: adapalen (Differin), %20 azelaik asit (Azelderm/Skinoren), %2 ketokonazol şampuan (Konazol) uygun mu?",
        "Tahlil iste (takviyeye başlamadan önce): D vitamini (25-OH), B12, ferritin + demir, hemogram, TSH, açlık şekeri ve lipid. Sonuçlar e-Nabız'a düşer; D3 dozunu doktor bu sonuca göre söylesin.",
        "Söyle: haftada 5 gün ağırlık çalışıyorum, kreatin monohidrat (3–5 g/gün) kullanmayı düşünüyorum; böbrek değerlerim (kreatinin) uygun mu?"],
      warn: ["Reçeteyi alamazsan her ilacın altındaki 'Reçete alamazsan' seçeneğini kullan."] },
    { id: "comedomed", type: "urun", cat: "Cilt · akne", name: "Avène Cleanance Comedomed Peeling (retinal + glikolik asit)", size: "40 ml", priceTL: 683, where: "Daffne / Kozvit (yetkili)", priority: 2, week: 1, care: ["retinoid"],
      ingredients: I("Retinal (retinaldehit) + glikolik asit; Silybum (deve dikeni) özü", "İzopropil alkol içerir: ilk haftalarda batabilir; parfüm yok", V(KOZ, NOSEAL, "Retinal + %6 glikolik: akne ve izde çift kör RKÇ (Dréno 2003) ve pilot veriler; retinal C. acnes'e karşı da etkili (Pechère 1999). Adapalen kadar güçlü kanıt yok")),
      how: ["Yetkili satıcıdan al: Daffne 683 TL (+73 kargo) ya da Kozvit 667 TL. 400 TL altı ilanlar şüpheli.", STORE_CHECK,
        "1–2. hafta: haftada 2–3 akşam; 3–4. hafta: gün aşırı; sonra her akşam. Kuru cilde bezelye kadar, göz ve dudaktan uzak.",
        "Aynı akşam başka asit (BHA, glikolik tonik) sürme. Batarsa önce nemlendirici, üstüne Comedomed (sandviç).", "Sonucu 8–12 haftada değerlendir; ilk haftalarda birkaç sivilce artabilir (normal)."],
      warn: ["Sabah SPF şart. Tıraş olduğun akşam boyuna sürme."],
      alt: [{ name: "Reçete bulursan: Differin %0,1 jel (adapalen)", priceTL: 904, where: "Eczane (beyaz reçete; aile hekimi de yazabilir)", why: "Kanıtı en güçlü retinoid. Reçeteye ulaşırsan Comedomed yerine bunu kullan.",
        how: ["Aile hekimi (ASM) randevusu hastane randevusu değildir; e-Devlet/MHRS'den ASM seç.", "Reçeteyle eczaneden al; karekodu İTS Mobil ile okut."] },
        { name: "Bütçe: The Purest Solutions Retinol %0,3 (lipozomal)", priceTL: 328, where: "TPS resmi / eczane siteleri", why: "Ucuz ama akne kanıtı retinalden zayıf.",
        how: ["Haftada 2 akşamla başla; SPF şart.", "Comedomed'u tolere edemezsen geç."] }] },
    { id: "azelaik", type: "urun", cat: "Cilt · leke-kızarıklık", name: "Maru.Derm Azelaik Asit Serum (%10)", size: "30 ml", priceTL: 315, where: "Eczane siteleri (30+ satıcı, 239–319 TL)", priority: 3, week: 1, care: ["azelaic"],
      ingredients: I("Azelaik asit (kozmetik doz ~%10)", "İlk günler hafif batma normal; INCI'de 'Azelaic Acid' ilk sıralarda olmalı", V(KOZ, NOSEAL, "%15–20 için RKÇ kanıtı var (akne, iz, kızarıklık); %10 kozmetikte daha zayıf etki beklenir")),
      how: ["Eczane sitesinden 239–319 TL bandında al.", STORE_CHECK, "Sabah temizleyiciden sonra ince tabaka, 1 dk bekle; sonra nemlendirici + SPF.", "Retinal akşam, azelaik sabah: aynı anda değil."], warn: [],
      alt: [{ name: "Reçete bulursan: Azelderm %20 krem (Skinoren eşdeğeri)", priceTL: 624, where: "Eczane (beyaz reçete)", why: "Aynı madde iki kat dozda; reçeteyle daha güçlü sonuç.",
        how: ["Aile hekimine (ASM) sor; reçeteyle eczaneden al.", "Sabah ince tabaka."] }] },
    { id: "dercos", type: "urun", cat: "Saç · kepek", name: "Vichy Dercos Anti-Dandruff DS (selenyum disülfür)", size: "390 ml", priceTL: 1072, where: "Kozvit (yetkili)", priority: 4, week: 1, care: ["hair"],
      ingredients: I("Selenyum disülfür %1, salisilik asit, seramid", "Mentol ve parfüm; renkli saçta renk değişimi nadir", V(KOZ, NOSEAL, "Selenyum sülfür kepekte plasebodan üstün, ketokonazole yakın (Danby 1993, n=246)")),
      how: ["Yetkili satıcıdan al (Kozvit 390 ml 1.072 TL; 200 ml 812 TL). 300 TL civarı ilanlar sahte riski.", STORE_CHECK,
        "Haftada 2–3 kez: saç derisine masaj, 3–5 dakika beklet, durula; arada Dercos Energy+.", "Alın çizgisinden arkaya doğru durula (köpük alına akmasın).", "4 haftada düzelmezse ya da kaş/burun kenarında pullanma varsa aile hekimine ketokonazol için git."],
      warn: [],
      alt: [{ name: "Reçete bulursan: Konazol %2 şampuan (ketokonazol)", priceTL: 179, where: "Eczane (beyaz reçete; aile hekimi yazabilir)", why: "Kepekte en iyi kanıt; ucuz.",
        how: ["Aile hekimi reçete yazar; SGK ödemez, 179 TL'yi sen ödersin.", "Haftada 2 kez, 3–5 dk beklet."] }] },
    { id: "cleanser", type: "urun", cat: "Cilt", name: "CeraVe Köpüren Temizleyici", size: "236 ml", priceTL: 730, where: "Kozvit (yetkili)", priority: 5, week: 1, care: ["cleanse", "pmcleanse"],
      ingredients: I("Niasinamid, seramid NP/AP/EOP, gliserin; yumuşak yüzey aktif (betain + glisinat)", "Parfüm yok; pH bilinmiyor", V(KOZ, NOSEAL, "Ürüne özgü çalışma yok; içerik mantığı güçlü")),
      how: [SELLER, "Avène Cleanance yerine bu: Avène parfüm ve iki boya içeriyor.", STORE_CHECK, "Sabah ve akşam ılık suyla 30 saniye."], warn: [] },
    { id: "moist", type: "urun", cat: "Cilt", name: "CeraVe Nemlendirici Losyon", size: "236 ml", priceTL: 670, where: "Yetkili eczane sitesi", priority: 6, week: 1, care: ["lotion", "gel", "cream", "pmmoist"],
      ingredients: I("3 seramid, kolesterol, gliserin, hiyalüronik asit", "Paraben (izinli; gerçek risk değil); parfüm yok", V(KOZ, NOSEAL, "Seramid bariyer onarımı: orta")),
      how: [SELLER, CHEAP + " 300 TL civarı ilanlar yetkili fiyatın yarısı.", STORE_CHECK], warn: [] },
    { id: "spf", type: "urun", cat: "Cilt", name: "La Roche-Posay Anthelios UVMune 400 Oil Control renkli SPF50+", size: "50 ml", priceTL: 591, where: "Narecza (yetkili)", priority: 7, week: 1, care: ["spf30", "spf50", "moistspf"],
      ingredients: I("Mexoryl 400 (uzun UVA), Tinosorb S, Mexoryl XL/SX, Uvinul A Plus, demir oksit, TiO2, çinko PCA", "Alkol (Alcohol Denat.) ve parfüm — adapalenle batabilir, önce küçük alanda dene", V(KOZ + "; filtreler AB Annex VI'da izinli", "SCF mührü yalnız ABD formülünde", "Demir oksit izlere karşı görünür ışık koruması: orta")),
      how: [SELLER, CHEAP + " 399–450 TL ilanlar şüpheli.", STORE_CHECK, "Her sabah iki parmak boyu; dışarıdaysan 2 saatte bir yenile.", "Batarsa yedek: Skin1004 Hyalu-Cica (parfümsüz, alkolsüz) ya da Avène Cleanance Solaire."], warn: [] },
    { id: "lip", type: "urun", cat: "Dudak", name: "Bepanthol Lipstick SPF30", size: "4,5 g", priceTL: 161, where: "Evdeeczane", priority: 8, week: 1, care: ["lip"],
      ingredients: I("Homosalat, DHHB, TiO2; pantenol", "Parfüm listenin sonlarında", V(KOZ, NOSEAL, "AAD: dudakta SPF30+")),
      how: [SELLER, "SKT'ye bak: süresi geçmiş stok ilanı görüldü.", STORE_CHECK], warn: [] },
    { id: "antip", type: "urun", cat: "Vücut", name: "Rexona Men Clinical Protection stick", size: "45 ml", priceTL: 228, where: "Zincir market / eczane", priority: 9, week: 1, care: ["antip"],
      ingredients: I("Alüminyum zirkonyum tetraklorohidreks gly", "Parfüm", V(KOZ, "—", "AB SCCS: izinli oranlarda güvenli (2020/2023)")),
      how: ["Market ya da eczaneden al.", "Akşam kuru koltuk altına sür; sabah etkisi daha iyi.", "Çok terliyorsan sonraki ay Driclor (geceleri, koltuk altını aldıktan 12 saat sonra)."], warn: [] },
    { id: "macun", type: "urun", cat: "Ağız", name: "Sensodyne Onarım ve Koruma", size: "75 ml", priceTL: 210, where: "Market / eczane", priority: 10, week: 1,
      ingredients: I("Sodyum florür 1450 ppm, NovaMin", "Önemsiz aroma", V(KOZ, "ADA/OHF mührü TR ürününde yok", "Florür çürük önlemede güçlü")),
      how: ["Market ya da eczane; normal fiyat 180–237 TL.", "Kutuda '1450 ppm' yazdığını kontrol et (Parodontax Orijinal florürsüz!).", "Akşam 2 dakika fırçala, tükür ama suyla çalkalama."], warn: [] },
    { id: "tepe", type: "urun", cat: "Ağız", name: "TePe ara yüz fırçası (0,45 mm başla)", size: "8'li", priceTL: 425, where: "Turuncukasa / eczane", priority: 11, week: 1, care: ["floss"],
      ingredients: I("Mekanik temizlik", "Yanlış boy diş etini tahriş eder", V("Tıbbi cihaz/kozmetik değil", "—", "Cochrane 2019: diş ipine eşit ya da biraz iyi (düşük kesinlik)")),
      how: ["Eczane ya da Turuncukasa (8'li ~425 TL); paket 2–3 ay yeter.", "En ince boyla başla; zorlamadan girmeli, kanama ilk hafta normal.", "Her akşam fırçalamadan önce."], warn: [] },
    { id: "sirt", type: "urun", cat: "Vücut", name: "La Roche-Posay Effaclar Mikro Peeling Jel (sırt/göğüs)", size: "400 ml", priceTL: 1000, where: "Yetkili eczane", priority: 12, week: 2, care: ["backwash"],
      ingredients: I("Salisilik asit, LHA, çinko glukonat", "SLES, mentol", V(KOZ + "; durulanan üründe SA ≤ %2,5", NOSEAL, "Sırtta SA için kontrollü veri az; BPO Türkiye'de reçeteli")),
      how: [SELLER, "Duşta sırta sür, 1–2 dakika beklet, durula; spordan sonra.", STORE_CHECK], warn: [] },
    { id: "balm", type: "urun", cat: "Tıraş", name: "Nivea Men Sensitive tıraş sonrası balsam (alkolsüz)", size: "100 ml", priceTL: 420, where: "Market / eczane", priority: 13, week: 2,
      ingredients: I("Pantenol, papatya, piroctone olamine; alkolsüz", "İzopropil palmitat, parfüm", V(KOZ, "—", "Zayıf")),
      how: ["Market ya da eczane; 390–440 TL bandı.", "2025 formülü 'alkolsüz' yazısına bak.", "Tıraştan sonra ince tabaka; sivilceli bölgeye kalın sürme."], warn: [] },
    { id: "sampuan", type: "urun", cat: "Saç", name: "Vichy Dercos Energy+ (günlük şampuan)", size: "400 ml", priceTL: 427, where: "Yetkili eczane (şüpheli 'refill' ilanlarından uzak dur)", priority: 14, week: 2,
      ingredients: I("Aminexil, niasinamid, salisilik asit; yağ yok", "SLES, parfüm", V(KOZ, "—", "Dökülme iddiası yalnız üretici verisi (zayıf)")),
      how: [SELLER, STORE_CHECK, "Kepek şampuanının olmadığı günlerde; saç derisine, köpük uçlara yeter."], warn: [] },
    { id: "oneblade", type: "arac", cat: "Tıraş", name: "Philips OneBlade QP1425", size: "Tarak setli", priceTL: 1245, where: "Philips resmi mağaza / yetkili", priority: 15, week: 2,
      how: ["Resmi mağaza ya da yetkili satıcı; garanti belgesi ve faturayı sakla.", "Boyunda 0,5–1 mm tarakla, jiletle sıfıra kazıma (batık kılın en etkili çözümü).", "Zaten 0,5–1 mm taraklı makinen varsa bu maddeyi atla."], warn: [] },
    { id: "scale", type: "arac", cat: "Vücut", name: "Dijital mutfak tartısı (1 g, dara)", size: "5 kg", priceTL: 199, where: "Pazaryeri", priority: 16, week: 2,
      how: ["1 g hassasiyet ve dara özelliği olan modeli seç; 150–450 TL bandı yeterli.", "İlk 2 hafta proteini tartarak öğren; hedef ~150 g/gün.", "Sabah kiloyu banyo tartısında, aynı saatte tartıl; check-in'e yaz."], warn: [] },
    { id: "barber", type: "hizmet", cat: "Görünüm", name: "Berber (taper + sakal çizgisi)", size: "Bu ay", priceTL: 800, where: "Kendi berberin", priority: 17, week: 1,
      how: ["Fotoğraf götür, uzunlukları mm ile söyle.", "'Yanlar alçak-orta taper, üst önde 6–8 cm makasla dokulu; şakaklara çizgi yok, ten fade istemiyorum.'",
        "'Sakal yanak 3–5 mm, çene 6–8 mm; boyun çizgisi Âdem elmasının iki parmak üstünden U, altı 0,5–1 mm.'", "'Kaşta yalnız iki kaşın arası.'"], warn: ["800 TL tahmini (fiyat toplanmadı); bütçeye dahil."] },
    { id: "parfum", type: "parfum", cat: "Parfüm", name: "Ana parfüm: Beymen ya da Boyner'de dene, birini al (Alınacaklar → Parfüm'de karşılaştır)", size: "50–100 ml", priceTL: 6000, where: "Beymen / Boyner (mağazanın kendi satışı)", priority: 18, week: 2,
      choices: ["tmwi-beymen", "lme-beymen", "swyi", "bbe", "dhi50", "bir50", "1me50", "zara-ebony-elixir", "supremacy"],
      ingredients: I("TMW Intense: kakule-karamel · Le Male Elixir: bal-tütün-vanilya · SWYI: kestane-karamel-vanilya · Bottled Elixir: tütsü-odun, tatlı değil",
        "Tatlı olanlar sıcakta ağır gelebilir; sınıfta 1–2 sprey", V("Beymen ve Boyner resmî distribütör ürünü satar; fatura + iade güvencesi", "—", "Fragrantica 2026 oyları: beğeni ve performans verisi")),
      how: ["Beymen ya da Boyner'e git; en fazla üç testerı dene: bir bileğe bir koku, birini boynun yanına. Kâğıtta değil tende.",
        "4–6 saat yaşa: hangisi hâlâ hissediliyor, hangisi 'fazla tatlı'? Tobacco Vanille'i sevmediysen Bottled Elixir'den başla.",
        "8 Ekim sepet fiyatları: Beymen TMW Intense 100 ml 5.544 TL (Boyner 5.985), Le Male Elixir 75 ml 6.065, SWYI 100 ml 6.000 (ikisinde de), Bottled Elixir 100 ml 5.901.",
        "Beymen'de 'Sepette %20' kampanyası bitebilir; kasada son fiyatı kontrol et. 3.000 TL üstü kargo ücretsiz, mağazadan teslim alabilirsin.",
        "Faturada satıcının mağazanın kendisi olduğuna, kutu altındaki batch kodunun şişe dibiyle aynı olduğuna ve selofana bak.",
        "Aldığında 'Aldım'a bas ve hangisini aldığını seç: rutinde ve önerilerde o adı görürsün."],
      warn: ["Pazaryerinde 1.600–2.000 TL'lik designer ilanları (Trendruum.com, 'TREND BESTT4') sahte riski. Beymen'de Arap markası yok; Boyner'de Cosmoland 2,5–3 kat pahalı satıyor."],
      alt: [{ name: "Zara yolu: Ebony Wood Elixir 100 ml + Red Eclipse 100 ml", priceTL: 3580, where: "Zara mağazası / zara.com/tr",
        why: "Ebony Wood Elixir Zara'nın en yüksek puanlısı (kalıcılık %84); iki koku 3.580 TL, kalan ~2.400 TL Kasım'a kalır. Performans designer'lardan düşük.",
        how: ["Zara mağazasında iki testerı bileğine sık, 4 saat sonra kokla.", "Ebony Wood Elixir gündüz/okul, Red Eclipse sonbahar-kış için."] },
        { name: "Arap muadili yolu: Afnan Supremacy Not Only Intense 100 ml + 2 dekant", priceTL: 4000, where: "Selika / Bakım Shop (Trendyol, puanı yüksek); dekant: Dekant Parfüm",
        why: "Beğeni %83, kalıcılık %80, yayılım %73; dört mevsim. Arap evleri için resmi TR distribütörü doğrulanmadı: satıcı puanına bak.",
        how: ["1.800 TL altı Arap şişesi şüpheli; Türkçe ithalatçı etiketi ve seri no/QR'a bak.", "Liquid Brun ve Khamrah Qahwa tatlı: önce 10 ml dekantla dene."] }] }
  ],
  "2026-11": [
    { id: "kreatin", type: "takviye", cat: "Takviye", name: "Kreatin monohidrat (Creapure ya da mikronize)", size: "250–300 g (2 ay)", priceTL: 780, where: "Hardline / HIQ Creapure (yetkili satıcı)", priority: 0, week: 1,
      ingredients: I("Kreatin monohidrat; günde 3–5 g", "Böbrek hastalığın varsa kullanma; ilk haftalarda 1–2 kg su tutma normaldir (yağ değil)", V("Gıda takviyesi: Tarım ve Orman Bakanlığı onay no'su kutuda olmalı", "Creapure (Almanya) ya da Informed Sport mührü varsa daha iyi", "Güçlü: ISSN 2017 pozisyon bildirgesi, ağırlık antrenmanında güç ve yağsız kütle artışı")),
      how: ["Doktora kreatin kullanacağını söyle; tahlilde kreatinin normalse başla.", "Hardline %100 Mikronize 300 g ~780 TL ya da HIQ Creapure 250 g ~999 TL; 'yükleme' gerekmez, her gün 3–5 g.",
        "Saat fark etmez; suya, yoğurda ya da shake'e karıştır. Antrenman olmayan günler de iç.", "Kutuda Bakanlık onay numarası ve son kullanma tarihi olmayan ilanı alma.", "Aldığında 'Aldım'a bas: Bugün listesine günlük hatırlatma eklenir."], warn: [] },
    { id: "d3", type: "takviye", optional: true, cat: "Takviye", name: "D3 vitamini (yalnız tahlilde düşükse)", size: "1000 IU damla/tablet", priceTL: 250, where: "Eczane", priority: 0, week: 2,
      ingredients: I("Kolekalsiferol (D3)", "Tahlilsiz yüksek doz alma; doz tahlil sonucuna göre", V("Eczane ürünü; Bakanlık onaylı", "—", "Eksiklik varsa güçlü; eksiklik yoksa ek fayda zayıf")),
      how: ["Önce tahlil: D vitamini (25-OH) sonucunu e-Nabız'dan gör.", "20 ng/mL altıysa doktorun söylediği dozla başla; normalse alma.", "Eczaneden 1000 IU damla ya da tablet ~150–300 TL; yağlı bir öğünle iç."], warn: [] },
    { id: "davines", type: "urun", cat: "Saç", name: "Davines This Is a Sea Salt Spray", size: "250 ml", priceTL: 1446, where: "13 satıcı, fiyatlar tutarlı", priority: 1, week: 1,
      ingredients: I("Magnezyum sülfat, deniz tuzu; yağ ve vaks yok", "Eski formülde MI (durulanmayan üründe AB'de yasak) — kutudan kontrol et", V(KOZ, "—", "—")),
      how: ["Kutudaki INCI'de 'Methylisothiazolinone' yoksa al.", "Nemli saça püskürt, fönle yukarı kurut."], warn: [] },
    { id: "cicaplast", type: "urun", cat: "Cilt", name: "LRP Cicaplast Baume B5+ (tahriş kurtarıcı)", size: "40 ml", priceTL: 599, where: "Kozvit (yetkili)", priority: 2, week: 1,
      ingredients: I("%5 pantenol, madekasosit, çinko", "Shea yağı, ağır doku", V(KOZ, "—", "Zayıf")),
      how: ["Yalnız tahriş olan bölgeye, akşam ince tabaka.", "220 TL ilanlar şüpheli; yetkili 599 TL."], warn: [] },
    { id: "niasinamid", type: "urun", optional: true, cat: "Cilt", name: "The Ordinary Niacinamide %10 + Zinc %1 (isteğe bağlı)", size: "30 ml", priceTL: 410, where: "Kozvit / Dermoshops", priority: 3, week: 1,
      ingredients: I("Niasinamid %10, çinko PCA %1", "%10, kanıttaki %4'ün üstünde; TR distribütörü doğrulanmadı", V(KOZ, "—", "%4 jelde orta")),
      how: ["Reçeteli ikili tolere edilirse sabah ekle; tahriş varsa bırak.", "Kozvit ya da Dermoshops; 400–415 TL bandı.", STORE_CHECK], warn: [] },
    { id: "parfum2", type: "parfum", optional: true, cat: "Parfüm", name: "İkinci koku (isteğe bağlı): Afnan Supremacy Not Only Intense 100 ml", size: "100 ml", priceTL: 3440, where: "Selika / Bakım Shop", priority: 4, week: 2,
      ingredients: I("Meyveli-dumanlı taze; dört mevsim gündüz kokusu (beğeni %83, kalıcılık %80, yayılım %73)", "Resmi TR distribütörü doğrulanmadı", V("Pazaryeri satıcısı; satıcı puanı ve seri no/QR", "—", "Fragrantica 2026 oyları")),
      how: ["Ekim'de aldığın tatlı kokuya gündüz/okul eşi olarak.", "1.800 TL altı ilan şüpheli; Türkçe ithalatçı etiketi ve seri no/QR'a bak.", "Önce 10 ml dekantla dene."], warn: [] }
  ]
};

const PRESET = {
  skin: "combo", issues: ["acne", "blackheads", "marks", "pores", "ingrown"],
  beard: { style: "stubble", density: "dense" },
  hair: { type: "wavy", oilyScalp: false, dandruff: true, thinning: true, lastCut: null }, sweat: "mid",
  times: { weekday: { wake: "07:30", sleep: "23:30" }, weekend: { wake: "09:30", sleep: "00:30" }, gymDays: [1, 2, 3, 5, 6], gym: "18:00" },
  amMinutes: 5, budget: "den", currentProducts: ""
};

/* Ucuz, yüksek proteinli Türk mutfağı öğünleri (protein ve kcal yaklaşık; maliyet 1 ucuz … 3 pahalı). Kaynak mantığı: ISSN ~1,6–2 g/kg, TÜBER 2022. */
const M = (id, slot, name, protein, kcal, cost, items) => ({ id, slot, name, protein, kcal, cost,
  items: items.map(([n, q, u, cat]) => ({ name: n, qty: q, unit: u, cat })) });
const MEALS = [
  M("menemen", "kahvalti", "Menemen (3 yumurta) + 100 g lor + 1 dilim tam buğday ekmek", 33, 520, 1, [["Yumurta", 3, "adet", "Protein"], ["Lor peyniri", 100, "g", "Süt"], ["Domates", 2, "adet", "Sebze"], ["Biber", 1, "adet", "Sebze"], ["Tam buğday ekmek", 1, "dilim", "Tahıl"]]),
  M("yulaf", "kahvalti", "Yulaf (60 g) + 200 g süzme yoğurt + muz + 1 yk fıstık ezmesi", 30, 560, 1, [["Yulaf", 60, "g", "Tahıl"], ["Süzme yoğurt", 200, "g", "Süt"], ["Muz", 1, "adet", "Sebze/Meyve"], ["Fıstık ezmesi", 15, "g", "Diğer"]]),
  M("haslama", "kahvalti", "3 haşlanmış yumurta + 60 g beyaz peynir + domates-salatalık + ekmek", 31, 500, 1, [["Yumurta", 3, "adet", "Protein"], ["Beyaz peynir", 60, "g", "Süt"], ["Domates", 1, "adet", "Sebze"], ["Salatalık", 1, "adet", "Sebze"], ["Tam buğday ekmek", 1, "dilim", "Tahıl"]]),
  M("omlet", "kahvalti", "Lorlu-maydanozlu omlet (2 yumurta + 2 beyaz) + ayran", 32, 430, 1, [["Yumurta", 4, "adet", "Protein"], ["Lor peyniri", 80, "g", "Süt"], ["Maydanoz", 1, "demet", "Sebze"], ["Ayran", 300, "ml", "Süt"]]),
  M("tavukpilav", "ogle", "Izgara tavuk göğüs (150 g) + bulgur pilavı + çoban salata", 48, 650, 2, [["Tavuk göğüs", 150, "g", "Protein"], ["Bulgur", 70, "g", "Tahıl"], ["Domates", 1, "adet", "Sebze"], ["Salatalık", 1, "adet", "Sebze"]]),
  M("tonsalata", "ogle", "Ton balıklı nohutlu salata + 2 dilim ekmek", 38, 560, 2, [["Ton balığı (konserve)", 1, "kutu", "Protein"], ["Haşlanmış nohut", 100, "g", "Bakliyat"], ["Marul", 1, "adet", "Sebze"], ["Tam buğday ekmek", 2, "dilim", "Tahıl"]]),
  M("mercimek", "ogle", "Mercimek çorbası + 2 haşlanmış yumurta + 200 g yoğurt", 32, 560, 1, [["Kırmızı mercimek", 80, "g", "Bakliyat"], ["Yumurta", 2, "adet", "Protein"], ["Yoğurt", 200, "g", "Süt"]]),
  M("kurufasulye", "ogle", "Kuru fasulye + bulgur + cacık", 30, 680, 1, [["Kuru fasulye", 90, "g", "Bakliyat"], ["Bulgur", 60, "g", "Tahıl"], ["Yoğurt", 150, "g", "Süt"], ["Salatalık", 1, "adet", "Sebze"]]),
  M("tavukdurum", "ogle", "Ev yapımı tavuk dürüm (150 g tavuk) + ayran", 46, 640, 2, [["Tavuk göğüs", 150, "g", "Protein"], ["Lavaş", 1, "adet", "Tahıl"], ["Ayran", 300, "ml", "Süt"], ["Marul", 1, "adet", "Sebze"]]),
  M("kofte", "aksam", "Izgara köfte (150 g yağsız kıyma) + bulgur + salata", 40, 640, 2, [["Yağsız kıyma", 150, "g", "Protein"], ["Bulgur", 60, "g", "Tahıl"], ["Domates", 1, "adet", "Sebze"], ["Soğan", 1, "adet", "Sebze"]]),
  M("firintavuk", "aksam", "Fırın tavuk but (derisiz, 2 adet) + fırın sebze", 40, 560, 1, [["Tavuk but (derisiz)", 2, "adet", "Protein"], ["Kabak", 1, "adet", "Sebze"], ["Patates", 1, "adet", "Sebze"], ["Biber", 1, "adet", "Sebze"]]),
  M("kiymamakarna", "aksam", "Kıymalı tam buğday makarna (120 g kıyma) + yoğurt", 42, 720, 2, [["Yağsız kıyma", 120, "g", "Protein"], ["Tam buğday makarna", 90, "g", "Tahıl"], ["Yoğurt", 150, "g", "Süt"], ["Domates salçası", 1, "yk", "Diğer"]]),
  M("nohuttavuk", "aksam", "Nohutlu tavuk + pirinç pilavı (az) + cacık", 38, 660, 1, [["Tavuk göğüs", 120, "g", "Protein"], ["Haşlanmış nohut", 120, "g", "Bakliyat"], ["Pirinç", 50, "g", "Tahıl"], ["Yoğurt", 150, "g", "Süt"]]),
  M("balik", "aksam", "Fırın uskumru/hamsi (200 g) + roka + haşlanmış patates", 38, 600, 2, [["Uskumru ya da hamsi", 200, "g", "Protein"], ["Roka", 1, "demet", "Sebze"], ["Patates", 1, "adet", "Sebze"]]),
  M("etlifasulye", "aksam", "Etli kuru fasulye (80 g kuşbaşı) + bulgur", 36, 700, 2, [["Kuşbaşı et", 80, "g", "Protein"], ["Kuru fasulye", 80, "g", "Bakliyat"], ["Bulgur", 60, "g", "Tahıl"]]),
  M("suzmeyogurt", "ara", "200 g süzme yoğurt + bir avuç ceviz", 22, 300, 1, [["Süzme yoğurt", 200, "g", "Süt"], ["Ceviz", 20, "g", "Diğer"]]),
  M("lorbal", "ara", "150 g lor + 1 tk bal + tarçın", 19, 220, 1, [["Lor peyniri", 150, "g", "Süt"], ["Bal", 1, "tk", "Diğer"]]),
  M("ayranyumurta", "ara", "2 haşlanmış yumurta + ayran", 21, 280, 1, [["Yumurta", 2, "adet", "Protein"], ["Ayran", 300, "ml", "Süt"]]),
  M("leblebi", "ara", "50 g leblebi + 1 kase yoğurt", 17, 330, 1, [["Leblebi", 50, "g", "Bakliyat"], ["Yoğurt", 150, "g", "Süt"]]),
  M("whey", "ara", "1 ölçek whey + süt (antrenman sonrası)", 32, 260, 2, [["Whey protein", 1, "ölçek", "Protein"], ["Süt", 250, "ml", "Süt"]])
];

/* Eğer–o zaman şablonları (uygulama niyetleri; Gollwitzer & Sheeran 2006). */
const IFTHEN = [
  { id: "ders", if: "Ders 18:00'den sonra biterse", then: "eve uğramadan 18:30'da salondayım" },
  { id: "gece", if: "Gece 00:00'ı geçerse", then: "kısa rutini yaparım: temizle + nemlendir, 2 dakika" },
  { id: "tatli", if: "Canım tatlı çekerse", then: "süzme yoğurt + meyve yerim, sonra 10 dakika beklerim" },
  { id: "disari", if: "Dışarıda yemek yersem", then: "ızgara + salata seçerim, ekmeği bir dilimle sınırlarım" },
  { id: "gecuyan", if: "Sabah geç kalırsam", then: "SPF'yi yine sürerim; temizleyiciyi su ile geçerim" },
  { id: "yorgun", if: "Antrenmana gitmek istemezsem", then: "sadece 20 dakika gelirim; gelince çoğu zaman devam ederim" },
  { id: "telefon", if: "Yatakta telefona uzanırsam", then: "telefonu şarja masaya bırakırım, ışığı kısarım" },
  { id: "kafein", if: "Saat 15:00'i geçerse", then: "kahve yerine su ya da bitki çayı içerim" },
  { id: "adim", if: "Akşam 20:00'de 6.000 adımın altındaysam", then: "20 dakikalık yürüyüşe çıkarım" },
  { id: "kacirdim", if: "Bir günü kaçırırsam", then: "ertesi gün kesinlikle yaparım: iki gün üst üste kaçırmam" }
];

/* Etkinlik hazırlık listeleri: off = etkinliğe kalan gün (7 … 0). */
const T = (off, label) => ({ off, label });
const EVENTS = {
  date: { name: "Date", tasks: [T(7, "Berber randevusu al (etkinlikten 2–4 gün önceye)"), T(3, "Kombini seç: Zenon'un akşam önerisine bak, ütü gerekenleri ayır"), T(2, "Sakal ve boyun çizgisini düzelt"), T(1, "Ütü + ayakkabı temizliği; akşam rutini eksiksiz, erken uyu"), T(0, "Duş, deodorant, parfüm 2–3 sprey (boyun, göğüs)"), T(0, "Diş ipi + dil temizliği; nane yerine su")] },
  mulakat: { name: "Mülakat", tasks: [T(7, "Berber randevusu al"), T(5, "Şirketi araştır, 3 soru hazırla"), T(3, "Sade kombin: koyu pantolon, düz gömlek/triko; ütüle"), T(1, "Yol ve süreyi planla; erken uyu"), T(0, "Hafif parfüm: 1–2 sprey"), T(0, "10 dakika erken orada ol; omuzlar geride, nefes")] },
  dugun: { name: "Düğün", tasks: [T(7, "Takım/ceket provası; terziye gerekirse götür"), T(5, "Berber randevusu al"), T(3, "Ayakkabıyı boyat/temizle, kemeri eşleştir"), T(1, "Sakal düzelt, ütü; akşam rutini"), T(0, "Parfüm 2–3 sprey, mendil ve şarj")] },
  diger: { name: "Etkinlik", tasks: [T(7, "Ne giyeceğini düşün"), T(3, "Kombini hazırla"), T(2, "Berber ya da sakal düzeltme"), T(1, "Ütü ve ayakkabı"), T(0, "Parfüm ve son kontrol")] }
};

/* Beden algısı öz kontrolü (0–3): NHS beden dismorfik bozukluk işaretlerinden uyarlanmıştır; tanı aracı değildir. */
const BODYCHECK = [
  "Görünüşünle ilgili düşünceler günde ne kadar zamanını alıyor? (0: çok az · 3: saatler)",
  "Aynaya ya da yansımalara ne sıklıkla bakıp kontrol ediyorsun? (0: nadiren · 3: sürekli)",
  "Görünüşün yüzünden insanlardan, fotoğraftan ya da dışarı çıkmaktan kaçındın mı? (0: hiç · 3: sık)",
  "Görünüşün seni ne kadar sıkıntıya sokuyor? (0: hiç · 3: çok)",
  "Kendini başkalarıyla ne sıklıkla kıyaslıyorsun? (0: nadiren · 3: sürekli)"
];

/* Parfüm rehberi (8 Ekim 2026 fiyatları; beymen.com, boyner.com.tr, zara.com/tr, Akakçe). ll/sl: Fragrantica "uzun+sonsuz" ve
   "güçlü+devasa" oy payı (%). Kaynak: research_notes/Kadınların beğendiği erkek parfümleri güncel/beymen_zara_2026-10-08.md. */
const PF = (id, store, brand, name, ml, priceTL, o) => Object.assign({ id, store, brand, name, ml, priceTL }, o);
const PERFUMES = [
  PF("tmwi-beymen", "Beymen", "Azzaro", "The Most Wanted EDP Intense", 100, 5544, { style: "tatli", listTL: 6930, rank: 16, notes: "Kakule, karamel (toffee), amber odun", ll: 70, sl: 54,
    when: "Gece, date, soğuk hava", why: "Kadınlardan iltifat alan tatlı-baharatlı koku; gece kokusu payı %75 ile listenin en 'gece' kokusu. Beymen'de sepette %20 ile Boyner'den ~440 TL ucuz." }),
  PF("lme-beymen", "Beymen", "Jean Paul Gaultier", "Le Male Elixir", 75, 6065, { style: "tatli", nuke: true, rank: 2, notes: "Lavanta, bal, tütün, vanilya, tonka", ll: 83, sl: 72,
    when: "Kış akşamı, date, kalabalık ortam", why: "Designer'lar içinde sıralamanın en üstündekilerden: kalıcılık %83, yayılım %72, 8–12 saat. Fazla tatlı bulunabilir; 1–2 sprey yeter." }),
  PF("swyi", "Beymen · Boyner", "Giorgio Armani", "Stronger With You Intensely", 100, 6000, { style: "tatli", listTL: 7500, rank: 5, notes: "Kestane, karamel, tarçın, vanilya, amber", ll: 76, sl: 65,
    when: "Sonbahar-kış, okul akşamı, date", why: "Beğeni %91, kadın oylamasında 6.; soğuk havanın en sevilen tatlı kokusu (%89 kış/sonbahar). Gençler arasında yaygın." }),
  PF("bbe", "Beymen · Boyner", "Hugo Boss", "Boss Bottled Elixir", 100, 5901, { style: "odunsu", nuke: true, listTL: 7376, rank: 12, notes: "Tütsü, kakule, paçuli, amber, odun", ll: 82, sl: 70,
    when: "Okul, gündüz-gece, kış", why: "Tatlı değil, olgun ve temiz-odunsu. Tobacco Vanille'i sevmediysen önce bunu dene. Kıyafette ertesi güne kalıyor." }),
  PF("dhi50", "Beymen", "Dior", "Dior Homme Intense (50 ml)", 50, 5875, { style: "odunsu", rank: 19, notes: "İris, pudra, odun", ll: 62, sl: 40,
    when: "Şık akşam, düğün, mülakat", why: "Kadın oylamasında 8.; zarif ve 'pahalı' duran pudralı iris. Yayılımı düşük, yakın mesafe kokusu." }),
  PF("bir50", "Beymen", "Valentino", "Born in Roma Uomo Intense (50 ml)", 50, 5480, { style: "tatli", listTL: 6850, rank: 40, notes: "Vanilya, lavanta, vetiver", ll: 32, sl: 32,
    when: "Date, yakın mesafe", why: "'Kadınlar bayılıyor' yorumları çok; kremsi vanilya. Kalıcılığı zayıf, yanına küçük bir sprey al." }),
  PF("1me50", "Beymen", "Rabanne", "1 Million Elixir (50 ml)", 50, 5980, { style: "tatli", rank: 14, notes: "Vanilya, meyve, gül, odun", ll: 76, sl: 63,
    when: "Gece, parti", why: "Güçlü ve iltifat toplayan tatlı koku; bazılarına fazla tatlı/unisex gelir." }),
  PF("zara-ebony-elixir", "Zara", "Zara", "Ebony Wood Elixir Parfum", 100, 2190, { style: "odunsu", rank: 33, notes: "Odunsu, aromatik, narenciye, paçuli", ll: 84, sl: 61,
    when: "Okul, gündüz, dört mevsim", why: "Zara'nın en yüksek puanlı erkek kokusu (4,39); kalıcılık %84. Gündüz kokusu olarak en iyi fiyat/performans." }),
  PF("zara-colosso", "Zara", "Zara", "Colosso EDP", 100, 1590, { style: "odunsu", rank: 36, notes: "Deri, sıcak baharat, amber, duman", ll: 87, sl: 90,
    when: "Kış akşamı", why: "Performans oyları çok yüksek ama yalnız ~40 oy: mağazada dene, kesin karar verme." }),
  PF("zara-red-eclipse", "Zara", "Zara", "Red Eclipse EDP", 100, 1390, { style: "odunsu", rank: 42, notes: "Aromatik, deri, yumuşak baharat", ll: 61, sl: 32,
    when: "Sonbahar-kış gündüz", why: "Rasasi Hawas Fire'a benzetiliyor; Blue Zenith ile ikili set 2.190 TL." }),
  PF("zara-ebony", "Zara", "Zara", "Ebony Wood EDP (30 ml)", 30, 990, { style: "odunsu", rank: 63, notes: "Yumuşak baharat, odun, misk", ll: 28, sl: 28,
    when: "Deneme", why: "Ucuz deneme boyu; beğenirsen Elixir'e geç (Elixir çok daha kalıcı)." }),
  PF("supremacy", "Pazaryeri", "Afnan", "Supremacy Not Only Intense", 100, 3440, { style: "taze", nuke: true, rank: 10, notes: "Meyveli, dumanlı, taze", ll: 80, sl: 73,
    when: "Dört mevsim gündüz", why: "Arap muadili: beğeni %83, kalıcılık %80. Selika / Bakım Shop gibi puanı yüksek satıcıdan; 1.800 TL altı şüpheli." }),
  PF("liquid-brun", "Pazaryeri", "French Avenue", "Liquid Brun", 100, 3100, { style: "tatli", rank: 11, notes: "Tatlı, amber, vanilya, baharat", ll: 78, sl: 65,
    when: "Kış akşamı", why: "Arap muadili; önce 10 ml dekantla dene (çok tatlı). AnymoParis French Avenue distribütörü olduğunu söylüyor (doğrulanmadı); 8 Ekim'de orada stokta yok." }),
  PF("khamrah-qahwa", "Pazaryeri", "Lattafa", "Khamrah Qahwa", 100, 2200, { style: "tatli", nuke: true, rank: 4, notes: "Kahve, tarçın, pralin, vanilya", ll: 81, sl: 73,
    when: "Kış gecesi", why: "En ucuz yüksek performanslı tatlı koku; pazaryerinde sahte çok, Trendruum ve 1.200 TL altı ilan alma." }),
  PF("hawas-elixir", "Pazaryeri", "Rasasi", "Hawas Elixir", 100, 2400, { style: "tatli", rank: 8, nuke: true, notes: "Meyveli-tatlı, amber, aquatik baharat", ll: 82, sl: 74,
    when: "Sonbahar-kış, okul, akşam", why: "Beğeni %89; bütçenin yarısına nükleere yakın performans. Selika, Bakım Shop, MY GRUP: 2.040–2.700 TL. 1.800 TL altı şüpheli." }),
  PF("9pm-elixir", "Pazaryeri", "Afnan", "9PM Elixir", 100, 2400, { style: "tatli", rank: 15, nuke: true, notes: "Tatlı vanilya, baharat, amber", ll: 80, sl: 71,
    when: "Kış gecesi", why: "Ultra Male tarzı tatlı-baharatlı; kış oylarının %83'ü. n11 / Selika 2.280–2.600 TL." }),
  PF("victory-elixir", "Pazaryeri", "Rabanne", "Invictus Victory Elixir", 100, 4291, { style: "tatli", rank: 0, nuke: true, notes: "Lavanta, kakule, tütsü, vanilya, tonka", ll: 80, sl: 69,
    when: "Kış, gece, date", why: "Beğeni %89. Beymen'de yok; Akakçe'de 4.291 TL'den 21 satıcı: yetkili satıcı ve fatura iste, en ucuz ilana atlama." }),
  PF("bharara-king", "Pazaryeri", "Bharara", "King", 100, 5799, { style: "taze", rank: 3, nuke: true, notes: "Narenciye, meyveli-tatlı, amber, misk", ll: 86, sl: 81,
    when: "Dört mevsim, akşam", why: "Nükleer sınıf: kalıcılık %86, yayılım %81. Resmî Türkiye satıcısı doğrulanmadı; Akakçe 5.799 TL'den." }),
  PF("dhp50", "Beymen", "Dior", "Dior Homme Parfum (50 ml)", 50, 7005, { style: "odunsu", rank: 1, nuke: true, notes: "İris, deri, odun, pudra", ll: 85, sl: 74,
    when: "Kış akşamı, şık ortam", why: "Sıralamanın 1.si, kadın oylamasında 2.; oyların %50'si 'ebedi'. 6.000 bütçesinin ~1.000 TL üstünde." }),
  PF("sauvage-elixir60", "Beymen", "Dior", "Sauvage Elixir (60 ml)", 60, 9830, { style: "odunsu", rank: 0, nuke: true, notes: "Baharat, lavanta, meyankökü, amber", ll: 91, sl: 85,
    when: "Kış, gece; 1 sprey yeter", why: "Gerçek nükleer: oyların %60'ı 'ebedi'. Tatlı değil. Bütçenin çok üstünde; 2.500 TL'lik pazaryeri ilanları kesin sahte." }),
  PF("arabians-tonka", "Beymen", "Montale", "Arabians Tonka", 100, 13600, { style: "tatli", listTL: 16000, rank: 0, nuke: true, notes: "Safran, oud, gül, tonka, şeker kamışı", ll: 91, sl: 88,
    when: "Kış gecesi; 1 sprey yeter", why: "Listenin en güçlüsü: oyların %64'ü 'ebedi', %55'i 'devasa yayılım'. Uniseks, koyu-tatlı. Beymen tek alımda %15 indirimle 13.600 TL; Akakçe'deki 5.590 TL gri ithalat/sahte riski." })
];

/* Tahlil kartı: eşikler yetişkin erkek için yaygın referanslar (D: Endocrine Society; ferritin/B12: sık kullanılan alt sınırlar). Tanı değildir. */
const LABS = [
  { key: "d3", name: "D vitamini (25-OH)", unit: "ng/mL" }, { key: "b12", name: "B12", unit: "pg/mL" },
  { key: "ferritin", name: "Ferritin", unit: "ng/mL" }, { key: "hb", name: "Hemoglobin", unit: "g/dL" }, { key: "tsh", name: "TSH", unit: "mIU/L" }
];
/* Antrenman kaydı: Aurelius programındaki hareketler; çift ilerleme (tekrar aralığının üstü → ağırlık). */
const COMPOUND = ["Bench Press", "T-Bar Row", "Leg Press", "Hip Thrust", "Romanian Deadlift", "Barbell Squat", "Stiff Leg Deadlift", "Incline DB Press", "Shoulder Press", "Seated DB Press", "Lat Pulldown", "DB Bench Row"];
const LIFTS = [...new Set(Object.values(PROGRAM.days).flatMap(d => d.ex.map(e => e.name)))].map(name => COMPOUND.includes(name)
  ? { name, range: [6, 10], step: 2.5 } : { name, range: [10, 15], step: 1 });

const api = { PROGRAM, MONTHS, PRESET, MEALS, IFTHEN, EVENTS, BODYCHECK, PERFUMES, LABS, LIFTS };
if (typeof module === "object" && module.exports) module.exports = api; else root.ZenonPlan = api;
})(typeof self !== "undefined" ? self : this);
