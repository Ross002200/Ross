"""2026-10-18 (kullanıcı: kazanma odaklı): kanıtla eksi çıkan kitaplar config'den kapatılır; aday üretmezler."""
import books as B
import scan as S


def test_kapali_kitaplar_aday_uretmez(monkeypatch):
    monkeypatch.setitem(S.CFG, "kapali_kitaplar", ["vwap", "rev"])
    out = {"vwap": [{"score": 1}], "rev": [{"score": 2}], "of": [{"score": 3}]}
    assert B.kapali_filtre(out) == {"vwap": [], "rev": [], "of": [{"score": 3}]}


def test_basari_odakli_yalniz_rsi2_ailesi_acik():
    """2026-10-18 (kullanıcı: "parayı değil başarıyı hedefle"): yalnız hem öğrenme hem sınav döneminde %60+ kazanan ve
    artıda kalan laboratuvar stratejilerinin kitapları açık: RSI(2) (Connors) ailesi."""
    kapali = set(S.CFG.get("kapali_kitaplar") or [])
    assert set(B.BOOKS) - kapali == {"rsi2", "rsi2c"}


def test_ders_kurali_canli_ozellikle():
    ders = {"feature": "gap", "op": ">=", "value": -0.1}
    assert B.ders_gecer(ders, {"gap": 0.0}) is True
    assert B.ders_gecer(ders, {"gap": -0.5}) is False
    assert B.ders_gecer({"feature": "gap", "op": "<=", "value": 1.0}, {"gap": 2.0}) is False
    assert B.ders_gecer(None, {"gap": -9}) is True                         # ders yoksa engel yok
    assert B.ders_gecer({"feature": "rs", "op": ">=", "value": 70}, {"gap": 0}) is True   # canlıda hesaplanamayan özellik engellemez
