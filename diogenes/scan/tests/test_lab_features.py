"""2026-10-18: kapanışta alınan işlemde "giriş günü açılış boşluğu" ertesi sabahın boşluğu olarak hesaplanıyordu (alım anında
bilinmeyen, geleceğe ait veri) — ders filtreleri bu yüzden kazananları seçiyordu. Özellik yalnız girişte bilinen veriden kurulmalı."""
from types import SimpleNamespace

import numpy as np
import pandas as pd

import lab

IDX = pd.date_range("2026-10-12", periods=3, freq="B")


def panel():
    f = lambda v: pd.DataFrame({"AAA": v}, index=IDX)
    return SimpleNamespace(idx=IDX, O=f([100.0, 103.0, 110.0]), H=f([101.0, 104.0, 111.0]), L=f([99.0, 102.0, 109.0]),
                           C=f([100.0, 104.0, 108.0]), rs=f([1.0, 1.0, 1.0]), atrp=f([2.0, 2.0, 2.0]), rv=f([1.0, 1.0, 1.0]),
                           e20=f([100.0, 100.0, 100.0]))


def ozellik(t):
    s = pd.Series([True] * 3, index=IDX)
    return lab.features(panel(), t, s, s, {})


def test_kapanista_alimda_bosluk_sinyal_gununun_kendi_acilisi():
    t = dict(i=1, sym="AAA", sig=str(IDX[1].date()), entry_d=str(IDX[1].date()), entry=104.0, stop=97.0)
    assert round(ozellik(t)["gap"], 4) == round((103 / 100 - 1) * 100, 4)          # ertesi sabahın 110/104'ü değil


def test_acilista_alimda_bosluk_giris_sabahinin_acilisi():
    t = dict(i=1, sym="AAA", sig=str(IDX[1].date()), entry_d=str(IDX[2].date()), entry=110.0, stop=104.0)
    assert round(ozellik(t)["gap"], 4) == round((110 / 104 - 1) * 100, 4)          # alım o açılışta, boşluk görülerek yapılır


def test_bekleyen_sinyalde_bosluk_bilinmez():
    t = dict(i=2, sym="AAA", sig=str(IDX[2].date()), entry_d=None, entry=108.0, stop=100.0)
    assert np.isnan(ozellik(t)["gap"])


def test_connors_genis_stop_degiskeni_laboratuvarda():
    """2026-10-18 araştırma: Connors RSI(2)'yi stopsuz işletiyordu; dip alımında dar stop kazanma oranını düşürür.
    Laboratuvar aynı kuralı geniş stopla (%12, simülasyonun izin verdiği en geniş) ve 10 gün tutmayla sınar."""
    st = next(s for s in lab.STRATS if s["id"] == "connors_close_genis")
    assert st["fn"] is lab.S_connors_close_genis and "%12" in st["rules"]


def test_haftalik_stratejiler_laboratuvarda():
    """2026-10-18 (kullanıcı: haftalık işlem modeline geç): haftalık dönüş, haftalık momentum ve 52 hafta zirvesi
    stratejileri Cuma kapanışında sinyal, Pazartesi açılışta giriş, en çok bir hafta tutma kuralıyla sınanır."""
    ids = {s["id"] for s in lab.STRATS}
    assert {"haftalik_donus", "haftalik_momentum", "haftalik_zirve"} <= ids
    for i in ("haftalik_donus", "haftalik_momentum", "haftalik_zirve"):
        st = next(s for s in lab.STRATS if s["id"] == i)
        assert st["kind"] == "haftalık" and callable(st["fn"])


def test_haftalik_sinyal_yalniz_cuma():
    gun = pd.bdate_range("2025-01-06", periods=8)
    assert list(lab.cuma_maskesi(gun)) == [d.weekday() == 4 for d in gun]


def test_yuzde_12_stop_reddedilmez():
    """2026-10-26 hatası: (e - e*0.88)/e = 0.12000000000000001 > 0.12 sayılıyor, %12 stoplu işlemler (geniş stoplu RSI(2) ve
    haftalık stratejiler) sessizce düşüyordu; haftalık kitaplar hiç sinyal üretemedi."""
    idx = pd.date_range("2026-10-12", periods=4, freq="B")
    f = lambda v: pd.DataFrame({"AAA": v}, index=idx)
    p = SimpleNamespace(idx=idx, O=f([100.0, 101.0, 102.0, 103.0]), H=f([101.0, 102.0, 103.0, 104.0]),
                        L=f([99.0, 100.0, 101.0, 102.0]), C=f([100.0, 101.5, 102.5, 103.5]))
    t = lab.sim_daily(p, "AAA", 0, "open", stop=lambda e, j: e * 0.88, max_hold=2)
    assert t is not None and t["entry"] == 101.0


def test_hafta_ozeti_haftalik_bekleyen_sinyallerden():
    """2026-10-26: ana ekran için küçük 'haftanın seçimleri' özeti (lab.json 200 KB; ana ekran onu yüklemez)."""
    strat = [{"id": "haftalik_zirve_ders", "pending": [{"sym": "AAA", "sig": "2026-10-23", "entry": 10.0, "stop": 8.8}]},
             {"id": "haftalik_momentum", "pending": [{"sym": "BBB", "sig": "2026-10-23", "entry": 20.0, "stop": 17.6},
                                                    {"sym": "AAA", "sig": "2026-10-23", "entry": 10.0, "stop": 8.8}]},
             {"id": "bnf_ders", "pending": [{"sym": "CCC", "sig": "2026-10-23", "entry": 5.0, "stop": 4.5}]}]
    o = lab.hafta_ozeti(strat)
    assert o["sinyal"] == "2026-10-23"
    assert [(a["sym"], a["kitap"]) for a in o["adaylar"]] == [("AAA", "hzirve"), ("BBB", "hmom")]   # aynı hisse bir kez
    assert lab.hafta_ozeti([])["adaylar"] == []


def test_tatil_gunleri_veriden_atilir():
    """2026-10-26 hatası: indirilen günlük veride ABD tatil günleri (25 Mayıs, 7 Eylül) neredeyse tamamen boş satır olarak
    duruyordu; yalnız sondaki boş satır atılıyordu. Aradaki boş satır 50/200 günlük ortalamayı 50/200 gün boyunca NaN
    yaptı → 200 günlüğe bakan bütün stratejiler Mayıs sonundan beri sinyal üretmedi."""
    gun = pd.bdate_range("2026-05-20", periods=6)
    sutun = pd.MultiIndex.from_product([["AAA", "BBB", "CCC"], ["Open", "Close"]])
    d1 = pd.DataFrame(1.0, index=gun, columns=sutun)
    d1.iloc[2] = np.nan                       # tatil: bütün hisseler boş
    d1.iloc[2, 0:2] = 5.0                     # yalnız bir sembol dolu (ör. endeks)
    d1.iloc[5] = np.nan                       # sondaki yarım gün
    temiz = lab.bos_gunleri_at(d1)
    assert list(temiz.index) == [gun[0], gun[1], gun[3], gun[4]]
