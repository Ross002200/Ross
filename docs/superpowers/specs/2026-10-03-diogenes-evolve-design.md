# Diogenes · Kendini geliştiren sistem (evolve) — tasarım

Tarih: 2026-10-03 · Durum: kullanıcı onayı bekliyor

## 1. Amaç

Kâğıt hesapta her gün 3 işlem yapan, 100 işlemde **%60+ kazanma oranı VE komisyon sonrası artı net** (başarı kriteri A)
hedefleyen, sonuçlarından kendi ayarlarını ve stratejiler arası payı kendisi değiştiren bir sistem.

Kullanıcının kararları:
- Başarı: %60+ kazanma **ve** komisyon sonrası net > 0 (ikisi birlikte).
- Süre: gün içi ve kısa swing (1–5 gün) birlikte.
- Garanti 3: her işlem günü 3 yeni işlem; 11:00 NY'ye kadar limit dolmazsa piyasa fiyatından girilir.
- Kâğıt hesap 10.000 $; rapor ayrıca "600 $ hesapla ne olurdu" sonucunu gösterir.
- Gerçek para yok. Risk sıfırlanamaz, en aza indirilir. Gerçek paraya geçiş yalnız kullanıcı onayıyla.

Kapsam dışı: gerçek emir/broker bağlantısı, açığa satış, opsiyon, kaldıraç.

## 2. Mevcut durumdan farkı

Bugün: tek oyun kitabı (order flow geri çekilmesi, `scan.py`), öğrenme modu (`learn.py`, 3 pozisyon, kurallar etiket, gölge işlem).
Laboratuvar (`lab.py`) swing stratejilerini günlük veride test ediyor ama canlı kâğıt hesaba bağlı değil.

Yeni: birden çok oyun kitabı aynı kâğıt hesabı paylaşır; günün 3 hakkını bandit dağıtır; her kitabın hedef/stop ayarı ve
sert kuralları kanıta göre otomatik değişir; her değişiklik gerekçesiyle günlüğe yazılır.

## 3. Bileşenler

| Dosya | Görev |
|---|---|
| `scan/books.py` (yeni) | Oyun kitabı kaydı ve ortak aday biçimi; gün içi kitaplar 2–5'in sinyal kodu; swing kitapları için `lab.py` sinyal fonksiyonlarının bugünkü veriye uygulanması |
| `scan/evolve.py` (yeni) | Bandit dağıtımı, kitap başına ayar (hedef/stop), kural sertleştirme, değişiklik günlüğü (`data/evolve.json`) |
| `scan/edgar.py` (yeni) | SEC EDGAR güncel 8-K akışı → sembol başına taze bildirim etiketi |
| `scan/scan.py` (değişir) | Kâğıt motoru: çoklu kitap, swing taşıma, 11:00 garantisi, kapasite/risk sınırları |
| `scan/learn.py` (değişir) | Gölge işlemlere kitap ve sapma (excursion) kaydı; kitap bazında rapor; 100 işlem ilerlemesi |
| `pro.html` (değişir) | "Gelişim" kartı: ilerleme, kitap tablosu, değişiklik günlüğü |

### 3.1 Ortak aday biçimi

Her kitap şu sözlükleri üretir:

```
{book, symbol, entry, stop, target, horizon: "gün" | "swing", max_days, order: "limit" | "market",
 score (kitap içi sıralama), rule_keys (çiğnenen kurallar), exit_rule (swing için, ör. "close>sma5")}
```

### 3.2 Oyun kitapları

