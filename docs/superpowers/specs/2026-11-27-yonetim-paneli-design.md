# Yönetim paneli: tasarım

Tarih: 2026-11-27. "Sunucu işlerini kolaylaştır" isteğinin 1/3 alt projesi (sonrakiler: Aurelius sunucu sadeleştirme, Diogenes finans sunucusu).

## Amaç

Altı projenin (Aurelius/Dazai, Kleanthes, Zenon, Epiktetos, Seneca, Diogenes) durumunu görmek, test etmek, yayınlamak, yedeklemek ve sırlarını yönetmek için tek bir yer. Bugün 17 ayrı `.cmd` dosyası ve projeye göre değişen komutlar var.

Başarı ölçütü: Diyar masaüstündeki "Yönet" simgesine çift tıklar; tarayıcıda açılan sayfada altı projenin yeşil/sarı/kırmızı durumu, sarı olanlarda tek cümlelik ne-yapmalı önerisi görünür; tek düğmeyle test, yayın (onaylı), yedek ve sır kontrolü yapar.

## Kullanıcının kararları

- Biçim: bilgisayarda açılan sayfa (komut penceresi menüsü değil).
- Bölüm 1 (yapı, açılış, güvenlik), Bölüm 2 (işlevler), Bölüm 3 (hatalar, testler) onaylandı.

## Kapsam dışı

- GitHub'a push (Claude'a söylenir).
- Giriş şifrelerinin (Zenon, Kleanthes, Aurelius `AUTH_PASSWORD`) panelden değiştirilmesi; panel yalnız komutu gösterir.
- Mevcut `.cmd` dosyalarının silinmesi (panel bir süre çalıştıktan sonra ayrıca).
- Diogenes'in ve Seneca'nın yayını (Diogenes GitHub Pages + Actions, Seneca evdeki bilgisayarda).

## 1. Yapı

