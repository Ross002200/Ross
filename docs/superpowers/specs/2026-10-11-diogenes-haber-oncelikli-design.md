# Diogenes — haber öncelikli, kendinden öğrenen sistem (tasarım)

Tarih: 2026-10-11 · Durum: kullanıcı onayı bekliyor

## Amaç

Diogenes haberi dakikalar içinde görsün; o hisse ya da sektör için kendi geçmiş deneyimine, teknik analize ve
güvenine baksın; ancak hepsi olumluysa işleme alsın. Her kapanan işlemden neden kazandığını ya da neden
kaybettiğini çıkarsın ve bunu sonraki kararlarına taşısın.

Başarı ölçütü: 100 kapanmış kâğıt işlemde komisyon sonrası net R artıda ve kazanma oranının güven aralığı
alt sınırı başabaşın üstünde. O zamana kadar sistem kâğıt modunda kalır.

## Kullanıcı kararları (2026-10-11)

- Bütçe 600 $ yerine 1000 $.
- Her kapanan işlemde "neden stop / neden kâr" analizi; dersler sisteme döner.
- Sıra: önce haber, sonra kendi verisi ve deneyimi, sonra teknik analiz ve güven, en son işlem.
- Haberler anlık izlenir: hisse ve sektör, iyi ve kötü.
- İşlem yalnız TR 16:30 sonrası değil, hafta içi geniş pencerede.
- Sürekli çalışan bulut parçası Seneca'nın sunucusuna kurulabilir; Seneca'nın ve diğer sistemlerin verisine
  zarar gelmeyecek.

## Bugünkü durum

- Stratejiler ekside: 60 günlük testte 116 işlem, kâr faktörü 0,80 (komisyonsuz 0,89); 377 gölge işlemde
  ortalama −0,29R.
- Haber yalnız ölçülüyor (`news_score.py`: "kararları değiştirmez"); haber kitabında 2 örnek var.
- Tarama GitHub Actions'ta: seans açıkken yaklaşık 7 dakikada bir, seans dışında günde bir kez. Giriş penceresi
  09:35–15:30 New York (TR 16:35–22:30).
- Ders mekanizması var ama 10 kuralın hepsi "veri az"; otomatik ayar 9 işleme bakıp hedef değiştirdi.

## Mimari

```
Haber bekçisi (bulut, dakikada bir)
   │  yeni haber: sembol / sektör, tür, yön, güç
   ▼
Olay taraması (GitHub Actions, haber başına tetiklenir)
   │  1. deneyim: bu haber türünün karnesi
   │  2. teknik onay
   │  3. güven puanı
   ├─ hepsi olumlu → kâğıt işlem + telefona emir fişi
   └─ değilse → "izleme" kaydı (nedeniyle), sonucu yine ölçülür
   ▼
Otopsi (her kapanan işlem) → ders tablosu → karne ve kurallar
```

### 1. Haber bekçisi (yeni, bulutta)

- Dakikada bir kontrol: Finnhub şirket ve piyasa haberleri, SEC 8-K bildirimleri, bilanço takvimi.
- Her haber bir kez işlenir (başlık + kaynak + zaman özetiyle tekrar süzülür).
- **Sınıflandırma** (kural tabanlı, anahtar kelime + kaynak):
  - Tür: bilanço, beklenti güncellemesi, analist notu, sözleşme / ürün, onay (FDA vb.), birleşme / satın alma,
    hukuki / soruşturma, hisse ihracı, yönetim değişikliği, sektör / makro.
  - Yön: iyi, kötü, belirsiz. Güç: 1–3.
- Sektör haberi: sektör ETF'i ve o sektörde göreli gücü en yüksek 3 hisse aday olur.
- Bekçi teknik analiz yapmaz; yalnız haberi yakalar ve GitHub'daki olay taramasını tetikler.

### 2. Olay defteri ve haber karnesi (yeni)

