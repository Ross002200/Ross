# Diogenes · Kişisel Finans Asistanı (Zarflar) — Tasarım

- Tarih: 2026-11-27
- Durum: taslak, Diyar'ın onayını bekliyor
- Kapsam: `D:\Claude\diogenes` (yeni worker) ve `D:\Claude\Aurelius` (Dazai bağlantısı ve taşıma)

## 1. Amaç ve kullanıcı

Diyar 22 yaşında. ESOGÜ Sivrihisar'da inşaat teknikerliği okuyor ve DGS'ye hazırlanıyor; günlük odağı spor ve dersler. Diogenes onun kişisel finans asistanı olacak. Hedef, finansal özgürlüğe en kısa yoldan ulaşmak.

Diogenes bütçeyi yönetir ama hiçbir işlemi kendiliğinden yapmaz. Her işlem önce **öneri** olarak hazırlanır ve Diyar onayladıktan sonra uygulanır.

**Diyar'ın kararları:**
- Tasarım **C · Zarflar** olacak: her lira bir zarfa atanır ve bir hedef merdiveni bulunur.
- Zarfları ve giderleri Diyar kendisi ayarlar. Diogenes takip eder, uyarır ve önerir.
- Harcama kayıtları Aurelius'tan Diogenes'e taşınır.
- Ay sonunda zarfta kalan para, merdivende sıradaki basamağa aktarılır (onayla).
- Hisse taraması çalışmaya devam eder ve "Piyasa" sekmesinde durur.
- Aylık gelir 35.000 TL'dir. Ayın 1'inde 15.000, 7'sinde 4.000, 16'sında 16.000 TL gelir.
- Mimari Cloudflare Worker + D1 olacak (Kleanthes ile aynı yapı).

**Sınır:** Diogenes kişiye özel al-sat ya da varlık dağılımı tavsiyesi vermez. Yatırım türlerini anlatabilir, hesaplama ve projeksiyon gösterebilir. Bu hesaplamalar "tavsiye değildir" notuyla gösterilir.

## 2. Mimari

- Diogenes tek bir Cloudflare Worker olarak çalışır ve `diogenes.diyarross.com` adresinde yayınlanır (custom domain). Worker üç şey sunar:
  - PWA ekranları (assets),
  - ekranların kullandığı `/api/*` uçları,
  - Dazai'nin kullandığı `/api/dazai/*` uçları.
- Tüm veriler D1 veritabanında (`diogenes`) tutulur ve `migrations/` klasöründen kurulur.
- Giriş, Kleanthes'teki gibi şifre ve HttpOnly çerezle yapılır. Dazai `x-dazai-key` başlığıyla (`DAZAI_KEY` secret) bağlanır.
- Cron günde bir kez çalışır. Gelir günlerinde dağıtım önerisi, abonelik günlerinde düşüm önerisi, ayın son gününde aktarım önerisi hazırlar. Kendi başına hiçbir şeyi uygulamaz.
- Kod düzeni şöyle:
  - `src/core.js`: saf hesaplar (dağıtım, kalan, aktarım, merdiven, kuruş).
  - `src/dazai.js`: Dazai sözleşmesi.
  - `src/tasima.js`: Aurelius'tan gelen kayıtları dönüştüren saf fonksiyonlar.
  - `src/worker.js`: HTTP, D1 ve cron.
