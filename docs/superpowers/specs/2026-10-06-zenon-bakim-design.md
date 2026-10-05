# Zenon 整 Bakım: profil, rutin motoru ve bildirimler (Parça 1)

Tarih: 2026-10-06 · Durum: tasarım onaylandı, spec incelemede

## Amaç

Zenon'a kişisel bakım asistanı eklemek. Kullanıcı (genç erkek, 178 cm / 90 kg, sıcak alt tonlu ten) her gün ne yapacağını, ne zaman yapacağını ve nedenini görsün; telefona saatinde bildirim gelsin.

Bu doküman dört parçalık yol haritasının **1. parçasıdır**:

1. **Profil anketi + günlük/haftalık rutin + bildirimler** (bu doküman)
2. 香 Parfüm rafı + günün kokusu (hava, plan, kombin)
3. Ürün dolabı + güvenilir ürün önerileri (bütçe katmanı, PAO, ÜTS kontrolü)
4. İlerleme fotoğrafları + bakım günlüğü

Kullanıcı kararları: anket Zenon içinde (A); bildirimler gerçek Web Push, Seneca'nın bulut sunucusu üzerinden (A); bölüm 1 ve 2 onaylandı.

## Kapsam dışı (bu parça)

- Ürün markaları ve güven notları (Parça 3). Adımlar ürün **türü** olarak yazılır: "seramidli nemlendirici", "SPF 50".
- Parfüm (Parça 2), fotoğraf (Parça 4).
- Tıbbi teşhis. Kalıcı sivilce/leke/dökülme için uygulama "dermatoloğa görün" notu gösterir.

## Bölüm 1: Zenon tarafı

### Yerleşim

- Yeni sekme **整 Bakım** (`data-view="care"`), 記 Takip'ten önce. Sekme çubuğu 6 düğmeye çıkar; ≤375 px'te taşmadığı ekran görüntüsüyle doğrulanır.
- 今 Bugün ekranında küçük **"Bugünün bakımı"** kartı: kalan adım sayısı, sıradaki rutin, günün ipucu; dokununca Bakım sekmesi.

### Anket (profil)

İlk açılışta Bakım sekmesi anketi gösterir; sonra "Profili düzenle" ile açılır. Çoktan seçmeli, ~2 dk. Saklama: `store.set("care.profile", …)`.

| Alan | Değerler |
|---|---|
| `skin` | `oily` · `combo` · `normal` · `dry` · `sensitive` (+ yardımcı soru: "yıkadıktan 1 saat sonra yüzün nasıl?") |
| `issues[]` | `acne` · `blackheads` · `marks` · `pores` · `redness` · `darkcircles` · `dryness` · `ingrown` · `backacne` |
| `beard` | stil `clean`·`stubble`·`short`·`full`; yoğunluk `sparse`·`medium`·`dense` |
| `hair` | yapı `straight`·`wavy`·`curly`; `oilyScalp` bool; `dandruff` bool; `thinning` bool; `lastCut` tarih |
| `sweat` | `low` · `mid` · `high` |
| `times` | `wake`/`sleep` hafta içi ve hafta sonu (HH:MM); `gym` gün listesi + saat |
| `amMinutes` | 2 · 5 · 10 |
| `budget` | Alışveriş sekmesindeki `TIERS` ile aynı: `eko` · `den` · `yat` |
| `currentProducts` | serbest metin |

### Rutin motoru (`zenon-care.js`)

Saf fonksiyonlar, DOM'a ve ağa dokunmaz, böylece node ile test edilir. Kural tabanlı; yapay zekâ yok, çevrimdışı çalışır.

```
buildDay(profile, date, wx, state) -> { am:[step], pm:[step], extras:[step], weekly:[task], tip, notes:[str] }
buildWeek(profile, startDate, wxByDate, state) -> [day × 7]
reminders(profile, week, state, now) -> [{at, title, body, tag}]
```

`step = {id, label, why, kind}`. `state` = retinoid başlangıç tarihi, işaretlenen adımlar, son berber, son peeling.

Kurallar:

