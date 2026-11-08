-- Zenon: localStorage anahtarları (docs), Dazai gelen kutusu (inbox), giriş denemeleri.
CREATE TABLE docs (key TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX idx_docs_updated ON docs (updated_at);
CREATE TABLE inbox (id TEXT PRIMARY KEY, day TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, applied_at TEXT);
CREATE INDEX idx_inbox_open ON inbox (applied_at, day);
CREATE TABLE login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX idx_login_attempts ON login_attempts (address, at);
