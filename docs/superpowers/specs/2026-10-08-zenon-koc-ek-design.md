# Zenon 師 Koç · Ek özellikler ve içerik odaklı liste (Aşama A2)

Tarih: 2026-10-08 · Durum: kullanıcı onayladı ("Hepsini ekle"; bütçe ve reçete kararları aynı mesajda)

## Kullanıcı kararları

- Önerilen 9 özelliğin **hepsi** eklenecek.
- **Toplam aylık bütçe 10–15 bin TL, parfüm dahil** (ayrı parfüm bütçesi yok).
- **Reçeteli ilaçlar listede kalır**; her birinin altında, reçete alınamazsa eczaneden **reçetesiz** alınabilecek alternatif ve güvenilir online satıcılar gösterilir. Hastane randevusu şu an bulunamıyor: aile hekimi seçeneği de rehbere eklenir.
- Parfüm Boyner'de denenip alınacak; orijinal Arap evleri de seçenek. Kriterler: kadınlarca beğeni, performans, sonbahar-kış; tatlı serbest.
- Ürün seçimi içerik odaklı: `reports/Rutin ürünleri içerik analizi.md` (Avène temizleyici → CeraVe Köpüren, Skinoren → Azelderm %20, Reuzel → Davines; gereksiz serumlar listeden çıkar).

## 1. Liste v2 (`zenon-plan.js`)

- Madde şeması genişler: `ingredients: {actives, flags, validation: {legal, seal, evidence}}`, `alt: [{name, priceTL, where, why, how}]` (reçete alınamazsa), `optional: bool`.
- Ekim listesi yeniden kurulur; **tek bütçe**: toplam ≤ 15.000 TL, hedef ~13.000 TL; satır kategorileri: bakım, araç, parfüm (hepsi tek toplamda). Kasım listesine kalanlar: Davines (gerekirse), Cicaplast B5+, niasinamid, ikinci parfüm.
- UI: her maddede üç açılır bölüm: **İçerik** (etkenler, kırmızı bayraklar, doğrulama: Y/M/K), **Nasıl alınır**, **Reçete alamazsan** (yalnız rx maddelerde). Üstte tek bütçe çubuğu: harcanan / plan / üst sınır 15.000.

## 2. Bağışlayıcı seri + toparlanma modu

- `ZenonCoach.forgivingStreak(doneMap, date)`: tam gün (amAll && pmAll) sayılır; **tek** kaçırılmış gün, iki yanı tam günse seriyi bozmaz (joker); art arda iki kaçırma sıfırlar. Joker 7 günde en fazla 1.
- Dün kaçırıldıysa ve önceki gün tamsa: Bugün listesinin başında **"Toparlanma: bugün kaçırma"** maddesi ve koçta özel cümle ("Bir kez insanlık, iki kez alışkanlık.").
- Bakım başlığındaki seri ve koç "motive" kuralı bu seriyi kullanır.

## 3. Eğer–o zaman planları

- `zenon9:coach.ifthen = [{id, if, then, active}]`; şablonlar (`ZenonPlan.IFTHEN`): ders geç biterse salon, gece 00:00'ı geçerse kısa rutin, tatlı isteği gelirse yoğurt + meyve, dışarıda yemekte ızgara + salata, sabah geç kalırsam SPF'yi atlama, vb.
- Takip'te **"Planlarım"** bölümü: şablondan seç ya da yaz; en fazla 5 aktif.
- Pazartesi Bugün listesinde "Haftanın 2–3 planını yaz" maddesi (aktif plan < 2 ise).
- Sabah bildirimine tarih tohumlu bir aktif plan eklenir ("Plan: Eğer ders geç biterse → 18:30 salondayım").

## 4. Haftalık özeti paylaş

- Takip'teki haftalık değerlendirmenin altında **"Özeti paylaş"**: metin kartı (ortalama kilo ve değişim, rutin uyumu, uyku, adım, seri, haftanın hedefi) → `navigator.share`, yoksa panoya kopyala. Kişisel fotoğraf/kilo paylaşmak kullanıcının seçimi; kilo satırı açılıp kapatılabilir.

## 5. Protein menüleri + market listesi

- `ZenonPlan.MEALS`: ~16 ucuz, yüksek proteinli Türk mutfağı öğünü `{id, name, protein, kcal, cost, items:[{name, qty, unit}] , slot: kahvalti|ogle|aksam|ara}` (menemen + lor, yoğurt + yulaf, tavuk pilav, mercimek çorbası + yumurta, ton balıklı salata, kuru fasulye, kıymalı makarna, ayran + simit değil vb.).
- `ZenonCoach.mealPlan(target, date)`: güne 3–4 öğün seçer, toplam protein ≥ hedef; tarih tohumlu, art arda günlerde aynı öğün tekrar etmez.
- Takip'te **"Beslenme"** bölümü: bugünün önerisi (protein ve kcal toplamı), "Haftalık market listesi" (7 günün malzemeleri birleşik ve gruplu: protein, süt, sebze, tahıl).

## 6. Uyku çapaları

