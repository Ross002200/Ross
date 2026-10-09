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
    { id: "cleanser", type: "urun", cat: "Yüz · 1", name: "CeraVe Köpüren Temizleyici (yağlı-karma cilt)", size: "236 ml", priceTL: 730, where: "Kozvit (yetkili)", priority: 1, week: 1, care: ["cleanse", "pmcleanse"],
      when: "Sabah ve akşam · 30 sn",
      use: ["Yüzü ılık suyla ıslat; 1 pompa avuçta köpürt.", "Alın, burun, çene (T bölge) ve sakallı alana 30 saniye dairesel masaj; sakalın dibine de.", "Bol ılık suyla durula, havluyla bastırarak kurula (sürtme).", "Spordan sonra da bir kez yıka; günde 2'den fazla yıkama kurutur."],
      ingredients: I("Niasinamid, 3 seramid, hiyalüronik asit; nazik yüzey aktif", "Parfüm yok, sabun içermez", V(KOZ, NOSEAL, "Seramid + niasinamid bariyeri korur; retinal kullanırken önemli")),
      how: [SELLER, CHEAP + " 400 TL altı ilanlar şüpheli.", STORE_CHECK], warn: [] },
    { id: "moist", type: "urun", cat: "Yüz · 2", name: "CeraVe Yağlanma Karşıtı Nemlendirici (yüz)", size: "52 ml", priceTL: 937, where: "Yetkili eczane siteleri (51 satıcı)", priority: 2, week: 1, care: ["lotion", "gel", "cream", "pmmoist", "moistspf"],
      when: "Sabah ve akşam · temizledikten sonra",
      use: ["Nohut kadar al; alın, iki yanak, burun, çeneye nokta nokta koy, yay.", "Akşam: Comedomed'dan 10 dk sonra (retinal gecesi) ya da temizlikten hemen sonra.", "Sabah: üstüne güneş kremi gelecek; 1 dk bekle.", "Cilt retinal yüzünden kuruyorsa akşam miktarı ikiye çıkar."],
      ingredients: I("Niasinamid, seramidler, hiyalüronik asit; yağ emici yapı", "Parfüm yok; yağsız jel-krem", V(KOZ, NOSEAL, "Niasinamid yağlanma ve kızarıklıkta orta kanıt; seramidli nemlendirici retinoid tahrişini azaltır")),
      how: [SELLER, "52 ml ~937 TL; 600 TL altı ilan şüpheli.", STORE_CHECK], warn: [] },
    { id: "spf", type: "urun", cat: "Yüz · 3", name: "La Roche-Posay Anthelios UVMune 400 Oil Control SPF50+", size: "50 ml", priceTL: 591, where: "Narecza (yetkili)", priority: 3, week: 1, care: ["spf30", "spf50", "moistspf"],
      when: "Her sabah, son adım · dışarıdaysan 2–3 saatte bir",
      use: ["İki parmak boyu (işaret + orta parmak) yüz, kulak ve boyna.", "Bulutlu ve kışın da sür: retinal cildi güneşe duyarlı yapar, izler güneşte koyulaşır.", "Dışarıda uzun kalacaksan 13:00 civarı yenile.", "Akşam temizleyiciyle çıkar."],
      ingredients: I("Mexoryl 400 (uzun UVA), Tinosorb S; mat bitiş", "Alkol ve parfüm içerir: ilk gün çene altında dene", V(KOZ + "; filtreler AB'de izinli", NOSEAL, "Günlük SPF iz/leke ve yaşlanmada güçlü kanıt")),
      how: [SELLER, CHEAP + " 399–450 TL ilanlar şüpheli.", STORE_CHECK], warn: [] },
    { id: "comedomed", type: "urun", cat: "Yüz · aktif", name: "Avène Cleanance Comedomed Peeling (retinal + glikolik asit)", size: "40 ml", priceTL: 683, where: "Daffne / Kozvit (yetkili)", priority: 4, week: 1, care: ["retinoid"],
      when: "Akşam · 1–2. hafta haftada 2–3 gece, sonra gün aşırı, sonra her gece",
      use: ["Temizle, yüzü TAMAMEN kurula (ıslak cilt batar), 5 dk bekle.", "Bezelye kadar al: alın, iki yanak, çene; göz çevresi, dudak kenarı ve burun kanatlarından uzak.", "10 dk sonra nemlendirici. Batma/kızarıklık olursa bir gece ara ver ya da önce nemlendirici sür (sandviç).", "Tıraş olduğun akşam sürme. İlk 2–4 hafta birkaç sivilce çıkabilir; 8–12 haftada değerlendir."],
      ingredients: I("Retinal (retinaldehit) + glikolik asit; deve dikeni özü", "İzopropil alkol içerir; parfüm yok", V(KOZ, NOSEAL, "Retinal + glikolik: akne ve izde RKÇ (Dréno 2003); retinal C. acnes'e etkili (Pechère 1999). Reçetesiz en güçlü akne retinoidi")),
      how: ["Yetkili satıcıdan al: Daffne 683 TL (+73 kargo) ya da Kozvit 667 TL. 400 TL altı ilanlar şüpheli.", STORE_CHECK, "Aynı akşam başka asit (BHA/AHA tonik) kullanma."],
      warn: ["Sabah SPF şart."],
      alt: [{ name: "Reçete bulursan: Differin %0,1 jel (adapalen)", priceTL: 904, where: "Eczane (beyaz reçete; aile hekimi yazabilir)", why: "Kanıtı en güçlü retinoid; reçeteye ulaşırsan Comedomed yerine.",
        how: ["Aile hekimi (ASM) hastane randevusu gerektirmez.", "Reçeteyle eczaneden al; aynı akşam takvimiyle kullan."] }] },
    { id: "dercos", type: "urun", cat: "Saç · kepek", name: "Vichy Dercos Anti-Dandruff DS (selenyum disülfür)", size: "390 ml", priceTL: 1072, where: "Kozvit (yetkili)", priority: 5, week: 1, care: ["hair"],
      when: "Haftada 2–3 duş · saç derisinde 3–5 dk",
      use: ["Islak saç derisine ceviz kadar; parmak uçlarıyla (tırnakla değil) 30 sn masaj.", "3–5 dakika beklet (bu sırada vücudu yıka), sonra bol suyla durula.", "Köpüğü alından arkaya doğru durula: alın sivilcesini önler.", "Kepek geçince haftada 1'e in; arada normal şampuanın."],
      ingredients: I("Selenyum disülfür %1, salisilik asit, seramid", "Mentol ve parfüm", V(KOZ, NOSEAL, "Selenyum sülfür kepekte plasebodan üstün, ketokonazole yakın (Danby 1993, n=246)")),
      how: ["Yetkili satıcıdan al (Kozvit 390 ml 1.072 TL). 300 TL civarı ilanlar sahte riski.", STORE_CHECK, "4 haftada düzelmezse aile hekiminden ketokonazol iste."],
      warn: [],
      alt: [{ name: "Reçete bulursan: Konazol %2 şampuan (ketokonazol)", priceTL: 179, where: "Eczane (aile hekimi yazabilir)", why: "Kepekte en iyi kanıt; ucuz.", how: ["Aile hekimi yazar; 179 TL'yi sen ödersin.", "Haftada 2 kez, 3–5 dk beklet."] }] },
    { id: "paste", type: "urun", cat: "Saç · şekil 1", name: "Schwarzkopf Osis+ Mess Up (mat macun, fönsüz şekil)", size: "100 ml", priceTL: 650, where: "Kuaför ürünü satıcıları (Saçhane 'yetkili satıcı' 800 TL; Akakçe 580–700 TL, 37 satıcı)", priority: 6, week: 1, care: ["style"],
      when: "Her sabah · su ile nemlendirilmiş saça · 2 dk",
      use: ["Saçı sprey şişesiyle (ya da ıslak elle) baştan sona hafif nemlendir: damlamasın, nemli olsun.", "Nohut kadar macunu avuçlarında görünmez olana kadar ov (soğuk macun topaklanır).", "Önce yanlara ve arkaya, kalanını üste: parmaklarını köklerden sokup ön kısmı YUKARI ve hafif geriye it; dalgalar kendi dokusunu verir.",
        "10–15 dk dokunmadan havada kurumaya bırak (fön gerekmez). Kuruyunca istersen köklere az pudra.", "Gün içinde dağılırsa ıslak parmakla yeniden şekil ver: macun suyla tekrar çalışır. Akşam şampuan ya da sıcak suyla çıkar."],
      ingredients: I("Su bazlı mat macun; orta tutuş, yeniden şekillenebilir", "Ağır yağ/balmumu yok; alın çizgisine yakın sürme (sivilce)", V(KOZ, NOSEAL, "Stilist görüşü: kalın dalgalı saçta fönsüz dokulu şekil için uygun")),
      how: ["Kuaför ürünü satıcısından al: Saçhane sitesinde 'Yetkili Satıcı' etiketiyle 800 TL; Akakçe'de 580–700 TL (37 satıcı). 400 TL altı ilan sahte riski.", "Kutuda Schwarzkopf Professional ve Türkçe ithalatçı etiketi olsun.", STORE_CHECK],
      warn: ["Saçhane'nin Şikayetvar'da 91 şikayeti var (sahte/kısa miat iddiaları): paketi kamerayla aç, miadı ve barkodu kontrol et."],
      alt: [{ name: "Köpük seçeneği: L'Oréal Professionnel Tecni.Art Full Volume Extra", priceTL: 868, where: "Kuaför ürünü satıcıları", why: "Fönsüz de çalışır: nemli saça köpük, parmakla buruştur (scrunch), havada kurut. Daha dalgalı-hacimli, daha az 'quiff' görünüm.",
        how: ["Nemli saça mandalina kadar, köklere yay.", "Ön kısmı parmakla yukarı it, havada kurusun."] }] },
    { id: "powder", type: "urun", cat: "Saç · şekil 2", name: "Schwarzkopf Osis+ Dust It (mat hacim pudrası)", size: "10 g", priceTL: 730, where: "Kuaför ürünü satıcıları (39 satıcı)", priority: 7, week: 2, care: ["style"],
      when: "Saç kuruduktan sonra (macundan 10–15 dk sonra) · köklere",
      use: ["Saç tamamen kuruyunca köklere 3–4 noktaya hafifçe serp (kutuyu sallayarak, az!).", "Parmak uçlarıyla köklerden kaldırarak ovala: hacim anında gelir.", "Ön kısmı yukarı-hafif yana şekillendir; dağınık-dokulu görünüm doğru.", "Fazla pudra saçı mat-gri gösterir: az başla. Gün içinde parmakla kabartınca tazelenir."],
      ingredients: I("Silika silylate (mat hacim tozu)", "Kuru saç derisinde kaşıntı yapabilir; akşam şampuanla çıkar", V(KOZ, NOSEAL, "Stilist görüşü: ince-orta tutuş, mat bitiş; kalın dalgalı saçta yağsız seçenek")),
      how: ["39 satıcı, 730–770 TL; 400 TL altı ilan şüpheli (sahte Dust It yaygın).", "Ambalajda Schwarzkopf Professional ithalatçı etiketi olsun.", STORE_CHECK], warn: [] },
    { id: "antip", type: "urun", cat: "Vücut", name: "Rexona Men Clinical Protection stick", size: "45 ml", priceTL: 228, where: "Zincir market / eczane", priority: 8, week: 1, care: ["antip"],
      when: "AKŞAM yatmadan, kuru koltuk altına",
      use: ["Yatmadan önce tamamen kuru koltuk altına 2–3 kez sür (gece ter bezleri sakin: tıkaç oluşur).", "Sabah duş alsan da etkisi 24–48 saat sürer; sabah tekrar gerekmez.", "Tıraştan hemen sonra sürme (batar)."],
      ingredients: I("Alüminyum zirkonyum tetraklorohidreks gly", "Parfüm", V(KOZ, "—", "Klinik güçte antiperspirant; AB SCCS izinli oranlarda güvenli")), how: ["Market ya da eczane; 200–250 TL.", "'Clinical Protection' yazanı al (normal Rexona değil).", "Çok terlemeye devam edersen sonraki ay Driclor."], warn: [] },
    { id: "sirt", type: "urun", cat: "Vücut · sırt", name: "La Roche-Posay Effaclar Mikro Peeling Jel (sırt/göğüs)", size: "400 ml", priceTL: 1000, where: "Yetkili eczane", priority: 9, week: 2, care: ["backwash"],
      when: "Spordan sonraki duşta · sırt ve göğüs",
      use: ["Duşta sırt ve göğse sür (uzun saplı fırça ya da elle).", "1–2 dakika beklet (şampuan sırasında), sonra durula.", "Spor sonrası terli tişörtle bekleme: hemen duş.", "8 haftada sırt sivilcesi azalmazsa doktor."],
      ingredients: I("Salisilik asit, LHA, çinko", "SLES, mentol", V(KOZ + "; durulanan üründe SA ≤ %2,5", NOSEAL, "Salisilik asit gözenek tıkanıklığında orta kanıt")), how: [SELLER, STORE_CHECK, "400 ml 2–3 ay yeter."], warn: [] },
    { id: "barber", type: "hizmet", cat: "Görünüm", name: "Berber: low taper + dokulu quiff, kısa sakal + U boyun çizgisi", size: "Bu ay", priceTL: 800, where: "Kendi berberin", priority: 10, week: 1,
      when: "Tam kesim 4–6 haftada bir · yan/ense ve boyun 2–3 haftada bir",
      use: ["Neden bu kesim: yüzün yuvarlağa yakın ve dolgun, saçın kalın-dalgalı. Üstte yükseklik + yanlarda sıkılık yüzü uzun ve ince gösterir; dalgan doğal hacim verir.",
        "Sakal neden böyle: yanaklar kısa (genişlik eklemez), çene biraz uzun (yüzü uzatır), boyun çizgisi çene altında gölge bırakır (gıdı görünmez).",
        "Fönsüz şekil: nemli saça macun, parmakla yukarı-geri, havada kurut. Evde Braun makinenle: 2–3 günde bir boyun altını 0,5–1 mm al, yanak taşmalarını temizle; çene 7–8 mm tarakla.",
        "Örnek görselleri berbere göster (aşağıdaki bağlantılar)."],
      how: ["Saç (berbere aynen oku): 'Yanlar ve ense LOW TAPER, alttan 1,5–3 mm'den başlayıp yukarı açılsın. Skin fade istemiyorum, şakak ve köşe çizgisi çizme. Üst önde 6–8 cm, tepeye doğru 4–5 cm. Makasla doku ver (point cut), sıfırlama. Yanlardaki hacmi al; perçemi yukarı-geriye şekillendireceğim.'",
        "Sakal: 'Yanaklar 3–4 mm, çene ve bıyık 7–8 mm. Boyun çizgisi gırtlağın 1,5–2 parmak üstünden kulak arkasına U şeklinde. Boyun altı makineyle 0,5–1 mm, jilet yok. Yanak çizgisini doğal bırak, sadece taşanları al.'",
        "Kaş: 'Sadece kaş arasını al; şekil verme.'",
        "Örnekler — saç: fashionbeans.com/article/low-taper-fade · rush.co.uk/blog/hairstyles-for-men-with-round-faces · Pinterest: 'low taper textured quiff wavy hair'.",
        "Örnekler — sakal: beardresource.com/short-boxed-beard · Pinterest: 'short boxed beard round face'."],
      links: [["Low taper + quiff örnekleri", "https://www.fashionbeans.com/article/low-taper-fade"], ["Yuvarlak yüze uygun kesimler", "https://rush.co.uk/blog/hairstyles-for-men-with-round-faces"],
        ["Pinterest: low taper textured quiff wavy", "https://www.pinterest.com/search/pins/?q=low%20taper%20textured%20quiff%20wavy%20hair"], ["Kısa kutu sakal örnekleri", "https://beardresource.com/short-boxed-beard/"],
        ["Pinterest: short boxed beard round face", "https://www.pinterest.com/search/pins/?q=short%20boxed%20beard%20round%20face"]],
      warn: ["800 TL tahmini (fiyat toplanmadı)."] },
    { id: "kreatin", type: "takviye", cat: "Takviye", name: "Kreatin monohidrat (Creapure ya da mikronize)", size: "250–300 g (2 ay)", priceTL: 780, where: "Hardline / HIQ Creapure (yetkili satıcı)", priority: 12, week: 2,
      when: "Her gün, saat fark etmez · 3–5 g (1 silme ölçek)",
      use: ["Günde 3–5 g: suya, yoğurda ya da ayrana karıştır; tadı yok.", "Antrenman olmayan günler de iç: kas içinde birikerek çalışır (2–4 haftada dolar).", "Yükleme dozu gerekmez; gün içinde 2–2,5 L su iç.", "İlk haftalarda 1–2 kg kilo artışı su tutulmasıdır, yağ değil: tartıda panik yapma."],
      ingredients: I("Kreatin monohidrat; günde 3–5 g", "Böbrek hastalığın varsa kullanma; ilk haftalarda 1–2 kg su tutma normaldir (yağ değil)", V("Gıda takviyesi: Tarım ve Orman Bakanlığı onay no'su kutuda olmalı", "Creapure (Almanya) ya da Informed Sport mührü varsa daha iyi", "Güçlü: ISSN 2017 pozisyon bildirgesi, ağırlık antrenmanında güç ve yağsız kütle artışı")),
      how: ["Doktora kreatin kullanacağını söyle; tahlilde kreatinin normalse başla.", "Hardline %100 Mikronize 300 g ~780 TL ya da HIQ Creapure 250 g ~999 TL; 'yükleme' gerekmez, her gün 3–5 g.",
        "Saat fark etmez; suya, yoğurda ya da shake'e karıştır. Antrenman olmayan günler de iç.", "Kutuda Bakanlık onay numarası ve son kullanma tarihi olmayan ilanı alma.", "Aldığında 'Aldım'a bas: Bugün listesine günlük hatırlatma eklenir."], warn: [] },
    { id: "parfum", type: "parfum", cat: "Parfüm", name: "Ana parfüm: Beymen ya da Boyner'de dene, birini al (Alınacaklar → Parfüm'de karşılaştır)", size: "50–100 ml", priceTL: 6000, where: "Beymen / Boyner (mağazanın kendi satışı)", priority: 11, week: 2, when: "Her sabah; date/akşam öncesi tazele",
      use: ["Duştan sonra, kuru tene: boynun iki yanı + göğüs (tatlı/güçlü kokularda 2 sprey yeter).", "Bileğe sıkıp ovma: üst notaları ezer.", "Kıyafete değil tene; kalıcılığı artırmak için önce kokusuz nemlendirici.", "Okul/kapalı alan: 1–2 sprey; akşam/date: 3 sprey. 'Günün kokusu' kartı hangi kokuyu seçeceğini söyler."],
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
    { id: "barber-nov", type: "hizmet", cat: "Görünüm", name: "Berber: yan/ense + sakal düzeltme", size: "Kasım", priceTL: 500, where: "Kendi berberin", priority: 1, week: 1,
      when: "Ekim kesiminden 3–4 hafta sonra", use: ["Yalnız yanlar, ense ve boyun çizgisi; üstü uzat.", "Aynı metni berbere oku (Ekim berber maddesi).", "Tam kesim 6. haftada."],
      how: ["Ekim'deki kesimden 3–4 hafta sonra randevu al.", "Üst kısma dokunulmasın: quiff için uzunluk gerekiyor.", "Fiyat tahmini; bütçeye dahil."], warn: [] },
    { id: "d3", type: "takviye", optional: true, cat: "Takviye", name: "D3 vitamini (yalnız tahlilde düşükse)", size: "1000 IU damla/tablet", priceTL: 250, where: "Eczane", priority: 0, week: 2,
      ingredients: I("Kolekalsiferol (D3)", "Tahlilsiz yüksek doz alma; doz tahlil sonucuna göre", V("Eczane ürünü; Bakanlık onaylı", "—", "Eksiklik varsa güçlü; eksiklik yoksa ek fayda zayıf")),
      how: ["Önce tahlil: D vitamini (25-OH) sonucunu e-Nabız'dan gör.", "20 ng/mL altıysa doktorun söylediği dozla başla; normalse alma.", "Eczaneden 1000 IU damla ya da tablet ~150–300 TL; yağlı bir öğünle iç."], warn: [] },
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
  amMinutes: 5, budget: "den", currentProducts: "", minimal: true
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

/* Nereden alınır: güven sırası (8–9 Ekim 2026 araştırması; research_notes/Glow up koçluk planı/nereden_alinir.md). */
const WHERE = {
  trust: [
    { name: "Fiziksel eczane", for: "CeraVe, La Roche-Posay, Avène, Vichy, kreatin dışı her şey", why: "Ürün distribütörden gelir (L'Oréal Türkiye: CeraVe/LRP/Vichy). Sahte riski en düşük; fiyat liste fiyatı olabilir." },
    { name: "Eczane siteleri (Akakçe'de 'Yetkili satıcı' rozetli)", for: "Dermokozmetik: Kozvit, Daffne, Narecza, Evdeeczane, Turuncukasa", why: "Arkasında eczane var, fiyatlar genelde en iyisi. Akakçe'de 'Yetkili satıcı en ucuz' satırına bak." },
    { name: "Beymen / Boyner (mağazanın kendi satışı)", for: "CeraVe (Beymen), LRP güneş kremi (Boyner), parfüm", why: "Kurumsal mağaza, fatura ve kolay iade. CeraVe'de eczane sitelerinden ~%10–15 pahalı (ör. yağlanma karşıtı nemlendirici 1.076 TL sepette)." },
    { name: "Kuaför ürünü satıcıları", for: "Osis+ Mess Up / Dust It", why: "Schwarzkopf Professional kuaför kanalıyla satılır; Saçhane 'Yetkili Satıcı' etiketli ama şikayet sayısı yüksek: paketi kamerayla aç." },
    { name: "Market / zincir eczane", for: "Rexona Clinical", why: "Kitle ürünü; sahte riski düşük." }
  ],
  avoid: ["Trendyol/Hepsiburada'da rozetsiz, fiyatı yetkili satıcının %30+ altında olan ilanlar", "Cosmolog / Cosmoland (sahte ürün şikayetleri)", "Faturadaki firma adı satıcıyla aynı değilse", "Barkodu ÜTS Mobil'de çıkmayan ya da kutu ile şişe barkodu farklı ürün"],
  sephora: "Sephora Türkiye'de CeraVe/La Roche-Posay görünmüyor; erkek bakımı Clinique vb. (ör. Moisture Surge 30 ml 1.425 TL) — aynı işi daha pahalıya yapar.",
  zara: "Zara'da erkek cilt/saç bakımı yok; yalnız parfüm (Parfüm sekmesinde)."
};

const api = { PROGRAM, MONTHS, PRESET, MEALS, IFTHEN, EVENTS, BODYCHECK, PERFUMES, LABS, LIFTS, WHERE };
if (typeof module === "object" && module.exports) module.exports = api; else root.ZenonPlan = api;
})(typeof self !== "undefined" ? self : this);
