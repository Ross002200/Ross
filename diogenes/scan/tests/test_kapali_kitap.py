"""2026-10-18 (kullanıcı: kazanma odaklı): kanıtla eksi çıkan kitaplar config'den kapatılır; aday üretmezler."""
import books as B
import scan as S


def test_kapali_kitaplar_aday_uretmez(monkeypatch):
    monkeypatch.setitem(S.CFG, "kapali_kitaplar", ["vwap", "rev"])
    out = {"vwap": [{"score": 1}], "rev": [{"score": 2}], "of": [{"score": 3}]}
    assert B.kapali_filtre(out) == {"vwap": [], "rev": [], "of": [{"score": 3}]}


def test_ders_kurali_canli_ozellikle():
    ders = {"feature": "gap", "op": ">=", "value": -0.1}
    assert B.ders_gecer(ders, {"gap": 0.0}) is True
    assert B.ders_gecer(ders, {"gap": -0.5}) is False
    assert B.ders_gecer({"feature": "gap", "op": "<=", "value": 1.0}, {"gap": 2.0}) is False
    assert B.ders_gecer(None, {"gap": -9}) is True                         # ders yoksa engel yok
    assert B.ders_gecer({"feature": "rs", "op": ">=", "value": 70}, {"gap": 0}) is True   # canlıda hesaplanamayan özellik engellemez


def test_rsi2c_genis_stop_ve_10_gun(monkeypatch):
    """2026-10-18 araştırma + laboratuvar: Connors aslına yakın geniş stop (%12) sınav döneminde kazanmayı %65'ten %71'e
    çıkardı. Kapanışta RSI(2) kitabı %12 stop ve en çok 10 gün tutmayla açılır."""
    import numpy as np
    import pandas as pd

    gun = pd.bdate_range("2025-09-01", periods=230, tz="America/New_York")
    fiyat = np.linspace(100, 160, 230)
    fiyat[-3:] = [158, 152, 147]                                    # trend içinde sert iki günlük düşüş: RSI(2) < 10
    d1 = pd.DataFrame({"Open": fiyat, "High": fiyat + 1, "Low": fiyat - 1, "Close": fiyat, "Volume": 1e6}, index=gun)
    bugun = (gun[-1] + pd.offsets.BDay(1)).date()                   # hafta içi bir sonraki gün
    td = pd.DataFrame({"Open": [146.0], "High": [146.5], "Low": [144.0], "Close": [144.5], "Volume": [1e6]},
                      index=[pd.Timestamp(f"{bugun} 15:30", tz="America/New_York")])
    simdi = pd.Timestamp(f"{bugun} 15:50", tz="America/New_York")
    monkeypatch.setattr(B, "_ders", lambda lab_id: None)
    out = B.close_swing(bugun, {"AAA": d1}, {"AAA": td}, {"AAA": 144.5}, {"AAA": {"sector": "Tech"}}, simdi)
    c = next(x for x in out if x["book"] == "rsi2c")
    assert c["stop"] == round(144.5 * 0.88, 2) and c["max_days"] == 10


def test_haftalik_kitaplar_lab_sinyalinden_pazartesi_acilir(tmp_path, monkeypatch):
    """2026-10-18 (kullanıcı: haftalık işlem modeli): Cuma kapanışında laboratuvarın yazdığı haftalık sinyaller
    Pazartesi sabahı kitaba girer; stop %12, en çok 5 işlem günü (bir hafta)."""
    import json

    import pandas as pd

    gun = pd.bdate_range("2026-09-01", "2026-10-16", tz="America/New_York")        # son gün Cuma 16 Ekim
    d1 = pd.DataFrame({"Open": 100.0, "High": 101.0, "Low": 99.0, "Close": 100.0, "Volume": 1e6}, index=gun)
    lab = {"strategies": [{"id": "haftalik_zirve_ders", "pending": [{"sym": "AAA", "sig": "2026-10-16", "i": 5}]},
                          {"id": "haftalik_momentum", "pending": [{"sym": "BBB", "sig": "2026-10-16", "i": 3}]}]}
    (S.DATA / "lab.json").write_text(json.dumps(lab), encoding="utf-8")
    simdi = pd.Timestamp("2026-10-19 10:00", tz="America/New_York")                 # Pazartesi
    out = B.swing(simdi.date(), {"AAA": d1, "BBB": d1}, {"AAA": 100.0, "BBB": 100.0}, {}, simdi)
    kitap = {c["book"]: c for c in out}
    assert set(kitap) == {"hzirve", "hmom"}
    for c in kitap.values():
        assert c["stop"] == 88.0 and c["max_days"] == 5 and c["horizon"] == "swing"


def test_haftalik_model_acik_kitaplar():
    kapali = set(S.CFG.get("kapali_kitaplar") or [])
    assert set(B.BOOKS) - kapali == {"hzirve", "hmom", "rsi2c"}
