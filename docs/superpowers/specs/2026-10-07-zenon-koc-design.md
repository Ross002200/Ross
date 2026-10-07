# Zenon 師 Koç: bildirimler, Bugün yapılacaklar, check-in, koç, aylık alışveriş (Aşama A)

Tarih: 2026-10-07 · Durum: tasarım onaylandı (kullanıcı: "Veriyorum devam et"), spec incelemede

## Amaç

Zenon'u kullanıcının kişisel glow-up koçuna çevirmek: her sabah gerçek bildirim, açılışta günün tek listesi, 60 saniyelik günlük check-in, tonu duruma göre değişen bir koç, ve "nasıl alınır" rehberli aylık alışveriş listesi (parfüm dahil). Kaynak araştırmalar: `Masaüstü/reports/Glow up koçluk planı.md`, `Genç erkek bakım rutini ve ürünleri.md`, `Kadınların beğendiği erkek parfümleri güncel.md`, notlar `research_notes/Glow up koçluk planı/` (yuz_yagi_sislik, nasil_alinir dahil).

Kullanıcı kararları (2026-10-07):
- Bildirim: gerçek Web Push, Seneca sunucusu üzerinden (Seneca fazları bitti). Takvim (.ics) yalnız yedek.
- Açılış ekranında Zenon'un yapılacaklar listesi.
- Parfüm kesin; parfüm bütçesi 12–15 bin TL, tatlı serbest.
- Koç: insan gibi; yeri gelince sert, motive edici, şakacı.
- Aşama B (sonra): gece Claude rutini ile gerçek yapay zekâ koç; check-in verilerinin **kullanıcının kendi Seneca sunucusuna** gitmesine izin verildi. Bu doküman Aşama A'dır; B ayrı spec.

## Kapsam dışı (Aşama A)

- Yapay zekâ koç rutini, sunucuya check-in senkronu (Aşama B).
- Parfüm rafı / günün kokusu motoru (Aşama B).
- Aurelius'a yazma: Aurelius'a dokunulmaz; antrenman programı Zenon'a salt veri olarak kopyalanır.
- Telefon ana ekran widget'ı: web uygulamasında mümkün değil; liste Zenon açılınca ve bildirimde görünür.

## 1. Bildirim sunucusu

