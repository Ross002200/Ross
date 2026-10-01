# Zenon

Japon estetiğinde kişisel stil danışmanı. Mobil öncelikli bir web uygulaması (PWA): Safari'de açıp **Paylaş → Ana Ekrana Ekle** ile uygulama gibi kullanılır.

## Bölümler

| Sekme | İçerik |
|---|---|
| 今 Bugün | Elle girilen ve hatırlanan şehrin canlı havası (Open-Meteo), gece girilen "yarın nereye" planı, kirli parçaları atlayan kombin kararı |
| 衣 Gardırop | Kıyafet arşivi, temiz/kirli takibi, fotoğrafla yeni parça ekleme |
| 型 Stil | Kombinlerin anime figürler üzerinde çizimi ve olur/dikkat/olmaz kararı, Starboy × Klasik yönü, alternatif yönler (City Boy, Tokyo Ivy, Amekaji), 178 cm / 90 kg kalıp kuralları, renk sistemi, ünlü kesitleri, mevsim kapsülü, Sanzo Wada kombinasyonları |
| 買 Alışveriş | Bütçeye (ekonomik / dengeli / yatırım) ve markaya (Zara, Massimo Dutti, Pull&Bear, Bershka, H&M) göre eksik parçalar, aday → onay listesi, araştırma kaynakları |

## Durum

Tasarım örneği. Gardırop verileri **örnektir**. Hava, telefonda konum veya şehir girilince canlı gelir; o zamana kadar örnek gösterilir. Ürün fiyatları henüz takip edilmiyor. Eklenen parçalar yalnızca o cihazın tarayıcısında saklanır.

Renk değerleri: [mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations) veri setindeki Sanzo Wada renkleri.

## Dosyalar

- `index.html`: sayfa iskeleti
- `zenon.css`: tasarım
- `zenon.js`: veriler, kombin motoru ve kıyafet çizimleri
- `build-preview.py`: üç dosyayı tek sayfada birleştirir (önizleme için)
- `manifest.webmanifest`, `icon*.png`, `icon.svg`: ana ekran ikonu ve PWA ayarları

## Takip (記)

- **Bunu giyiyorum**: giyim takvimine yazar; tişört 1, kazak 3, jean 5 giyimde otomatik kirliye düşer.
- **👍 / 👎**: beğenilen kombin öne çıkar, beğenilmeyen 14 gün önerilmez.
- **Aldım**: sepetteki parça gardıroba geçer.
- **Haftalık plan**: her gün için mekân; Zenon o günü buna göre hazırlar.
- **İstatistik**: en çok / hiç giyilmeyen, giyim başı maliyet, renk dağılımı, mekân kapsamı.
- **Seyahat**: şehir + gün sayısı → günlük kombin ve bavul listesi (Open-Meteo tahmini).
- **Hatırlatma**: her akşam 21:00 takvim bildirimi (.ics) ya da Kestirmeler otomasyonu.
- **Yedek**: tüm cihaz verisi JSON olarak indirilir / geri yüklenir.
- **Paylaş**: kombin kartı PNG olarak paylaşılır.

## Yayınlama

GitHub → Settings → Pages → *Deploy from a branch* → bu dal, `/ (root)`. Adres: `https://ross002200.github.io/Ross/`. `sw.js` uygulamayı çevrimdışı açılabilir yapar.

## Gün İçi Masası (`trade/`)

Öğrenme amaçlı, kâğıt üzerinde gün içi işlem defteri. Yatırım tavsiyesi değildir; hiçbir aracı kuruma bağlanmaz. Adres: `https://ross002200.github.io/Ross/trade/`.

- **Masa**: işlem planı (giriş / stop / hedef) kurallara göre kontrol edilir; lot, risk ve ödül/risk otomatik hesaplanır. Kurala aykırı plan açılamaz.
- **Yükselenler**: kripto için Binance 24 saatlik en çok yükselenler; BIST ve diğerleri elle eklenir.
- **Günlük / İstatistik**: R çarpanı, kazanma oranı, beklenti, sermaye eğrisi, kurulum bazında sonuç, plana uyunca ve uymayınca fark.
- **Kurallarım**: risk %, günlük zarar sınırı, işlem sayısı, min. ödül/risk, saatler, kontrol listesi, kurulumlar.
- **Claude ile**: günün raporunu kopyalayıp sohbete yapıştırma; Claude'un verdiği JSON planı forma aktarma.

Veriler yalnızca o cihazın tarayıcısında saklanır; Kurallarım → Veri bölümünden yedeklenir.
