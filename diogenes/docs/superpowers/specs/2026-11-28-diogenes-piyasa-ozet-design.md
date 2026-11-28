# Diogenes Piyasa Panosu ve Günlük Özet: Tasarım

- **Tarih:** 2026-11-28
- **Durum:** Onay bekliyor
- **İlgili belge:** `2026-11-27-diogenes-finans-asistani-design.md`. Bu belge, oradaki Piyasa sekmesi kararını ("yalnızca bağlantı") değiştirir.

## 1. Amaç ve kullanıcı

Diyar Diogenes'i açtığında Türkiye ve ABD piyasalarını, altını, dövizi, faizi ve enflasyonu tek ekranda görmeli. Her hafta içi sabah da kısa bir özet bildirimi almalı: piyasada ne oldu, bütçesi nerede duruyor, bugün takvimde ne var.

Diogenes bu bölümde **veri ve hesap verir, tavsiye vermez.** Kişiye özel al-sat ya da dağılım önerisi yoktur. Bunun iki gerekçesi var: Türkiye'de bu, SPK lisansı gerektiren yatırım danışmanlığıdır. Ayrıca reel getiri sıralaması aydan aya değişiyor (TÜİK: Eylül 2026'da altın yıllık +%5,3 reel getirdi, Ekim 2026'da −%11,7).

**Başarı ölçütleri:**
- Hafta içi her sabah 08:30'da doğru rakamlarla bir özet gelir.
- Bir kaynak düşerse yalnızca o satır eksik kalır.
- Eski veri hiçbir zaman güncel veri gibi gösterilmez.

**Diyar'ın kararları (2026-11-28):**
- Özet Diogenes'te tutulur, ayrıca bildirim gelir.
- Panoda dört grup olur: altın ve döviz, Türkiye borsası, ABD borsası, faiz/enflasyon/fon.
- Özet karma yazılır: rakamları kod hesaplar, Claude kısa bir not ekler.

## 2. Mimari ve veri akışı

Saatler Türkiye saatidir. Yalnızca hafta içi çalışır.

| Saat | Kim | Ne yapar |
|---|---|---|
| 07:30 | Claude rutini (bulut) | Günün olaylarını ve önemli haberi araştırır. 2–3 cümlelik notu `diogenes/data/gunluk_not.json` dosyasına yazıp depoya commit eder (mevcut haftalık `brief.json` kalıbı). Rutinin Diogenes anahtarına ihtiyacı yoktur. |
| 08:00 | GitHub Actions `diogenes-piyasa.yml` | Python + yfinance ile fiyatları; TCMB EVDS ile faiz ve TÜFE'yi; TEFAS'tan fon fiyatlarını toplar. Notu dosyadan okur. Hepsini `POST https://diogenes.diyarross.com/api/piyasa` ucuna gönderir (`x-piyasa-key`). |
| 08:30 | Diogenes worker cron (`30 5 * * 1-5`) | Günün özetini kurar: rakam satırları, bütçe satırı ve not. Özeti `ozetler` tablosuna yazar ve bildirim servisine gönderir. |

### Kaynaklar

| Veri | Kaynak | Not |
|---|---|---|
| Dolar/TL, euro/TL | Yahoo `USDTRY=X`, `EURTRY=X` | 15–20 dakika gecikmeli |
| Ons altın | Yahoo `GC=F` | Gram altın = ons × USDTRY ÷ 31,1035. Çeyrek altın = gram × 1,6038 (1,75 g × 22 ayar ≈ 0,9165 saflık). Bunlar hesaplanmış değerlerdir, kuyumcu fiyatı değildir; ekranda bu belirtilir. |
| BIST 100, BIST hisseleri | Yahoo `XU100.IS`, `<KOD>.IS` | Hisse kodlarının Yahoo'da çalıştığı uygulama sırasında doğrulanır. Çalışmazsa `borsapy` kullanılır. |
| S&P 500, Nasdaq, ABD hisseleri | Yahoo `^GSPC`, `^IXIC`, `<KOD>` | Hisse taramasının mevcut kurulumunu kullanır |
| Politika faizi, TÜFE endeksi, mevduat faizi | TCMB EVDS | Ücretsiz anahtar gerekir (`EVDS_KEY`). Anahtar yoksa bu satırlarda "veri yok" yazar. |
| Fon fiyatları | TEFAS (`tefas-crawler` 0.6+) | Kaynak kırılgandır. Hata verirse yalnızca fon satırları boş kalır. |

