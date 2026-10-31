/* Zenon 師 Koç · plan verisi: antrenman programı (Aurelius'tan kopya), aylık alışveriş listesi ve "Nasıl alınır" rehberleri.
   Tarayıcıda window.ZenonPlan, node'da require(). Fiyatlar 6–7 Ekim 2026; kaynaklar Masaüstü/reports altındaki raporlar. */
(function (root) {
"use strict";
const ex = rows => rows.map(([name, sets, reps]) => ({ name, sets, reps }));

/* Aurelius "Hipertrofi" programı (Alt/Üst, 4 gün; Pazar salon kapalı). Aurelius'ta Pazartesi=0; burada JS günü: Pazar=0, Pazartesi=1.
   Zenon Aurelius'a bağlıysa program oradan okunur ve bu nesnenin üzerine yazılır (zenon.js: applyAurProgram); bu, bağlantı yokken kullanılan kopyadır.
   Gerekçe ve kaynaklar: Masaüstü/reports/Aurelius koç - Antrenman programı.md */
const PROGRAM = {
  days: {
    1: { focus: "Alt A", ex: ex([["Leg Press", 3, "8–12"], ["Romanian Deadlift", 3, "8–10"], ["Seated Leg Curl", 3, "10–15"], ["Leg Extension", 2, "12–15"], ["Standing Calf Raise", 3, "10–15"], ["Cable Crunch", 2, "10–15"]]) },
    3: { focus: "Üst A · kısa", ex: ex([["Incline Smith / DB Press", 3, "8–12"], ["Chest-Supported Row", 3, "8–12"], ["Cable Lateral Raise", 3, "12–20"], ["Overhead Cable Triceps Extension", 2, "10–15"], ["Incline DB Curl", 2, "10–15"]]) },
    5: { focus: "Alt B", ex: ex([["Hack Squat / Smith Squat", 3, "8–12"], ["Seated Leg Curl", 3, "10–15"], ["Leg Extension", 3, "12–15"], ["Hip Thrust", 2, "8–12"], ["45° Hyperextension", 2, "10–15"], ["Standing Calf Raise", 3, "10–15"]]) },
    6: { focus: "Üst B · uzun", ex: ex([["Lat Pulldown", 3, "8–12"], ["Machine Chest Press / DB Bench", 3, "8–12"], ["Seated Cable Row", 3, "8–12"], ["Pec Deck / Cable Fly", 2, "12–15"], ["Machine Shoulder Press", 2, "8–12"], ["Cable Lateral Raise", 3, "12–20"], ["Preacher Curl", 3, "10–15"], ["Triceps Pushdown", 3, "10–15"], ["Reverse Pec Deck", 2, "12–20"]]) }
  },
  cardio: { 2: 35, 4: 35 },
  advice: [
    "İlk 2 hafta her hareket 2 set, tükenişe 3 tekrar kala bırak: amaç formu ve başlangıç ağırlıklarını bulmak.",
    "3. haftadan itibaren yazan setler, tükenişe 1–2 tekrar kala. Tüm setlerde tekrar aralığının üstüne çıkınca ağırlığı artır.",
    "Her tekrarda 2–3 saniyede kontrollü in. 9. hafta setleri yarıya indir; sonra program kayıtlarına göre güncellenir."
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
    { id: "cleanser", type: "urun", cat: "Yüz · 1", name: "CeraVe Köpüren Temizleyici (yağlı-karma cilt)", size: "473 ml (büyük boy daha ucuz)", priceTL: 788, where: "Kozvit", shop: "Kozvit", priority: 1, week: 1, care: ["cleanse", "pmcleanse"],
      when: "Sabah ve akşam · 30 sn",
      use: ["Yüzü ılık suyla ıslat; 1 pompa avuçta köpürt.", "Alın, burun, çene (T bölge) ve sakallı alana 30 saniye dairesel masaj; sakalın dibine de.", "Bol ılık suyla durula, havluyla bastırarak kurula (sürtme).", "Spordan sonra da bir kez yıka; günde 2'den fazla yıkama kurutur."],
      ingredients: I("Niasinamid, 3 seramid, hiyalüronik asit; nazik yüzey aktif", "Parfüm yok, sabun içermez", V(KOZ, NOSEAL, "Seramid + niasinamid bariyeri korur; retinal kullanırken önemli")),
      how: [SELLER, CHEAP + " 400 TL altı ilanlar şüpheli.", STORE_CHECK], warn: [] },
    { id: "moist", type: "urun", cat: "Yüz · 2", name: "CeraVe Moisturising Lotion (nemlendirici losyon)", size: "236 ml", priceTL: 636, where: "Kozvit", shop: "Kozvit", priority: 2, week: 1, care: ["lotion", "gel", "cream", "pmmoist", "moistspf"],
      when: "Sabah ve akşam · temizledikten sonra",
      use: ["Yüz için YARIM pompa (nohut kadar) yeter: alın, iki yanak, burun, çeneye nokta nokta koy, yay. Fazlası yağlı hissettirir.", "Sabah: üstüne güneş kremi gelecek; 1 dk bekle.", "Akşam: Comedomed gecesiyse ondan 10 dk sonra; değilse temizlikten hemen sonra.", "236 ml uzun gider: duştan sonra kollara ve tıraş edilen boyna da sürebilirsin.", "Cilt retinal yüzünden kuruyup pul pul olursa akşam miktarı bir pompaya çıkar."],
      ingredients: I("3 seramid, hiyalüronik asit, gliserin; hafif losyon", "Parfüm yok; yağlanma karşıtı jel-kremden bir tık daha zengin: az sür", V(KOZ, NOSEAL, "Seramidli nemlendirici bariyeri onarır ve retinoid tahrişini azaltır (orta kanıt)")),
      how: ["Kozvit'ten alındı (636,41 TL).", "Yüz yağlı kalırsa miktarı azalt; ürün komedojenik değil.", STORE_CHECK], warn: [] },
    { id: "spf", type: "urun", cat: "Yüz · 3", name: "La Roche-Posay Anthelios UVMune 400 Fluid SPF50+", size: "50 ml", priceTL: 950, where: "Kozvit (65 yorum, 4,9)", shop: "Kozvit", priority: 3, week: 1, care: ["spf30", "spf50", "moistspf"],
      when: "Her sabah, son adım · dışarıdaysan 2–3 saatte bir",
      use: ["İki parmak boyu (işaret + orta parmak) yüz, kulak ve boyna.", "Bulutlu ve kışın da sür: retinal cildi güneşe duyarlı yapar, izler güneşte koyulaşır.", "Dışarıda uzun kalacaksan 13:00 civarı yenile.", "Akşam temizleyiciyle çıkar."],
      ingredients: I("Mexoryl 400 (uzun UVA), Tinosorb S; akışkan, hafif", "Parfüm içerebilir: ilk gün çene altında dene", V(KOZ + "; filtreler AB'de izinli", NOSEAL, "Günlük SPF iz/leke ve yaşlanmada güçlü kanıt")),
      how: [SELLER, CHEAP + " 399–450 TL ilanlar şüpheli.", STORE_CHECK], warn: [] },
    { id: "comedomed", type: "urun", cat: "Yüz · aktif", name: "Avène Cleanance Comedomed Peeling (retinal + glikolik asit)", size: "40 ml", priceTL: 634, where: "Kozvit", shop: "Kozvit", priority: 4, week: 1, care: ["retinoid"],
      when: "Akşam · 1–2. hafta haftada 2–3 gece, sonra gün aşırı, sonra her gece",
      use: ["Temizle, yüzü TAMAMEN kurula (ıslak cilt batar), 5 dk bekle.", "Bezelye kadar al: alın, iki yanak, çene; göz çevresi, dudak kenarı ve burun kanatlarından uzak.", "10 dk sonra nemlendirici. Batma/kızarıklık olursa bir gece ara ver ya da önce nemlendirici sür (sandviç).", "Tıraş olduğun akşam sürme. İlk 2–4 hafta birkaç sivilce çıkabilir; 8–12 haftada değerlendir."],
      ingredients: I("Retinal (retinaldehit) + glikolik asit; deve dikeni özü", "İzopropil alkol içerir; parfüm yok", V(KOZ, NOSEAL, "Retinal + glikolik: akne ve izde RKÇ (Dréno 2003); retinal C. acnes'e etkili (Pechère 1999). Reçetesiz en güçlü akne retinoidi")),
      how: ["Kozvit'ten alındı (633,65 TL).", STORE_CHECK, "Aynı akşam başka asit (BHA/AHA tonik) kullanma."],
      warn: ["Sabah SPF şart."],
      alt: [{ name: "Reçete bulursan: Differin %0,1 jel (adapalen)", priceTL: 904, where: "Eczane (beyaz reçete; aile hekimi yazabilir)", why: "Kanıtı en güçlü retinoid; reçeteye ulaşırsan Comedomed yerine.",
        how: ["Aile hekimi (ASM) hastane randevusu gerektirmez.", "Reçeteyle eczaneden al; aynı akşam takvimiyle kullan."] }] },
    { id: "shampoo", type: "urun", cat: "Saç · yıkama", name: "Zara Hair Shampoo Fleur Blossom", size: "500 ml", priceTL: 899, where: "Zara", shop: "Zara", priority: 5, week: 1, care: ["hair"],
      when: "Haftada 3 gün (Pzt-Çar-Cmt) · akşam duşunda · saç derisine",
      use: ["Islak saça 1 pompa; YALNIZ saç derisine parmak uçlarıyla 30 sn masaj (tırnak yok).", "Köpük uçlara kendiliğinden iner; uçları ovalama.", "Ilık suyla iyice durula; alından arkaya doğru (köpük yüze akmasın).", "Hemen ardından Davines LOVE Curl saç kremi."],
      ingredients: I("Parfümlü günlük şampuan (mimoza, müge, misk)", "İçerik listesi doğrulanamadı; parfümü yoğun: saç derisinde kaşıntı ya da alında sivilce artarsa haftada 2'ye in", V("Zara'nın kendi ürünü: orijinal", NOSEAL, "Bağımsız veri yok; şampuan görünüme en az etki eden adım")),
      how: ["Zara'dan alındı (~899 TL).", "500 ml haftada 3 yıkamayla 4–5 ay gider.", "Saç kurur/matlaşırsa: şampuanı azalt, kremi artır."], warn: [] },
    { id: "conditioner", type: "urun", cat: "Saç · bakım", name: "Davines LOVE Curl Saç Kremi (dalgalı saç)", size: "250 ml", priceTL: 1760, where: "Saçhane", shop: "Saçhane", priority: 6, week: 1, care: ["hair"],
      when: "Her saç yıkamada (Pzt-Çar-Cmt), şampuandan sonra · 2 dk",
      use: ["Şampuanı duruladıktan sonra saçın suyunu elinle sık.", "Ceviz kadar kremi YALNIZ saç tellerine ve uçlara sür; saç derisine ve alına değil.", "Parmaklarını tarak gibi kullanıp dağıt; 2 dakika beklet (bu sırada vücudunu yıka).", "Ilık-serin suyla durula ama tamamen değil: saç hafif kaygan kalsın. 'Cansız' görünümü alan adım bu.", "Havluyla ovalama; bastırarak ya da eski pamuklu tişörtle kurula."],
      ingredients: I("Aloe vera, gliserin, baobab; yumuşatıcı yağ alkolleri (yeni formül silikonsuz)", "Parfüm içerir; durularken başı arkaya eğ (alına bulaşmasın)", V(KOZ, NOSEAL, "Dalgalı saç için formüle; saç kremi kırılma ve kabarmayı azaltır (AAD)")),
      how: ["Saçhane'den alındı (1.760 TL).", "Paketi kamerayla aç; son kullanma tarihi ve barkodu kontrol et.", STORE_CHECK], warn: [] },
    { id: "styler", type: "urun", cat: "Saç · şekil", name: "Davines Forming Pomade (görünmez şekillendirici)", size: "75 ml", priceTL: 1725, where: "Saçhane", shop: "Saçhane", priority: 7, week: 1, care: ["style"],
      when: "Her sabah · su spreyiyle nemlendirilmiş saça · 2 dk",
      use: ["Su spreyiyle saçı baştan sona nemlendir (damlamasın).", "NOHUT kadar al (az!): avuçlarında tamamen eriyip görünmez olana kadar ov.", "Önce arkaya ve yanlara, sonra üste; köklerden uçlara parmaklarını geçir. Alın çizgisine sürme.", "Ön kısmı parmaklarla yukarı ve hafif geriye/yana it; tarama. 10–15 dk havada kurusun.", "Kuruyunca parmak uçlarıyla bir kez kabart. Gün içinde dağılırsa ıslak parmakla yeniden şekil ver.", "Akşam duş yoksa yatmadan saçı suyla ıslatıp parmakla aç: ürün yastığa ve alına geçmesin."],
      ingredients: I("Shea yağı, karnauba mumu, PVP, zeytin özü, gliserin; orta tutuş, doğal bitiş", "Shea ve mum içerir: alın çizgisine ve tene bulaşırsa sivilce yapabilir; fazla sürersen ağırlaştırır", V(KOZ, NOSEAL, "Üretici: orta, yeniden şekillenebilir tutuş; kuru ya da nemli saça, havada kurutulabilir")),
      how: ["Saçhane'den alındı (1.725 TL).", "75 ml nohut kadar kullanımla 3–4 ay gider.", STORE_CHECK], warn: ["Az kullan: fazlası saçı yağlı ve cansız gösterir, tam tersine çalışır."] },
    { id: "toothpaste", type: "urun", cat: "Diş", name: "Sensodyne Gentle Whitening (florürlü, düşük aşındırıcı)", size: "75 ml", priceTL: 250, where: "Market / eczane", shop: "Market", priority: 8, week: 1,
      when: "Sabah ve akşam · elektrikli fırçayla 2 dk",
      use: ["Nohut kadar macun; elektrikli fırçayı dişe değdir, bastırma; her bölgeye 30 sn.", "Fırçaladıktan sonra tükür ama suyla ÇALKALAMA: florür dişte kalsın (mineyi güçlendiren asıl şey bu).", "Kahve/çay/kola sonrası 30 dk bekle, sonra fırçala (asit mineyi yumuşatır).", "Gerçek beyazlık için diş taşı temizliği + cila (aşağıdaki madde)."],
      ingredients: I("Sodyum florür (~1450 ppm), potasyum nitrat (hassasiyet), düşük aşındırıcı silika", "Beyazlatıcı macunlar yalnız yüzey lekesini alır; dişin rengini değiştirmez", V(KOZ, "—", "Florür çürük önlemede güçlü kanıt; beyazlatıcı macunların etkisi küçük (sistematik derlemeler)")),
      how: ["Market ya da eczane; 230–260 TL.", "Kutuda 1450 ppm florür yazdığını kontrol et.", "Biorepair (hidroksiapatit) daha pahalı ve beyazlatma kanıtı ön çalışma düzeyinde."], warn: [] },
    { id: "dentist", type: "hizmet", cat: "Diş", name: "Diş taşı temizliği + cila (diş hekimi)", size: "Bir kez", priceTL: 0, where: "ADSM (devlet ağız-diş, MHRS) ya da özel klinik", priority: 9, week: 2,
      when: "Bu ay bir kez · sonra 6 ayda bir",
      use: ["Tek seferde en görünür diş farkı: taş ve lekeler alınır, cila parlatır.", "Hekime sor: 'Diş eti sağlığım nasıl, beyazlatma için uygun muyum?'", "Daha beyaz istersen hekim kontrolünde beyazlatma (ofis ya da ev tipi plak); internetten güçlü bant alma.", "Fiyat kliniğe göre değişir; ADSM'de MHRS randevusuyla katkı payı düşük."],
      how: ["MHRS → Ağız ve Diş Sağlığı → en yakın ADSM; ya da özel klinik.", "Randevu tarihini Zenon'a etkinlik olarak ekle.", "Fiyat bilgisi toplanmadı; bütçeye 0 TL yazıldı."], warn: [] },
    { id: "barber", type: "hizmet", cat: "Görünüm", name: "Berber: low taper + dokulu quiff, kısa sakal + U boyun çizgisi", size: "Bu ay", priceTL: 800, where: "Kendi berberin", priority: 10, week: 1,
      when: "Tam kesim 4–6 haftada bir · yan/ense ve boyun 2–3 haftada bir",
      use: ["Neden bu kesim: yüzün yuvarlağa yakın ve dolgun, saçın kalın-dalgalı. Üstte yükseklik + yanlarda sıkılık yüzü uzun ve ince gösterir; dalgan doğal hacim verir.",
        "Sakal neden böyle: yanaklar kısa (genişlik eklemez), çene biraz uzun (yüzü uzatır), boyun çizgisi çene altında gölge bırakır (gıdı görünmez).",
        "Fönsüz şekil: nemli saça Forming Pomade, parmakla yukarı-geri, havada kurut. Evde Braun makinenle: 2–3 günde bir boyun altını 0,5–1 mm al, yanak taşmalarını temizle; çene 7–8 mm tarakla.",
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
    { id: "parfum", type: "parfum", cat: "Parfüm", name: "Zara Fashionably London Elixir Parfum (Jo Loves)", size: "100 ml", priceTL: 2190, where: "Zara", shop: "Zara", priority: 11, week: 1,
      choices: ["zara-fle", "extradose50", "lhi50", "zara-ebony-elixir"],
      when: "Okul günleri 2 sprey · akşam/özel gün 3 sprey",
      use: ["Çok güçlü bir koku (yayılım oyları %83): okulda 2 sprey YETER — ense + göğüs (tişört altına).", "Akşam ya da açık havada üçüncü sprey ceket/kazak yakasına.", "Bileğe sıkıp ovma. 20–30 dk sonra kendi kokunu almazsın; çevren alır: tazeleme yapma.", "Giyinmeden önce, saç ve yüz bittikten sonra sık (son adım)."],
      ingredients: I("Bergamot, gül, şakayık, temiz misk; çiçeksi-odunsu", "Gül ağırlıklı ve uniseks: çok sıkarsan baskın olur", V("Zara'nın kendi ürünü: orijinal", "—", "Fragrantica (131 oy): kalıcılık %86, yayılım %83, beğeni %86")),
      how: ["Zara'dan alındı (2.190 TL).", "İlk gün evde 1 sprey dene: tenin nasıl taşıdığını gör.", "Güneş almayan, serin bir yerde sakla (banyo değil)."],
      warn: ["Veri az (131 oy) ama oranlar çok güçlü. Gül-misk kokusu klasik 'erkek parfümü' değil; dikkat çekici ve az bilinen."],
      alt: [{ name: "Sonra (istersen): Valentino Born in Roma Extradose 50 ml", priceTL: 5480, where: "Beymen", why: "Daha maskülen (lavanta-baharat-odun) akşam kokusu; kalıcılık %78, yayılım %67.",
        how: ["8 hafta sonra hâlâ ikinci koku istiyorsan.", "Beymen'de testerı dene."] }] }
  ],
  "2026-11": [
    { id: "barber-nov", type: "hizmet", cat: "Görünüm", name: "Berber: yan/ense + sakal düzeltme", size: "Kasım", priceTL: 500, where: "Kendi berberin", priority: 1, week: 1,
      when: "Ekim kesiminden 3–4 hafta sonra", use: ["Yalnız yanlar, ense ve boyun çizgisi; üstü uzat.", "Aynı metni berbere oku (Ekim berber maddesi).", "Tam kesim 6. haftada."],
      how: ["Ekim'deki kesimden 3–4 hafta sonra randevu al.", "Üst kısma dokunulmasın: quiff için uzunluk gerekiyor.", "Fiyat tahmini; bütçeye dahil."], warn: [] },
    { id: "d3", type: "takviye", optional: true, cat: "Takviye", name: "D3 vitamini (yalnız tahlilde düşükse)", size: "1000 IU damla/tablet", priceTL: 250, where: "Eczane", priority: 0, week: 2,
      ingredients: I("Kolekalsiferol (D3)", "Tahlilsiz yüksek doz alma; doz tahlil sonucuna göre", V("Eczane ürünü; Bakanlık onaylı", "—", "Eksiklik varsa güçlü; eksiklik yoksa ek fayda zayıf")),
      how: ["Önce tahlil: D vitamini (25-OH) sonucunu e-Nabız'dan gör.", "20 ng/mL altıysa doktorun söylediği dozla başla; normalse alma.", "Eczaneden 1000 IU damla ya da tablet ~150–300 TL; yağlı bir öğünle iç."], warn: [] },
    { id: "parfum2", type: "parfum", optional: true, cat: "Parfüm", name: "İkinci koku (isteğe bağlı): Zara Ebony Wood Elixir 100 ml (okul/gündüz)", size: "100 ml", priceTL: 2190, where: "Zara", shop: "Zara", priority: 4, week: 2,
      ingredients: I("Odunsu, aromatik, narenciye, paçuli; gündüz kokusu", "Oy sayısı az (223): mağazada dene", V("Zara'nın kendi ürünü: orijinal", "—", "Fragrantica: kalıcılık %84, yayılım %61, beğeni %87")),
      how: ["Zara mağazasında testerla dene.", "Okul günleri bu, akşam Extradose.", "2.190 TL; sahte riski yok."], warn: [] }
  ]
};

const PRESET = {
  skin: "combo", issues: ["acne", "blackheads", "marks", "pores", "ingrown"],
  beard: { style: "stubble", density: "dense" },
  hair: { type: "wavy", oilyScalp: false, dandruff: false, thinning: false, lastCut: null }, sweat: "mid",
  times: { weekday: { wake: "07:30", sleep: "23:30" }, weekend: { wake: "09:30", sleep: "00:30" }, gymDays: [1, 3, 5, 6], gym: "18:00" },
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
  PF("zara-fle", "Zara", "Zara", "Fashionably London Elixir Parfum", 100, 2190, { rank: 0, nuke: true, style: "taze", notes: "Bergamot, gül, şakayık, misk", ll: 86, sl: 83,
    when: "Okul (2 sprey), gündüz-akşam", why: "Jo Loves işbirliği; az bilinen ve çok güçlü. Temiz, 'pahalı' duran gül-misk." }),
  PF("extradose50", "Beymen", "Valentino", "Born in Roma Extradose Uomo (50 ml)", 50, 5480, { listTL: 6850, rank: 0, nuke: false, style: "odunsu", notes: "Lavanta, sıcak baharat, odun, vanilya-vetiver", ll: 78, sl: 67,
    when: "Okul (2 sprey), akşam, date", why: "2025'te çıktı; yeni çıkanlar içinde performansta açık ara önde, maskülen ve fazla tatlı değil. Born in Roma serisi kadınlar arasında çok beğenilir." }),
  PF("lhi50", "Beymen", "Guerlain", "L'Homme Idéal EDP (50 ml)", 50, 6060, { listTL: 7130, rank: 0, style: "tatli", notes: "Badem, vişne, tonka, deri", ll: 55, sl: 25,
    when: "Akşam, sonbahar-kış", why: "Sevdiğin koku; zarif ve 'pahalı'. Yayılımı düşük: yakından fark edilir." }),
  PF("ahsee50", "Beymen", "Chanel", "Allure Homme Sport Eau Extrême (50 ml)", 50, 5900, { rank: 0, style: "taze", notes: "Mandalina, nane, tonka, misk, sedir", ll: 52, sl: 36,
    when: "Okul, gündüz, dört mevsim", why: "Forumlarda okul için 'taze ama özgün' diye önerilir; sakin ve şık." }),
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
/* Tekrar aralığı programdaki "8–12" yazımından okunur; ağır bileşik hareketlerde (alt sınır ≤ 8) adım 2,5 kg, diğerlerinde 1 kg. */
const rangeOf = reps => { const m = /(\d+)\D+(\d+)/.exec(reps || ""); return m ? [+m[1], +m[2]] : [8, 12]; };
function liftsOf(program) {
  const seen = new Map();
  Object.values(program.days).forEach(d => d.ex.forEach(e => { if (!seen.has(e.name)) { const range = rangeOf(e.reps); seen.set(e.name, { name: e.name, range, step: range[0] <= 8 ? 2.5 : 1 }); } }));
  return [...seen.values()];
}
const LIFTS = liftsOf(PROGRAM);

/* Alınanlar (10 Ekim 2026 siparişleri) ve haftalık düzen. Günler JS haftası: 0 Paz … 6 Cmt. */
const PURCHASED = { date: "2026-10-10", ids: ["cleanser", "moist", "spf", "comedomed", "shampoo", "conditioner", "styler", "parfum"], parfum: "Zara Fashionably London Elixir Parfum", shelf: "zara-fle" };
const WEEK = {
  school: [2, 3, 4],                      // Sal, Çar, Per
  hairWash: [1, 3, 6],                    // Pzt, Çar, Cmt: şampuan + saç kremi
  laundry: { 5: "Çamaşır: spor kıyafetleri + havlular (60°)", 0: "Çamaşır: kıyafetler + nevresim ve yastık kılıfı" },
  pillow: [3, 0],
  rows: [
    [1, "Pzt", "—", "Alt A", "Tam duş + saç (şampuan + krem)", "—"],
    [2, "Sal", "Okul", "Yürüyüş 35 dk", "Hızlı duş (saç yok)", "—"],
    [3, "Çar", "Okul", "Üst A (kısa)", "Tam duş + saç (şampuan + krem)", "Yastık kılıfı"],
    [4, "Per", "Okul", "Yürüyüş 35 dk", "Hızlı duş (saç yok)", "—"],
    [5, "Cum", "—", "Alt B", "Hızlı duş (saç yok)", "Spor kıyafetleri + havlular"],
    [6, "Cmt", "—", "Üst B (uzun)", "Tam duş + saç (şampuan + krem)", "—"],
    [0, "Paz", "—", "Dinlenme", "Hızlı duş (saç yok)", "Kıyafetler + nevresim"]
  ]
};

/* Sepetler: iki yetkili site. */
const SHOPS = {
  Kozvit: { url: "https://www.kozvit.com", note: "Eczane tabanlı dermokozmetik sitesi; CeraVe, La Roche-Posay, Vichy fiyatları en iyiler arasında." },
  "Saçhane": { url: "https://sachane.com", note: "Kuaför ve dermokozmetik ürünlerinde 'Yetkili Satıcı' etiketli; paketi kamerayla aç." },
  Zara: { url: "https://www.zara.com/tr/", note: "Zara'nın kendi ürünü; orijinal garantili." },
  Beymen: { url: "https://www.beymen.com/tr", note: "Beymen'in kendi satışı; faturalı, kolay iade. 'Tek %20' indirimi sepette uygulanır." },
  Market: { url: "", note: "Zincir market ya da eczane." }
};
/* Sabah 10 dakika: yüz + saç birlikte (dakika). */
const MORNING10 = [
  { min: 1, t: "Yüzü CeraVe köpüren temizleyiciyle 30 sn yıka, bastırarak kurula" },
  { min: 1, t: "Saçı su spreyiyle baştan sona nemlendir (damlamasın)" },
  { min: 1, t: "Yüze yarım pompa CeraVe losyon" },
  { min: 2, t: "Saç: nohut kadar Forming Pomade'i avuçta erit, köklerden uçlara; ön kısım yukarı-geri" },
  { min: 1, t: "Yüz, kulak ve boyna iki parmak La Roche-Posay SPF50+" },
  { min: 3, t: "Giyin, kahvaltı: saç bu sürede havada kurur" },
  { min: 1, t: "Saçı parmak uçlarıyla bir kez kabart; parfüm: okulda 2 sprey (ense + göğüs)" }
];

/* Yol haritası: siparişten 12. haftaya (eleştirel değerlendirme 9 Ekim 2026). */
const ROADMAP = [
  { when: "0. gün · sipariş", items: ["Alındı ✓ Kozvit: CeraVe temizleyici + losyon, LRP SPF, Comedomed", "Alındı ✓ Saçhane: Davines LOVE Curl kremi + Forming Pomade", "Alındı ✓ Zara: şampuan + Fashionably London Elixir · kalan: Sensodyne (market)", "0. gün fotoğrafı (Takip → İlerleme fotoğrafı) + bel ölçüsü"] },
  { when: "1–2. hafta · alışma", items: ["Sabah 10 dk rutini her gün", "Comedomed yalnız haftada 2–3 akşam; batarsa önce nemlendirici", "Berber: low taper + kısa sakal, U boyun çizgisi", "Diş taşı temizliği randevusu"] },
  { when: "3–4. hafta · oturtma", items: ["Comedomed gün aşırı", "Saç: yıkama günü şampuan + LOVE Curl kremi; diğer sabahlar su + Forming Pomade", "30. gün fotoğrafı: aynı ışık, aynı açı", "Listeye HİÇBİR ürün ekleme: önce bu set otursun"] },
  { when: "5–8. hafta · ilk sonuçlar", items: ["Comedomed her akşam (tolere ediyorsan)", "Haftada 0,5–0,7 kg: yüz dolgunluğu buradan iner", "Berber: yan/ense düzeltme", "60. gün fotoğrafı"] },
  { when: "9–12. hafta · değerlendirme", items: ["90. gün fotoğrafı 0. günle yan yana", "Sivilce/iz: iyileşme yoksa aile hekimi (adapalen)", "Saç hâlâ cansızsa: OI All in One Milk ya da maske ekle", "İkinci koku isteniyorsa Born in Roma Extradose 50 ml (akşam) ya da Zara Ebony Wood Elixir"] }
];

/* Renk kombinasyonları: Erik Xei'nin herkese açık seçkilerindeki çizgiden (old money × sokak: geniş paça/pileli alt,
   triko polo, yapısız katman, loafer/retro sneaker, süet-deri aksesuar) ESİNLENEN, Zenon'un kendi kütüphanesi.
   Ücretli "Elite Color Combo Playbook" içeriği değildir. Sıcak ten: saf beyaz yerine kırık beyaz/krem; kahve, bordo, deve tüyü, lacivert öne çıkar.
   Analiz: research_notes/Glow up koçluk planı/erikxei_analiz_2026-11-01.md */
const SL = (slot, cats, colors, label, o = {}) => ({ slot, cats, colors, label, ...o });
const U = (c, l, types) => SL("Üst", ["ust", "katman"], c, l, types ? { types } : {});
const D = (c, l, types, opt) => SL("Dış", ["dis"], c, l, { ...(types ? { types } : {}), ...(opt ? { opt: true } : {}) });
const A = (c, l, types = ["trouser", "chino", "cargo", "jeans"]) => SL("Alt", ["alt"], c, l, { types });
const F = (c, l, types) => SL("Ayakkabı", ["ayak"], c, l, types ? { types } : {});
const X = c => SL("Aksesuar", ["aks"], c, null, { opt: true });
const CB = (id, name, family, palette, slots, occ, t, rule, pin) => ({ id, name, family, palette, slots, occ, t, rule, pin });
const COMBOS = [
  CB("tonal-siyah", "Tonal siyah, dokuyla", "Tonal", ["black", "wblack", "silver"],
    [U(["black"], "siyah tişört ya da polo"), A(["black", "wblack"], "siyah pantolon"), F(["black"], "siyah sneaker"), D(["black"], null, null, true), X(["silver"])],
    ["okul", "gunluk", "konser", "bar"], [-5, 28], "Tek renk; farkı doku yapar: fitilli tişört + mat kargo + deri. Gümüş tek metal olsun.", "all black outfit men texture leather"),
  CB("siyah-bordo", "Siyah üstüne bordo odak", "Kontrast", ["black", "burgundy", "wgrey"],
    [U(["black"], "siyah tişört"), D(["burgundy"], "bordo ceket"), A(["black", "wgrey", "indigo"], "siyah ya da koyu jean"), F(["black"], "siyah sneaker")],
    ["okul", "gunluk", "bulusma", "bar"], [5, 18], "Sıcak tenine en çok yakışan odak renk bordo; geri kalan her şey koyu ve sakin.", "burgundy leather jacket black outfit men"),
  CB("siyah-kahve", "Siyah + çikolata", "Sıcak", ["black", "brown", "gold"],
    [U(["brown"], "kahve triko ya da quarter-zip", ["knit", "polo", "turtle"]), A(["black"], "siyah pantolon"), F(["black", "brown"], "siyah ya da kahve ayakkabı"), X(["gold"])],
    ["okul", "kafe", "bulusma", "is"], [3, 18], "Siyahın sertliğini kahve yumuşatır; altın saat aynı sıcaklıkta.", "brown knit black trousers men outfit"),
  CB("kahve-krem", "Kahve + krem (old money)", "Old money", ["cream", "brown", "camel"],
    [U(["cream", "bone"], "krem triko polo", ["knit", "polo"]), A(["brown", "camel"], "kahve pileli pantolon", ["trouser", "chino"]), F(["brown"], "kahve süet loafer")],
    ["kafe", "bulusma", "is", "ozel"], [8, 24], "İki sıcak nötr, ten rengine en yakın palet; parlak hiçbir şey yok.", "cream knit polo brown pleated trousers loafers men"),
  CB("lacivert-krem", "Lacivert + krem", "Old money", ["navy", "cream", "brown"],
    [U(["navy"], "lacivert triko polo", ["knit", "polo"]), A(["cream", "stone"], "krem pileli pantolon", ["trouser", "chino"]), F(["brown", "bone"], "kahve loafer ya da krem sneaker")],
    ["okul", "kafe", "bulusma", "is"], [10, 26], "Klasik açık-koyu ikilisi; lacivert siyahtan daha yumuşak ve 'pahalı' durur.", "navy knit polo cream trousers men"),
  CB("gri-siyah", "Yıkanmış gri + siyah", "Tonal", ["storm", "black", "charcoal"],
    [U(["storm", "heather"], "gri hoodie ya da sweatshirt"), A(["black", "charcoal"], "siyah pantolon"), F(["black"], "siyah sneaker")],
    ["okul", "gunluk", "konser"], [4, 18], "Gri ile siyah aynı aileden; hacimli üstün altı tek renk ve düz kalsın.", "grey hoodie black cargo men streetwear"),
  CB("kirik-beyaz-jean-deri", "Kırık beyaz + jean + deri", "Kontrast", ["bone", "wgrey", "black"],
    [U(["bone", "white"], "kırık beyaz tişört"), D(["black"], "siyah deri ceket", ["leather"]), A(["wgrey", "indigo"], "yıkamalı jean"), F(["black"], "siyah sneaker")],
    ["okul", "gunluk", "konser", "bar"], [6, 20], "Klasik üçlü: açık iç katman, koyu deri, orta ton jean. Saf beyaz yerine kırık beyaz yüzüne daha yumuşak.", "white tee black leather jacket jeans men"),
  CB("cizgili-siyah", "Çizgili gömlek + siyah", "Kontrast", ["white", "sky", "black"],
    [U(["white", "sky"], "açık mavi ya da çizgili gömlek", ["shirt"]), A(["black"], "siyah pantolon"), F(["black"], "siyah retro sneaker")],
    ["okul", "kafe", "bulusma", "is"], [14, 28], "Gömleği siyah tişört üstüne açık giy; mavi tonu siyahla netleşir.", "striped shirt open black tee black trousers men"),
  CB("zeytin-siyah", "Zeytin katman + siyah", "Sıcak", ["olive", "black"],
    [D(["olive"], "zeytin overshirt ya da ceket"), U(["black"], "siyah tişört"), A(["black"], "siyah pantolon"), F(["black"], "siyah sneaker")],
    ["okul", "gunluk", "konser"], [8, 20], "Zeytin sıcak tende canlı durur; siyah tabanla askeri değil şık okunur.", "olive overshirt black outfit men"),
  CB("devetuyu-siyah", "Deve tüyü + siyah", "Old money", ["camel", "black"],
    [D(["camel"], "deve tüyü kaban ya da ceket"), U(["black"], "siyah triko ya da tişört"), A(["black"], "siyah pantolon"), F(["black"], "siyah ayakkabı")],
    ["okul", "is", "bulusma", "ozel"], [-3, 14], "Kışın en 'pahalı' duran ikili; deve tüyü dışta, içerisi tamamen siyah.", "camel coat all black outfit men"),
  CB("bordo-gri", "Bordo + gri", "Kontrast", ["burgundy", "storm", "wgrey"],
    [D(["burgundy"], "bordo ceket"), U(["storm", "heather"], "gri hoodie"), A(["wgrey", "black"], "gri-mavi jean ya da siyah"), F(["black"], "siyah sneaker")],
    ["okul", "gunluk", "konser"], [4, 16], "Gri bordoyu sakinleştirir; kapüşonu ceketin dışına al.", "burgundy jacket grey hoodie men"),
  CB("krem-tonal", "Krem tonal", "Tonal", ["bone", "cream", "stone"],
    [U(["bone", "cream"], "krem tişört ya da triko"), A(["cream", "stone"], "krem/taş pantolon", ["trouser", "chino"]), F(["bone", "white"], "krem retro sneaker")],
    ["kafe", "bulusma", "gunluk"], [16, 30], "Açık tonlar ten rengini öne çıkarır; dokular farklı olsun (triko + keten).", "cream monochrome outfit men summer"),
  CB("kahve-lacivert", "Kahve + lacivert", "Sıcak", ["navy", "brown", "indigo"],
    [U(["navy"], "lacivert tişört ya da triko"), D(["brown", "duck"], "kahve süet ya da worker ceket"), A(["indigo", "cream"], "koyu jean ya da krem pantolon"), F(["brown", "black"], "kahve ayakkabı")],
    ["okul", "kafe", "gunluk"], [6, 18], "Soğuk lacivert + sıcak kahve dengesi; süet dokusu kombine derinlik verir.", "navy sweater brown suede jacket men"),
  CB("siyah-altin-date", "Siyah polo + altın (date)", "Akşam", ["black", "gold"],
    [U(["black"], "siyah triko polo", ["polo", "knit"]), A(["black"], "siyah pileli pantolon", ["trouser"]), F(["black"], "siyah retro ya da loafer"), X(["gold"])],
    ["bulusma", "bar", "ozel"], [8, 24], "Tamamen siyah, tek parlak nokta altın saat; parfümle bitir.", "black knit polo black pleated trousers gold watch men"),
  CB("indigo-beyaz-kahve", "Koyu jean + kırık beyaz + kahve", "Sıcak", ["indigo", "bone", "brown"],
    [U(["bone", "white"], "kırık beyaz tişört ya da oxford"), A(["indigo", "wgrey"], "koyu yıkama jean", ["jeans"]), F(["brown", "black"], "kahve ayakkabı"), X(["gold"])],
    ["okul", "gunluk", "kafe"], [12, 26], "Denim + açık üst + kahve deri: her yerde çalışan rahat şıklık.", "white tee dark jeans brown loafers men"),
  CB("antrasit-krem", "Antrasit + krem", "Kontrast", ["charcoal", "cream"],
    [U(["cream", "bone"], "krem triko"), A(["charcoal", "black"], "antrasit pantolon"), F(["black"], "siyah ayakkabı")],
    ["okul", "is", "kafe"], [5, 18], "Açık üst / koyu alt: boyu uzun, omzu geniş gösterir.", "cream sweater charcoal trousers men"),
  CB("acikmavi-tas", "Açık mavi oxford + taş", "Old money", ["sky", "stone", "brown"],
    [U(["sky"], "açık mavi oxford gömlek", ["shirt"]), A(["stone", "cream"], "taş rengi chino", ["chino", "trouser"]), F(["brown"], "kahve loafer")],
    ["okul", "is", "kafe"], [14, 28], "Ralph Lauren'in klasik formülü; kolları iki kıvır, gömleği iç ya da yarım iç.", "light blue oxford shirt stone chinos loafers men"),
  CB("kanvas-siyah", "Kanvas kahve worker + siyah", "Sokak", ["duck", "black"],
    [D(["duck", "brown"], "kanvas kahve worker ceket", ["work"]), U(["black"], "siyah tişört"), A(["black"], "siyah pantolon"), F(["black"], "siyah sneaker")],
    ["okul", "gunluk", "konser"], [6, 18], "Workwear katmanı siyah tabanı sıcaklaştırır; Carhartt havası.", "carhartt detroit jacket black outfit"),
  CB("athleisure-gri", "Gri melanj + siyah (spor-şık)", "Sokak", ["heather", "black"],
    [U(["heather", "storm"], "gri melanj sweatshirt"), A(["black"], "siyah eşofman ya da balloon", ["track", "cargo", "trouser"]), F(["black"], "siyah sneaker")],
    ["okul", "gunluk", "spor"], [5, 18], "Salondan sonra derslere: eşofman ama toplu; gri üst, siyah alt.", "grey sweatshirt black track pants men"),
  CB("bordo-krem", "Bordo triko + krem", "Old money", ["burgundy", "cream"],
    [U(["burgundy"], "bordo triko", ["knit", "polo"]), A(["cream", "stone"], "krem pantolon", ["trouser", "chino"]), F(["brown", "bone"], "kahve ya da krem ayakkabı")],
    ["kafe", "bulusma", "is"], [6, 18], "Bordo üstte, krem altta: sonbaharın en sıcak ikilisi.", "burgundy sweater cream trousers men"),
  CB("kahve-tonal", "Kahve tonal", "Tonal", ["brown", "camel", "duck"],
    [U(["brown", "camel"], "kahve triko"), A(["brown", "camel", "duck"], "kahve pantolon", ["trouser", "chino", "cargo"]), F(["brown"], "kahve ayakkabı")],
    ["kafe", "bulusma", "gunluk"], [5, 18], "Aynı rengin üç tonu: koyu üst, orta alt, deri ayakkabı.", "tonal brown outfit men"),
  CB("siyah-beyaz", "Siyah-beyaz kontrast", "Kontrast", ["black", "white"],
    [U(["white", "bone"], "beyaz tişört"), D(["black"], "siyah deri ceket", ["leather"]), A(["black"], "siyah pantolon"), F(["black"], "siyah sneaker")],
    ["okul", "konser", "bar"], [8, 22], "En net kontrast; beyaz yalnız tişörtte, geri kalanı siyah.", "white tee black leather jacket black trousers"),
  CB("lacivert-tonal", "Lacivert tonal", "Tonal", ["navy", "indigo"],
    [U(["navy"], "lacivert triko"), A(["indigo", "navy"], "koyu indigo jean"), F(["black", "brown"], "siyah ya da kahve ayakkabı")],
    ["okul", "is", "kafe"], [5, 20], "Siyahtan yumuşak tonal görünüm; indigo jean ile aynı mavi ailesi.", "navy sweater dark indigo jeans men"),
  CB("zeytin-krem", "Zeytin + krem", "Sıcak", ["olive", "bone", "stone"],
    [D(["olive"], "zeytin overshirt"), U(["bone"], "kırık beyaz tişört"), A(["stone", "cream"], "taş pantolon"), F(["brown", "bone"], "kahve ya da krem ayakkabı")],
    ["gunluk", "kafe", "okul"], [12, 24], "Doğa tonları; sıcak tende sağlıklı görünür.", "olive overshirt cream trousers men"),
  CB("sonbahar-uclu", "Deve tüyü + krem + kahve (sonbahar)", "Old money", ["camel", "cream", "brown"],
    [D(["camel"], "deve tüyü kaban"), U(["cream"], "krem triko"), A(["brown"], "kahve pantolon"), F(["brown"], "kahve ayakkabı")],
    ["is", "ozel", "bulusma"], [-2, 12], "Sezonun en zengin paleti; hepsi sıcak, hiçbiri parlak değil.", "camel coat cream knit brown trousers men"),
  CB("griMavi-kahve", "Gri-mavi jean + kahve triko", "Sıcak", ["wgrey", "brown", "black"],
    [U(["brown"], "kahve triko", ["knit", "polo"]), A(["wgrey"], "gri-mavi yıkama jean", ["jeans"]), F(["black"], "siyah sneaker")],
    ["okul", "gunluk", "kafe"], [5, 18], "Soğuk jean + sıcak triko; çikolata yüzüne renk verir.", "brown knit grey jeans men"),
  CB("gumus-gunu", "Siyah + gümüş detay", "Sokak", ["black", "silver"],
    [U(["black"], "siyah tişört"), A(["black"], "siyah kargo", ["cargo", "trouser"]), F(["black"], "siyah teknik sneaker"), X(["silver"])],
    ["okul", "gunluk", "konser"], [4, 26], "Tüm metaller gümüş: kolye, kemer tokası, saat. Altınla karıştırma.", "black outfit silver chain men"),
  CB("cikolata-gri", "Çikolata + antrasit", "Sıcak", ["brown", "charcoal"],
    [U(["brown"], "kahve triko"), A(["charcoal", "heather"], "antrasit pantolon", ["trouser", "chino"]), F(["black"], "siyah ayakkabı")],
    ["okul", "is", "kafe"], [4, 16], "Gri pantolonla kahve, siyaha göre daha yumuşak ve olgun.", "brown sweater charcoal trousers men"),
  CB("bordo-lacivert", "Bordo + lacivert", "Kontrast", ["burgundy", "navy", "indigo"],
    [U(["burgundy"], "bordo triko"), A(["indigo", "navy"], "koyu jean"), F(["black", "brown"], "siyah ya da kahve ayakkabı")],
    ["okul", "kafe", "gunluk"], [4, 16], "İki derin renk; biri sıcak biri soğuk, ikisi de koyu.", "burgundy sweater dark jeans men"),
  CB("krem-siyah", "Krem triko + siyah", "Kontrast", ["cream", "black"],
    [U(["cream", "bone"], "krem triko polo", ["knit", "polo"]), A(["black"], "siyah pileli pantolon", ["trouser", "cargo"]), F(["black"], "siyah ayakkabı")],
    ["okul", "bulusma", "is"], [8, 22], "Siyah gardırobuna eklenecek tek krem parça 6 yeni kombin açar.", "cream knit polo black trousers men")
];
/* Ücretli Erik Xei rehberi: kullanıcı satın alıp PDF verirse kombinasyonlar buraya işlenir. */
const PLAYBOOK = { status: "bekliyor", title: "Elite Color Combo Playbook", count: 200, note: "PDF'i Claude'a ver: 200 kombinasyon gardırobuna eşlenip bu bölümün en üstüne eklenir." };

/* Sahip olunanlar: listeye girmez; koç bunları kullanır. */
const OWNED = [
  { id: "kreatin", name: "Kreatin monohidrat", use: "Günde 3–5 g, saat fark etmez; antrenmansız günler de. İlk haftalarda 1–2 kg su tutma normaldir." },
  { id: "whey", name: "Protein tozu", use: "Öğünlerle protein hedefine yetişemediğin günler 1 ölçek (≈22–25 g); suya ya da süte." },
  { id: "braun", name: "Braun tıraş makinesi", use: "2–3 günde bir boyun altı 0,5–1 mm, yanak taşmaları; çene 7–8 mm tarak." },
  { id: "dis", name: "Diş fırçası ve macun", use: "Sabah-akşam 2 dk; akşam tükür, suyla çalkalama." }
];

/* Saç bakımı: yüz kadar önemli. */
const HAIRCARE = [
  { t: "Yıkama: haftada 3 gün (Pzt-Çar-Cmt) Zara şampuan yalnız saç derisine; ardından Davines LOVE Curl kremi uçlara 2 dk. Her gün şampuan dalgalı saçı kurutur ve cansızlaştırır.", ev: "AAD: kepekli saçta düzenli antifungal şampuan" },
  { t: "Her yıkamada saç kremi: yalnız tellere ve uçlara, 2 dk; saç derisine ve alına sürme.", ev: "AAD saç bakımı önerisi" },
  { t: "Her sabah: su spreyi + nohut kadar Forming Pomade, parmakla şekil, havada kurut. Fön, düzleştirici ve sıkı bere/şapka yok: ısı ve çekme dökülmeyi artırabilir.", ev: "Stilist pratiği" },
  { t: "Kurulama: havluyla ovalama yok, bastır; mümkünse eski pamuklu tişört. Sıcak değil ılık-serin su.", ev: "Stilist pratiği (kabarma ve kırılma)" },
  { t: "Yatmadan önce saçta yoğun ürün kalmasın (suyla ıslatıp parmakla aç); yastık kılıfını haftada 2 değiştir (alın sivilcesi).", ev: "AAD: saç ürünleri alın aknesini tetikleyebilir" },
  { t: "Berber: yan/ense 3–4 haftada bir, tam kesim 5–6 haftada bir. Üstü uzat: dalgalı doku 5 cm+ ister.", ev: "Berber pratiği" },
  { t: "Dökülme takibi: ayda bir aynı ışıkta alın çizgisi + tepe fotoğrafı (Takip → İlerleme fotoğrafı). Günde 50–100 tel normal.", ev: "AAD: hair shedding" },
  { t: "Şakaklar 3 ayda belirgin geriliyorsa: eczacıya minoksidil %5 sor (Türkiye'de reçete durumu kaynaklarda çelişkili) ya da aile hekimi. Kendi başına finasterid kullanma.", ev: "AAD: erkek tipi dökülme tedavisi" },
  { t: "İçeriden: günlük protein hedefi, uyku 7+ saat, ferritin ve D vitamini tahlilde normal olsun (Takip → Tahlil kartı).", ev: "Demir/D eksikliği dökülmeyle ilişkili (AAD)" }
];

/* Yüz şişkinliği, ödem ve yağ: kalıcı olan yağ kaybı, sabah şişliği ise sıvı. */
const PUFF = {
  intro: "Sabah şişliği çoğunlukla sıvıdır ve öğlene iner; yanak-çene altı dolgunluğu ise yağdır ve yalnız genel kilo kaybıyla gider. Yüz egzersiziyle bölgesel yağ yakılmaz.",
  tips: [
    { t: "Kalıcı çözüm: haftada ~0,5–0,7 kg kayıp (Takip'teki kilo hedefi). Yüz, kaybedilen yağdan payını alır; 4–8 haftada fark görünür.", ev: "Bölgesel yağ yakımı yok (NSCA); genel yağ kaybı" },
    { t: "Tuz: günde 5 g'ın altı (1 tatlı kaşığı). Akşam özellikle: sucuk, turşu, cips, hazır çorba, döner, soya sosu, salamura peynir.", ev: "WHO tuz önerisi; sodyum su tutar (fizyoloji)" },
    { t: "Son yemek yatmadan 3 saat önce; akşam büyük karbonhidrat + tuzlu öğün ertesi sabah şişlik yapar.", ev: "Glikojen + sodyum su tutar (mekanizma)" },
    { t: "Alkol: akşam içkisi ertesi sabahın en sık şişlik nedeni; hafta içi sıfır.", ev: "Uzman görüşü (sıvı dengesi, inflamasyon)" },
    { t: "Uyku 7–9 saat, sabit saat; yastık hafif yüksek, mümkünse sırt üstü (yüz yastığa basmasın).", ev: "Uyku yoksunluğu yüz görünümünü kötüleştirir (Sundelin 2013)" },
    { t: "Su 2,5–3 L (kreatin kullanıyorsun): az su içmek vücudu su tutmaya iter.", ev: "Uzman görüşü" },
    { t: "Potasyum: muz, patates, yoğurt, ıspanak, kuru fasulye, domates — sodyumu dengeler.", ev: "Fizyoloji; WHO potasyum önerisi" },
    { t: "Sabah hızlı (geçici, 1–2 saat): 30 sn soğuk su ya da buzdolabındaki metal kaşık göz altına; 1 dk hafif masaj içten dışa ve aşağı boyuna.", ev: "Geçici etki, kanıt zayıf" },
    { t: "Burun tıkanıklığı + göz altı şişliği sürekliyse alerji/sinüzit olabilir: eczacıya sor.", ev: "Uzman görüşü" }
  ],
  warn: "Tek taraflı, ağrılı, ani ya da günler boyu inmeyen şişlik; kortizon kullanımı → doktor."
};

/* Nereden alınır: güven sırası (8–9 Ekim 2026 araştırması; research_notes/Glow up koçluk planı/nereden_alinir.md). */
const WHERE = {
  trust: [
    { name: "Fiziksel eczane", for: "CeraVe, La Roche-Posay, Avène, Vichy", why: "Ürün distribütörden gelir (L'Oréal Türkiye: CeraVe/LRP/Vichy). Sahte riski en düşük; fiyat liste fiyatı olabilir." },
    { name: "Eczane siteleri (Akakçe'de 'Yetkili satıcı' rozetli)", for: "Dermokozmetik: Kozvit, Daffne, Narecza, Evdeeczane, Turuncukasa", why: "Arkasında eczane var, fiyatlar genelde en iyisi. Akakçe'de 'Yetkili satıcı en ucuz' satırına bak." },
    { name: "Beymen / Boyner (mağazanın kendi satışı)", for: "CeraVe (Beymen), LRP güneş kremi (Boyner), parfüm", why: "Kurumsal mağaza, fatura ve kolay iade. CeraVe'de eczane sitelerinden ~%10–15 pahalı (ör. yağlanma karşıtı nemlendirici 1.076 TL sepette)." },
    { name: "Saçhane (yetkili satıcı etiketli)", for: "Davines LOVE Curl saç kremi, Davines Forming Pomade", why: "Kuaför ve dermokozmetik ürünleri; Saçhane 'Yetkili Satıcı' etiketli ama şikayet sayısı yüksek: paketi kamerayla aç." },
    { name: "Market / zincir eczane", for: "Rexona Clinical", why: "Kitle ürünü; sahte riski düşük." }
  ],
  avoid: ["Trendyol/Hepsiburada'da rozetsiz, fiyatı yetkili satıcının %30+ altında olan ilanlar", "Cosmolog / Cosmoland (sahte ürün şikayetleri)", "Faturadaki firma adı satıcıyla aynı değilse", "Barkodu ÜTS Mobil'de çıkmayan ya da kutu ile şişe barkodu farklı ürün"],
  sephora: "Sephora Türkiye'de CeraVe/La Roche-Posay görünmüyor; erkek bakımı Clinique vb. (ör. Moisture Surge 30 ml 1.425 TL) — aynı işi daha pahalıya yapar.",
  zara: "Zara'da erkek cilt/saç bakımı yok; yalnız parfüm (Parfüm sekmesinde)."
};

const api = { PROGRAM, MONTHS, PRESET, MEALS, IFTHEN, EVENTS, BODYCHECK, PERFUMES, LABS, LIFTS, liftsOf, WHERE, OWNED, HAIRCARE, PUFF, SHOPS, MORNING10, ROADMAP, PURCHASED, WEEK, COMBOS, PLAYBOOK };
if (typeof module === "object" && module.exports) module.exports = api; else root.ZenonPlan = api;
})(typeof self !== "undefined" ? self : this);