| id | Ad | Süre | Giriş | Stop / hedef (başlangıç) |
|---|---|---|---|---|
| `of` | Order flow geri çekilmesi (mevcut) | gün | limit, OF bölgesi | mevcut plan |
| `vwap` | VWAP geri alımı (Brian Shannon) | gün | yükseliş günü, fiyat VWAP'a geri çekilip üstünde 5 dk kapanış | stop gün dibi/VWAP − 0,5 ATR(5dk); hedef 1,5R |
| `orb` | 15 dk açılış aralığı kırılımı (Aziz/Zarattini) | gün | oyundaki hisse (göreli hacim ≥ 2, açılış ≥ %1), ilk 15 dk tepesi kırılınca | stop ilk 15 dk dibi (≤ %3); hedef 1,5R |
| `cat` | Haber/gap katalizörü (Kullamägi EP, Ross Cameron) | gün | taze olumlu haber ya da 8-K + gap ≥ %3 + göreli hacim ≥ 2, ilk geri çekilmeden sonra yeni tepe | stop geri çekilme dibi; hedef 1,5R |
| `rev` | Gün içi aşırı satım dönüşü (Connors) | gün | günlük trend yukarı, gün içi RSI(2, 15dk) < 10 ve VWAP − 1,5 ATR altı, dönüş mumu | stop dönüş dibi; hedef VWAP |
| `bnf` | BNF sapma oranı (lab'da kanıtlı) | swing ≤ 5 gün | dünkü kapanışta 25 günlük ortalamanın %15+ altı → bugün açılışta | stop %10 → ayara tabi; hedef ortalamanın %97'si |
| `rsi2` | Connors RSI(2) geri alım | swing ≤ 5 gün | fiyat > 200 günlük, RSI(2) < 10 → bugün açılışta | stop %7; çıkış kapanış > 5 günlük ortalama |

Swing kitapları `lab.py`'deki `S_bnf_kairi` ve `S_connors_rsi2` sinyal maskelerini son güne uygular (kural tek yerde kalır).
Lab'daki 10 günlük azami süre burada 5 güne iner (kullanıcı kararı); lab bu kısaltılmış sürümü ayrıca test eder.

## 4. Günlük akış (her tarama, ~7 dk)

1. **Açık işlemleri güncelle.** Gün içi: mevcut kurallar (stop, hedef, 15:55 kapanış). Swing: gün sonunda kapanmaz;
   stop/hedef 5 dk mumlarla izlenir, `exit_rule` ve `max_days` 15:55 taramasında kontrol edilir.
2. **Adayları topla.** Her kitap kendi adaylarını üretir. Sert kurallar (bilanço günü, FOMC, veri saati, fiyat geçersiz,
   kitabın öğrenilmiş sert kuralları) burada eler; diğer kurallar `rule_keys` etiketi olur.
3. **Dağıt (bandit).** Bugün kalan hak = 3 − bugün açılan. Her kitap için:
   - kazanma olasılığı örneklenir: θ ~ Beta(α, β); α/β = lab ön bilgisi (10 sanal işleme ölçekli) + canlı kazanç/kayıp;
   - net beklenti örneklenir: μ ~ Normal(ort. net R, s/√n) (n < 5 ise lab ortalaması);
   - fayda = θ, μ ≤ 0 ise θ × 0,5.
   Kitaplar faydaya göre sıralanır; her hak sıradaki kitabın en yüksek puanlı adayına verilir (bir kitap bir günde en fazla 2 hak).
   Rastgelelik tarih tohumuyla sabittir (aynı gün aynı sonuç, test edilebilir).
4. **Garanti 3.** 09:35–11:00 arası limit emirle girilir. 11:00 NY'den itibaren bugün açılan < 3 ise dolmamış limit emirler
   iptal edilir ve kalan haklar dağıtım sırasındaki adaylara piyasa fiyatından verilir (stop/hedef R mesafeleri korunur).
   Swing kitapları sinyali dünkü kapanıştan geldiği için ilk taramada (09:35 sonrası) piyasa fiyatından girer.
   Uygun aday hiç yoksa hak boş kalır ve günlükte nedeni yazılır (sert kurallar asla delinmez).
5. **Kapasite ve risk.**
   - Aynı anda en fazla 6 açık pozisyon; her biri en fazla hesap/6 nakit (kaldıraç yok).
   - İşlem başına risk (komisyon dahil) ≤ hesabın %1'i.
   - Günlük zarar −3R'ye ulaşınca o gün yeni işlem yok.
   - Aynı sektörde en fazla 2 açık pozisyon; aynı sembolde tek pozisyon.
   - Çöküş koruması (SPY −%2 ve VWAP altı → gün içi pozisyonlar kapanır) ve kalkanda yarım risk aynen kalır.
6. **Gölge işlemler** (`learn.py`): her aday kitabıyla birlikte gölgeye alınır. Ek olarak her gölge için stop çarpanları
   k ∈ {0,8; 1; 1,25} başına "stoptan önce görülen en iyi R", "stop oldu mu", "kapanış R" kaydedilir (`ex`).
   Bu kayıtla her hedef/stop bileşimi yeniden simüle etmeden değerlendirilebilir (aynı mumda stop ve hedef → stop).

## 5. Kendini geliştirme (`evolve.py`, günde bir kez, 16:00 NY sonrası ilk tarama)

1. **Ayar.** Son ayardan beri ≥ 20 yeni kapanmış örneği (gerçek + gölge) olan her kitap için 9 bileşim
   (hedef 1R / 1,5R / 2R × stop k) `ex` kayıtlarından değerlendirilir. Seçim:
   (a) kazanma ≥ %60 ve net > 0 olanlar içinde en yüksek net beklenti; (b) yoksa net > 0 olanlar içinde en yüksek kazanma;
   (c) o da yoksa mevcut ayar korunur. Değişiklik ancak yeni ayar mevcut ayardan net beklentide ≥ 0,05R iyi ise yapılır.
2. **Kural sertleştirme.** Kitap bazında `learn.json` kararı "koruyor" ve iki tarafta ≥ 30 örnek varsa kural o kitabın sert
   kurallarına eklenir; daha sonra aynı eşikle "fark yok" ya da "fırsat kaçırtıyor" olursa çıkarılır.
3. **Değişiklik günlüğü.** Her değişiklik `data/evolve.json` → `changes`: `{tarih, kitap, ne, eski, yeni, gerekçe, örnek sayısı}`.
   Uygulamada listelenir; `config.json` → `evolve.frozen: true` ile otomatik değişiklikler durdurulabilir.

## 6. Kaynaklar

- **SEC EDGAR** (`edgar.py`): güncel 8-K atom akışı (`browse-edgar?action=getcurrent&type=8-K&output=atom`), CIK → sembol
  eşlemesi `company_tickers.json` (haftada bir önbelleğe). SEC'in istediği User-Agent: "Diogenes research
  (github.com/Ross002200/Ross)" — e-posta gönderilmez. Saniyede ≤ 10 istek; hata olursa sessizce atlanır.
  Aday etiketi: `filing: {item, time}` (2.02 sonuç, 1.01 anlaşma, 8.01 diğer). `cat` kitabı kullanır.
- **Piyasa öncesi gap:** mevcut 1 dk `prepost=True` indirmesinden açılış öncesi son fiyat / dünkü kapanış.
- Mevcutlar aynen: yfinance haber, Finnhub bilanço, gün içi yükselenler, Claude sabah analizi (`night.json`), `news_score` ölçümü.

## 7. Veri

- `data/paper.json` sürüm 3: başlangıç 10.000 $; v2 hesap `paper_v2.json`'a arşivlenir. İşlemlere `book`, `horizon`,
  `max_days`, `exit_rule`, `order` ("limit"/"market"), `pnl_600` (aynı işlem 600 $/6 pozisyon boyutuyla) eklenir.
- `data/evolve.json` (yeni): `books: {id: {alpha, beta, live_n, net_mean, net_sd, params: {target_r, stop_k}, hard_rules,
  last_tune}}`, `allocation` (bugünkü sıra ve faydalar), `changes`.
- `data/learn.json`: `by_book`, `progress: {n, goal: 100, win, wilson_lo, wilson_hi, net, net_600, criteria_met}`.
- `data/shadow.json`: kayıtlara `book` ve `ex` eklenir; 45 gün saklanır (mevcut).

## 8. Arayüz (`pro.html`)

"Gelişim" kartı: 100 işlem ilerleme çubuğu; kazanma oranı ve %95 Wilson aralığı; net ($ ve R) ve 600 $ karşılığı;
kriter A durumu (✓/✗ her iki parça ayrı); kitap tablosu (bugünkü pay, n, kazanma, net, hedef/stop ayarı, sert kurallar);
son 20 değişiklik. Önbellek sürümü artırılır.

## 9. Bildirimler

Mevcut açılış/kapanış bildirimlerine kitap adı eklenir. Gün özeti kitap bazında. Otomatik ayar değişikliği bildirilir.
25/50/75/100. işlemde ara rapor; 100'de kriter A sonucu ve "gerçek paraya geçiş için onayın gerekir" notu.

## 10. Hata durumları

- Bir kitabın kodu hata verirse o kitap o tur atlanır, diğerleri çalışır; hata günlüğe yazılır.
- Veri gelmezse (yfinance/EDGAR) işlem açılmaz; açık işlemler bir sonraki turda güncellenir.
- `evolve.json` bozuksa lab ön bilgisinden yeniden kurulur, değişiklik günlüğü korunur.

## 11. Test

- `scan/tests/` (pytest, sentetik veri, ağ yok): bandit (tohumla belirlenim, μ ≤ 0 cezası, kitap başına 2 hak sınırı);
  11:00 garantisi (limit iptal → piyasa girişi); swing taşıma ve `exit_rule`/`max_days`; kapasite (6 pozisyon, hesap/6,
  sektör 2, −3R günü); `ex` ile bileşim değerlendirme; kural sertleştirme/geri alma; `pnl_600`.
- Uçtan uca: depo kopyasında, gerçek veriyle, saat taklidiyle iki tur (şimdiye kadarki smoke testi gibi).
- GitHub Actions'a taramadan önce `pytest` adımı eklenir; testler geçmezse o tur tarama çalışmaz, iş başarısız olur ve GitHub e-posta ile bildirir.

## 12. Yayın

Kod → commit → `origin`'e rebase → push. Pages ~1 dk içinde yayınlar; Actions bir sonraki çalışmada yeni kodu kullanır.
Veri dosyalarına yerelden dokunulmaz. `mode: strict` ile eski katı kurallara dönüş korunur.
