# Diogenes · Yeni arayüz — tasarım

Tarih: 2026-10-04 · Yön: Gece mavisi + şampanya altını (kullanıcı seçimi)

## Amaç
Telefonda tek elle, bir bakışta anlaşılan, lüks bir borsa uygulaması. Ana ekran soruyu tek cümleyle cevaplar:
"Sistem bugün ne yaptı ve 100 işlem hedefine göre nerede?" Ayrıntı isteyen eski Gelişmiş görünüme (pro.html) gider.

## Kapsam
- `index.html` yeni uygulama olur (telefondaki kurulum aynı adresi açtığı için kendiliğinden gelir).
- Eski ana ekran `klasik.html` olarak korunur; `pro.html` olduğu gibi kalır. Her ikisine Hesap sekmesinden bağlantı.
- Yalnız okuma: veriler `data/*.json`. Canlı fiyat için mevcut Finnhub anahtarı (aynı tarayıcı kaydı, kullanıcı yeniden girmez).

## Belirteçler
| Ad | Hex | Rol |
|---|---|---|
| Gece | #0E1A2B | zemin |
| Derin | #142439 | yüzey, sekme çubuğu |
| Şampanya | #C8A96A | tek vurgu: kadran, seçili sekme, %60 işareti |
| Fildişi | #EDE6D6 | metin |
| Duman | #8E97A6 | ikincil metin |
| Yosun | #6FB08F | kazanç |
| Bordo | #C0606A | kayıp |

Yazı: rakamlar ve başlıklar Bodoni Moda (yüksek kontrast, saat kadranı rakamı hissi); gövde Manrope (tabular rakam).
Büyük harf etiket, mono yazı ve ok işaretli bağlantı yok; cümle düzeni.

## Ekranlar (alt sekme çubuğu: Bugün · Gelişim · Araştırma · Hesap)
1. **Bugün**: üstte marka + tarih + piyasa durumu tek satır. Ortada **kronograf kadranı** (tek akılda kalan öğe):
   dış halkada 100 çentik (dolan = kapanmış işlem), iç yay kazanma oranı, yayın üstünde altın %60 indeksi, ortada net $
   ve "23 / 100". Altında iki satır: "Kazanma hedefi %60 ✓/✗", "Komisyon sonrası artı ✓/✗". Sonra **Bugünün işlemleri**:
   3 satır (sembol, oyun kitabı, durum ya da canlı R); boş satır "11:00'de garanti giriş" der. Açık swing pozisyonları altında.
   Hafta planı bayrağı dikkat/dur ise tek satır not.
2. **Gelişim**: oyun kitapları bugünkü sıraya göre; her satırda ad, ustası, örnek sayısı, kazanma oranı ince altın çubukla,
   net R. Altında sistemin kendi değişiklikleri zaman çizelgesi (tarih, ne değişti, neden).
3. **Araştırma**: hafta planı (Pzt–Cum bayrak şeridi, öne çıkan / kaçınılacak sektörler, izleme listesi), geçen haftanın
   değerlendirmesi, fikirler (kabul/ret, kaynak bağlantısı, sınav sonucu), aktif araştırma kitapları.
4. **Hesap**: gerçek bütçe swing (600 $), kâğıt hesap özeti (bakiye, komisyon, 600 $ karşılığı), canlı fiyat anahtarı,
   bildirim konusu, Gelişmiş görünüm ve klasik ekran bağlantıları, sürüm.

## İlkeler
- Cesaret tek yerde: kadran. Geri kalan sakin: kart ızgarası yok, ince ayırıcılar, bol boşluk, sola hizalı metin.
- Hareket: yalnız açılışta kadranın bir kez çizilmesi; azaltılmış hareket tercihinde yok.
- Boş durumlar yön gösterir ("İlk işlem pazartesi 16:35'te").
- 390 px telefonda yatay kaydırma yok; dokunma hedefleri ≥ 44 px; klavye odağı görünür; kontrast AA.

## Test
Playwright + Edge ile 390×844 ekran görüntüsü: canlı (boş) veri ve dolu örnek veriyle; JS sözdizimi kontrolü;
service worker sürümü artar, sayfa sürüm etiketi gösterir.