### Geçmiş veri

Görev her gün günlük değerleri gönderir. Buna ek olarak her enstrümanın **son 13 ay sonu kapanışını** da gönderir (yaklaşık 15 enstrüman × 13 değer). Böylece reel getiri karnesi ilk günden dolu olur.

### Bildirim

Mevcut `diogenes-bildirim` worker'ı kullanılır. Diogenes bu worker'a service binding (`BILDIRIM`) ile `POST /gonder` gönderir. Ayrıca şu değişiklikler gerekir:
- **İzin listesi:** Bildirim worker'ının izin verdiği adreslere `https://diogenes.diyarross.com` eklenir. Şu an yalnızca `ross002200.github.io` izinli.
- **Abonelik:** Yeni uygulamanın service worker'ı push aboneliği yapar (Ayarlar → "Bildirimleri aç"). Push gelince `GET /son` ile son bildirimi okuyup gösterir. iOS'ta bildirim için uygulamanın ana ekrana eklenmiş olması gerekir (iOS 16.4+).
- **Eski uygulama:** Eski tarama uygulamasına abone olan cihazlar da özeti alır. Bu kabul edilen bir yan etkidir.

## 3. Veri modeli (D1, migration `0003_piyasa.sql`)

| Tablo | Sütunlar |
|---|---|
| `piyasa` | `gun`, `kod`, `grup` (`altin_doviz`/`tr`/`abd`/`faiz`), `ad`, `deger` (REAL), `onceki` (REAL, bir önceki işlem günü), `birim`, `kaynak`, `durum` (`ok`/`yok`/`supheli`). Birincil anahtar: `(gun, kod)`. |
| `piyasa_aylik` | `ay`, `kod`, `deger`. Ay sonu kapanışı; TÜFE için endeks değeri. Birincil anahtar: `(ay, kod)`. |
| `piyasa_not` | `gun` (birincil anahtar), `metin`, `kaynak` |
| `ozetler` | `gun` (birincil anahtar), `metin`, `bildirim` (0/1), `olusturma` |
| `izleme` | `id`, `tur` (`bist`/`abd`/`fon`), `kod`, `sira`. En çok 10 BIST, 10 ABD, 5 fon. |

Fiyatlar kuruşa çevrilmez, REAL olarak saklanır. Bunlar Diyar'ın parası değil, piyasa fiyatıdır. Ekranda gösterilirken yuvarlanır.

## 4. Hesaplar (saf, `src/piyasa.js`)

- **Günlük değişim:** `(deger − onceki) / onceki`. `onceki` yoksa değişim gösterilmez.
- **Şüpheli veri:** Bir günlük değişim, gruba özgü eşiği aşarsa satır `supheli` olarak işaretlenir ve gösterilmez. Eşikler: döviz ve altın ±%15, endeks ±%20, hisse ±%35. Fiyatın sıfır ya da negatif olması da şüpheli sayılır.
- **Bayatlık:** Son veri günü, bugünden iki iş gününden daha eskiyse panonun üstünde "Veri N gündür güncellenmedi" uyarısı çıkar.
- **Reel getiri (1, 3 ve 12 ay):** `(1 + nominal) / (1 + TÜFE değişimi) − 1`. Nominal getiri `piyasa_aylik` ay sonu değerlerinden hesaplanır.
  - **Mevduat:** Getirisi, ilgili aylardaki yıllık mevduat faizinin aylığa bölünüp bileşiklenmesiyle bulunur (yaklaşık değer; brüt, stopaj hariç). Ekranda "yaklaşık" diye belirtilir.
  - **Eksik veri:** Hesap için gereken TÜFE ya da fiyat eksikse hücrede "—" görünür.
