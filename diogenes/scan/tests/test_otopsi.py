import pandas as pd

import otopsi as O

NY = "America/New_York"


def islem(**k):
    t = dict(id="t1", symbol="AAA", book="vwap", date="2026-10-13", fill=100.0, stop=98.0, target=103.0, qty=10.0,
             risk=23.0, r=-1.0, mfe=0.2, mae=-1.0, note="Stop", violations=[], horizon="gün",
             fill_time="2026-10-13 10:00:00-04:00", exit_time="2026-10-13 11:00:00-04:00", status="closed")
    t.update(k)
    return t


def test_bir_r_komisyon_haric_riskten():
    assert O.bir_r(islem()) == 2.0                                     # (23 − 3) / 10
    assert O.bir_r(islem(risk=None)) == 2.0                            # yoksa giriş − stop


def test_kayip_etiketleri_oncelik_sirasi():
    assert O.etiketle(islem(note="Stop (boşlukla)"), 104.0, -1.0)["etiket"] == "boşlukla delindi"
    assert O.etiketle(islem(), 103.5, -1.0)["etiket"] == "stop dar kaldı"            # sonra hedefe gitti
    assert O.etiketle(islem(), 101.0, -0.8)["etiket"] == "piyasa döndü"
    assert O.etiketle(islem(mfe=0.1), 101.0, 0.1)["etiket"] == "hiç lehte gitmedi"
    assert O.etiketle(islem(mfe=0.9), 101.0, 0.1)["etiket"] == "geri döndü"         # önce lehte gitti, sonra stop
    assert O.etiketle(islem(note="Gün sonu kapanış", r=-0.3, mfe=0.5), None, 0.0)["etiket"] == "süre doldu"


def test_kazanc_etiketleri():
    assert O.etiketle(islem(note="Hedef", r=1.5, mfe=1.6), None, 0.7)["etiket"] == "piyasa taşıdı"
    assert O.etiketle(islem(note="Hedef", r=1.5, mfe=1.6), None, 0.1)["etiket"] == "kendi hareketi"
    assert O.etiketle(islem(note="Gün sonu kapanış", r=0.4, mfe=0.9), None, 0.1)["etiket"] == "kârda süre doldu"


def test_kural_ihlali_isareti_ve_alanlar():
    e = O.etiketle(islem(violations=[{"key": "ev", "msg": "x"}]), None, None)
    assert e["kural_ihlali"] is True and e["spy"] is None and e["sonra_hedef"] is None
    assert O.etiketle(islem(), None, None)["etiket"] == "hiç lehte gitmedi"   # SPY yoksa piyasa etiketi verilmez


def bars(rows):
    df = pd.DataFrame(rows, columns=["ts", "Open", "High", "Low", "Close", "Volume"])
    df["ts"] = pd.to_datetime(df["ts"]).dt.tz_convert(NY)
    return df.set_index("ts")


def test_olcumler_arsivden():
    sym = bars([["2026-10-13 10:45:00-04:00", 99, 99.5, 98, 98.5, 1], ["2026-10-13 11:15:00-04:00", 99, 103.2, 99, 103, 1],
                ["2026-10-14 09:30:00-04:00", 103, 104, 102, 103, 1]])
    spy = bars([["2026-10-13 09:45:00-04:00", 500, 500, 500, 500, 1], ["2026-10-13 10:45:00-04:00", 498, 498, 497, 497.5, 1]])
    tepe, spy_d = O.olcumler(islem(), sym, spy)
    assert tepe == 103.2                                               # yalnız çıkıştan sonra ve aynı gün (gün içi işlem)
    assert spy_d == -0.5                                               # girişteki son mumdan çıkıştaki son muma
    tepe2, _ = O.olcumler(islem(horizon="swing"), sym, spy)
    assert tepe2 == 104.0                                              # swing: ertesi seans da sayılır


def test_ozet_ve_bulgular():
    kayitlar = [dict(book="vwap", r=-1.0, etiket="stop dar kaldı", kural_ihlali=False)] * 6 + \
               [dict(book="vwap", r=1.5, etiket="kendi hareketi", kural_ihlali=False)] * 2 + \
               [dict(book="of", r=-1.0, etiket="hiç lehte gitmedi", kural_ihlali=True)] * 3
    o = O.ozet(kayitlar)
    assert o["etiket"]["stop dar kaldı"] == {"n": 6, "r": -6.0}
    assert o["kitap"]["vwap"]["stop dar kaldı"] == {"n": 6, "r": -6.0}
    assert o["kural_ihlali"] == {"n": 3, "r": -3.0}
    assert any("stop dar kaldı" in b and "ön bulgu" in b for b in o["bulgular"])