- **Sabah:** temizleme (kuru/hassas: yalnız su veya hafif temizleyici) → aktif (yağlı/sivilce/gözenek: niasinamid; leke: C vitamini, `amMinutes ≥ 5` ise) → nemlendirici (yağlı/nemli gün: jel; kuru/soğuk-kuru gün: krem) → SPF. `amMinutes = 2` iken en fazla 3 adım: temizle, nemlendir+SPF.
- **Akşam:** temizleme → gecenin aktifi → nemlendirici.
- **Aktif takvimi:** retinoid (sivilce/leke/gözenek varsa, hassas değilse) 1-2. hafta Pzt+Per, 3-4. hafta Pzt+Çar+Cum, sonra her gece; hassas ciltte bir basamak yavaş. BHA peeling (siyah nokta/gözenek/batık kıl) haftada 2, retinoid gecesiyle **aynı geceye düşmez**. Kızarıklıkta azelaik asit, retinoid olmayan gecelere.
- **Haftalık görevler:** peeling günleri, sakal düzeltme (stile göre 3-7 gün), tırnak (7 gün), yastık kılıfı (3-4 gün; sivilcede 2), havlu (3 gün), saç yıkama sıklığı (yağlı saç derisi: gün aşırı; değilse 2-3/hafta), kepekte haftada 2 ketokonazollü şampuan notu, berber geri sayımı (`lastCut` + 24 gün).
- **Hava ayarı:** Open-Meteo `daily` isteğine `uv_index_max`, `relative_humidity_2m_mean` eklenir. UV ≥ 3 → SPF zorunlu notu; UV ≥ 6 → 13:00 yenileme; sıcaklık ≤ 8 °C ve nem < %45 → krem nemlendirici + dudak balmı; ≥ 26 °C ve nem > %60 → jel nemlendirici, ter notu (`sweat = high` ise antiperspiranı geceden sür).
- **Spor günü:** `extras` içine antrenman sonrası duş + yüz yıkama; `backacne` varsa BHA'lı vücut yıkama notu.
- **Günün bilgisi:** ~60 kısa ipucu (`CARE_TIPS`), her biri `tags` ile (ör. `["spf"]`, `["acne"]`). Profilin etiketleriyle eşleşenler arasından tarih tohumlu seçim; aynı ipucu 14 gün tekrarlanmaz. Her ipucunun kaynağı ipucu nesnesinde tutulur (`src`).

### Takip

- Adımlar işaretlenir: `store.set("care.done", {"YYYY-MM-DD": {am:[ids], pm:[ids], tasks:[ids]}})`. 60 günden eski günler budanır.
- Seri: sabah ve akşamın tamamı işaretlenen ardışık gün sayısı.
- 記 Takip'e "Bakım" satırı: son 14 günün tamamlanma şeridi, atlanan rutinler.

## Bölüm 2: Bildirimler

### Zenon tarafı

