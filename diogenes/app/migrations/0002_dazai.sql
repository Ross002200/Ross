-- Aşama 2: Dazai gelirlerinde tekrar koruması ve öğrenilen zarf eşlemeleri.
ALTER TABLE gelirler ADD COLUMN istek_id TEXT;
CREATE UNIQUE INDEX gelirler_istek ON gelirler(istek_id);
CREATE TABLE zarf_eslemeleri (kelime TEXT PRIMARY KEY, zarf_id INTEGER NOT NULL, guncelleme TEXT NOT NULL);