- `data/olaylar.json`: her haber — zaman, sembol / sektör, tür, yön, güç, kaynak, başlık, o anki fiyat.
- Gece laboratuvarı her olayın sonrasını ölçer: 1 saat, gün sonu, 3 gün getirisi ve S&P 500'e göre fark.
- **Haber karnesi:** tür × yön başına adet, ortalama fark, pozitif oranı. Sistem "deneyim" olarak buna bakar.
- İşleme dönüşmeyen haberler de ölçülür; karne kâğıt işlem olmasa da büyür.

### 3. Karar zinciri (olay taraması)

Sıra sabittir; bir basamak olumsuzsa sonraki çalışmaz ve neden kaydedilir.

1. **Deneyim:** bu tür × yönün karnesi. 30'dan az örnek varsa "öğrenme" (yarım riskle kâğıt işlem); 30+ örnekte
   ortalama fark eksiyse ret.
2. **Teknik onay:** fiyat 20 günlük ortalamanın üstünde; haber sonrası ilk geri çekilme tutundu (ilk 15
   dakikanın dibi kırılmadı ve fiyat VWAP üstünde); göreli hacim ≥ 1,5; stop mesafesi günlük ATR'yi aşmıyor.
3. **Güven ve getiri:** komisyon sonrası ödül / risk ≥ 2; aynı sektörde en çok 2 açık pozisyon.
4. **İşlem:** kâğıt pozisyon açılır, telefona hazır emir fişi gider (giriş, stop, hedef, adet, çıkış kuralı).

Sıçramanın peşinden gidilmez: haber anındaki ilk mum girilmez, geri çekilme beklenir.

### 4. Kötü haber

- Açık pozisyonun hissesinde ya da sektöründe kötü haber: hemen "çık" bildirimi.
- O hisse 24 saat, kötü sektör haberi alan sektör gün sonuna kadar yeni girişe kapalı.
- Açığa satış yok (Midas kontrolüne göre değişebilir).

### 5. Otopsi ve ders döngüsü

Her kapanan işleme bir neden etiketi:

| Stop olduysa | Kârla kapandıysa |
|---|---|
| Boşlukla delindi | Haber taşıdı (haber sonrası hacim sürdü) |
| Stop dar kaldı (sonra hedefe gitti) | Piyasa taşıdı (S&P aynı sürede güçlü) |
| Piyasa döndü (S&P aynı sürede −%0,5 ve altı) | Teknik seviye çalıştı |
| Haber söndü (hacim ilk saatin yarısına indi) | |
| Süre doldu | |
| Plan dışı (kural çiğnendi) | |

- Her işlem için ayrıca en çok lehte ve en çok aleyhte gidiş (R cinsinden).
- **Ders tablosu:** etiket × kitap × haber türü. Bir etiket 30 işlemde belirgin eksi ise sistem bir kural
  değişikliği **önerir**; uygulanması ayrı bir sınav dönemini geçmesine bağlıdır.
- Otomatik ayar, kitap başına 30 kapanmış işleme kadar dondurulur.
- Uygulamada her işlemin kartında "Neden?" ve haftalık "Bu hafta ne öğrendik" özeti.

### 6. Bütçe

