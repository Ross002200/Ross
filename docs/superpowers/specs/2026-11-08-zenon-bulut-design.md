# Zenon bulut tarafı ve Dazai bağlantısı: tasarım

Tarih: 2026-11-08. Alt proje 3/6 (yeni mimari: bakım ve kıyafet Zenon'da, Dazai her uygulamanın günlük işlerini söyler ve işaretler).
Bağlantı standardı: `Aurelius/docs/superpowers/specs/2026-11-06-dazai-gunluk-isler-design.md` (Kleanthes'te uygulandı).

## Amaç

- Zenon verisi (fotoğraflar hariç) bulutta yaşar; telefon bozulsa ya da Safari verisi silinse bile kaybolmaz.
- Dazai, Zenon'un günlük bakım adımlarını ve günün kombinini sabah söyler, akşam yapılmayanları sorup işaretler.
- Zenon'un kendi bakım bildirimleri kapanır; bakım ve kombin Dazai'nin öğle/gece raporuna girer.

Başarı ölçütü: Zenon'u o gün hiç açmadan Dazai'ye "akşam rutinini yaptım, kombini giydim" denince; ertesi açılışta Zenon'da bakım işaretli, giyim takviminde kayıt var ve parçalar kirli sayacına düşmüş olur. Dazai raporu Zenon maddelerini sayar.

## Kullanıcının verdiği kararlar

- Kapsam: bakım + kombin (yalnız bakım değil).
- Fotoğraflar dışında tüm Zenon verisi buluta.
- Zenon kendi sunucusunda: `zenon.diyarross.com` (Cloudflare Worker + D1), Kleanthes kalıbı. GitHub Pages bırakılır.
- Bakım bildirimleri Dazai raporuna katılır; Seneca üzerinden giden Zenon bildirimleri kapanır.

## Kapsam dışı

- Zenon'un Koç bölümü (antrenman, beden ölçüleri, `coach.*`) olduğu gibi kalır ve eşitlenir; Kleanthes'e taşınması ayrı alt proje.
- Fotoğrafların buluta taşınması.
- Kombin motorunun sunucuya taşınması.

## 1. Sunucu

- Konum: depo kökünde `zenon-sunucu/` (Worker kodu, `wrangler.jsonc`, `migrations/`, `tests/`). Statik dosyalar (index.html, zenon*.js, zenon.css, sw.js, manifest, ikonlar) bir derleme betiğiyle `zenon-sunucu/public/` içine kopyalanır; kaynak dosyalar kökte kalır.
- D1 `zenon`. Tablolar: `docs(key TEXT PRIMARY KEY, data TEXT, updated_at TEXT)`, `inbox(id TEXT PRIMARY KEY, day TEXT, data TEXT, created_at TEXT, applied_at TEXT NULL)`, `login_attempts` (Kleanthes ile aynı).
- Giriş: Kleanthes'teki şifre + imzalı çerez + deneme sınırı kodu kopyalanır. Gizli değerler: `AUTH_PASSWORD`, `SESSION_SECRET`, `DAZAI_KEY`. Girişsiz yalnız giriş sayfası, manifest, sw.js ve ikonlar açılır.
- Özel alan adı `zenon.diyarross.com`.

## 2. Eşitleme

Zenon'un `store` katmanı (`zenon9:<anahtar>` localStorage) korunur; localStorage önbellek, D1 asıl kopya olur.

- `store.set(k,v)`: localStorage'a yazar ve anahtarı gönderim sırasına koyar; sıra ~2 sn sonra `PUT /api/docs` ile toplu gider (`{items:[{key,data,updated_at}]}`).
- Açılışta ve sayfa öne gelince: `GET /api/docs?since=<son eşitleme>` → yerelden yeni olan anahtarlar localStorage'a yazılır, ekran yenilenir.
- Çakışma: anahtar başına son yazan kazanır (`updated_at`). Dazai bu belgelere hiç yazmaz (bkz. 3), bu yüzden Dazai ile çakışma olmaz.
- Eşitlenmeyen anahtarlar: `photos`, `care.push`, `aurelius`.
- Çevrimdışı: sıra localStorage'da saklanır, bağlantı gelince gider; bekleyen varsa üstte küçük "eşitlenmedi" işareti.
- Sınırlar: anahtar başına 1 MB, geçersiz JSON 400.

## 3. Dazai gelen kutusu

Dazai'nin işaretleri `inbox` tablosuna yazılır; Zenon'un belgelerine dokunulmaz.

- Kayıt türleri: `{tur:"giydim", d, slot:"gun"|"spor", key, title, ids}`, `{tur:"bakim", d, kind:"am"|"pm", on}`, `{tur:"gorev", d, id, on}`.
- Kimlik: Dazai'nin `anahtar` alanı (yoksa sunucu üretir); aynı kimlik ikinci kez yazılmaz.
- Zenon açılışta `GET /api/inbox` ile işlenmemişleri alır ve uygular:
  - giydim → `log`'a `{d,key,title,occ,ids,applied:false}` eklenir (aynı gün aynı key varsa eklenmez), `processLog` kirli sayacını işler.
  - bakim → `ZenonCare.markRoutine` ile `care.state[d]`.
  - gorev → `care.state[d].tasks` ekle/çıkar.
  - Sonra `POST /api/inbox/ack {ids}` → `applied_at` yazılır. Uygulanan kimlikler yerelde de tutulur; ack kaybolsa bile ikinci kez uygulanmaz.
- Uygulama mantığı saf fonksiyonlarda (`zenon-sync.js`, tarayıcı + node) olur ve test edilir.

## 4. Dazai bağlantısı (standart uç noktalar)

Yetki: `x-dazai-key` = `DAZAI_KEY`. Dazai anahtarı gardırobun tamamını okuyamaz; yalnız aşağıdaki iki uç.

### GET /api/dazai/bugun?day=YYYY-MM-DD

Sunucu `care.profile`, `care.state`, `card:<gün>` belgeleri ve o günün işlenmemiş inbox kayıtlarından hesaplar:

| id | baslik | tur | durum |
|---|---|---|---|
| `kombin:gun` | `Kombin: <başlık> (<parçalar>)` | onay | log'da ya da inbox'ta o günün giydim kaydı varsa yapildi |
| `kombin:spor` | yalnız kartta spor kombini varsa | onay | aynı |
| `bakim:sabah` | `Sabah bakımı (<adım adları>)` | onay | tüm adımlar → yapildi, bir kısmı → kismen (`ilerleme:"2/4 adım"`), yoksa bekliyor |
| `bakim:aksam` | `Akşam bakımı (<adımlar>)`, retinoid/BHA gecesi başlıkta | onay | aynı |
| `gorev:<id>` | o gün düşen haftalık görev | onay | tasks içinde ya da inbox'ta varsa yapildi |

- Bakım adımları `zenon-care.js` (`buildDay`; haftalık görevler onun `weekly` alanından) ile sunucuda hesaplanır (hava olmadan; UV notları yok). Profil yoksa bakım maddeleri çıkmaz, `ozet` "Bakım profili yok" der.
- Kombin kartı (`card:<gün>` belgesi: `{gun:{key,title,pieces,ids,occ}, spor:{…}|null}`) Zenon her açıldığında bugün için, gece "yarın nereye" planı girildiğinde yarın için yazılır. Kart yoksa kombin maddesi çıkmaz ve `ozet`e "Zenon bugün kombin hazırlamadı" eklenir.
- `ozet`: ör. `Retinoid gecesi · kombin hazır`.

### POST /api/dazai/isaretle

Gövde standarttaki gibi: `{day, id, yapildi?, anahtar?}` → `{ok, mesaj}` ya da `{error}` (Türkçe).

- `kombin:*` yalnız `yapildi:true`; kart yoksa "Bugün için kombin kartı yok; Zenon'u açınca hazırlanır." Mesaj: `<başlık> giyildi olarak işaretlendi.`
- `bakim:sabah|aksam` `yapildi` true/false → inbox `bakim`. Mesaj: `Sabah bakımı yapıldı olarak işaretlendi.`
- `gorev:<id>` true/false; o gün düşmeyen görev reddedilir.
- Bilinmeyen madde: `Bilinmeyen madde.`

## 5. Aurelius tarafı

- `lib/jarvis/baglanti.ts`: `BAGLANTILAR`'a `{app:"zenon", ad:"Zenon", url:"https://zenon.diyarross.com"}`; anahtar `ZENON_DAZAI_KEY` (her uygulamanın kendi anahtarı).
- `isaretle` aracında `uygulama` enum'u `["kleanthes","zenon"]`.
- Talimat: "Kıyafet ya da bakım söylenirse → isaretle (uygulama zenon, id gunun_isleri'nden)."
- Öğle/gece raporu Zenon'u otomatik sayar (birlestir zaten uygulama listesine göre çalışıyor).
- Eski yol kaldırılır: Zenon'daki `pushAurPlan` ve bridge `plan` türü; `sources.ts`'teki zenon snapshot satırı yerini `gunun_isleri`ne bırakır.

## 6. Bildirimler

- Zenon'daki bildirim kartı kaldırılır; yerine "Bakım hatırlatmaları Dazai'nin öğle ve gece raporunda" notu.
- Seneca'daki Zenon zamanlanmış bildirimleri: Zenon artık yeni plan göndermez; mevcut planlı olanlar en geç 7 gün içinde biter. Seneca kodu değişmez.

## 7. Taşıma

1. Yeni Zenon yayınlanır, kullanıcı şifreyle girer.
2. Eski Zenon'da (GitHub Pages) "Yedek indir" → yeni Zenon'da "Geri yükle". Geri yükleme tüm anahtarları gönderim sırasına koyar (fotoğraflar yalnız o cihazda kalır).
3. Ana ekrana yeni Zenon eklenir.
4. Eski adresteki `index.html` yerine "Zenon taşındı → zenon.diyarross.com" sayfası; eski sw.js önbelleği temizler. Bu adım kullanıcı taşımayı doğruladıktan sonra yayınlanır.

## 8. Hatalar

- Zenon sunucusu düşerse Dazai raporunda "Ulaşılamayan: Zenon"; diğer uygulamalar sürer (mevcut `bugunTopla` davranışı).
- Telefon çevrimdışı: önbellekten açılır, sıra bekler.
- İki cihaz aynı anahtarı değiştirirse son yazan kazanır.
- Gelen kutusu kaydı iki kez gelirse tek uygulanır (kimlik).

## 9. Testler

- Sunucu (node --test): `dazaiBugun` (profil var/yok, kart var/yok, spor günü, inbox'ta bekleyen işaret), `isaretle` kuralları, yetki, docs PUT/GET doğrulaması (boyut, JSON).
- `zenon-sync.js`: inbox uygulama (giydim log'a, aynı key tekrar eklenmez, bakım markRoutine, görev ekle/çıkar, aynı kimlik ikinci kez uygulanmaz), gönderim sırası birleştirme.
- Aurelius: Zenon bağlantı listesinde; `isaretle` enum'u; talimat satırı.
- Yayından sonra veri yazmayan canlı yoklama (yanlış anahtar → Yetkisiz, doğru anahtar + bilinmeyen madde → "Bilinmeyen madde.").
- İlk giriş ve yedekten taşıma kullanıcı tarafından yapılır (gerçek şifre).