- Bakım sekmesinde **"Bildirimleri aç"** ve **"Test bildirimi"** düğmeleri. Destek yoksa (iOS'ta ana ekrandan açılmamış, ya da iOS < 16.4) düğme yerine açıklama: "Safari → Paylaş → Ana Ekrana Ekle, sonra simgeden aç".
- Abonelik: `GET {SRV}/zenon/api/anahtar` → VAPID public key → `pushManager.subscribe` → ilk kez rastgele 32 baytlık `cihaz` kimliği ve `token` üretilir (`crypto.getRandomValues`), `store`'da saklanır → `POST {SRV}/zenon/api/abone {cihaz, token, subscription}`.
- `SRV = "https://seneca-diyar.duckdns.org"` (`zenon-care.js` sabiti).
- **Plan senkronu:** uygulama açılışında, profil değişince, bir rutin işaretlenince → `reminders()` sonraki 7 günü üretir → `PUT {SRV}/zenon/api/plan` (başlık `X-Zenon-Cihaz`, `X-Zenon-Token`) gövde `{hatirlatmalar:[{at: ISO-UTC, title, body, tag}]}`. Sunucu o cihazın **gelecekteki gönderilmemiş** hatırlatmalarını siler, yenilerini yazar.
- Hatırlatma kuralları: sabah = kalkış + 10 dk; akşam = yatış − 45 dk; SPF yenile = UV ≥ 6 günlerde 13:00; spor sonrası = spor saati + 90 dk; haftalık görev = görev günü kalkış + 30 dk (aynı güne düşen görevler tek bildirimde); berber = döngü dolduğu gün 12:00. Kalkıştan önce ve yatıştan sonra bildirim yok; günde en fazla 6. İşaretlenmiş rutinin o günkü bildirimi üretilmez. Son senkrondan 7 gün sonrası için tek "Zenon'u aç, planını yenileyeyim" bildirimi.
- Bildirim metni hava ve rutin içerir: "Temizle → niasinamid → nemlendir → SPF 50 (bugün UV 6)".
- `sw.js`: `push` olayı → `showNotification(title, {body, tag, data:{url}})`; `notificationclick` → `./#care` adresini açar veya açık pencereye odaklanır. Zenon şu an hash ile sekme açmıyor: açılışta ve `hashchange`'te `#care` gibi bir hash varsa ilgili sekmeye geçen küçük bir yönlendirme eklenir. `CACHE` sürümü `zenon-v2`'ye çıkar, `SHELL`'e `zenon-care.js` eklenir.
- Ağ hatası: kartta küçük uyarı "Bildirim planı gönderilemedi, rutin ekranda"; sonraki açılışta yeniden dener. Rutin her durumda ekranda.

### Sunucu tarafı (Seneca bulutu, ayrı modül)

- Yeni `zenon_push.py`; kendi SQLite dosyası `data/zenon.db`. Seneca tablolarına dokunmaz.
  - `cihazlar(cihaz TEXT PK, token_ozet TEXT, endpoint, p256dh, auth, olusturma, son_senkron)`
  - `hatirlatmalar(id INTEGER PK, cihaz, zaman_utc TEXT, baslik, govde, etiket, gonderildi INTEGER DEFAULT 0)`, indeks `(gonderildi, zaman_utc)`
- Uç noktalar (`server.py`'ye eklenir, iş mantığı `zenon_push.py`'de):
  - `GET /zenon/api/anahtar` → Seneca'nın mevcut VAPID public key'i (`push.vapid_anahtarlari()`).
  - `POST /zenon/api/abone` → ilk kayıtta `token_ozet = sha256(token)`; var olan cihazda token eşleşmesi şart (yanlışsa 403). En fazla 5 cihaz.
  - `PUT /zenon/api/plan` → token doğrulama; en fazla 100 hatırlatma, başlık ≤ 80, gövde ≤ 300 karakter, zaman şimdi ile +8 gün arasında; aksi 400.
  - `POST /zenon/api/test` → token doğrulama; hemen bir test bildirimi.
  - `GET /zenon/api/saglik` → `{"ok": true, "surum": N}` (yayın kontrolü için).
- `guvenlik.py`: `/zenon/api/` öneki `SERBEST`'e eklenir (site şifresinden muaf; koruma = token). IP başı 240/dk sınırı geçerli kalır. `koruma` ara katmanının kendisi değişmez.
- CORS: genel ara katman **eklenmez**. Yalnız Zenon rotaları kendi yanıtlarına başlık koyar: `Origin == https://ross002200.github.io` ise `Access-Control-Allow-Origin` + `Allow-Headers: Content-Type, X-Zenon-Cihaz, X-Zenon-Token` + `Allow-Methods: GET, POST, PUT`; önuçuş için `@app.options("/zenon/api/{yol:path}")` → 204. Seneca'nın kendi sayfalarının başlıkları (CSP vb.) değişmez.
- **Yalıtım:** `server.py` ve `jobs.py` Zenon'u `try/except` içinde içe aktarır ve kaydeder; `zenon_push.py` hata verirse yalnız Zenon devre dışı kalır, Seneca açılmaya devam eder (günlüğe uyarı). Yeni bağımlılık yok (`pywebpush` zaten kurulu), `pip` adımı tetiklenmez.
- Gönderim: `jobs.zamanlayiciyi_kur` içine dakikalık `zenon_gonder` görevi (bulutta `seneca-isci` sürecinde çalışır; `webpush` çağrısı `timeout=10`, tek indeksli sorgu: e2-micro'ya yük yok). Bilgisayardaki ayna modunda da çalışır ama oradaki `zenon.db` boştur, hiçbir şey göndermez (çift bildirim olmaz). `zaman_utc <= şimdi` ve gönderilmemiş olanlar: şimdiden 30 dk'dan eskiyse gönderilmeden `gonderildi=2` (atlandı); değilse `pywebpush` ile gönder, `gonderildi=1`. 404/410 → cihaz ve hatırlatmaları silinir. 30 günden eski satırlar budanır.
- Seneca'nın `push_subscriptions`, `notifications` ve `TELEFONA_GIDEN` mantığı değişmez.

### Güvenlik ve gizlilik

- Sunucu yalnız hatırlatma metnini ve saatini görür; cilt profili, anket, işaretlemeler telefonda kalır.
- Ross deposu herkese açık: depoya kişisel veri yazılmaz.
- Token sunucuda yalnız özet olarak durur; cihaz kimliği tahmin edilse bile plan yazılamaz.

## Test

- **Sunucu (pytest, `Seneca/tests/test_zenon_push.py`)**, geçici `zenon.db` ile: abone kaydı ve yanlış token 403; plan değiştirme yalnız gelecekteki gönderilmemişleri siler; sınır aşımı 400; dakikalık görev vakti geleni gönderir, 30 dk geç kalanı atlar (`webpush` monkeypatch); 410'da cihaz silinir; CORS başlıkları yalnız izinli origin'e.
- **Zenon (node, `tests/care.test.mjs`, bağımlılıksız `node:test`)**: retinoid ve BHA aynı geceye düşmez; giriş takvimi haftalara göre artar; `amMinutes=2` en fazla 3 adım; UV/nem kuralları; bildirimler kalkış-yatış dışına çıkmaz, günde ≤ 6, işaretlenen rutin bildirim üretmez; ipucu 14 gün tekrar etmez.
- **Görsel**: Playwright + `channel="msedge"`, 375 px; Bakım sekmesi, anket, Bugün kartı, 6 sekmeli çubuk.
- **Uçtan uca**: yayın sonrası `requests` ile `/zenon/api/saglik`; kullanıcı telefonda "Test bildirimi"ne basar.

## Yayın

1. Zenon: `Documents/Ross`'ta commit → `git fetch --filter=blob:none` → rebase → push (dal `claude/daily-increases-site-gumybo`; `diogenes/data/*.json`'a dokunulmaz). README'ye Bakım bölümü eklenir.
2. Sunucu (Seneca'nın kurallarına göre):
   - **Zamanlama:** Seneca'da başka bir oturum aktif çalışıyorsa (2026-10-06 02:53'te Faz 3 düzenlemesi sürüyordu) Seneca dosyalarına dokunulmaz. `guncelle.cmd` bilgisayardaki **bütün** kodu gönderdiği için yarım kalmış Seneca işi de buluta gider; bu yüzden sunucu adımı ancak Seneca'nın o anki işi bitip kendi yayını yapıldıktan sonra, kullanıcı onayıyla yapılır.
   - Değişen dosyaların kopyası `yedek/2026-10-06-zenon/` altına (Seneca'nın mevcut yedek düzeni).
   - Mevcut Seneca testleri (`python -m pytest tests`) değişiklikten **önce ve sonra** çalıştırılır; sonuç aynı olmalı. Ayrıca zamanlayıcısız test sunucusu (8001) ile Seneca'nın ana uçları (`/`, `/api/kasa`, giriş) değişiklik sonrası yanıt veriyor mu bakılır.
   - Yayın `guncelle.cmd` ile (yalnız kod; `data/` ve `.env` gitmez). Kök yardımcı yeni sürümü `web/sw.js` numarasından doğruladığı için Seneca `sw.js` sürümü bir artırılır (telefonda Seneca bir kez kendini yeniler, başka etkisi yok). Yeni sürüm açılmazsa ya da `seneca-isci` çalışmazsa yardımcı **otomatik geri alır**.
   - `scripts/sunucu_paketi.py` `HARIC_DOSYA`'ya `zenon.db*` eklenir: tam paket bir gün yeniden kurulursa bilgisayardaki boş `zenon.db` buluttakinin üstüne yazılmasın.
   - Yayın sonrası `/zenon/api/saglik` ve Seneca'nın açıldığı dışarıdan doğrulanır. Seneca `CLAUDE.md`'ye Zenon servisi notu.

## Açık riskler

- iOS Web Push yalnız ana ekrana eklenmiş PWA'da çalışır; kullanıcı Zenon'u daha önce ana ekrana eklediyse yeni `sw.js` ilk açılışta gelir, gerekirse bir kez kapatıp açmak gerekir.
- Seneca sunucusu kapanırsa Zenon bildirimleri de durur (kabul edildi).