- Hatırlatmalara iki tür eklenir: **kafein** (kalkıştan 7 saat sonra ya da en geç 15:00, "Kafeini bırak: uykun için"), **uyku** (yatıştan 60 dk önce, "Ekranı bırak, ışığı kıs") — öncelik en düşük; günde ≤ 6 kuralı korunur.
- Hafta sonu kalkış saati hafta içinden 1 saatten fazla geç ise koç "bilgi" notu verir (sabit kalkış).

## 7. Standart ilerleme fotoğrafı

- Takip'te **"Fotoğraflar"**: önden / sağ / sol; kamera `getUserMedia` (ön kamera) ile açılır, **önceki fotoğraf %35 saydam üstte** (hayalet), çerçeve kılavuzu; yakala → 540 px JPEG; desteklenmezse dosya seçici. Saklama IndexedDB `zenon-photos` (yalnız cihazda; yedeğe girmez).
- Karşılaştırma: ilk ve son fotoğraf yan yana / kaydırıcıyla.
- Check-in'e haftalık **bel ölçüsü** (cm) alanı; İlerleme'de bel satırı.
- Sınır: aynı açıdan 7 günde en fazla 1 fotoğraf (beden algısı koruması).

## 8. Etkinlik hazırlık listeleri

- `zenon9:coach.events = [{id, type: date|mulakat|dugun|diger, date, title}]`; şablon (`ZenonPlan.EVENTS`) gün ofsetli görevler: T-7 berber randevusu, T-3 kombini seç (Zenon kombin motorundan öneri), T-2 sakal/boyun çizgisi, T-1 ütü + ayakkabı, T-1 akşam rutini eksiksiz, T-0 duş, deodorant, parfüm 2–3 sprey, nefes/diş ipi.
- Etkinlik günleri Bugün listesine ve sabah bildirimine girer; Bugün kartında geri sayım rozeti.
- Takip'te **"Etkinlikler"** formu (tür, tarih, ad).

## 9. Beden algısı koruma bandı

- Ayda bir (ayın ilk pazarı) Takip'te 5 soruluk öz kontrol (görünüş kaygısına harcanan zaman, ayna kontrolü, kaçınma, sıkıntı, kıyaslama; 0–3). Toplam ≥ 8 ya da "sıkıntı" sorusu 3 ise destekleyici mesaj + uzman önerisi (psikolog/psikiyatrist; acil durumda 112). Sonuç yalnız cihazda.
- Koç asla aşırı yöntem önermez (aşırı diyet, mewing, çene aleti, ilaçsız "hızlı" çözümler); fotoğraf sınırı (7).
- Güvenlik tonu zaten var (uyku, ruh hali, hızlı kilo kaybı).

## 10. Adımlar otomatik (iOS Kestirmeler)

- Not: iOS'ta ana ekran PWA'sının depolaması Safari'den ayrıdır; kestirmenin URL açması PWA'ya ulaşmaz. Bu yüzden adımlar **sunucu üzerinden** gelir.
- Seneca `zenon_push.py`'ye: `PUT /zenon/api/adim {tarih, adim}` ve `GET /zenon/api/adim?gun=14` (cihaz token'ı ile; tablo `adimlar(cihaz, tarih, adim, guncel)`; değer 0–100.000; 400 gün sonra budanır). Bu, kullanıcının izin verdiği "check-in verisi kendi sunucusuna" kapsamındadır.
- Zenon açılışta son 14 günün adımını çeker, `coach.log[tarih].steps` boşsa doldurur (elle girileni ezmez).
- Takip'te **"Adımları otomatik al"** kartı: kestirme kurulum adımları (Sağlık'tan "Örnekleri Bul: Adım, bugün, toplam" → "URL İçeriğini Al: PUT, başlıklar X-Zenon-Cihaz/Token, JSON") ve "Anahtarları kopyala" düğmesi (cihaz + token yalnız bildirimler açıksa vardır; yoksa önce bildirim aboneliği istenir).
- Seneca değişikliği önceki güvenlik kurallarıyla: yedek, testler önce/sonra, gövde sınırı, token, CORS, `guncelle.py`.

## Test

- `tests/coach.test.js`: forgivingStreak (joker, art arda iki kaçırma, 7 günde 1 joker), toparlanma maddesi, mealPlan (protein ≥ hedef, art arda tekrar yok), etkinlik görevlerinin doğru günde çıkması, beden kontrolü eşiği, haftalık özet metni.
- `tests/care.test.js`: kafein/uyku hatırlatmaları ≤ 6 kuralıyla, öncelik en düşük.
- `tests/plan.test.js`: Ekim listesi toplamı ≤ 15.000, her rx maddede `alt` ≥ 1, her maddede `ingredients`.
- Seneca `tests/test_zenon_push.py`: adım uçları (token, sınırlar, budama, CORS), tüm suite önce/sonra.
- Playwright: yeni bölümler 375 px, sayfa hatası yok; kamera yerine dosya seçici yolu.

## Kapsam dışı

- Aşama B (gece Claude rutini, parfüm rafı) ayrı.
- Android Health Connect (web'den erişilemez).
