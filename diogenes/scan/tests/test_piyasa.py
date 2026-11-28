import json

import piyasa as P


def test_gram_ve_supheli():
    assert round(P.gram(2000, 31.1034768), 6) == 2000.0
    assert P.supheli("doviz", 50, 41) is True
    assert P.supheli("hisse", 50, 41) is False
    assert P.supheli("endeks", 0, 100) is True
    assert P.supheli("faiz", 0, 40) is False
    assert P.supheli("doviz", 42, None) is False


def test_seri_satirlari_son_30_ve_supheli():
    seri = [(f"2026-10-{d:02d}", 40.0) for d in range(1, 32)] + [("2026-11-02", 60.0), ("2026-11-03", 40.2)]
    out = P.seri_satirlari("USDTRY", "altin_doviz", "doviz", "Dolar/TL", "₺", "yahoo", seri)
    assert len(out) == 30
    assert [r["durum"] for r in out[-2:]] == ["supheli", "ok"]
    assert out[-1] == dict(gun="2026-11-03", kod="USDTRY", grup="altin_doviz", tip="doviz", ad="Dolar/TL", deger=40.2, birim="₺", kaynak="yahoo", durum="ok")


def test_ay_sonlari():
    seri = [("2026-09-29", 1.0), ("2026-09-30", 2.0), ("2026-10-31", 3.0), ("2026-11-03", 4.0)]
    assert P.ay_sonlari(seri, 2) == [dict(ay="2026-10", deger=3.0), dict(ay="2026-11", deger=4.0)]


def _yahoo(semboller):
    gun = [("2026-11-27", 1.0), ("2026-11-30", 1.0)]
    veri = {"USDTRY=X": [("2026-11-27", 41.9), ("2026-11-30", 42.1)], "GC=F": [("2026-11-27", 2000.0), ("2026-11-30", 2010.0)],
            "XU100.IS": [("2026-11-27", 10000.0), ("2026-11-30", 10080.0)], "THYAO.IS": gun}
    return {s: veri.get(s, []) for s in semboller}


def test_topla_kaynak_dusunce_yok_satiri_ve_izleme():
    iz = [{"tur": "bist", "kod": "THYAO"}, {"tur": "abd", "kod": "AAPL"}, {"tur": "fon", "kod": "TTE"}]
    def tefas_bozuk(kod, bas, son):
        raise RuntimeError("tefas kapalı")
    g = P.topla(iz, None, "2026-11-30", yahoo_fn=_yahoo, evds_fn=None, tefas_fn=tefas_bozuk)
    k = {}
    for r in g["satirlar"]:
        k.setdefault(r["kod"], []).append(r)
    assert k["USDTRY"][-1]["deger"] == 42.1
    assert round(k["GRAM"][-1]["deger"], 2) == round(2010 * 42.1 / 31.1034768, 2)
    assert round(k["CEYREK"][-1]["deger"], 2) == round(k["GRAM"][-1]["deger"] * 1.6038, 2)
    assert k["EURTRY"] == [dict(gun="2026-11-30", kod="EURTRY", grup="altin_doviz", tip="doviz", ad="Euro/TL", deger=None, birim="₺", kaynak="yahoo", durum="yok")]
    assert k["BIST:THYAO"][-1]["grup"] == "tr" and k["BIST:THYAO"][-1]["tip"] == "hisse"
    assert k["ABD:AAPL"][-1]["durum"] == "yok"
    assert k["FON:TTE"][-1]["durum"] == "yok" and k["FON:TTE"][-1]["grup"] == "faiz"
    for kod in ("POLITIKA", "TUFE_Y", "MEVDUAT"):
        assert k[kod][-1]["durum"] == "yok", "EVDS anahtarı yok"
    aylik = {(a["kod"], a["ay"]) for a in g["aylik"]}
    assert ("USDTRY", "2026-11") in aylik and ("GRAM", "2026-11") in aylik
    json.dumps(g)  # gövde JSON'a çevrilebilir


def test_topla_yahoo_tamamen_duserse():
    def kapali(semboller):
        raise RuntimeError("yahoo kapalı")
    g = P.topla([], None, "2026-11-30", yahoo_fn=kapali, evds_fn=None, tefas_fn=None)
    assert all(r["durum"] == "yok" for r in g["satirlar"])
    assert {r["kod"] for r in g["satirlar"]} >= {"USDTRY", "GRAM", "XU100", "SPX", "NDX"}


