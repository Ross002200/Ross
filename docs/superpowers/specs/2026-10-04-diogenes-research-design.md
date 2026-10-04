# Diogenes · Hafta sonu araştırma modu — tasarım

Tarih: 2026-10-04 · Durum: kullanıcı onayladı ("yaz ve uygulamaya başla")

## Amaç
Hafta sonu işlem yok; sistem araştırır: (1) kendini geliştirecek kural fikirleri (makale, kitap, trader deneyimi),
(2) geçmiş haftanın değerlendirmesi, (3) gelecek haftaya hazırlık. Kararlar: araştırmayı Claude rutini yapar (A);
sınavı geçen fikirler otomatik olarak oyun kitabı adayı olur (A).

## Akış (TR saati)
| Zaman | İş | Çıktı |
|---|---|---|
| Cmt 11:00 | Actions `weekend.py` (mevcut) + geçmiş hafta özeti | `data/weekly.json` → `review` |
| Cmt 12:00 | Claude rutini **Diogenes araştırma** | ntfy eki `research_in.json` |
| Cmt 14:30 | Actions: `relay.py` → `research.py --test` | `data/research.json` (sonuçlar, aktif fikirler, geri bildirim) |
| Paz 17:30 | Claude rutini **Diogenes hafta hazırlığı** | ntfy eki `brief.json`, `week_plan.json` |
| Paz 18:20 | Actions: `relay.py` (mevcut) + `research.py --test` (cumartesi kaçtıysa) | `data/brief.json`, `data/week_plan.json` |
| Hafta içi her akşam | Actions lab işi sonrası `research.py --live` | aktif fikirlerin yarın açılış sinyalleri |

Rutinler repoya push edemez; mevcut yol kullanılır: ntfy `<ntfy_topic>-data` konusuna dosya eki → `relay.py` alır,
zorunlu alanları doğrular, yazar.

## Kural dili (`research_in.json` → `ideas[].rule`)
```
{"when": [[özellik, op, sayı | özellik], ...],   op: < <= > >= cross_above cross_below
 "entry": "next_open", "stop_pct": 2–12,
 "target": {"pct": x} | {"r": x} | {"exit": "close_above_sma5"},
 "max_days": 1–5}
```
Özellikler (günlük): close, open, sma5/10/20/25/50/150/200, ema10/20/50, rsi2, rsi14, atr_pct, rv (göreli hacim),
gap (%), ret1/ret5/ret20/ret63 (%), rs (63 gün sıralama, 0–100), dev25 (% 25 günlükten sapma), hi252_dist (%), adr (%).
Bilinmeyen özellik/op/alan → ret; ret nedeni `research.json → feedback`'e yazılır (Claude gelecek hafta okur). Kod çalıştırılmaz.

## Test ve kabul (`research.py --test`)
Lab'ın 2 yıllık günlük panelinde (`lab.load` + `lab.panel` + `lab.run_signals`), komisyon dahil, aynı mumda stop+hedef → stop.
Öğrenme/sınav bölmesi lab ile aynı. Kabul: öğrenme ve sınavda ≥ 30'ar işlem, ikisinde de işlem başı net > 0, sınav
p değeri o haftanın fikirleri arasında Holm düzeltmesiyle < 0,10. Kabul edilen fikir `active`'e girer (en fazla 6; dolarsa
sınav beklentisi en düşük olan çıkar). Canlıda ≥ 20 gerçek işlem ve ortalama net R < 0 olursa emekli edilir.

## Sisteme girişi
- `books.all_books()`: sabit 7 kitap + aktif fikirler (`r_<id>`, swing ≤ 5 gün). Ön bilgi sınav sonucundan (10 sanal işlem).
- `research.py --live` aktif fikirlerin son kapanış sinyallerini yazar; `books.swing()` bunları ertesi gün açılışta aday yapar.
- Ekleme/emeklilik `evolve.json → changes`'e yazılır ve bildirilir.

## Hafta planı (`week_plan.json`)
`{week, generated, days: {tarih: {flag: normal|dikkat|dur, why}}, sectors: {favor: [], avoid: []}, watch: [{symbol, why}], events: []}`
- `dur`: kalkan açılır (öğrenme modunda yarım risk, işlem sürer). `dikkat`: piyasa uyarısı.
- `avoid` sektör → aday etiketi `week_avoid`; `favor` → etiket `week_favor` ve kitap içi puana %15 avantaj.
- `watch` hisseleri tarama evrenine eklenir. Etiketler öğrenme raporunda ölçülür (Claude'un görüşü işe yarıyor mu).

## Arayüz
pro.html Masa: "Araştırma" kartı (haftanın değerlendirmesi, fikirler ve test sonuçları, kaynak bağlantıları, aktif fikirler,
gelecek hafta planı). index.html Gelişim panelinde bugünkü hafta planı bayrağı ve aktif fikir sayısı.

## Hata durumları
Rutin çalışmazsa önceki plan sürer; şemaya uymayan dosya relay'de atlanır; bir fikrin testi hata verirse yalnız o fikir
"hata" ile reddedilir.

## Test
Kural dili doğrulama ve maske hesabı (sentetik panel), kabul kuralı (Holm), aktif listenin sınırı ve emeklilik,
hafta planı etkileri (dur → kalkan, avoid/favor etiketleri), `books.swing` araştırma sinyallerini okuma.
