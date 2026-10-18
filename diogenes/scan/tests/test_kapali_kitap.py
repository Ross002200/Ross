"""2026-10-18 (kullanıcı: kazanma odaklı): kanıtla eksi çıkan kitaplar config'den kapatılır; aday üretmezler."""
import books as B
import scan as S


def test_kapali_kitaplar_aday_uretmez(monkeypatch):
    monkeypatch.setitem(S.CFG, "kapali_kitaplar", ["vwap", "rev"])
    out = {"vwap": [{"score": 1}], "rev": [{"score": 2}], "of": [{"score": 3}]}
    assert B.kapali_filtre(out) == {"vwap": [], "rev": [], "of": [{"score": 3}]}


def test_canli_config_kanitla_eksi_kitaplari_kapatir():
    assert {"vwap", "rev", "orb"} <= set(S.CFG.get("kapali_kitaplar") or [])
    assert "of" not in (S.CFG.get("kapali_kitaplar") or [])
