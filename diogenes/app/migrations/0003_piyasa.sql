-- Piyasa panosu ve günlük özet. Fiyatlar REAL (Diyar'ın parası değil, piyasa fiyatı).
CREATE TABLE piyasa (gun TEXT NOT NULL, kod TEXT NOT NULL, grup TEXT NOT NULL, tip TEXT NOT NULL, ad TEXT NOT NULL, deger REAL, birim TEXT NOT NULL DEFAULT '', kaynak TEXT NOT NULL DEFAULT '', durum TEXT NOT NULL, PRIMARY KEY (gun, kod));
CREATE TABLE piyasa_aylik (ay TEXT NOT NULL, kod TEXT NOT NULL, deger REAL NOT NULL, PRIMARY KEY (ay, kod));
CREATE TABLE piyasa_not (gun TEXT PRIMARY KEY, metin TEXT NOT NULL);
CREATE TABLE ozetler (gun TEXT PRIMARY KEY, metin TEXT NOT NULL, bildirim TEXT NOT NULL, olusturma TEXT NOT NULL);
CREATE TABLE izleme (id INTEGER PRIMARY KEY, tur TEXT NOT NULL, kod TEXT NOT NULL, sira INTEGER NOT NULL);
CREATE INDEX piyasa_kod ON piyasa(kod, gun);