def test_topla_evds():
    def evds(anahtar, seri, bas, son):
        if seri == P.KAYNAK["evds"]["TUFE"]:
            return [(f"{2025 + (m >= 12)}-{(m % 12) + 1:02d}", 100 * 1.02 ** i) for i, m in enumerate(range(10, 23))]
        if seri == P.KAYNAK["evds"]["POLITIKA"]:
            return [("2026-11-28", 38.0)]
        return [("2026-10", 45.0), ("2026-11", 44.0)]
    g = P.topla([], "anahtar", "2026-11-30", yahoo_fn=_yahoo, evds_fn=evds, tefas_fn=None)
    k = {r["kod"]: r for r in g["satirlar"] if r["kod"] in ("POLITIKA", "TUFE_Y", "MEVDUAT")}
    assert k["POLITIKA"]["deger"] == 38.0 and k["MEVDUAT"]["deger"] == 44.0
    assert round(k["TUFE_Y"]["deger"], 4) == round((1.02 ** 12 - 1) * 100, 4)
    assert sum(1 for a in g["aylik"] if a["kod"] == "TUFE") == 13


def test_evds_ayristir():
    items = [{"Tarih": "2025-10", "TP_FG_J0": "3100.5"}, {"Tarih": "28-11-2026", "TP_FG_J0": None}, {"Tarih": "27-11-2026", "TP_FG_J0": "3120"}]
    assert P.evds_ayristir(items, "TP.FG.J0") == [("2025-10", 3100.5), ("2026-11-27", 3120.0)]


def test_gunluk_not(tmp_path, monkeypatch):
    monkeypatch.setattr(P, "NOT", tmp_path / "gunluk_not.json")
    assert P.gunluk_not("2026-11-30") is None
    (tmp_path / "gunluk_not.json").write_text(json.dumps({"date": "2026-11-29", "text": "eski"}), encoding="utf-8")
    assert P.gunluk_not("2026-11-30") is None
    (tmp_path / "gunluk_not.json").write_text(json.dumps({"date": "2026-11-30", "text": " Bugün TÜFE açıklanıyor. "}), encoding="utf-8")
    assert P.gunluk_not("2026-11-30") == "Bugün TÜFE açıklanıyor."


def test_inceleme_ay_sonlari_varsayilan_15_ay():
    seri = [(f"{2025 + (m >= 12)}-{(m % 12) + 1:02d}-15", float(m)) for m in range(0, 17)]
    assert len(P.ay_sonlari(seri)) == 15, "12 aylık reel getiri için TÜFE gecikmesini de karşılar"


def test_inceleme_aylik_ortalama():
    haftalik = [("2026-10-03", 40.0), ("2026-10-10", 42.0), ("2026-11-07", 44.0), ("2026-11-14", 46.0)]
    assert P.aylik_ortalama(haftalik) == [("2026-10", 41.0), ("2026-11", 45.0)]


def test_inceleme_nan_atlanir():
    out = P.seri_satirlari("FON:X", "faiz", "fon", "X", "₺", "tefas", [("2026-11-26", 1.0), ("2026-11-27", float("nan")), ("2026-11-28", 1.01)])
    assert [r["gun"] for r in out] == ["2026-11-26", "2026-11-28"]
    json.dumps(out, allow_nan=False)


def test_inceleme_tam_izleme_listesi_govdesi_sinirin_altinda():
    iz = [{"tur": "bist", "kod": f"B{i}"} for i in range(10)] + [{"tur": "abd", "kod": f"A{i}"} for i in range(10)] + [{"tur": "fon", "kod": f"F{i}"} for i in range(5)]
    gunler = [f"2025-{m:02d}-{d:02d}" for m in range(9, 13) for d in range(1, 29)] + [f"2026-{m:02d}-{d:02d}" for m in range(1, 12) for d in range(1, 29)]
    def yahoo(semboller):
        return {s: [(g, 1234.5678 + i) for i, g in enumerate(gunler)] for s in semboller}
    def tefas(kod, bas, son):
        return [(g, 1.234567 + i / 1000) for i, g in enumerate(gunler)]
    def evds(anahtar, seri, bas, son):
        return [(g[:7], 40.0) for g in gunler]
    g = P.topla(iz, "k", "2026-11-28", yahoo_fn=yahoo, evds_fn=evds, tefas_fn=tefas)
    boyut = len(json.dumps(g, allow_nan=False).encode("utf-8"))
    assert boyut < 400 * 1024, boyut
    assert sum(1 for a in g["aylik"] if a["kod"] == "MEVDUAT") <= 15, "haftalık/günlük seri aya indirgenir"
