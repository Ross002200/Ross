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

## Diogenes (`diogenes/`)

Dürüst işlem defteri: ABD hisseleri, Midas. Öğrenme amaçlıdır, yatırım tavsiyesi değildir; hiçbir aracı kuruma bağlanmaz. Adres: `https://ross002200.github.io/Ross/diogenes/` (Safari → Paylaş → Ana Ekrana Ekle).

Basit görünüm (`index.html`), dört sekme:
- **Günün planı** (ana ekran, `index.html`, `scan/watchlist.py` v4): tek pozisyon, sırayla. Bir hisse kapanmadan diğeri alınmaz; gün, sabah araştırılmış ilk hisseyle açılışta başlar (açılışta +%1'den fazla boşluk varsa sıradakine geçilir). Kapanınca sıradaki hisse fiyat VWAP'ın ve açılışın üstündeyken alınır (14:30 NY'ye kadar). Günde 2 stopta gün biter. Stop %2–2,5 (günlük oynaklığın ~%70'i), çok iyi haberli hissede %3'e kadar; hedef stopun 2 katı; 15:55 NY'de açık pozisyon kapatılır. Piyasa kalkanı ya da Claude "dur" derse o gün alım yok; "dikkat" günlerinde yalnız iyi haberli ya da dün hacmi 1,5 katı olan hisseler. Claude'un olumsuz dediği sektörlerden hisse alınmaz, olumlu sektörler öne alınır; sırada bir sektörden en fazla 2 hisse. Son 5 günde %8'den fazla yükselmiş hisseler elenir. Adet: bakiye ve %2 risk (stopta en fazla bakiyenin %2'si), kaldıraç yok; net sonuç Midas komisyonu (emir başı 1,5 $) dahil.
  60 günlük 15 dk test (S&P 500 + likit hisseler): eski "hepsini aç, %2/%2" kuralı 60 günde −286 $; tek pozisyon + 2 stop + stop %2–3 + hedef 2× ≈ −25 $; buna dünkü hacim ≥1,5× ve piyasa kalkanı eklenince ≈ +79 $ (günde ~0,9 işlem). Fark istatistik gürültüsü içinde, yani kanıtlanmış bir avantaj değil; komisyon hâlâ brüt kârın büyük kısmını alıyor.
- **Takip**: ★ ile eklenen hisseler.
- **İşlemler**: sistemin kâğıt hesabı.
- **Daha fazla**: listenin isabeti, sabah notu, ayarlar, bildirim konusu, gelişmiş görünüm.

Gelişmiş görünüm (`pro.html`): tarama, plan formu, günlükler, backtest, kodeks ve ustalar raporu.

Otomasyon (`.github/workflows/`):
- `diogenes-scan.yml`: hafta içi seans boyunca ~7 dakikada bir (her çalışma 45 dk kendi içinde döner; GitHub gecikmeleri boşluk bırakmaz, push başarısızsa 5 kez denenir) `diogenes/scan/scan.py`. ~560 sembollük evren (`scan/universe.json`: S&P 500 + sık işlem gören hisseler ve ETF'ler) süzülür, 15 dk / 1 s order flow aranır, backtest günde bir yenilenir, kâğıt hesap 5 dk mumlarla yönetilir. Çıktılar: `data/watchlist.json` (günün takip listesi, `scan/watchlist.py`), `data/watch_history.json`, `data/scan.json`, `data/paper.json`, `data/backtest.json`, `data/journal.json` (sistem günlüğü: her gün hangi kuralın kaç adayı elediği, işlemler ve senaryoları, bakiye, düşüş, risk, ¼ Kelly).
- `diogenes-weekend.yml`: cumartesi `scan/weekend.py` → `data/weekly.json` (bilanço ve makro takvimi, sektörler, haftalık sonuç). Pazar günü Claude rutini haberleri araştırıp `data/brief.json` yazar.
- Bildirimler ntfy ile gider (`scan/config.json` → `ntfy_topic`, ya da repo secret `NTFY_TOPIC`).
- Kurallar ve süzgeçler `scan/config.json`, makro takvim `scan/macro.json`.

Uygulama açıkken fiyatlar Finnhub'dan canlı akar (ücretsiz anahtar, Kodeks → Ayarlar); kâğıt pozisyonlar stop/hedefte kendiliğinden kapanır.

Kişisel kayıtlar yalnızca o cihazın tarayıcısında saklanır; Kodeks → Veri bölümünden yedeklenir. `diogenes/sw.js` uygulamayı çevrimdışı açılabilir yapar (tarama verisi her zaman ağdan gelir).

### Bildirimler

Tüm bildirimleri tek yerden, tarayıcı gönderir; uygulama ile aynı veriye dayanır. Claude rutinleri yalnız analiz dosyası yükler, kendi bildirim atmaz. Aynı başlık ve metin son 20 saatte ntfy'de görüldüyse tekrar gönderilmez. Günün hisseleri için: sabah liste (Claude'un risk bayrağı ve notuyla), açılışta alım seviyeleri, her hedef ve stop, gün içi eklenenler, haber değişince uyarı, gün sonu özeti.

### Laboratuvar (`scan/lab.py`, `data/lab.json`, uygulamada "Lab" sekmesi)

Trade şampiyonlarının yayımlanmış yöntemleri kurallara dökülüp bakiye harcamadan denenir: Minervini (VCP/SEPA), Kullamägi (kırılım, episodik pivot), Oliver Kell (EMA geri dönüşü), Linda Raschke (Holy Grail), Takashi Kotegawa/BNF (sapma oranı), Lance Breitstein (kapitülasyon dönüşü), J Law (yeni zirve momentumu), Martin Luk (sıcak sektör lideri), Andrew Aziz (açılış aralığı kırılımı, 15 dk), Larry Connors (RSI-2, karşılaştırma), Diogenes trend kırılımı, Diogenes günün planı ve laboratuvarın kendi fikri "rejim değiştirici".
- Son 2 yılın günlük verisi (gün içi stratejilerde son 60 günün 15 dk verisi), her işlem 1.000 $ ve 3 $ komisyon, aynı gün stop+hedef → stop.
- İlk yıl öğrenme, ikinci yıl sınav. Kaybeden işlemler incelenir, kayıpları en çok azaltan tek filtre ("ders") aranır; sınav yılında da tutarsa "+ ders" sürümü ayrıca denenir.
- 2 Ekim 2026'dan sonraki sinyaller canlı kâğıt deneme sayılır (kurallar sabit). Mezuniyet: canlı 10+ işlem, %60+ kazanma, komisyon sonrası artı ve sınav yılı artı → sinyaller ana ekrana "Lab onaylı" girer, bildirim gelir. Kazanma oranı düşük ama kâr faktörü ≥ 1,3 olanlar "güçlü aday" olarak işaretlenir, kullanıcı onayı bekler.
- `diogenes-lab.yml` her işlem günü kapanıştan sonra çalışır.
