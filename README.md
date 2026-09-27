# Zenon

Japon estetiğinde kişisel stil danışmanı. Mobil öncelikli bir web uygulaması (PWA): Safari'de açıp **Paylaş → Ana Ekrana Ekle** ile uygulama gibi kullanılır.

## Bölümler

| Sekme | İçerik |
|---|---|
| 今 Bugün | Hava + günün planına göre kombin önerisi ve gerekçesi |
| 衣 Gardırop | Kıyafet arşivi, fotoğrafla yeni parça ekleme |
| 型 Stiller | Araştırmadan çıkan stil yönleri ve gardırop eşleşme oranı |
| 色 Renkler | Sanzo Wada, *A Dictionary of Color Combinations* (1933) kombinasyonları |

## Durum

İlk tasarım örneği. Hava durumu, plan ve gardırop verileri **örnek** verilerdir. Eklenen parçalar yalnızca o cihazın tarayıcısında saklanır.

Renk değerleri: [mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations) veri setindeki Sanzo Wada renkleri.

## Dosyalar

- `index.html`: uygulamanın tamamı (HTML + CSS + JS)
- `manifest.webmanifest`, `icon*.png`, `icon.svg`: ana ekran ikonu ve PWA ayarları