- **Harcama hızı** (bütçe satırı için): Zarfın ay içindeki günlük ortalama harcaması `harcanan / geçen gün` olarak hesaplanır. Bu hızla zarfın biteceği gün `bugün + kalan / ortalama` olur ve ay sonundan önceyse söylenir. Ayın ilk 3 gününde tahmin yapılmaz, çünkü veri yetersizdir.
- **Özet metni:**
  - **Satır 1, piyasa:** `Dolar 42,10 (+%0,4) · gram altın 4.210 (−%1,1) · BIST 100 +%0,8 · S&P 500 −%0,2`
  - **Satır 2, bütçe:** En riskli zarf, örneğin "Yemek'te 1.200 ₺ kaldı; bu hızla 22'sinde biter". Riskli zarf yoksa satır "Atanmamış X ₺" olur. Kurulum yapılmamışsa bütçe satırı hiç yazılmaz.
  - **Satır 3, not:** Claude'un notu. Not yoksa bu satır yazılmaz.
  - **Bildirim:** Bildirim metni satır 1 ve satır 2'den oluşur (en çok 180 karakter).

## 5. Ekranlar

**Piyasa sekmesi**, yukarıdan aşağıya:
1. **Bugünün özeti.** Özet metni, Claude notu ve verinin saati ("08:00 itibarıyla, gecikmeli").
2. **Pano.** Dört grup kart. Her kartta değer, günlük değişim (yeşil ya da kırmızı) ve 30 günlük küçük bir çizgi grafik (SVG) bulunur. Karta dokununca 1, 3 ve 12 aylık değişim açılır.
3. **Reel getiri karnesi.** Satırlar: mevduat (yaklaşık), gram altın, dolar, BIST 100 ve izleme listesindeki fonlar. Sütunlar: 1, 3 ve 12 ay. Altında sabit bir not durur: "Geçmiş getiri geleceği göstermez; sıralama aydan aya değişiyor. Tavsiye değil, hesap."
4. **Eski tarama ekranlarına bağlantı.**

**Zarflar ekranı:** En üste tek satırlık bir şerit eklenir: dolar · gram altın · BIST 100 (değişimleriyle). Veri yoksa şerit gösterilmez.

**Ayarlar:**
- **İzleme listesi:** Mevcut liste editörü kullanılır. Tür ve kod girilir; kod büyük harfe çevrilir ve `^[A-Z0-9.]{1,12}$` kuralına uymalıdır.
- **Bildirimleri aç / kapat.**

## 6. API

| Uç | Yetki | Davranış |
|---|---|---|
| `POST /api/piyasa` | `x-piyasa-key` (`PIYASA_KEY`, safeEqual) | Gövde: `{gun, satirlar:[{kod,grup,ad,deger,onceki,birim,kaynak}], aylik:[{ay,kod,deger}], not?}`. En çok 64 KB. Upsert yapılır: aynı gün yeniden gelirse üzerine yazılır. Şüphe kontrolü sunucuda da yapılır. Cevap: `{ok, yazilan, supheli}`. |
| `GET /api/izleme-listesi` | `x-piyasa-key` | Görev hangi kodları çekeceğini buradan okur. |
| `GET /api/piyasa?gun=` | Oturum | `{gun, saat, bayat, satirlar, seriler(30 gün), karne, ozet}` |
| `POST /api/bildirim/abone` | Oturum | Abonelik nesnesi bildirim worker'ına iletilir. |

`PUT /api/liste` uç noktası `izleme` tablosunu da kabul eder.

