# Zenon 師 Koç · Ek özellikler (Aşama A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, user-approved method). Steps use checkbox syntax.

**Goal:** Spec `docs/superpowers/specs/2026-10-08-zenon-koc-ek-design.md` — 9 ek özellik + içerik odaklı tek bütçeli liste v2 (reçeteli + reçetesiz alternatif + Boyner parfüm).

**Architecture:** Saf motorlar genişler (`zenon-coach.js`, `zenon-care.js`), veri `zenon-plan.js`; arayüz `zenon.js` koç bölümünün altına yeni alt bölümler; adım senkronu için Seneca `zenon_push.py` iki uç.

**Tech Stack:** önceki planla aynı.

## Global Constraints

- Önceki planın (2026-10-07-zenon-koc.md) tüm Seneca kuralları: başka oturum kontrolü, `yedek/2026-10-08-zenon-adim/`, pytest önce/sonra, `guncelle.py`, CORS yalnız Pages, gövde ≤ 64 KB, token önce.
- Toplam Ekim listesi ≤ 15.000 TL (parfüm dahil); her rx maddede ≥ 1 reçetesiz alternatif.
- Fotoğraflar yalnız IndexedDB'de; yedeğe/sunucuya gitmez. Beden kontrolü sonucu yalnız cihazda.
- Günde ≤ 6 bildirim; yeni türler en düşük öncelik.
- Commit sonu: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Joker seri: art arda iki kaçırma kesin sıfırlar; 7 günde birden fazla joker yok → T2 testi.
- Öğün planı protein hedefini tutmalı ve ertesi gün aynı öğünü tekrar etmemeli → T2 testi.
- Etkinlik görevi doğru günde (T-7 … T-0) ve etkinlikten sonra görünmemeli → T2 testi.
- Adım senkronu elle girilen adımı ezmemeli; yanlış token 403 → T1/T5.
- Kamera izni yoksa ya da desteklenmiyorsa dosya seçiciye düşmeli, sayfa hatası yok → T5 Playwright.

### Task 1: Seneca adım uçları (TDD + yayın)
- Testler (`tests/test_zenon_push.py`): `adim_yaz` token zorunlu (403), 0 ≤ adım ≤ 100.000 ve tarih `YYYY-MM-DD` son 30 gün içinde (400), aynı gün güncellenir, `adim_oku(cihaz, token, gun)` en fazla 60 gün döner, 400 günden eski budanır; uçlar `PUT /zenon/api/adim`, `GET /zenon/api/adim?gun=14` CORS'lu.
- Uygulama: `zenon_push.py` tablo `adimlar(cihaz, tarih, adim, guncel, PRIMARY KEY(cihaz,tarih))`, fonksiyonlar `adim_yaz`, `adim_oku`; `server.py` iki uç (`_zenon_cagir` + `_zenon_is`, `dogrula` gövdeden önce); `Allow-Methods` GET, POST, PUT.
- Yayın: Seneca sw +1, `guncelle.py`, canlı doğrulama, CLAUDE.md notu.

### Task 2: Koç motoru ve veri
- `zenon-plan.js`: `MEALS` (≥ 16 öğün, protein/kcal/maliyet/malzeme), `IFTHEN` (≥ 8 şablon), `EVENTS` (date, mulakat, dugun, diger ofsetli görevler), `BODYCHECK` (5 soru).
- `zenon-coach.js`: `forgivingStreak(doneMap, date)`, `todayTodos` → toparlanma maddesi, pazartesi plan maddesi, etkinlik maddeleri (`ctx.events`), `mealPlan(target, date)`, `marketList(days)`, `bodyCheckResult(answers)`, `weeklyShareText(log, date, opts)`, `pickIfThen(plans, date)`; koçta joker serisi ve toparlanma cümleleri.
- Testler (`tests/coach.test.js`, `tests/plan.test.js`) Review Focus maddeleri + spec Test bölümü.

### Task 3: Uyku çapaları (`zenon-care.js`)
- `reminders` yeni türler `kafein` (kalkış+7 saat ya da 15:00'ın erken olanı) ve `uyku` (yatış−60); PRIO en sona; `extra.ifthen[date]` sabah gövdesine eklenir. Test: ≤ 6, öncelik.

### Task 4: Liste v2 verisi
- Araştırma notları (`research_notes/Rutin ürünleri içerik analizi/` + `receteesiz_alternatifler.md` + `parfum_boyner.md`) ile `MONTHS["2026-10"]` yeniden: tek bütçe, `ingredients`, `alt`, parfüm satırları; `MONTHS["2026-11"]` taslak. Test: toplam ≤ 15.000, rx → alt.

### Task 5: Arayüz
- Alışveriş: tek bütçe çubuğu, madde içinde İçerik / Nasıl alınır / Reçete alamazsan.
- Takip: Planlarım, Beslenme (+ market listesi), Fotoğraflar (kamera + hayalet + karşılaştırma, IndexedDB), Etkinlikler, Beden kontrolü (ayın ilk pazarı), Özeti paylaş, Adımları otomatik al (kestirme rehberi + anahtar kopyala + açılışta çekme).
- Bugün: toparlanma/plan/etkinlik maddeleri; check-in'e bel ölçüsü; sabah bildirimine plan.
- Playwright: tüm yeni bölümler 375 px, hata yok; node + Seneca testleri.

### Task 6: Gözden geçirme ve yayın
- Taze gözden geçirici (opus), Critical/Important düzeltmeleri TDD; Zenon push; canlı kontrol; hafıza.