`docs/superpowers/specs/2026-10-06-zenon-bakim-design.md` Bölüm 2 aynen uygulanır (Seneca'da ayrı `zenon_push.py`, `data/zenon.db`, `/zenon/api/{saglik,anahtar,abone,plan,test}`, token doğrulama, CORS yalnız `https://ross002200.github.io`, dakikalık gönderim, 30 dk geç kalan atlanır, yalıtım `try/except`, `HARIC_DOSYA` `zenon.db*`, yayın `guncelle.cmd` + `sw.js` sürümü +1, değişiklik öncesi/sonrası Seneca testleri, `yedek/` kopyası). Ek kurallar:
- Plan uç noktası her hatırlatmada şimdi −5 dk ile +8 gün arasını kabul eder (saat kayması).
- Her uç nokta JSON döner (boş yanıt yok).
- Seneca'da başka oturum aktif mi diye dosya değişiklik saatleri yayından hemen önce bir kez daha kontrol edilir.

## 2. Bugün yapılacaklar (açılış ekranı)

- 今 Bugün sekmesinin en üstüne (hava kartından önce) **"Bugün yapılacaklar"** kartı. Bildirimden (`./#today`) ya da normal açılışta ilk görünen şey.
- Liste maddeleri (her biri işaretlenebilir, günlük kaydedilir `zenon9:coach.todo[date]`):
  1. Sabah rutini (bakım motorundan; adım sayısı) — işaretlenince bakım `amAll` ile eşlenir
  2. Günün antrenmanı (program verisinden, ör. "Push · Bench Press 3 set …"); dinlenme günü "Dinlenme · 8.000 adım yürüyüş"
  3. Adım hedefi (8.000–10.000)
  4. Protein hedefi (gram; profilden 1,7 g/kg, yuvarlanmış)
  5. Akşam rutini — bakım `pmAll` ile eşlenir
  6. Check-in (akşam)
  7. Varsa günün alışveriş/randevu maddesi (aylık listeden "bu hafta" olanlar; ilk gün "MHRS dermatoloji randevusu al")
  8. Pazar: haftalık değerlendirme; 0./14./30. gün: ilerleme fotoğrafı
- Kartın altında **koçun notu** (bkz. 4).
- İlerleme: "5/8" ve ince çubuk.

## 3. Günlük check-in

- Bugün kartındaki "Check-in" maddesi bir sayfa (sheet) açar. Alanlar: uyku (saat, 0,5 adım), sabah kilosu (kg, 0,1), adım, antrenman yapıldı mı (program günü otomatik önerilir), protein (g, yaklaşık), su (L), cilt notu (hızlı çipler: temiz / yeni sivilce / kızarıklık / kuruluk / tahriş + serbest metin), ruh hali (1–5).
- Saklama: `zenon9:coach.log` = `{ "YYYY-MM-DD": {sleep, weight, steps, workout, protein, water, skin:[], note, mood} }`. 120 günden eskisi budanır. Yedek/geri yükle mevcut mekanizmaya dahil (care.push hariç kuralı korunur).
- 記 Takip'e **İlerleme** bölümü: 7 günlük ortalama kilo çizgisi (son 8 hafta), haftalık değişim ve hedef (−0,6 kg/hafta), uyku ortalaması, rutin uyum %, adım ortalaması. Basit SVG çizgi grafik.

## 4. Koç

Saf motor `zenon-coach.js` (DOM/ağ yok, node testli), tarayıcıda `window.ZenonCoach`.

```
coachNote(ctx) -> {tone: "sert"|"motive"|"sakaci"|"bilgi", text, why}
weeklyReview(ctx) -> {avgWeight, prevAvgWeight, deltaKg, targetKg:-0.6, adherence, sleepAvg, stepsAvg, verdict, actions:[str]}
todayTodos(ctx) -> [{id, label, detail, kind, done}]
```

`ctx = {date, profile, careState, log, todoState, program, plan, wx}`.

Ton kuralları (öncelik sırasıyla):
- **sert**: son 2 günde sabah ya da akşam rutini tamamlanmadıysa; ya da 3+ gün check-in yok; ya da 7 günlük ortalama kilo 2 hafta üst üste hedefin gerisinde ve adım ortalaması < 6.000. Örnek: "İki gündür akşam rutini yok. Bahaneyi duydum, şimdi lavaboya. 3 dakika."
- **motive**: seri 3, 7, 14, 30. günler; haftalık kilo hedefe uygun; yeni kişisel rekor (antrenman). Örnek: "7 gün seri. Ayna bunu fark etmeye başladı bile."
- **sakaci**: iyi gidişte, haftada en fazla 2 kez, tarih tohumlu. Örnek: "Cilt bugün senden daha disiplinli, rekabet et."
- **bilgi**: diğer günler; profile uygun kanıtlı ipucu (bakım ipuçları + yüz yağı/şişlik notları: uyku, tuzu sabit tutma, 1,5 m fotoğraf).
- Her tonda ≥ 12 farklı cümle; aynı cümle 10 gün tekrar etmez (`coach.seen`).
- Güvenlik: haftalık kayıp > %1 vücut ağırlığı 2 hafta üst üste, uyku ort. < 6 saat ya da ruh hali ort. ≤ 2 → koç sertleşmez, "bilgi" tonunda doktora/diyetisyene yönlendirir.

## 5. Aylık alışveriş ve "Nasıl alınır"

- Veri dosyası `zenon-plan.js` (`window.ZenonPlan`): `months: {"2026-10": [item]}`, `item = {id, cat, name, size, priceTL, where, priority, url?, rx:boolean, how:[adım], warn:[str], becomes?: careProductRef}`.
- Ekim 2026 listesi: koçluk planındaki 1. ay listesi (~8.230 TL) + parfüm paketi (önerilen: Dior Homme Parfum 75 ml 7.830 TL + Stronger With You Intensely 100 ml 6.000 TL = 13.830 TL; alternatif Dior Homme Parfum + Afnan Supremacy NOI = 11.270 TL; önce tester). Parfüm ayrı bütçe satırı.
- 買 Alışveriş sekmesinin en üstüne **"Bu ayın listesi"**: toplam / harcanan / kalan; her madde açılır, altında **Nasıl alınır** adımları (nasil_alinir.md'den: MHRS adımları ve 50 TL katılım payı, ilaçların internetten satılamadığı ve eczaneden alınacağı, İTS karekod, ÜTS Mobil "Ürün Sorgula", yetkili satıcı seçimi ve rozetin tek başına garanti olmadığı, cayma hakkı ve açılmış kozmetik istisnası, parfümde tester/batch kodu/sahte fiyat örnekleri, berbere mm ile tarif).
- "Aldım" → madde `bought` olur, tarihi tutulur; bakım ürünüyse ilgili rutin adımının etiketine ürün adı eklenir (ör. "SPF 50 · LRP UVMune").
- Reçeteli maddeler `rx` rozeti; "dermatolog randevusundan sonra".

## 6. Antrenman verisi

- `zenon-plan.js` içinde Aurelius 5 günlük program kopyası (Pzt Push, Sal Pull, Çar Legs, Cum Üst, Cmt Bacak; kardiyo Per+Paz 40 dk Zone 2; Aurelius'ta hafta Pazartesi=0, cardioDays [3,6] = Perşembe, Pazar).
- Koç önerisi: göğüs ve omuz haftalık setleri 10'un altında → "Bench'e +1 set, Lateral Raise'e +1 set" önerisi (kanıt: haftada ≥10 set). Aurelius değiştirilmez; öneri metin olarak görünür.
- Bakım profilindeki spor günleri programdan önerilir (Pzt, Sal, Çar, Cum, Cmt).

## 7. Bildirim içeriği (hatırlatma üreticisine ekler)

Mevcut `reminders()` genişler (günde ≤ 6 kuralı korunur, öncelik: sabah, akşam, check-in, antrenman, görev, berber):
- Sabah (kalkış+10): "Günün listesi: 1) Sabah rutini 2) Push günü 3) 150 g protein" + koçun kısa notu.
- Check-in: yatıştan 75 dk önce, o gün check-in yapılmadıysa.
- Antrenman günü: program saatinden 30 dk önce "Bugün Push: Bench 3 set…".
- Bildirime dokununca `./#today`.

## 8. Profil önayarı

Bakım anketinde "Koçun analizini uygula" düğmesi: cilt karma; sorunlar sivilce, siyah nokta, leke, gözenek, batık kıl; sakal kirli/sık; saç dalgalı, kepek, dökülme endişesi; spor günleri programdan. Kullanıcı kaydetmeden önce değiştirebilir.

## Test

- `tests/coach.test.js` (node:test): ton seçimi (2 gün rutin yok → sert; seri 7 → motive; güvenlik eşiği → bilgi), cümle 10 gün tekrar etmez, haftalık değerlendirme 7 günlük ortalama ve delta, todayTodos program gününe göre doğru antrenman ve dinlenme, alışveriş maddesi "bu hafta" seçimi, protein hedefi.
- `tests/care.test.js` genişler: yeni hatırlatma türleri, ≤ 6/gün, check-in yapıldıysa hatırlatma yok.
- Seneca: `tests/test_zenon_push.py` (önceki spec'teki maddeler + −5 dk tolerans); Seneca'nın mevcut testleri önce/sonra aynı.
- Görsel: Playwright 375 px — Bugün kartı, check-in sayfası, İlerleme grafiği, Bu ayın listesi + Nasıl alınır açılırı; sayfa hatası yok.
- Uçtan uca: yayından sonra `/zenon/api/saglik`, kullanıcı "Test bildirimi".

## Yayın

1. Seneca sunucu modülü (önceki spec'in Yayın 2. maddesi): yedek, testler, `guncelle.cmd`, doğrulama, Seneca `CLAUDE.md` notu.
2. Zenon istemcisi: Ross deposu, fetch → rebase → push; README.
3. Hafıza notu güncellenir.

## Açık riskler

- iOS Web Push yalnız ana ekrandan açılan PWA'da; ilk kurulumda kullanıcı "Bildirimleri aç"a dokunmalı.
- Koç kural tabanlı; gerçek sohbet Aşama B'ye ve Claude ile konuşmaya kalır.
- Fiyatlar 6–7 Ekim 2026 verisi; liste maddesinde tarih gösterilir.