`config.json`: toplam 1000 $, küçük hesap ölçeği 1000 $, swing payları 500 ve 750 $, durdurma eşiği 150 $
(600 $'daki oranlar korunur). İşlem başı risk 20 $; gidiş-dönüş 3 $ komisyon 0,15R eder.
Swing tarafındaki gerçek para payının büyütülmesi kullanıcının kararıdır; öneri, 100 işlem ölçütü dolana
kadar değiştirmemek.

### 7. Saatler

- Midas (kullanıcı ve Midas duyurusu, 2026-10-11): çoğu ABD hissesi pazartesi 04:00 – cumartesi 04:00 (TR)
  arası 24 saat açık; normal seans dışında **yalnız limit emir** geçer. Gece seansında stop emrinin çalıştığı
  doğrulanamadı.
- Hedef pencere TR 11:00–03:00 (New York 04:00–20:00). Seans dışında giriş limit emirle; stop "zihinsel"dir:
  fiyat stop seviyesine gelince sistem bildirim yollar, çıkış limit emirle elle yapılır.
- Seans dışı adaylar: Midas'ta 24 saat açık olan ve son 20 günde seans dışı hacmi yüksek hisseler.
- TR 03:00–11:00 gece seansı için ücretsiz veri yok; bu aşamada kapsam dışı.
- Giriş iki kipte ölçülür: **gün içi** (haberden sonraki ilk geri çekilme, aynı gün kapanmadan çıkış) ve
  **sürüklenme** (1–3 gün taşıma). Hangisinin daha çok kazandırdığına karne karar verir. Girilmeyen sert
  hareketler "kaçan" diye kaydedilir ve sonuçları ölçülür.

### 8. Uygulama

- Yeni "Canlı" bölümü: haber akışı ve her haberin durumu — izleniyor, teknik onay bekliyor, işleme alındı,
  reddedildi (nedeniyle).
- Bildirimler mevcut telefon bildirimi kanalından: yeni işlem fişi, çıkış uyarısı, kötü haber uyarısı.

## Bulut ve veri güvenliği

- Bekçi Seneca'nın sunucusunda **ayrı** çalışır: ayrı Linux kullanıcısı `diogenes`, ayrı klasör
  `/opt/diogenes`, ayrı servis. Seneca'nın klasörlerini okuyamaz ve yazamaz.
- Kaynak tavanı: bellek 120 MB, işlemci %20. Aşarsa yalnız bekçi yeniden başlar.
- Sunucuya dışarıdan yeni kapı açılmaz ve Seneca'nın web ayarlarına dokunulmaz: bekçi yalnız dışarı istek
  atar (haber kaynakları, GitHub, bildirim).
- Kurulumdan önce sunucu diskinin anlık kopyası alınır.
- Bekçi durursa Diogenes'in mevcut GitHub taraması aynen çalışmaya devam eder; yalnız anlık haber gecikir.
- GitHub anahtarı yalnız `Ross` deposunda "Actions" yetkisi taşır.

## Yol haritası

| Adım | İçerik | Kullanıcıdan gereken |
|---|---|---|
| D1 | Bütçe 1000 $, otopsi, ders tablosu, otomatik ayarın dondurulması | yok |
| D2 | Olay defteri ve haber karnesi (işlem yok, yalnız ölçüm) | yok |
| D3 | Karar zinciri kâğıt modunda, geniş saat penceresi | Midas kontrolü |
| D4 | Bulutta haber bekçisi, "Canlı" bölümü, kötü haber uyarıları | disk kopyası, GitHub anahtarı, Finnhub anahtarı, kurulum komutu |
| D5 | 100 işlem sonunda gerçek para ölçütünün birlikte değerlendirilmesi | karar |

D1–D3 yalnız GitHub deposunda çalışır; sunucuya D4'te dokunulur.

## Kapsam dışı

Otomatik emir gönderme (Midas'a emirler elle girilir), açığa satış, gece seansı (TR 03:00–11:00), yapay
zekâ ile haber sınıflandırma (ücretli anahtar ister; kural tabanlı sürüm ölçüldükten sonra karar verilir).

## Riskler

- Kural tabanlı sınıflandırma haberin yönünü yanlış okuyabilir; karne bunu tür bazında ortaya çıkarır.
- Hız avantajımız yok: haberin ilk dakikaları profesyonellerindir. Sistem sonraki saat ve günlerdeki
  harekete oynar.
- Seans dışında makas geniştir; limit emir dolmayabilir.
- Küçük örnek: karne ve ders tablosu ilk haftalarda oynak olur, bu yüzden 30 işlem eşiği var.