## 7. Hata durumları

| Durum | Davranış |
|---|---|
| Yahoo, TCMB ya da TEFAS'tan biri düşer | O satırlar `durum:'yok'` olarak gelir. Ekranda "veri yok (dünkü: X)" yazar, geri kalanı çalışır. |
| Görev hiç çalışmaz | Pano son veriyi ve bayatlık uyarısını gösterir. Özet "Piyasa verisi gelmedi" satırıyla yazılır. Bildirim yine gider ve yalnızca bütçe satırını içerir. |
| Claude notu yok | Özet notsuz yazılır. |
| Şüpheli değer | Satır gösterilmez. "Doğrulanamadı" etiketi ve dünkü değer görünür. |
| Bildirim worker'ı hata verir | Özet kaydedilir, `bildirim=0` olarak işaretlenir. Bir sonraki cron çalışması tekrar denemez. Kaçan bildirim kabul edilir. |
| Anahtar yanlış | 401 döner. |

## 8. Güvenlik

- **Gizli değerler:**
  - `PIYASA_KEY` hem GitHub'da (Actions secret) hem Cloudflare'de (Diogenes secret) durur.
  - `EVDS_KEY` yalnızca GitHub'da durur. Diyar anahtarı kendi girer.
  - Bildirim worker'ının `GONDER_TOKEN` değeri Diogenes'e secret olarak verilir.
- **Claude rutini:** Hiçbir anahtar görmez, yalnızca depoya dosya yazar.
- **İzleme kodları:** Biçim kuralıyla doğrulanır. Görev bu kodları komut satırına değil, yalnızca yfinance'e parametre olarak verir.

## 9. Test

- **Python (`scan/tests/test_piyasa.py`):**
  - Gram ve çeyrek altın dönüşümü.
  - Şüpheli değer eleme.
  - Kaynak düştüğünde `yok` satırları üretilmesi.
  - Gövde biçimi.
  - Ağ çağrıları sahte nesnelerle yapılır.
- **Diogenes (`tests/piyasa.test.js`):**
  - Değişim, şüphe ve bayatlık hesapları.
  - Bilinen TÜFE ve fiyatla reel getiri; mevduat yaklaşımı.
  - Harcama hızı, ilk 3 gün kuralı dahil.
  - Özet ve bildirim metni; kurulum yokken, not yokken ve veri yokken.
- **Duman testi:**
  - Anahtarsız istek 401 döner.
  - Sahte gövde gönderilir, ardından `GET /api/piyasa` ile pano ve karne kontrol edilir.
  - Aynı gün tekrar gönderildiğinde satırlar çoğalmaz.
  - `__scheduled` ile özet üretilir.
- **Tarayıcı:**
  - Piyasa sekmesi ve şerit, 375 ve 320 piksel genişlikte kontrol edilir.
  - Bayat veri uyarısı görünür.

## 10. Diyar'dan gerekenler

1. TCMB EVDS'ye ücretsiz kayıt olup API anahtarı alır ve GitHub'a secret olarak kendi girer. Adımlar yazılı olarak verilir.
2. İzleme listesini girer. Boş da bırakabilir.
3. Diogenes'in ilk kurulumunu tamamlar. Bütçe satırı için gereklidir.
4. Uygulamayı ana ekrana ekler ve Ayarlar → "Bildirimleri aç" der.
5. Claude rutininin kurulmasını onaylar. Rutin, planından günde bir kısa araştırma kadar kullanım harcar.

## 11. Kapsam dışı

- Anlık fiyat ve gün içi güncelleme.
- Al-sat sinyali ve kişiye özel dağılım önerisi.
- Kripto. İstenirse sonra tek satırla eklenir.
- Harcama analizi ekranları (sonraki alt proje), birim bazlı varlıklar ve kural tabanlı yatırım politikası (ondan sonraki alt proje).