- Testler `node --test` ile çalışır.
- Hisse taramasına (GitHub Actions, `diogenes-bildirim` worker'ı, `scan/`) dokunulmaz. Piyasa sekmesi taramaların ürettiği veriyi gösterir. Mevcut `index.html`, `pro.html` ve `klasik.html` bu sekmeye taşınır.

## 3. Veri modeli

Tüm tutarlar **kuruş cinsinden tam sayı** olarak saklanır. Tarihler `YYYY-AA-GG` biçiminde, Europe/Istanbul saatine göre tutulur.

| Tablo | Alanlar |
|---|---|
| `zarflar` | id, ad, aylik_kurus, sira, aktif, olusturma |
| `gelir_plani` | id, ad, tutar_kurus, gun (1–31) |
| `gelirler` | id, plan_id?, tutar_kurus, tarih, not |
| `dagitimlar` | id, ay (YYYY-AA), zarf_id, tutar_kurus, gelir_id?, tarih |
| `harcamalar` | id, istek_id (tekil), tutar_kurus, aciklama, zarf_id?, tarih, kaynak (`el`/`dazai`/`tasima`), etiket |
| `abonelikler` | id, ad, tutar_kurus, gun, zarf_id, aktif |
| `borclar` | id, ad, kalan_kurus, aylik_kurus, kalan_taksit? |
| `birikimler` | id, tur (nakit/banka/altin/doviz/fon/diger), ad, tutar_kurus, guncelleme |
| `merdiven` | id, sira, ad, hedef_kurus?, biriken_kurus, tamam |
| `oneriler` | id, tur (`dagitim`/`abonelik`/`aktarim`/`kaydirma`), anahtar (tekil), detay_json, durum (`bekliyor`/`onaylandi`/`reddedildi`/`eskidi`), olusturma, karar |
| `ayarlar` | anahtar, deger |

**Merdivenin başlangıç taslağı** (Diyar düzenleyebilir):
1. Borçsuzluk: borç yoksa tamam sayılır.
2. Acil fon: hedef, aktif zarfların aylık toplamının 3 katı.
3. Düzenli yatırım.
4. Ek gelir.

## 4. Para kuralları

1. **Dağıtım.** Bir gelir geldiğinde (cron önerir ya da Diyar elle girer) Diogenes bir dağıtım önerisi hazırlar. Zarflar `sira` sırasıyla, bu ay eksik kalan tutar (`aylik − bu ay dağıtılan`) kadar doldurulur. Artan para "Atanmamış" olarak kalır. Diyar önerideki tutarları değiştirip onaylayabilir.
2. **Kalan.** Zarfın kalanı, o ay zarfa dağıtılan tutardan o ay zarftan yapılan harcamalar çıkarılarak bulunur. Atanmamış tutar, ayın gelirlerinden ayın dağıtımları çıkarılarak bulunur.
3. **Eksiye düşme.** Kalanı sıfırın altına düşen zarf kırmızı gösterilir. Diogenes, kalanı en fazla olan zarftan (Atanmamış önce gelir) para kaydırmayı önerir.
4. **Abonelik.** Abonelik günü gelince bağlı zarftan düşmek için bir öneri hazırlanır. Onaylanınca `kaynak=el` olan bir harcama yazılır.
5. **Ay sonu.** Ayın son günü, pozitif kalanı olan zarfların toplamı ve Atanmamış tutar için bir aktarım önerisi hazırlanır. Hedef, merdivende `tamam=0` olan ilk basamaktır. Onaylanınca o basamağın `biriken_kurus` değeri artar. Basamağın hedefi aşılırsa artan kısım bir sonraki basamağa geçer.
6. **Yatırım basamağı.** Bu basamağa yapılan aktarım yalnızca kaydedilir. Diogenes ne alınacağını söylemez.
7. **Öneri tekilliği.** Her önerinin bir `anahtar` değeri vardır, örneğin `dagitim:2026-12:gelir-<id>`, `aktarim:2026-12`, `abonelik:<id>:2026-12`. Aynı anahtarla ikinci bir öneri oluşmaz. Bir öneri yalnızca `bekliyor` durumundayken uygulanabilir. Öneri hazırlandıktan sonra ilgili zarf silindiyse ya da öneri artık geçerli değilse durumu `eskidi` olur ve öneri yeniden hazırlanır.

## 5. Ekranlar

Uygulama telefon öncelikli bir PWA'dır: koyu tema, alt sekmeler ve sağ üstte Ayarlar (⚙︎). Görünüm, daha önce gösterilen C taslağını izler.

- **İlk kurulum sihirbazı** yalnızca ilk açılışta gösterilir. Adımları:
  1. Gelir planı (dolu gelir, Diyar onaylar).
  2. Birikimler.
  3. Borçlar.
  4. Zarflar. Ekranda "Dağıtılan X / Gelir 35.000 · Y atanmamış" sayacı canlı güncellenir.
  5. Merdiven.
- **Zarflar (ana ekran):**
  - En üstte bekleyen öneri kartları, her birinde Onayla / Düzenle / Reddet.
  - Altında zarf listesi. Her zarfta doluluk çubuğu, "kalan / aylık" bilgisi ve eksiye düştüyse kırmızı gösterim.
  - En altta Atanmamış satırı.
  - Bir **+** düğmesi: tutar, zarf (son kullanılan önce gelir) ve açıklamayla hızlı harcama girişi.
- **Hedefler:**
  - Merdiven basamakları ve ilerlemeleri.
  - Finansal özgürlük göstergesi: (birikim + yatırım) × 0,04 ÷ yıllık zarf gideri.
  - "Ayda X ile Y yılda" projeksiyonu. Varsayılan getiri oranı Diyar'ın ayarladığı bir sayıdır ve ekranda yazılı olarak gösterilir.
- **Geçmiş:** Aylara göre gelir ve harcamalar, zarfa göre süzme ve kayıt düzenleme/silme. Her ay için bir özet gösterilir: hedefe aktarılan tutar ve en çok harcanan zarf.
- **Piyasa:** Mevcut tarama ekranları. Bu sekmeye yalnızca bağlantı verilir, içerik değişmez.
- **Ayarlar:** Zarflar, gelir planı, abonelikler, borçlar, birikimler, merdiven, varsayılan getiri oranı, şifre ve bildirimler.

## 6. Dazai bağlantısı

Bu bölüm, Aurelius'taki `docs/superpowers/specs/2026-11-06-dazai-gunluk-isler-design.md` standardını izler.

**Diogenes tarafı:**
- `GET /api/dazai/bugun` şu yapıyı döner: `{app:"diogenes", day, ozet, maddeler}`. Maddeler zarf kalanları (eksiye düşenler önce), bekleyen öneriler ve yarınki abonelik çekimleridir.
- `POST /api/dazai/harcama` şu alanları alır: `{istek_id, tutar, aciklama, zarf?, etiket?, tarih?}`.
  - Zarf verilmemişse etiket ve açıklama, bir eşleme tablosu ile zarfa çevrilir (ör. market → Yemek). Eşleşme bulunamazsa harcama Atanmamış'a yazılır ve yanıtta `zarf_sor:true` döner.
  - Aynı `istek_id` ile gelen ikinci istek yeni kayıt oluşturmaz, ilk kaydı döner.
- `POST /api/dazai/gelir` şu alanları alır: `{istek_id, tutar, aciklama, tarih?}`. Gelir kaydedilir ve bir dağıtım önerisi hazırlanır.
- `POST /api/dazai/onayla` şu alanları alır: `{oneri_id | tur, karar: "onayla"|"reddet"}`. Uygulama kuralları §4.7'dekiyle aynıdır.

**Aurelius tarafı:**
- `wrangler` yapılandırmasına `DIOGENES` servis bağlantısı eklenir. `app-fetch.ts` içindeki HOSTS listesine `diogenes.diyarross.com` eklenir.
- `para_kaydet` artık Diogenes'e yazar. Tür `gelir` ise `/api/dazai/gelir`, değilse `/api/dazai/harcama` çağrılır. Yanıtta `zarf_sor` dönerse Dazai kullanıcıya hangi zarfa yazılacağını sorar.
- Yeni araç `diogenes_onayla` eklenir: bekleyen öneri sesli olarak onaylanır ya da reddedilir.
- `gunun_isleri` ve `uygulama_ozeti` Diogenes satırını içerir. Diogenes'e ulaşılamazsa "Diogenes'e şu an ulaşılamadı." gösterilir ve özetin geri kalanı çalışmaya devam eder.
- Dazai'nin yönü, Diogenes canlıya alınıp taşıma tamamlandıktan sonra değiştirilir.

## 7. Aurelius'tan taşıma

Taşıma bir kez yapılır ve Diyar'ın onayına bağlıdır. Dönüşümü `src/tasima.js` içindeki saf fonksiyonlar yapar.

| Aurelius `records.kind` | Diogenes |
|---|---|
| `ledger` (needs/wants/investment) | `harcamalar` (`kaynak=tasima`). Zarf `tag` alanına göre eşlenir. |
| `ledger` (income) | `gelirler` |
| `subscription` (subscription/fixed) | `abonelikler` |
| `subscription` (installment) | `borclar` (`kalan_taksit` ile) |
| `subscription` (income) | `gelir_plani` için öneri. Diyar'ın planıyla çakışırsa Diyar'ın planı geçerli olur. |
| `asset`, `netWorth` | Sihirbazdaki birikim adımı için ön dolum |
| `savingsGoal` | `merdiven` basamağı |

Taşıma iki adımda yapılır:
1. **Ön izleme:** kayıtlar, düşecekleri zarflar ve eşlenemeyenler listelenir.
2. **Onay:** aktarım yapılır.

Aurelius'taki kayıtlar silinmez. Varlık odasının para bölümü, Diogenes özet kartı ve "Diogenes'te aç" bağlantısıyla değiştirilir. Koç bağlamı para bilgisini Diogenes'in `/api/dazai/bugun` ucundan okur.

## 8. Hata durumları

- Geçersiz tutar (0, negatif ya da 10.000.000 TL'den büyük), bilinmeyen bir zarf veya bozuk bir tarih gelirse 400 döner ve Türkçe bir hata mesajı gösterilir.
- Yetki yoksa ya da anahtar yanlışsa 401 döner.
- Cron bir gün kaçırılırsa bir sonraki çalışmada geçmiş günler taranır. Öneri anahtarları sayesinde çift öneri oluşmaz.
- Gelir geç gelir ya da farklı tutarda gelirse, öneri gerçek tutarla yeniden hesaplanır.
- Eşzamanlı onaylarda `UPDATE … WHERE durum='bekliyor'` ifadesi yalnızca bir kez başarılı olur.

## 9. Test

- `core.js`: dağıtım sırası, kısmi doldurma, Atanmamış hesabı, eksiye düşme ve kaydırma önerisi, ay sonu aktarımı, merdiven taşması, kuruş yuvarlaması (`"1.250,50"` değerinin 125050 olması).
- `dazai.js`: yetki, harcama ve gelir yazma, zarf eşleme, `zarf_sor`, aynı `istek_id`'nin tekrar gelmesi, onaylama ve eskimiş öneri.
- `tasima.js`: örnek Aurelius kayıtlarıyla her `kind` ve `type` için dönüşüm.
- Uçtan uca: telefon boyutunda sihirbaz, harcama ekleme ve öneri onayı tarayıcıda kontrol edilir.

## 10. Aşamalar

Her aşama kendi başına çalışır ve her birinin sonunda deploy ve push için Diyar'ın onayı alınır.

1. **Diogenes çekirdeği:** worker, D1, ekranlar, sihirbaz, zarflar, öneri/onay, cron, Piyasa sekmesi.
2. **Dazai bağlantısı:** `/api/dazai/*`, Aurelius servis bağlantısı, `para_kaydet` yönlendirmesi, `diogenes_onayla`, `gunun_isleri`.
3. **Taşıma ve Aurelius temizliği:** ön izleme, taşıma, Varlık odası kartı, Koç bağlamı.

## 11. Kapsam dışı

- Banka hesabı bağlama ya da hesap hareketlerini otomatik çekme.
- Al-sat tavsiyesi ve otomatik yatırım.
- Birden fazla kullanıcı.
- Hisse taramasında değişiklik.
