-- Diogenes: zarf bütçesi. Tutarlar kuruş (tam sayı), tarihler YYYY-AA-GG (İstanbul).
CREATE TABLE zarflar (id INTEGER PRIMARY KEY, ad TEXT NOT NULL, aylik_kurus INTEGER NOT NULL, sira INTEGER NOT NULL DEFAULT 0, aktif INTEGER NOT NULL DEFAULT 1, olusturma TEXT NOT NULL);
CREATE TABLE gelir_plani (id INTEGER PRIMARY KEY, ad TEXT NOT NULL, tutar_kurus INTEGER NOT NULL, gun INTEGER NOT NULL);
CREATE TABLE gelirler (id INTEGER PRIMARY KEY, plan_id INTEGER, tutar_kurus INTEGER NOT NULL, aciklama TEXT NOT NULL, tarih TEXT NOT NULL, oneri_id INTEGER);
CREATE TABLE dagitimlar (id INTEGER PRIMARY KEY, ay TEXT NOT NULL, zarf_id INTEGER NOT NULL, tutar_kurus INTEGER NOT NULL, oneri_id INTEGER, tarih TEXT NOT NULL);
CREATE TABLE harcamalar (id INTEGER PRIMARY KEY, istek_id TEXT NOT NULL UNIQUE, tutar_kurus INTEGER NOT NULL, aciklama TEXT NOT NULL, zarf_id INTEGER, tarih TEXT NOT NULL, kaynak TEXT NOT NULL, etiket TEXT NOT NULL DEFAULT '');
CREATE TABLE aktarimlar (id INTEGER PRIMARY KEY, ay TEXT NOT NULL, zarf_id INTEGER, merdiven_id INTEGER NOT NULL, tutar_kurus INTEGER NOT NULL, oneri_id INTEGER, tarih TEXT NOT NULL);
CREATE TABLE abonelikler (id INTEGER PRIMARY KEY, ad TEXT NOT NULL, tutar_kurus INTEGER NOT NULL, gun INTEGER NOT NULL, zarf_id INTEGER, aktif INTEGER NOT NULL DEFAULT 1);
CREATE TABLE borclar (id INTEGER PRIMARY KEY, ad TEXT NOT NULL, kalan_kurus INTEGER NOT NULL, aylik_kurus INTEGER NOT NULL, kalan_taksit INTEGER);
CREATE TABLE birikimler (id INTEGER PRIMARY KEY, tur TEXT NOT NULL, ad TEXT NOT NULL, tutar_kurus INTEGER NOT NULL);
CREATE TABLE merdiven (id INTEGER PRIMARY KEY, sira INTEGER NOT NULL, ad TEXT NOT NULL, kural TEXT, hedef_kurus INTEGER, biriken_kurus INTEGER NOT NULL DEFAULT 0);
CREATE TABLE oneriler (id INTEGER PRIMARY KEY, tur TEXT NOT NULL, anahtar TEXT NOT NULL UNIQUE, detay_json TEXT NOT NULL, durum TEXT NOT NULL DEFAULT 'bekliyor', olusturma TEXT NOT NULL, karar TEXT);
CREATE TABLE ayarlar (anahtar TEXT PRIMARY KEY, deger TEXT NOT NULL);
CREATE TABLE login_attempts (address TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX harcamalar_tarih ON harcamalar(tarih);
CREATE INDEX oneriler_durum ON oneriler(durum);