- `D:\Claude\yonet\`:
  - `sunucu.mjs`: Node (kurulu olan), ek paket yok. `127.0.0.1`'e bağlanır, rastgele kapı (port) seçer.
  - `sayfa.html`: tek sayfa, satır içi CSS/JS, dış kaynak yok.
  - `projeler.mjs`: proje listesi (aşağıda). Yeni proje = yeni kayıt.
  - `durum.mjs`, `is.mjs` (iş çalıştırıcı), `gizle.mjs` (çıktıda sır gizleme): saf, test edilebilir modüller.
  - `tests/*.test.mjs`: `node --test`.
- `D:\Claude\Yönet.cmd`: `node yonet\sunucu.mjs` çalıştırır; sunucu açılınca tarayıcıyı `http://127.0.0.1:<kapı>/?t=<giriş anahtarı>` ile açar. Masaüstüne kısayol.
- Pencere kapanınca ya da sayfadaki **Kapat** ile sunucu durur.

### Proje listesi (`projeler.mjs`)

| id | klasör | test | yayın | canlı yoklama | D1 | beklenen sırlar |
|---|---|---|---|---|---|---|
| aurelius | `Aurelius` | `node scripts/test-core.mjs`, `test-jarvis.mjs`, `test-voice.mjs` | `node scripts/deploy.mjs`, sonra `cron` klasöründe `wrangler deploy --config wrangler.json` | `https://aurelius.diyarross.com/` | aurelius | AUTH_PASSWORD, CRON_SECRET, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, EPIKTETOS_DAZAI_KEY, KLEANTHES_DAZAI_KEY, KLEANTHES_OZET_KEY, OWNER_ID, SENECA_SIFRE, SESSION_SECRET, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, ZENON_DAZAI_KEY |
| kleanthes | `Kleanthes/app` | `npm test` | `npm run deploy` | `https://kleanthes.diyarross.com/` | kleanthes | AUTH_PASSWORD, SESSION_SECRET, DAZAI_KEY, UYKU_KEY, OZET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY |
| zenon | `.` ve `zenon-sunucu` | `node --test tests/*.test.js` (kök) + `npm test` (sunucu) | `zenon-sunucu`: `npm run deploy` | `https://zenon.diyarross.com/` | zenon | AUTH_PASSWORD, SESSION_SECRET, DAZAI_KEY |
| epiktetos | `Epiktetos` | `npx tsc --noEmit`, `npx vitest run` | `npm run deploy` | `https://epiktetos.diyarross.com/` | epiktetos | KOC_SIFRE, ANTHROPIC_API_KEY, DAZAI_KEY |
| seneca | `Seneca` | `python -m pytest -q` | yok | `https://seneca-diyar.duckdns.org/zenon/api/saglik` | yok (yerel `data/seneca.db`) | yok |
| diogenes | `diogenes` | `python -m pytest -q scan/tests` | yok (bildirim Worker'ı ayrı, kapsam dışı) | `https://ross002200.github.io/Ross/diogenes/` | yok | yok |

Beklenen sır listesi, uygulama sırasında `wrangler secret list` ile canlıdan bir kez doğrulanır (VAPID adları Kleanthes'te farklıysa listede düzeltilir).

## 2. Güvenlik

- Sunucu yalnız `127.0.0.1`'i dinler.
- Her açılışta 32 baytlık rastgele giriş anahtarı; sayfa her isteğe `x-yonet` başlığıyla ekler, yoksa 403. Sayfanın kendisi de `?t=` ile açılır.
- `Origin` başlığı varsa `http://127.0.0.1:<kapı>` olmalı.
- Aynı anda tek iş; sürerken gelen ikinci iş 409 ile reddedilir (kuyruğa alınmaz).
- Çıktı akışında (ve kayıtta) sır değeri gizlenir: bilinen sır değerleri (anahtar yenilemede üretilenler) ve 32+ karakterlik onaltılık dizgiler `••••` olur.
- Yayınla ve Anahtar yenile, sayfada onay ister ve sunucuda `onay:true` olmadan çalışmaz.

## 3. İşlevler

### Durum
Her proje için canlı adres yoklaması (3xx de "açık" sayılır; ağ hatasında bir kez yeniden dener; internet hiç yoksa tümü "bağlantı yok") ve veri tazeliği:

| proje | tazelik sorgusu | sarı eşiği | öneri |
|---|---|---|---|
| aurelius | `jarvis_sessions` son gün; `daily_pushes` bugünkü fazlar | Dazai 7 gün konuşulmadı | "Dazai ile konuş: yazılı sohbette 'Bugün ne var?'" |
| kleanthes | son `sessions` gün; son `uyku` gün ve kaynağı | uyku 3 gün yok | "Apple uyku Kestirmesini çalıştır" |
| zenon | `docs` en yeni `updated_at` | 3 gün | "Zenon'u telefonda aç (zenon.diyarross.com)" |
| epiktetos | `kart` en yeni gün | hiç ya da 3 gün | "iPad'de Epiktetos'u aç; Koç şifresi girili olmalı" |
| seneca | yoklama | — | "Evdeki bilgisayarda Seneca'yı başlat (Seneca/baslat.cmd)" |
| diogenes | `git log -1 origin/<dal>` tarihi (fetch ile) | 2 gün | "GitHub Actions taramalarını kontrol et" |

D1 sorguları `wrangler d1 execute <db> --remote --json` ile, salt okunur.

### Test, Yayınla
Proje başına ve "Hepsini test et". Yayın: önce testler (başarısızsa durur), sonra yayın komutları (ağ/503 hatasında 3 deneme), sonra canlı yoklama; sonuç tek satır.

### Yedek
- D1'ler: `wrangler d1 export <db> --remote --output yedekler/<gün>/<db>.sql`.
- Seneca: `python -c "import sqlite3; s=sqlite3.connect('Seneca/data/seneca.db'); d=sqlite3.connect('yedekler/<gün>/seneca.db'); s.backup(d)"` (WAL'a rağmen tutarlı kopya).
- `yedekler/` git dışında (`.gitignore`). Eski yedekler silinmez; panel sayıyı gösterir.

### Sırlar
Her Worker için `wrangler secret list --name <worker>`; beklenen listeyle karşılaştırma: tanımlı ✓ / eksik ✗ / fazladan (bilgi).

### Anahtar yenile
| bağlantı | üret | koy |
|---|---|---|
| Kleanthes ↔ Dazai | 24 bayt hex | kleanthes `DAZAI_KEY` + aurelius `KLEANTHES_DAZAI_KEY` |
| Zenon ↔ Dazai | aynı | zenon `DAZAI_KEY` + aurelius `ZENON_DAZAI_KEY` |
| Epiktetos ↔ Dazai | aynı | epiktetos `DAZAI_KEY` + aurelius `EPIKTETOS_DAZAI_KEY` |
| Uyku Kestirmesi | aynı | kleanthes `UYKU_KEY`; değer `Belgeler\Kleanthes-uyku-anahtari.txt`'ye |

Değer `wrangler secret put`'a stdin ile verilir; ekrana ve kayda yazılmaz. İkinci taraf başarısız olursa panel açıkça "Yarım kaldı: <taraf> eski anahtarla; yeniden dene" der.

Giriş şifreleri için panel yalnız komutu gösterir (ör. `cd D:\Claude\zenon-sunucu` → `node ..\Kleanthes\app\node_modules\wrangler\bin\wrangler.js secret put AUTH_PASSWORD`).

## 4. Hatalar

- Cloudflare oturumu yoksa (wrangler "not logged in"/auth hatası) → "Cloudflare girişi gerekli: terminalde `wrangler login`".
- İş yarıda kalırsa son 20 satır ve öneri; canlı sürüm değişmez (wrangler yükleme ya tamamlanır ya olmaz).
- Panel kapanırsa çalışan alt süreç sonlandırılır; son iş `yonet/son-is.json`'a yazılır, açılışta "yarım kaldı" gösterilir.

## 5. Testler

- `projeler.mjs`: her projede klasör var, test komutu tanımlı, canlı adres https.
- `durum.mjs`: renk ve öneri kuralları (bayatlık eşikleri, kırmızı, bağlantı yok).
- `sunucu.mjs`: anahtarsız istek 403, yanlış Origin 403, ikinci iş 409, yalnız 127.0.0.1.
- `gizle.mjs`: bilinen değer ve uzun hex gizlenir; normal metin dokunulmaz.
- Gerçek deneme: Durum, Hepsini test et, Sırlar (canlıya yazmaz). Yayınla ve Anahtar yenile'yi ilk kez Diyar kullanır.
