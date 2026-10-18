import pandas as pd

import haber as H

NY = "America/New_York"


def test_siniflandir_tur_ve_yon():
    assert H.siniflandir("Acme beats Q3 estimates, raises full-year guidance") == ("beklenti", "iyi")
    assert H.siniflandir("Acme misses third-quarter earnings estimates") == ("bilanço", "kötü")
    assert H.siniflandir("Morgan Stanley downgrades Acme to underweight") == ("analist", "kötü")
    assert H.siniflandir("FDA approves Acme's new drug") == ("onay", "iyi")
    assert H.siniflandir("Acme to acquire Beta in $2 billion deal") == ("birleşme", "belirsiz")
    assert H.siniflandir("Acme faces SEC probe over accounting") == ("hukuki", "kötü")
    assert H.siniflandir("5 stocks to watch this week") == ("diğer", "belirsiz")
    assert H.siniflandir("Acme upgraded but misses revenue") == ("analist", "belirsiz")   # iki yön birden


def bars(rows):
    df = pd.DataFrame(rows, columns=["ts", "Open", "High", "Low", "Close", "Volume"])
    df["ts"] = pd.to_datetime(df["ts"]).dt.tz_convert(NY)
    return df.set_index("ts")


def ts(s):
    return int(pd.Timestamp(s).timestamp())


GUNLER = [("2026-10-12", 100, 102), ("2026-10-13", 102, 104), ("2026-10-14", 104, 103), ("2026-10-15", 103, 106)]


def seri(carpan=1.0):
    rows = []
    for d, o, c in GUNLER:
        rows += [[f"{d} 09:30:00-04:00", o * carpan, o * carpan, o * carpan, o * carpan, 1],
                 [f"{d} 12:00:00-04:00", o * carpan, c * carpan, o * carpan, (o + c) / 2 * carpan, 1],
                 [f"{d} 15:45:00-04:00", c * carpan, c * carpan, c * carpan, c * carpan, 1]]
    return bars(rows)


def test_olc_seans_icinde_haber():
    sym, spy = seri(), seri(5.0)
    o = H.olc(ts("2026-10-12 11:00:00-04:00"), sym, spy)
    assert o["giris"] == 100.0                                    # haberden sonraki ilk mumun açılışı (12:00 mumu)
    assert o["gun"] == 2.0                                        # o günün kapanışı 102
    assert o["g3"] == 3.0                                         # 3. seansın kapanışı (14 Ekim) 103
    assert o["spy_gun"] == 2.0 and o["fark_gun"] == 0.0
    assert o["fark_gun"] == round(o["gun"] - o["spy_gun"], 2)


def test_olc_kapanistan_sonra_haber_ertesi_acilistan():
    o = H.olc(ts("2026-10-12 18:00:00-04:00"), seri(), seri(5.0))
    assert o["giris"] == 102.0 and o["gun"] == round((104 / 102 - 1) * 100, 2)


def test_olc_veri_yetmezse_3g_bos():
    o = H.olc(ts("2026-10-15 10:00:00-04:00"), seri(), seri(5.0))
    assert o["gun"] is not None and o["g3"] is None


def test_karne_birikir_ve_budanir():
    olaylar = [dict(id=f"x{i}", sym="A", ts=1000 + i, tur="bilanço", yon="iyi", fark_gun=1.0, fark_3g=2.0, sayildi=False)
               for i in range(3)] + [dict(id="y", sym="B", ts=5, tur="bilanço", yon="iyi", fark_gun=-1.0, fark_3g=None, sayildi=False)]
    karne = {}
    H.karneye_ekle(olaylar, karne)
    k = karne["bilanço|iyi"]
    assert k["n"] == 3 and k["s_gun"] == 3.0 and k["poz"] == 3 and k["s_3g"] == 6.0          # 3 günü dolmayan sayılmaz
    assert all(o["sayildi"] for o in olaylar[:3]) and not olaylar[3]["sayildi"]
    H.karneye_ekle(olaylar, karne)
    assert karne["bilanço|iyi"]["n"] == 3                                                    # ikinci kez sayılmaz
    ozet = H.karne_ozet(karne)
    assert ozet[0] == {"tur": "bilanço", "yon": "iyi", "n": 3, "ort_gun": 1.0, "ort_3g": 2.0, "poz": 100}


def test_birlestir_tekrar_almaz_ve_sinirlar():
    eski = [dict(id="a", sym="A", ts=1, tur="bilanço", yon="iyi", sayildi=True)]
    yeni = [dict(id="a", sym="A", ts=1), dict(id="b", sym="A", ts=2), dict(id="c", sym="B", ts=3)]
    out = H.birlestir(eski, yeni, sinir=2)
    assert [o["id"] for o in out] == ["b", "c"]                   # en yeni 2; "a" zaten vardı ve en eski
